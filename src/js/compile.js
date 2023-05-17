import { parse, join, resolve } from 'path';
import { tmpdir } from 'os';
import { stat, lstat, readdir, mkdir, rmdir, unlink, readFile, writeFile } from 'fs/promises';

const { env } = process;

var buildDir = env.NODE_ZIG_BUILD_DIR ?? tmpdir();
var cacheDir = env.NODE_ZIG_CACHE_DIR ?? join(process.cwd(), 'zig-cache');
var zigCmd = env.NODE_ZIG_BUILD_CMD ?? (env.NODE_ENV === 'production') ? 'zig build' : 'zig build -O ReleaseFast';

export async function compile(path) {
  const fullPath = resolve(path);
  const rootFile = parse(fullPath);
  const soName = rootFile.base + '.so';
  const soPath = join(cacheDir, soName);
  const soMTime = (await find(soPath))?.mtime;
  const noBuilding = !buildDir || !cacheDir;
  if (soMTime && noBuilding) {
    return soPath;
  }
  if (!find(fullPath)) {
    throw new Error(`Source file not found: ${fullPath}`);
  }
  // scan the dir containing the file to see if recompilation is necessary
  // also check if there's a custom build file and for C dependency
  const customBuildFileName = rootFile.name + '.build.zig';
  var custom = false, changed = false, dependent = false;
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
    return soPath;
  }
  // build in a unique temp dir
  const hash = await md5(fullPath);
  await mkdirp(buildDir);
  const soBuildDir = join(buildDir, hash);
  const logPath = join(buildDir, hash + '.log');
  var errorLog;
  while (!errorLog) {
    try {
      await mkdir(soBuildDir);
      const vars = {
        EXPORTER_PATH: absolute('../zig/export.zig'),
        PACKAGE_PATH: fullPath,
        PACKAGE_NAME: rootFile.name,
        LIBRARY_PATH: soPath,
      };
      await create('../zig/stub.zig', soBuildDir, vars);
      await create('../zig/build.zig', soBuildDir, vars);
      break;
    } catch (err) {
      if (err.code != 'EEXIST') {
        throw err;
      }
      // perhaps another process is compiling the same file
      // wait for it to finish
      if (await monitor(soBuildDir)) {
        // the folder has vanished, see if the shared library has been updated
        const soNewMTime = (await find(soPath))?.mtime;
        if (!(soNewMTime && soNewMTime !== soMTime)) {
          return soPath;
        } else {
          errorLog = await load(logPath);
        }
      } else {
        await rimraf(soBuildDir);
      }
    }  
  }
  if (errorLog) {
    throw new Error(`Compilation of Zig code failed\n\n${errorLog}`);
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

async function monitor(dir) {
  while (true) {
    const mtime = (await find(dir)).mtime;
    if (!mtime) {
      // folder has been removed
      return true;
    } else if (new Date() - mtime > 5000) {
      // folder's been abandoned
      return false;
    }
    await delay(1000);
  }
}

async function create(relpath, dir, vars) {
  const path = absolute(relpath);
  const { base } = parse(path);
  const destPath = join(dir, base);
  var s = await readFile(path, 'utf8');
  s = s.replace(/"\${(\w+)}"/g, (m0, m1) => JSON.stringify(vars[m1] ?? m1));
  s = s.replace(/\${(\w+)}/g, (m0, m1) => vars[m1] ?? m1);
  await writeFile(destPath, s);
}

function absolute(relpath) {
  return (new URL(relpath, import.meta.url)).pathname;
}

async function load(path, def) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    return def;
  }
}

async function md5(text) {
  const { createHash } = await import('crypto');
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

async function delay(ms) {
  await new Promise(r => setTimeout(r, ms));
}

async function mkdirp(path) {
  if (!find(path)) {
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
      console.log({ path, info });
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