import { execSync } from 'child_process';
import {
  chmodSync, closeSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmdirSync,
  statSync, unlinkSync, utimesSync, writeFileSync, writeSync
} from 'fs';
import os, { tmpdir } from 'os';
import { join, parse, resolve } from 'path';
import {
  absolute, formatProjectConfig, getBuildFolder, getLibraryName, isWASM, md5,
} from './compiler.js';

const cwd = process.cwd();

export function compileSync(path, options = {}) {
  const {
    optimize = 'Debug',
    clean = false,
    platform = os.platform(),
    arch = os.arch(),
    nativeCpu = false,
    buildDir = tmpdir(),
    cacheDir = join(cwd, 'zigar-cache'),
    zigCmd = `zig build -Doptimize=${optimize}`,
    staleTime = 60000,
  } = options;
  const fullPath = resolve(path);
  const rootFile = parse(fullPath);
  const suffix = isWASM(arch) ? 'wasm' : 'c';
  const config = {
    platform,
    arch,
    nativeCpu,
    packageName: rootFile.name,
    packagePath: fullPath,
    packageRoot: rootFile.dir,
    exporterPath: absolute(`../zig/exporter-${suffix}.zig`),
    stubPath: absolute(`../zig/stub-${suffix}.zig`),
    buildFilePath: absolute(`../zig/build.zig`),
    useLibC: (platform === 'win32') ? true : false,
  };
  const dirHash = md5(rootFile.dir);
  const soName = getLibraryName(rootFile.name, platform, arch);
  const soDir = join(cacheDir, platform, arch, optimize, dirHash);
  const soPath = join(soDir, soName);
  const soMTime = findFileSync(soPath)?.mtime;
  if (!buildDir || !cacheDir || !zigCmd) {
    // can't build when no command or build directory is set to empty
    if (soMTime) {
      return soPath;
    } else {
      throw new Error(`Cannot find shared library and compilation is disabled: ${soPath}`);
    }
  }
  if (!findFileSync(fullPath)) {
    throw new Error(`Source file not found: ${fullPath}`);
  }
  // scan the dir containing the file to see if recompilation is necessary
  // also check if there's a custom build file and for C dependency
  let changed = false;
  scanDirectorySync(rootFile.dir, /\.zig$/i, (dir, name, { mtime }) => {
    if (dir === rootFile.dir && name === 'build.zig') {
      config.buildFilePath = join(dir, name);
    }
    if (!config.useLibC) {
      const content = loadFileSync(join(dir, name));
      if (content.includes('@cImport')) {
        config.useLibC = true;
      }
    }
    if (!(soMTime > mtime)) {
      changed = true;
    }
  });
  if (!changed) {
    const zigFolder = absolute('../zig');
    // rebuild when source files have changed
    scanDirectorySync(zigFolder, /\.zig$/i, (dir, name, { mtime }) => {
      if (!(soMTime > mtime)) {
        changed = true;
      }
    });
  }
  if (!changed) {
    return soPath;
  }
  // build in a unique temp dir
  const soBuildDir = getBuildFolder(fullPath, platform, arch);
  // only one process can compile a given file at a time
  acquireLockSync(soBuildDir, staleTime);
  try {
    // create config file
    createProjectSync(config, soBuildDir);
    // then run the compiler
    runCompilerSync(zigCmd, soBuildDir);
    // move library to cache directory
    const libPath = join(soBuildDir, 'zig-out', 'lib', soName);
    createDirectorySync(soDir);
    moveFileSync(libPath, soPath);
    touchFileSync(soPath);
  } finally {
    releaseLockSync(soBuildDir);
    if (clean) {
      deleteDirectorySync(soBuildDir);
    }
  }
  return soPath;
}

export function runCompilerSync(zigCmd, soBuildDir) {
  const options = {
    cwd: soBuildDir,
    windowsHide: true,
    stdio: 'pipe',
  };
  try {
    execSync(zigCmd, options);
  } catch (err) {
    const log = err.stderr ?? '';
    if (log) {
      const logPath = join(soBuildDir, 'log');
      try {
        writeFileSync(logPath, log);
      } catch (_) {         
      }
    }
    throw new Error(`Zig compilation failed\n\n${log}`);
  }
}

export function findFileSync(path, follow = true) {
  try {
    return follow ? statSync(path) : lstatSync(path);
  } catch (err) {
  }
}

export function scanDirectorySync(dir, re, cb) {
  const ino = findFileSync(dir)?.ino;
  /* c8 ignore next 3 */
  if (!ino) {
    return;
  }
  const scanned = [ ino ];
  const scan = (dir) => {
    try {
      const list = readdirSync(dir);
      for (const name of list) {
        if (name.startsWith('.') || name === 'node_modules' || name === 'zig-cache') {
          continue;
        }
        const path = join(dir, name);
        const info = findFileSync(path);
        if (info?.isDirectory() && !scanned.includes(info.ino)) {
          scan(path);
        } else if (info?.isFile() && re.test(name)) {
          cb(dir, name, info);
        }
      }
      /* c8 ignore next 2 */
    } catch (err) {
    }
  };
  scan(dir);
}

export function acquireLockSync(soBuildDir, staleTime) {
  const pidPath = join(soBuildDir, 'pid');
  while (true)   {
    try {
      createDirectorySync(soBuildDir);
      const handle = openSync(pidPath, 'wx');
      writeSync(handle, `${process.pid}`);
      closeSync(handle);
      return;
    } catch (err) {
      if (err.code === 'EEXIST') {
        const last = findFileSync(pidPath)?.mtime;
        const now = new Date();
        const diff = now - last;
        if (diff > staleTime) {
          // lock file has been abandoned
          deleteFileSync(pidPath);
          continue;
        }
      } else {
        throw err;
      }
    }
    delaySync(50);
  }
}

export function releaseLockSync(soBuildDir) {
  const pidPath = join(soBuildDir, 'pid');
  deleteFileSync(pidPath);
}

export function createProjectSync(config, dir) {
  const content = formatProjectConfig(config);
  const cfgFilePath = join(dir, 'build-cfg.zig');
  writeFileSync(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  copyFileSync(config.buildFilePath, buildFilePath);
}

export function moveFileSync(srcPath, dstPath) {
  try {
    renameSync(srcPath, dstPath);
    /* c8 ignore next 8 -- hard to test */
  } catch (err) {
    if (err.code == 'EXDEV') {
      copyFileSync(srcPath, dstPath);
      deleteFileSync(srcPath);
    } else {
      throw err;
    }
  }
}

export function copyFileSync(srcPath, dstPath) {
  const info = statSync(srcPath);
  const data = readFileSync(srcPath);
  writeFileSync(dstPath, data);
  chmodSync(dstPath, info.mode);
}

export function loadFileSync(path, def) {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    return def;
  }
}

export function touchFileSync(path) {
  const now = new Date();
  utimesSync(path, now, now);
}

export function deleteFileSync(path) {
  try {
    unlinkSync(path);
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
      throw err;
    }
  }
}

export function createDirectorySync(path) {
  const exists = findDirectorySync(path);
  if (!exists) {
    const { root, dir } = parse(path);
    createDirectorySync(dir);
    try {
      mkdirSync(path);
    } catch (err) {
      /* c8 ignore next 3 */
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
  }
}

export function findDirectorySync(path) {
  return findFileSync(path);
}

export function deleteDirectorySync(dir) {
  try {
    const list = readdirSync(dir);
    for (const name of list) {
      const path = join(dir, name);
      const info = findFileSync(path, false);
      if (info?.isDirectory()) {
        deleteDirectorySync(path);
      } else if (info) {
        deleteFileSync(path);
      }
    }
    rmdirSync(dir);
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
      throw err;
    }
  }
}

export function delaySync(ms) {
  try {
    const options = {
      windowsHide: true,
      input: `setTimeout(() => {}, ${ms})`,
      stdio: 'pipe',
    };
    execSync(`node`, options);
  } catch (err) {    
    console.log(err);
  }
}