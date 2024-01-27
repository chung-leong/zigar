import { exec, execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import os, { tmpdir } from 'os';
import { basename, dirname, join, parse } from 'path';
import { fileURLToPath } from 'url';
import { getPlatformExt } from './configuration.js';
import {
  acquireLock, copyFile, copyFileSync, createDirectory, deleteDirectory, findFile,
  findMatchingFiles, loadFile, md5, moveFile, releaseLock, touchFile
} from './utility-functions.js';

export async function compile(srcPath, soPath, options = {}) {
  const {
    optimize = 'Debug',
    clean = false,
    zigCmd = `zig build -Doptimize=${optimize}`,
    buildDir = join(tmpdir(), 'zigar-build'),
    staleTime = 60000,
  } = options;
  const srcInfo = await findFile(srcPath);
  if (!srcInfo) {
    throw new Error(`Source file not found: ${fullPath}`);
  }
  const soInfo = await findFile(soPath);
  const config = createConfig(srcPath, srcInfo, soPath, soInfo, options);
  const srcFileMap = await findMatchingFiles(config.packageRoot, /\.zig$/);
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
  if (changed) {
    // build in a unique temp dir
    const soBuildDir = join(buildDir, getBuildFolder(config));
      // only one process can compile a given file at a time
    await acquireLock(soBuildDir, staleTime);
    try {
      // create config file
      await createProject(config, soBuildDir);
      // then run the compiler
      await runCompiler(zigCmd, soBuildDir);
      // move library to designated location      
      const re = new RegExp(`\\${getPlatformExt(options)}$`);
      const outputDir = join(soBuildDir, 'zig-out', 'lib');
      // look for most recently create file
      const fileMap = await findMatchingFiles(outputDir, re);
      let resultPath, resultMTime;
      for (const [ path, info ] of fileMap) {
        if (!(resultMTime >= info.mtime)) {
          resultPath = path;
          resultMTime = info.mtime;
        }
      }
      await createDirectory(dirname(soPath));
      await moveFile(resultPath, soPath);
      await touchFile(soPath);
    } finally {
      await releaseLock(soBuildDir);
      if (clean) {
        await deleteDirectory(soBuildDir);
      }
    }
  }
}

export function compileSync(srcPath, soPath, options = {}) {
  // TODO
}

function getBuildFolder(config) {
  const { packageName, packageRoot } = config;
  const soBuildPrefix = basename(packageName).slice(0, 16);
  const soBuildHash = md5(`${packageRoot}/${packageName}`).slice(0, 8);
  return soBuildPrefix + '-' + soBuildHash;
}

function createConfig(srcPath, srcInfo, soPath, soInfo, options) {
  const {
    platform = os.platform(),
    arch = os.arch(),
    nativeCpu = false,
  } = options;
  const suffix = /^wasm(32|64)$/.test(arch) ? 'wasm' : 'c';
  const src = parse(srcPath);
  const so = parse(soPath);
  return {
    platform,
    arch,
    nativeCpu,
    packageName: so.name,
    packagePath: srcInfo.isDirectory() ? undefined : srcPath,
    packageRoot: srcInfo.isDirectory() ? srcPath : src.dir,
    exporterPath: absolute(`../zig/exporter-${suffix}.zig`),
    stubPath: absolute(`../zig/stub-${suffix}.zig`),
    buildFilePath: absolute(`../zig/build.zig`),
    useLibC: (platform === 'win32') ? true : false,
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
