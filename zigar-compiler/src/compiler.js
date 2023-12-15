import { createHash } from 'crypto';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { parse, join, resolve } from 'path';
import os, { tmpdir } from 'os';
import { stat, lstat, readdir, mkdir, rmdir, unlink, rename, chmod, utimes, readFile, writeFile, open } from 'fs/promises';

const cwd = process.cwd();

export async function compile(path, options = {}) {
  const {
    optimize = 'Debug',
    clean = false,
    platform = os.platform(),
    arch = os.arch(),
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
  const soMTime = (await findFile(soPath))?.mtime;
  if (!buildDir || !cacheDir || !zigCmd) {
    // can't build when no command or build directory is set to empty
    if (soMTime) {
      return soPath;
    } else {
      throw new Error(`Cannot find shared library and compilation is disabled: ${soPath}`);
    }
  }
  if (!await findFile(fullPath)) {
    throw new Error(`Source file not found: ${fullPath}`);
  }
  // scan the dir containing the file to see if recompilation is necessary
  // also check if there's a custom build file and for C dependency
  let changed = false;
  await scanDirectory(rootFile.dir, /\.zig$/i, async (dir, name, { mtime }) => {
    if (dir === rootFile.dir && name === 'build.zig') {
      config.buildFilePath = join(dir, name);
    }
    if (!config.useLibC) {
      const content = await loadFile(join(dir, name));
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
    await scanDirectory(zigFolder, /\.zig$/i, (dir, name, { mtime }) => {
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
  await acquireLock(soBuildDir, staleTime);
  try {
    // create config file
    await createProject(config, soBuildDir);
    // then run the compiler
    await runCompiler(zigCmd, soBuildDir);
    // move library to cache directory
    const libPath = join(soBuildDir, 'zig-out', 'lib', soName);
    await createDirectory(soDir);
    await moveFile(libPath, soPath);
    await touchFile(soPath);
  } finally {
    await releaseLock(soBuildDir);
    if (clean) {
      await deleteDirectory(soBuildDir);
    }
  }
  return soPath;
}

function isWASM(arch) {
  switch (arch) {
    case 'wasm32':
    case 'wasm64':
      return true;
    default:
      return false;
  }
}

export function getLibraryName(name, platform, arch) {
  switch (arch) {
    case 'wasm32':
    case 'wasm64':
      return `${name}.wasm`;
    default:
      switch (platform) {
        case 'darwin':
          return `lib${name}.dylib`;
        case 'win32': ;
          return `${name}.dll`;
        default:
          return `lib${name}.so`;
      }
  }
}

export function getBuildFolder(path, platform, arch) {
  const buildDir = tmpdir();
  const fullPath = resolve(path);
  return join(buildDir, md5(fullPath), platform, arch)
}

export async function runCompiler(zigCmd, soBuildDir) {
  const options = {
    cwd: soBuildDir,
    windowsHide: true,
  };
  return new Promise((resolve, reject) => {
    exec(zigCmd, options, (err, stdout, stderr) => {
      if (err) {
        const log = stderr;
        if (log) {
          const logPath = join(soBuildDir, 'log');
          writeFile(logPath, log).catch(() => {});
          err = new Error(`Zig compilation failed\n\n${log}`);
        }
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export async function findFile(path, follow = true) {
  try {
    return await (follow ? stat(path) : lstat(path));
  } catch (err) {
  }
}

export async function scanDirectory(dir, re, cb) {
  const ino = (await findFile(dir))?.ino;
  /* c8 ignore next 3 */
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
        const info = await findFile(path);
        if (info?.isDirectory() && !scanned.includes(info.ino)) {
          await scan(path);
        } else if (info?.isFile() && re.test(name)) {
          await cb(dir, name, info);
        }
      }
      /* c8 ignore next 2 */
    } catch (err) {
    }
  };
  await scan(dir);
}

export async function acquireLock(soBuildDir, staleTime) {
  const pidPath = join(soBuildDir, 'pid');
  while (true)   {
    try {
      await createDirectory(soBuildDir);
      const handle = await open(pidPath, 'wx');
      handle.write(`${process.pid}`);
      handle.close();
      return;
    } catch (err) {
      if (err.code === 'EEXIST') {
        const last = (await findFile(pidPath))?.mtime;
        const now = new Date();
        const diff = now - last;
        if (diff > staleTime) {
          // lock file has been abandoned
          await deleteFile(pidPath);
          continue;
        }
      } else {
        throw err;
      }
    }
    await delay(50);
  }
}

export async function releaseLock(soBuildDir) {
  const pidPath = join(soBuildDir, 'pid');
  await deleteFile(pidPath);
}

export async function createProject(config, dir) {
  // translate from names used by Node to those used by Zig
  const cpuArchs = {
    arm: 'arm',
    arm64: 'aarch64',
    ia32: 'x86',
    mips: 'mips',
    mipsel: 'mipsel',
    ppc: 'powerpc',
    ppc64: 'powerpc64',
    s390: undefined,
    s390x: 's390x',
    x64: 'x86_64',
  };
  const osTags = {
    aix: 'aix',
    darwin: 'macos',
    freebsd: 'freebsd',
    linux: 'linux',
    openbsd: 'openbsd',
    sunos: 'solaris',
    win32: 'windows',
  };
  const cpuArch = cpuArchs[config.arch] ?? config.arch;
  const osTag = osTags[config.platform] ?? config.platform;
  const target = `.{ .cpu_arch = .${cpuArch}, .os_tag = .${osTag} }`;
  const lines = [];
  lines.push(`const std = @import("std");\n`);
  lines.push(`pub const target: std.zig.CrossTarget = ${target};`);
  lines.push(`pub const package_name = ${JSON.stringify(config.packageName)};`);
  lines.push(`pub const package_path = ${JSON.stringify(config.packagePath)};`);
  lines.push(`pub const package_root = ${JSON.stringify(config.packageRoot)};`);
  lines.push(`pub const exporter_path = ${JSON.stringify(config.exporterPath)};`);
  lines.push(`pub const stub_path = ${JSON.stringify(config.stubPath)};`);
  lines.push(`pub const use_libc = ${config.useLibC ? true : false};`);
  lines.push(``);
  const content = lines.join('\n');
  const cfgFilePath = join(dir, 'build-cfg.zig');
  await writeFile(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  await copyFile(config.buildFilePath, buildFilePath);
}

export async function moveFile(srcPath, dstPath) {
  try {
    await rename(srcPath, dstPath);
    /* c8 ignore next 8 -- hard to test */
  } catch (err) {
    if (err.code == 'EXDEV') {
      await copyFile(srcPath, dstPath);
      await deleteFile(srcPath);
    } else {
      throw err;
    }
  }
}

export async function copyFile(srcPath, dstPath) {
  const info = await stat(srcPath);
  const data = await readFile(srcPath);
  await writeFile(dstPath, data);
  await chmod(dstPath, info.mode);
}

export async function loadFile(path, def) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    return def;
  }
}

export async function touchFile(path) {
  const now = new Date();
  await utimes(path, now, now);
}

export async function deleteFile(path) {
  try {
    await unlink(path);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

export async function createDirectory(path) {
  const exists = await findDirectory(path);
  if (!exists) {
    const { root, dir } = parse(path);
    await createDirectory(dir);
    try {
      await mkdir(path);
    } catch (err) {
      /* c8 ignore next 3 */
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
  }
}

export async function findDirectory(path) {
  return findFile(path);
}

export async function deleteDirectory(dir) {
  try {
    const list = await readdir(dir);
    for (const name of list) {
      const path = join(dir, name);
      const info = await findFile(path, false);
      if (info?.isDirectory()) {
        await deleteDirectory(path);
      } else if (info) {
        await deleteFile(path);
      }
    }
    await rmdir(dir);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

function md5(text) {
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

async function delay(ms) {
  await new Promise(r => setTimeout(r, ms));
}

function absolute(relpath) {
  return fileURLToPath(new URL(relpath, import.meta.url));
}
