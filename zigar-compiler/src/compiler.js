import ChildProcess from 'child_process';
import { readFile, readdir, stat, writeFile } from 'fs/promises';
import os from 'os';
import { basename, isAbsolute, join, parse, resolve } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import {
  acquireLock, copyFile, createDirectory, deleteDirectory, getArch, getPlatform,
  md5,
  releaseLock
} from './utility-functions.js';

const execFile = promisify(ChildProcess.execFile);

export async function compile(srcPath, modPath, options) {
  const srcInfo = (srcPath) ? await stat(srcPath) : null;
  if (srcInfo?.isDirectory()) {
    srcPath = join(srcPath, '?');
  }
  const config = createConfig(srcPath, modPath, options);
  const { moduleDir, outputPath } = config;
  let changed = false;
  let sourcePaths;
  if (srcPath) {
    // add custom build file
    try {
      const path = join(moduleDir, 'build.zig');
      await stat(path);
      config.buildFilePath = path;
    } catch (err) {
    }
    // add custom package manager manifest
    try {
      const path = join(moduleDir, 'build.zig.zon');
      await stat(path);
      config.packageConfigPath = path;
    } catch (err) {
    }
    const { zigPath, zigArgs, moduleBuildDir } = config;
    // only one process can compile a given file at a time
    const pidPath = `${moduleBuildDir}.pid`;
    await acquireLock(pidPath);
    const getOutputMTime = async () => {
      try {
        const stats = await stat(outputPath);
        return stats.mtime.valueOf();
      } catch (err) {
      }
    };
    const outputMTimeBefore = await getOutputMTime();
    try {
      const { onStart, onEnd } = options;
      // create config file
      await createProject(config, moduleBuildDir);
      // then run the compiler
      await runCompiler(zigPath, zigArgs, { cwd: moduleBuildDir, onStart, onEnd });
      // get list of files involved in build
      sourcePaths = await findSourcePaths(moduleBuildDir);
    } finally {
      if (config.clean) {
        await deleteDirectory(moduleBuildDir);
      }
      await releaseLock(pidPath);
    }
    const outputMTimeAfter = await getOutputMTime();
    changed = outputMTimeBefore != outputMTimeAfter;
    sourcePaths.push(config.buildFilePath);
    if (config.packageConfigPath) {
      sourcePaths.push(config.packageConfigPath);
    }
  }
  return { outputPath, changed, sourcePaths }
}

export async function runCompiler(path, args, options) {
  const {
    cwd,
    onStart,
    onEnd,
  } = options;
  try {
    onStart?.();
    return await execFile(path, args, { cwd, windowsHide: true });
  } catch (err) {
    let message = 'Zig compilation failed';
    if (err.stderr) {
      try {
        const logPath = join(cwd, 'log');
        await writeFile(logPath, err.stderr);
        /* c8 ignore next 2 */
      } catch (err) {
      }
      message += `\n\n${err.stderr}`;
    }
    throw new Error(message);
    /* c8 ignore next */
  } finally {
    onEnd?.();
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
    cacheDir = join(cwd, '.zigar-cache'),
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
  const zigArgs = zigArgsStr.split(/\s+/).filter(s => !!s);
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

async function getManifestLists(buildPath) {
  let dirPath;
  let names;
  try {
    dirPath = join(buildPath, '.zig-cache', 'h');
    names = await readdir(dirPath);
  } catch (err) {
    try {
      dirPath = join(buildPath, 'zig-cache', 'h');
      names = await readdir(dirPath);
    } catch (err) {
      names = [];
    }
  }
  return names.filter(n => /\.txt$/.test(n)).map(n => join(dirPath, n));
}

async function findSourcePaths(buildPath) {
  const manifestPaths = await getManifestLists(buildPath);
  const involved = {};
  for (const manifestPath of manifestPaths) {
    try {
      const data = await readFile(manifestPath, 'utf-8');
      if (data.length > 0) {
        const lines = data.split(/\r?\n/);
        // https://ziglang.org/documentation/master/std/#std.Build.Cache.Manifest.writeManifest
        // size inode mtime bin_digest prefix sub_path
        const re = /\d+ \d+ \d+ \w+ \d+ (.+)/;
        for (const line of lines) {
          const m = re.exec(line);
          if (m) {
            const srcPath = m[1];
            if(isAbsolute(srcPath) && !srcPath.startsWith(buildPath) && !srcPath.includes('/.cache/zig/')) {
              involved[srcPath] = true;
            }
          }
        }
      }
    } catch (err) {
    }
  }
  return Object.keys(involved);
}