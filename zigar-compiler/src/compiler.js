import { exec, execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import os, { tmpdir } from 'os';
import { basename, join, parse, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  acquireLock, acquireLockSync, copyFile, copyFileSync, deleteDirectory, deleteDirectorySync,
  findFile, findFileSync, findMatchingFiles, findMatchingFilesSync, loadFile, loadFileSync, md5,
  releaseLock, releaseLockSync
} from './utility-functions.js';

export async function compile(srcPath, soPath, options) {
  const srcInfo = await findFile(srcPath);
  if (!srcInfo) {
    throw new Error(`Source file not found: ${srcPath}`);
  }
  const soInfo = await findFile(soPath);
  const config = createConfig(srcPath, srcInfo, soPath, soInfo, options);
  const srcFileMap = await findMatchingFiles(config.packageRoot, /\.(zig|zon)$/);
  let changed = false;
  // see if the (re-)compilation is necessary
  if (soInfo) {
    for (const [ name, info ] of srcFileMap) {
      if (info.mtime > soInfo.mtime) {
        changed = true;
        break;
      }
    }
  } else {
    changed = true;
  }
  if (!changed) {
    // rebuild when exporter or build files have changed
    const zigFolder = absolute('../zig');
    const zigFileMap = await findMatchingFiles(zigFolder, /\.zig$/);
    for (const [ name, info ] of zigFileMap) {
      if (info.mtime > soInfo.mtime) {
        changed = true;
        break;
      }
    }
  }
  if (!changed) {
    return false;
  }
  // see if C library is needed
  if (!config.useLibC && !srcInfo.isDirectory()) {
    for (const [ path, info ] of srcFileMap) {
      const content = await loadFile(path);
      if (content.includes('@cImport')) {
        config.useLibC = true;
        break;
      }
    }
  }
  // add custom build file
  for (const [ path, info ] of srcFileMap) {
    switch (basename(path)) {
      case 'build.zig':
        config.buildFilePath = path;
        break;
      case 'build.zig.zon':
        config.packageConfigFilePath = path;
        break;
    }
  }
  // build in a unique temp dir
  const soBuildDir = getBuildFolder(config);
  const soBuildCmd = getBuildCommand(config);
    // only one process can compile a given file at a time
  await acquireLock(soBuildDir, config.staleTime);
  try {
    // create config file
    await createProject(config, soBuildDir);
    // then run the compiler
    await runCompiler(soBuildCmd, soBuildDir);
  } finally {
    await releaseLock(soBuildDir);
    if (config.clean) {
      await deleteDirectory(soBuildDir);
    }
  }
  return true;
}

export function compileSync(srcPath, soPath, options) {
  const srcInfo = findFileSync(srcPath);
  if (!srcInfo) {
    throw new Error(`Source file not found: ${srcPath}`);
  }
  const soInfo = findFileSync(soPath);
  const config = createConfig(srcPath, srcInfo, soPath, soInfo, options);
  const srcFileMap = findMatchingFilesSync(config.packageRoot, /\.(zig|zon)$/);
  let changed = false;
  // see if the (re-)compilation is necessary
  if (soInfo) {
    for (const [ path, info ] of srcFileMap) {
      if (info.mtime > soInfo.mtime) {
        changed = true;
        break;
      }
    }
  } else {
    changed = true;
  }
  if (!changed) {
    // rebuild when exporter or build files have changed
    const zigFolder = absolute('../zig');
    const zigFileMap = findMatchingFilesSync(zigFolder, /\.zig$/);
    for (const [ path, info ] of zigFileMap) {
      if (info.mtime > soInfo.mtime) {
        changed = true;
        break;
      }
    }
  }
  if (!changed) {
    return false;
  }
  // see if C library is needed
  if (!config.useLibC && !srcInfo.isDirectory()) {
    for (const [ path, info ] of srcFileMap) {
      const content = loadFileSync(path);
      if (content.includes('@cImport')) {
        config.useLibC = true;
        break;
      }
    }
  }
  // add custom build file
  for (const [ path, info ] of srcFileMap) {
    switch (basename(path)) {
      case 'build.zig':
        config.buildFilePath = path;
        break;
      case 'build.zig.zon':
        config.packageConfigFilePath = path;
        break;
    }
  }
  // build in a unique temp dir
  const soBuildDir = getBuildFolder(config);
  const soBuildCmd = getBuildCommand(config);
    // only one process can compile a given file at a time
  acquireLockSync(soBuildDir, config.staleTime);
  try {
    // create config file
    createProjectSync(config, soBuildDir);
    // then run the compiler
    runCompilerSync(soBuildCmd, soBuildDir);
  } finally {
    releaseLockSync(soBuildDir);
    if (config.clean) {
      deleteDirectorySync(soBuildDir);
    }
  }
  return true;
}

export function getBuildCommand(config) {
  const { arch, platform, nativeCpu, optimize, zigCmd } = config;
  if (zigCmd) {
    return zigCmd;
  }
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
  const cpuArch = cpuArchs[arch] ?? arch;
  const osTag = osTags[platform] ?? platform;
  const target = `${nativeCpu ? 'native' : cpuArch}-${osTag}`;
  return `zig build -Dtarget=${target} -Doptimize=${optimize}`;
}

export function getBuildFolder(config) {
  const { packageName, packageRoot, buildDir } = config;
  const soBuildPrefix = basename(packageName).slice(0, 16);
  const soBuildHash = md5(`${packageRoot}/${packageName}`).slice(0, 8);
  return join(buildDir, soBuildPrefix + '-' + soBuildHash);
}

export function createConfig(srcPath, srcInfo, soPath, soInfo, options) {
  const {
    platform = os.platform(),
    arch = os.arch(),
    nativeCpu = false,
    optimize = 'Debug',
    clean = false,
    buildDir = join(tmpdir(), 'zigar-build'),
    staleTime = 60000,
    zigCmd,
  } = options;
  const suffix = /^wasm(32|64)$/.test(arch) ? 'wasm' : 'c';
  const src = parse(srcPath);
  const so = parse(soPath);
  return {    
    platform,
    arch,
    optimize,
    nativeCpu,
    packageName: so.name,
    packagePath: srcInfo.isDirectory() ? undefined : srcPath,
    packageRoot: srcInfo.isDirectory() ? srcPath : src.dir,
    exporterPath: absolute(`../zig/exporter-${suffix}.zig`),
    stubPath: absolute(`../zig/stub-${suffix}.zig`),
    buildDir,
    buildFilePath: absolute(`../zig/build.zig`),
    outputPath: soPath,
    packageConfigFilePath: undefined,
    useLibC: (platform === 'win32') ? true : false,
    clean,
    staleTime,
    zigCmd,
  };
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
          writeFile(logPath, log);
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
    const log = err.stderr;
    if (log) {
      const logPath = join(soBuildDir, 'log');
      writeFileSync(logPath, log);
    }
    throw new Error(`Zig compilation failed\n\n${log}`);
  }
}

export function formatProjectConfig(config) {
  const lines = [];
  lines.push(`pub const package_name = ${JSON.stringify(config.packageName)};`);
  lines.push(`pub const package_path = ${JSON.stringify(config.packagePath)};`);
  lines.push(`pub const package_root = ${JSON.stringify(config.packageRoot)};`);
  lines.push(`pub const exporter_path = ${JSON.stringify(config.exporterPath)};`);
  lines.push(`pub const output_path = ${JSON.stringify(config.outputPath)};`);
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
  if (config.packageConfigFilePath) {
    const packageConfigFilePath = join(dir, 'build.zig.zon');
    await copyFile(config.packageConfigFilePath, packageConfigFilePath);
  }
}

export function createProjectSync(config, dir) {
  const content = formatProjectConfig(config);
  const cfgFilePath = join(dir, 'build-cfg.zig');
  writeFileSync(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  copyFileSync(config.buildFilePath, buildFilePath);
  if (config.packageConfigFilePath) {
    const packageConfigFilePath = join(dir, 'build.zig.zon');
    copyFileSync(config.packageConfigFilePath, packageConfigFilePath);
  }
}

function absolute(relpath) {
  // import.meta.url don't always yield the right URL when transpiled to CommonJS
  // just use __dirname as it's going to be there
  /* c8 ignore next 2 */
  if (typeof(__dirname) === 'string') {
    return resolve(__dirname, relpath);
  } else {
    return fileURLToPath(new URL(relpath, import.meta.url));
  }
}
