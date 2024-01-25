import { exec, execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import os, { tmpdir } from 'os';
import { join, parse, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  acquireLock, acquireLockSync, copyFile, copyFileSync, createDirectory, createDirectorySync,
  deleteDirectory, deleteDirectorySync, findFile, findFileSync,
  loadFile, loadFileSync, md5, moveFile, moveFileSync, releaseLock, releaseLockSync,
  scanDirectory, scanDirectorySync, touchFile, touchFileSync,
} from './utility-functions.js';

const cwd = process.cwd();

export async function compile(path, options = {}) {
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

export function isWASM(arch) {
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

export function formatProjectConfig(config) {
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
  const cpuModel = (config.nativeCpu) ? 'native' : 'baseline';
  const osTag = osTags[config.platform] ?? config.platform;
  const target = `.{ .cpu_arch = .${cpuArch}, .cpu_model = .${cpuModel}, .os_tag = .${osTag} }`;
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
  return lines.join('\n');
}

export async function createProject(config, dir) {
  const content = formatProjectConfig(config);
  const cfgFilePath = join(dir, 'build-cfg.zig');
  await writeFile(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  await copyFile(config.buildFilePath, buildFilePath);
}

export function createProjectSync(config, dir) {
  const content = formatProjectConfig(config);
  const cfgFilePath = join(dir, 'build-cfg.zig');
  writeFileSync(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  copyFileSync(config.buildFilePath, buildFilePath);
}

function absolute(relpath) {
  return fileURLToPath(new URL(relpath, import.meta.url));
}
