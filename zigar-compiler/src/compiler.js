import ChildProcess from 'child_process';
import { writeFile } from 'fs/promises';
import os from 'os';
import { basename, join, parse, resolve } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import {
  acquireLock,
  copyFile,
  createDirectory,
  deleteDirectory,
  findFile,
  findMatchingFiles,
  getArch, getPlatform, md5, releaseLock
} from './utility-functions.js';

const execFile = promisify(ChildProcess.execFile);

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
    const srcFileMap = await findMatchingFiles(moduleDir, /.\..*$/);
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
      const { zigPath, zigArgs, moduleBuildDir } = config;
      // only one process can compile a given file at a time
      const pidPath = `${moduleBuildDir}.pid`;
      await acquireLock(pidPath);
      try {
        // create config file
        await createProject(config, moduleBuildDir);
        // then run the compiler
        await runCompiler(zigPath, zigArgs, moduleBuildDir);
      } finally {
        if (config.clean) {
          await deleteDirectory(moduleBuildDir);
        }
        await releaseLock(pidPath);
      }
    }   
  }
  return { outputPath, changed }
}

export async function runCompiler(path, args, buildDir) {
  try {
    const options = {
      cwd: buildDir,
      windowsHide: true,
    }; 
    return await execFile(path, args, options);
  } catch (err) {
    let message = 'Zig compilation failed';
    if (err.stderr) {
      try {
        const logPath = join(buildDir, 'log');
        await writeFile(logPath, err.stderr);
      } catch (_) {        
      }
      message += `\n\n${err.stderr}`;
    }
    throw new Error(message);
  }
}

export function formatProjectConfig(config) {
  const lines = [];
  const fields = [ 
    'moduleName', 'modulePath', 'moduleDir', 'stubPath', 'outputPath', 'useLibc', 'isWASM',
  ];  
  for (const [ name, value ] of Object.entries(config)) {
    if (fields.includes(name)) {
      const snakeCase = name.replace(/[A-Z]+/g, m => '_' + m.toLowerCase());
      lines.push(`pub const ${snakeCase} = ${JSON.stringify(value)};`);
    }
  }
  return lines.join('\n');
}

const wasmMainFn = `int main(void) { return 0; }`;

export async function createProject(config, dir) {
  await createDirectory(dir);
  const content = formatProjectConfig(config);
  const cfgFilePath = join(dir, 'build-cfg.zig');
  await writeFile(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  await copyFile(config.buildFilePath, buildFilePath);
  if (config.packageConfigPath) {
    const packageConfigPath = join(dir, 'build.zig.zon');
    await copyFile(config.packageConfigPath, packageConfigPath);
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

export function createConfig(srcPath, modPath, options = {}) {
  const {
    platform = getPlatform(),
    arch = getArch(),
    optimize = 'Debug',
    isWASM = false,
    useLibc = isWASM ? false : true,
    clean = false,
    buildDir = join(os.tmpdir(), 'zigar-build'),
    zigPath = 'zig',
    zigArgs: zigArgsStr = '',
  } = options;
  const src = parse(srcPath ?? '');
  const mod = parse(modPath ?? '');
  const moduleName = mod.name || src.name;
  const modulePath = (src.name !== '?') ? srcPath : undefined;
  const moduleDir = src.dir;
  const modulePrefix = basename(moduleName).slice(0, 16);
  const moduleHash = md5(`${moduleDir}/${moduleName}`).slice(0, 8);
  const moduleBuildDir = join(buildDir, modulePrefix + '-' + moduleHash);   
  const outputPath = (() => {
    if (!modPath && isWASM) {
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
  const zigArgs = [];
  if (!zigArgs.find(s => /^[^-]/.test(s))) {
    zigArgs.unshift('build');
  }
  if (!zigArgs.find(s => /^\-Doptimize=/.test(s))) {
    zigArgs.push(`-Doptimize=${optimize}`);
  }
  if (!zigArgs.find(s => /^\-Dtarget=/.test(s))) {
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
    zigArgs.push(`-Dtarget=${cpuArch}-${osTag}`);
  }
  const stubPath = absolute(`../zig/stub-${isWASM ? 'wasm' : 'c'}.zig`);
  const buildFilePath = absolute(`../zig/build.zig`);
  return {
    platform,
    arch,
    optimize,
    moduleName,
    modulePath,
    moduleDir,
    moduleBuildDir,
    stubPath,
    buildFilePath,
    packageConfigPath: undefined,
    outputPath,
    clean,
    zigPath,
    zigArgs,
    useLibc,
    isWASM,
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
