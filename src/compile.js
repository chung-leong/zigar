import { parse, join, resolve } from 'path';
import { tmpdir } from 'os';
import { stat, lstat, readdir, mkdir, rmdir, unlink, rename, chmod, utimes, readFile, writeFile, open } from 'fs/promises';

const { env } = process;
const defaults = {
  buildDir: env.NODE_ZIG_BUILD_DIR ?? tmpdir(),
  cacheDir: env.NODE_ZIG_CACHE_DIR ?? join(process.cwd(), 'zig-cache'),
  zigCmd: env.NODE_ZIG_BUILD_CMD ?? (env.NODE_ENV === 'production') ? 'zig build -Doptimize=ReleaseFast' : 'zig build',
  cleanUp: env.NODE_ZIG_CLEAN_UP ?? (env.NODE_ENV === 'production') ? '1' : '',
};

export async function settings(options) {
  Object.assign(defaults, options);
}

export async function compile(path, options = {}) {
  const {
    buildDir,
    cacheDir,
    zigCmd,
    cleanUp,
  } = { ...defaults, ...options };
  const fullPath = resolve(path);
  const rootFile = parse(fullPath);
  const soName = `lib${rootFile.name}.so`;
  const soPath = join(cacheDir, soName);
  const soMTime = (await find(soPath))?.mtime;
  if (!buildDir || !cacheDir) {
    // can't build when no command or build directory is set to empty
    if (soMTime) {
      return soPath;
    } else {
      throw new Error(`Cannot find shared library and compilation is disabled: ${soPath}`);
    }
  }
  if (!find(fullPath)) {
    throw new Error(`Source file not found: ${fullPath}`);
  }
  // scan the dir containing the file to see if recompilation is necessary
  // also check if there's a custom build file and for C dependency
  const customBuildFileName = rootFile.name + '.build.zig';
  let custom = false, changed = false, dependent = false;
  await walk(rootFile.dir, /\.(zig|c|cc|cpp|h|hh)$/i, (dir, name, { mtime }) => {
    if (dir === rootFile.dir && name === customBuildFileName) {
      custom = true;
    }
    if (!(soMTime > mtime)) {
      changed = true;
    }
    if (!/\.zig$/.test(name)) {
      dependent = true;
    }
  });
  if (!changed) {
    const { pathname } = new URL('../zig', import.meta.url);
    await walk(pathname, /\.zig$/i, (dir, name, { mtime }) => {
      if (!(soMTime > mtime)) {
        changed = true;
      } 
    });
  }
  // build in a unique temp dir
  const soBuildDir = join(buildDir, await md5(fullPath));
  const logPath = join(soBuildDir, 'log');
  const cmdPath = join(soBuildDir, 'cmd');
  const pidPath = join(soBuildDir, 'pid');
  // if there's an existing build folder, use it only if the command used to create it is the same
  const prevCmd = await load(cmdPath, '');
  if (prevCmd && prevCmd !== zigCmd) {
    if (await writePID(pidPath)) {
      await rimraf(soBuildDir);
      changed = true;
    }
  }
  if (!changed) {
    return soPath;
  }
  let done = false, errorLog;
  while (!done) {
    await mkdirp(soBuildDir);
    if (await writePID(pidPath)) {
      await createProject({
        'stub.zig': `./stub.zig`,
        'build.zig': `./build${dependent ? '-clib' : ''}.zig`,
      }, {
        EXPORTER_PATH: absolute('./export.zig'),
        PACKAGE_PATH: fullPath,
        PACKAGE_NAME: rootFile.name,
      }, soBuildDir);
      const { exec } = await import('child_process');
      const options = {
        cwd: soBuildDir,
        windowsHide: true,
      };
      const success = await new Promise((resolve) => {
        exec(zigCmd, options, (err, stdout, stderr) => {
          if (err) {
            errorLog = stderr || '[NO OUTPUT]';
            resolve(false);
            writeFile(logPath, errorLog).catch(() => {});
          } else {
            resolve(true);
          }
        });
      });
      try {
        if (success) {
          const libPath = join(soBuildDir, 'zig-out', 'lib', soName);
          await mkdirp(cacheDir);
          await move(libPath, soPath);
        }
      } finally {
        if (cleanUp) {
          await rimraf(soBuildDir);
        } else {
          await unlink(pidPath);
          await writeFile(cmdPath, zigCmd);
        }
      }
      done = true;
    } else {
      // perhaps another process is compiling the same file--wait for it to finish
      if (await monitor(soBuildDir)) {
        // pidfile has vanished--see if the shared library has been updated
        const newMTime = (await find(soPath))?.mtime;
        if (!(newMTime && newMTime !== soMTime)) {
          errorLog = await load(logPath, '[ERROR LOG NOT FOUND]');
        }
        done = true;
      } else {
        // remove the stale folder
        await rimraf(soBuildDir);
      }
    }  
  }
  if (errorLog) {
    throw new Error(`Zig compilation failed\n\n${errorLog}`);
  }
  return soPath;
}

async function find(path, follow = true) {
  try {
    return await (follow ? stat(path) : lstat(path));
  } catch (err) {
  }
}

async function walk(dir, re, cb) {
  const ino = (await find(dir))?.ino;
  if (!ino) {
    return;
  }
  const scanned = [ ino ];
  const scan = async (dir) => {
    try {
      const list = await readdir(dir);
      for (const name of list) {
        if (name.startsWith('.') || name === 'node_modules' || name === 'zig-cache') {
          continue;
        }
        const path = join(dir, name);
        const info = await find(path);
        if (info?.isDirectory() && !scanned.includes(info.ino)) {
          await scan(path);
        } else if (info?.isFile() && re.test(name)) {
          cb(dir, name, info);
        }
      }
    } catch (err) {
    }
  };  
  await scan(dir);
}

async function monitor(path) {
  while (true) {
    const mtime = (await find(path)).mtime;
    if (!mtime) {
      // pidfile has been removed
      return true;
    } else if (new Date() - mtime > 2500) {
      // pidfile's been abandoned
      return false;
    }
    await delay(500);
  }
}

async function writePID(path) {
  try {
    const handle = await open(path, 'wx');
    handle.write(`${process.pid}`);
    handle.close();
    return true;
  } catch (err) {
    if (err.code == 'EEXIST') {
      return false;
    } else {
      throw err;
    }
  }
}

async function createProject(fileMap, vars, dir) {
  for (const [ name, src ] of Object.entries(fileMap)) {
    const path = absolute(src);
    const destPath = join(dir, name);
    let s = await readFile(path, 'utf8');
    s = s.replace(/"\${(\w+)}"/g, (m0, m1) => JSON.stringify(vars[m1] ?? m1));
    s = s.replace(/\${(\w+)}/g, (m0, m1) => vars[m1] ?? m1);
    await writeFile(destPath, s);
  }
}

async function move(srcPath, dstPath) {
  try {
    await rename(srcPath, dstPath);
  } catch (err) {
    if (err.code == 'EXDEV') {
      const info = await stat(srcPath);
      const data = await readFile(srcPath);
      await writeFile(dstPath, data);
      await chmod(dstPath, info.mode);
      await unlink(srcPath);
    } else {
      throw err;
    }
  }  
}

async function load(path, def) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    return def;
  }
}

async function touch(path) {
  try {
    const now = new Date();
    await utimes(path, now, now);
  } catch (err) {    
  }
}

async function md5(text) {
  const { createHash } = await import('crypto');
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

async function mkdirp(path) {
  const exists = await find(path);
  if (!exists) {
    const { root, dir } = parse(path);
    await mkdirp(dir);
    await mkdir(path);
  }
}

async function rimraf(dir) {
  const remove = async (dir) => {
    const list = await readdir(dir);
    for (const name of list) {
      const path = join(dir, name);
      const info = await find(path, false);
      if (info?.isDirectory()) {
        await remove(path);
      } else if (info) {
        await unlink(path);
      }
    }
    await rmdir(dir);
  };  
  await remove(dir); 
}

async function delay(ms) {
  await new Promise(r => setTimeout(r, ms));
}

function absolute(relpath) {
  return (new URL(relpath, import.meta.url)).pathname;
}
