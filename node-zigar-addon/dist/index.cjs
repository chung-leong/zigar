const { execFileSync, execFile: execFileAsync } = require('child_process');
const { promisify } = require('util');
const execFile = promisify(execFileAsync);
const { stat  } = require('fs/promises');
const { writeFileSync } = require('fs');
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
    zigPath = 'zig',
    onStart,
    onEnd,
  } = options;
  const outputPath = join(addonDir, `${platform}.${arch}.node`);
  let changed = false;
  if (recompile) {
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
        ppc64: 'powerpc64le',
        s390: undefined,
        riscv64: 'riscv64',
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
    const getOutputMTime = async () => {
      try {
        const stats = await stat(outputPath);
        return stats.mtime.valueOf();
      } catch (err) {
      }
    };
    const outputMTimeBefore = await getOutputMTime();
    try {
      await runCompiler(zigPath, args, { cwd, onStart, onEnd });
    } catch (err) {
      if (err.code === 'ENOENT') {
        if (!outputMTimeBefore) {
          throw new MissingModule(outputPath);
        }
      } else {
        throw err;
      }
    }
    const outputMTimeAfter = await getOutputMTime();
    changed = outputMTimeBefore != outputMTimeAfter;
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
    throw new CompilationError(path, args, cwd, err);
    /* c8 ignore next */
  } finally {
    onEnd?.();
  }
}

class CompilationError extends Error {
  constructor(path, args, cwd, err) {
    super([ `Zig compilation failed`, err.stderr ].filter(s => !!s).join('\n\n'));
    this.path = path;
    this.args = args;
    this.errno = err.errno;
    this.code = err.code;
    if (err.stderr) {
      try {
        const logPath = join(cwd, 'log');
        writeFileSync(logPath, err.stderr);
        this.log = logPath;
        /* c8 ignore next 2 */
      } catch (err) {
      }
    }
  }
}

class MissingModule extends Error {
  constructor(path) {
    super(`Module not found: ${path}`);
  }
}

module.exports = {
  createEnvironment,
  importModule,
  getGCStatistics,
  getLibraryPath,
  buildAddon,
};
