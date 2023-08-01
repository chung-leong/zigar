import { createHash } from 'crypto';
import { exec } from 'child_process';
import { parse, join, resolve } from 'path';
import { tmpdir } from 'os';
import { stat, lstat, readdir, mkdir, rmdir, unlink, rename, chmod, utimes, readFile, writeFile, open } from 'fs/promises';

const cwd = process.cwd();

export async function settings(options) {
  Object.assign(defaults, options);
}

export async function compile(path, options = {}) {
  const {
    optimize = 'Debug',
    clean = false,
    target = '',
    buildDir = tmpdir(),
    cacheDir = join(cwd, 'zig-cache'),
    zigCmd = `zig build -Doptimize=${optimize}`,
  } = options;
  const fullPath = resolve(path);
  const rootFile = parse(fullPath);
  const prefix = (target === 'wasm') ? 'wasm' : 'cpp';
  const config = {
    target,
    packageName: rootFile.name,
    packagePath: fullPath,
    exporterPath: absolute(`../zig/${prefix}-exporter.zig`),
    stubPath: absolute(`../zig/${prefix}-stub.zig`),
    buildFilePath: absolute(`../zig/build.zig`),
    useLibC: false,
  };
  const soName = (target === 'wasm') ? `${rootFile.name}.wasm` : `lib${rootFile.name}.so`;
  const soPath = join(cacheDir, soName);
  const soMTime = (await find(soPath))?.mtime;
  if (!buildDir || !cacheDir || !zigCmd) {
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
  let changed = false;
  await walk(rootFile.dir, /\.(zig|c|cc|cpp|h|hh)$/i, (dir, name, { mtime }) => {
    if (dir === rootFile.dir && name === rootFile.name + '.build.zig') {
      config.buildFilePath = join(dir, name);
    }
    if (!/\.zig$/.test(name)) {
      config.useLibC = true;
    }
    if (!(soMTime > mtime)) {
      changed = true;
    }
  });
  if (process.env.NODE_ENV !== 'production') {
    if (!changed) {
      const { pathname } = new URL('../zig', import.meta.url);
      // rebuild when source files have changed
      await walk(pathname, /\.zig$/i, (dir, name, { mtime }) => {
        if (!(soMTime > mtime)) {
          changed = true;
        }
      });
    }
  }
  // recompile if options are different
  const optPath = soPath + '.json';
  const optString = JSON.stringify({ zigCmd }, undefined, 2);
  const prevOptString = await load(optPath, '');
  if (prevOptString !== optString) {
    changed = true;
  }

  // build in a unique temp dir
  const soBuildDir = join(buildDir, await md5(fullPath), target);
  const logPath = join(soBuildDir, 'log');
  const pidPath = join(soBuildDir, 'pid');
  if (!changed) {
    return soPath;
  }
  let done = false, errorLog;
  while (!done) {
    await mkdirp(soBuildDir);
    if (await writePID(pidPath)) {
      await createProject(config, soBuildDir);
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
          await writeFile(optPath, optString);
        }
      } finally {
        if (clean) {
          await rimraf(soBuildDir);
        } else {
          await unlink(pidPath);
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

async function createProject(config, dir) {
  let target = '.{}';
  switch (config.target) {
    case 'wasm':
      target = '.{ .cpu_arch = .wasm32, .os_tag = .freestanding }';
      break;
  }
  const lines = [];
  lines.push(`const std = @import("std");\n`);
  lines.push(`pub const target: std.zig.CrossTarget = ${target};`);
  lines.push(`pub const package_name = ${JSON.stringify(config.packageName)};`);
  lines.push(`pub const package_path = ${JSON.stringify(config.packagePath)};`);
  lines.push(`pub const exporter_path = ${JSON.stringify(config.exporterPath)};`);
  lines.push(`pub const stub_path = ${JSON.stringify(config.stubPath)};`);
  lines.push(`pub const use_libc = ${config.useLibC ? true : false};`);
  lines.push(``);
  const content = lines.join('\n');
  const cfgFilePath = join(dir, 'build-cfg.zig');
  await writeFile(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  await copy(config.buildFilePath, buildFilePath);
}

async function move(srcPath, dstPath) {
  try {
    await rename(srcPath, dstPath);
  } catch (err) {
    if (err.code == 'EXDEV') {
      await copy(srcPath, dstPath);
      await unlink(srcPath);
    } else {
      throw err;
    }
  }
}

async function copy(srcPath, dstPath) {
  const info = await stat(srcPath);
  const data = await readFile(srcPath);
  await writeFile(dstPath, data);
  await chmod(dstPath, info.mode);
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
