import { exec, execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import os from 'os';
import { basename, join, parse, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  acquireLock, acquireLockSync, copyFile, copyFileSync, deleteDirectory, deleteDirectorySync,
  findFile, findFileSync, findMatchingFiles, findMatchingFilesSync, getArch, getPlatform,
  md5, releaseLock, releaseLockSync
} from './utility-functions.js';

export async function compile(srcPath, modPath, options) {
  const srcInfo = (srcPath) ? await findFile(srcPath) : null;
  if (srcInfo === undefined) {
    throw new Error(`Source file not found: ${srcPath}`);
  }
  if (srcInfo?.isDirectory()) {
    srcPath = join(srcPath, '?');
  }
  const config = createConfig(srcPath, modPath, options);
  const { moduleDir, outputPath } = config;
  let changed = false;
  if (srcPath) {
    const srcFileMap = await findMatchingFiles(moduleDir, /\.(zig|zon)$/);
    // see if the (re-)compilation is necessary
    const soInfo = await findFile(outputPath);
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
      for (const [ path, info ] of zigFileMap) {
        if (info.mtime > soInfo.mtime) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      // add custom build file
      for (const [ path, info ] of srcFileMap) {
        switch (basename(path)) {
          case 'build.zig':
            config.buildFilePath = path;
            break;
          case 'build.zig.zon':
            config.packageConfigPath = path;
            break;
        }
      }
      const { zigCmd, moduleBuildDir } = config;
      // only one process can compile a given file at a time
      await acquireLock(moduleBuildDir);
      try {
        // create config file
        await createProject(config, moduleBuildDir);
        // then run the compiler
        await runCompiler(zigCmd, moduleBuildDir);
      } finally {
        await releaseLock(moduleBuildDir);
        if (config.clean) {
          await deleteDirectory(moduleBuildDir);
        }
      }
    }   
  }
  return { outputPath, changed }
}

export function compileSync(srcPath, modPath, options) {
  const srcInfo = (srcPath) ? findFileSync(srcPath) : null;
  if (srcInfo === undefined) {
    throw new Error(`Source file not found: ${srcPath}`);
  }
  if (srcInfo?.isDirectory()) {
    srcPath = join(srcPath, '?');
  }
  const config = createConfig(srcPath, modPath, options);
  const { moduleDir, outputPath } = config;
  let changed = false;
  if (srcPath) {
    const srcFileMap = findMatchingFilesSync(moduleDir, /\.(zig|zon)$/);
    // see if the (re-)compilation is necessary
    const soInfo = findFileSync(outputPath);
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
    if (changed) {
      // add custom build file
      for (const [ path, info ] of srcFileMap) {
        switch (basename(path)) {
          case 'build.zig':
            config.buildFilePath = path;
            break;
          case 'build.zig.zon':
            config.packageConfigPath = path;
            break;
        }
      }
      const { zigCmd, moduleBuildDir } = config;
      // only one process can compile a given file at a time
      acquireLockSync(moduleBuildDir);
      try {
        // create config file
        createProjectSync(config, moduleBuildDir);
        // then run the compiler
        runCompilerSync(zigCmd, moduleBuildDir);
      } finally {
        releaseLockSync(moduleBuildDir);
        if (config.clean) {
          deleteDirectorySync(moduleBuildDir);
        }
      }
    } 
  }
  return { outputPath, changed }
}

function findCUsage(content) {
  return content.includes('@cImport') || content.includes('std.heap.c_allocator');
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
  const fields = [ 
    'moduleName', 'modulePath', 'moduleDir', 'exporterPath', 'stubPath', 'outputPath', 'useLibc'
  ];  
  for (const [ name, value ] of Object.entries(config)) {
    if (fields.includes(name)) {
      const snakeCase = name.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      lines.push(`pub const ${snakeCase} = ${JSON.stringify(value)};`);
    }
  }
  return lines.join('\n');
}

const wasmMainFn = `int main(void) { return 0; }`;

export async function createProject(config, dir) {
  const content = formatProjectConfig(config);
  const cfgFilePath = join(dir, 'build-cfg.zig');
  await writeFile(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  await copyFile(config.buildFilePath, buildFilePath);
  if (config.packageConfigPath) {
    const packageConfigPath = join(dir, 'build.zig.zon');
    await copyFile(config.packageConfigPath, packageConfigPath);
  }
  if (config.useLibc && config.platform === 'wasi') {
    // need empty main function
    const mainFilePath = join(dir, 'main.c');
    await writeFile(mainFilePath, wasmMainFn);
  }
}

export function createProjectSync(config, dir) {
  const content = formatProjectConfig(config);
  const cfgFilePath = join(dir, 'build-cfg.zig');
  writeFileSync(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  copyFileSync(config.buildFilePath, buildFilePath);
  if (config.packageConfigPath) {
    const packageConfigPath = join(dir, 'build.zig.zon');
    copyFileSync(config.packageConfigPath, packageConfigPath);
  }
  if (config.useLibc && config.platform === 'wasi') {
    const mainFilePath = join(dir, 'main.c');
    writeFileSync(mainFilePath, wasmMainFn);
  }
}

const cwd = process.cwd();

export function getCachePath(options) {
  const {
    cacheDir = join(cwd, 'zigar-cache'),
  } = options;
  return cacheDir;
}

export function getModuleCachePath(srcPath, options) {
  const {
    optimize,
  } = options;
  const src = parse(srcPath);
  const folder = basename(src.dir).slice(0, 16).trim() + '-' + md5(src.dir).slice(0, 8);
  const cacheDir = getCachePath(options);
  return join(cacheDir, folder, optimize, `${src.name}.zigar`);
}

const isWASM = /^wasm(32|64)$/;

export function createConfig(srcPath, modPath, options = {}) {
  const {
    platform = getPlatform(),
    arch = getArch(),
    nativeCpu = false,
    optimize = 'Debug',
    useLibc = isWASM.test(arch) ? false : true,
    clean = false,
    buildDir = join(os.tmpdir(), 'zigar-build'),
    zigCmd = (() => {
      // translate from names used by Node to those used by Zig
      const cpuArchs = {
        arm: 'arm',
        arm64: 'aarch64',
        ia32: 'x86',
        loong64: 'loong64',
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
        linux: 'linux-gnu',
        openbsd: 'openbsd',
        sunos: 'solaris',
        win32: 'windows',
      };
      const cpuArch = cpuArchs[arch] ?? arch;
      const osTag = osTags[platform] ?? platform;
      const args = [
        `build`,
        `-Doptimize=${optimize}`,
        `-Dtarget=${cpuArch}-${osTag}`,        
      ];
      if (nativeCpu) {
        if (arch === getArch() && platform === getPlatform()) {
          args.push(`-Dcpu=native`);
        }
      }
      return `zig ${args.join(' ')}`;
    })(),
  } = options;
  const suffix = isWASM.test(arch) ? 'wasm' : 'c';
  const src = parse(srcPath ?? '');
  const mod = parse(modPath ?? '');
  const moduleName = mod.name || src.name;
  const modulePath = (src.name !== '?') ? srcPath : undefined;
  const moduleDir = src.dir;
  const modulePrefix = basename(moduleName).slice(0, 16);
  const moduleHash = md5(`${moduleDir}/${moduleName}`).slice(0, 8);
  const moduleBuildDir = join(buildDir, modulePrefix + '-' + moduleHash);   
  const outputPath = (() => {
    if (!modPath && isWASM.test(arch)) {
      // save output in build folder
      return join(moduleBuildDir, optimize, `${src.name}.wasm`);
    } else {
      const extensions = {
        darwin: 'dylib',
        win32: 'dll',
      };
      const ext = extensions[platform] || 'so';
      return join(modPath, `${platform}.${arch}.${ext}`);
    }  
  })();
  const exporterPath = absolute(`../zig/exporter-${suffix}.zig`);
  const stubPath = absolute(`../zig/stub-${suffix}.zig`);
  const buildFilePath = absolute(`../zig/build.zig`);
  return {
    platform,
    arch,
    optimize,
    useLibc,
    nativeCpu,
    moduleName,
    modulePath,
    moduleDir,
    moduleBuildDir,
    exporterPath,
    stubPath,
    buildFilePath,
    packageConfigPath: undefined,
    outputPath,
    clean,
    zigCmd,
  };
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
