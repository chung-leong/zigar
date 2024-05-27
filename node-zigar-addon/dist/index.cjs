const { execFileSync, execFile: execFileAsync } = require('child_process');
const { promisify } = require('util');
const execFile = promisify(execFileAsync);
const { readdir, stat, utimes } = require('fs/promises');
const os = require('os');
const { join, resolve } = require('path');

function createEnvironment(options) {
  const { createEnvironment } = loadAddon(options);
  return createEnvironment();
}

function importModule(soPath, options) {
  const env = createEnvironment(options);
  env.loadModule(soPath);
  env.acquireStructures(options);
  return env.useStructures();
}

function getGCStatistics(options) {
  const { getGCStatistics } = loadAddon(options);
  return getGCStatistics();
}

function getLibraryPath() {
  return __filename;
}

async function buildAddon(addonDir, options) {
  const { 
    recompile = true,
    arch = getArch(),
    platform = getPlatform(),
    onStart,
    onEnd,
  } = options;
  const outputPath = join(addonDir, `${platform}.${arch}.node`);
  let changed = false;
  if (recompile) {
    const srcDir = resolve(__dirname, '../src');
    changed = await isOlderThan(outputPath, [ srcDir, options.configPath ]);
    if (changed) {
      const cwd = resolve(__dirname, '../');
      const args = [ 'build', `-Doptimize=ReleaseSmall`, `-Doutput=${outputPath}` ];
      if (platform && arch) {
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
        args.push(`-Dtarget=${cpuArch}-${osTag}`);
      }
      await runCompiler('zig', args, { cwd, onStart, onEnd });
      const now = new Date();
      await utimes(outputPath, now, now);
    }
  }
  return { outputPath, changed };
}

function loadAddon(options) {
  const { addonPath } = options;
  return require(addonPath);
}

let isGNU;

function getPlatform() {
  let platform = os.platform();
  /* c8 ignore start */
  if (platform === 'linux') {
    // differentiate glibc from musl
    if (isGNU === undefined) {
      if (process.versions?.electron || process.__nwjs) {
        isGNU = true;
      } else {
        try {
          execFileSync('getconf', [ 'GNU_LIBC_VERSION' ], { stdio: 'pipe' });
          isGNU = true;
        } catch (err) {
          isGNU = false;
        }  
      }
    }
    if (!isGNU) {
      platform += '-musl';
    }
  }
  /* c8 ignore end */
  return platform;
}

function getArch() {
  return os.arch();
}

async function runCompiler(path, args, options) {
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
      } catch (_) {        
      }
      message += `\n\n${err.stderr}`;
    }
    throw new Error(message);
  } finally {
    onEnd?.();
  }
}

async function isOlderThan(targetPath, srcPaths) {
  try {
    const targetInfo = await stat(targetPath);
    const checked = new Map();
    const check = async (path) => {
      if (!path) {
        return false;
      }
      /* c8 ignore next 3 */      
      if (checked.get(path)) {
        return false;
      }
      checked.set(path, true);
      const info = await stat(path);
      if (info.isFile()) {
        if (targetInfo.mtime < info.mtime) {
          return true;
        }
      } else if (info.isDirectory()) {
        const list = await readdir(path);
        for (const name of list) {
          if (name.startsWith('.') || name === 'node_modules' || name === 'zig-cache') {
            continue;
          }
          if (await check(join(path, name))) {
            return true;
          }
        }
      }
      return false;
    };
    for (const srcPath of srcPaths) {
      if (await check(srcPath)) {
        return true;
      }
    }
    return false;
  } catch (err) {
    return true;
  }
}

module.exports = {
  createEnvironment,
  importModule,
  getGCStatistics,
  getLibraryPath,
  buildAddon,
};
