const { execFile: execFileAsync } = require('child_process');
const { promisify } = require('util');
const execFile = promisify(execFileAsync);
const { stat } = require('fs/promises');
const { writeFileSync } = require('fs');
const { join, resolve } = require('path');

function createEnvironment() {
  const { createEnvironment } = loadAddon();
  return createEnvironment();
}

function importModule(soPath, options) {
  const env = createEnvironment();
  env.loadModule(soPath);
  env.acquireStructures(options);
  return env.useStructures();
}

function getGCStatistics() {
  const { getGCStatistics } = loadAddon();
  return getGCStatistics();
}

function getLibraryPath() {
  return __filename;
}

const optionsForAddon = {
  optimizeAddon: {
    type: 'string',
    enum: [ 'Debug', 'ReleaseSmall', 'ReleaseFast', 'ReleaseSafe' ],
    title: 'Zig optimization mode for Node.js addon',
  },
}

async function buildAddon(addonDir, options) {
  const {
    recompileAddon = true,
    optimizeAddon = 'ReleaseSmall',
    arch,
    platform,
    zigPath = 'zig',
    onStart,
    onEnd,
  } = options;
  const outputPath = join(addonDir, `${platform}.${arch}.node`);
  const baseDir = resolve(__dirname, '../');
  let changed = false;
  if (recompileAddon) {
    const args = [ 'build', `-Doptimize=${optimizeAddon}`, `-Doutput=${outputPath}` ];
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
        return stats.mtimeMs;
      } catch (err) {
      }
    };
    const outputMTimeBefore = await getOutputMTime();
    try {
      await runCompiler(zigPath, args, { cwd: baseDir, onStart, onEnd });
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
    changed = outputMTimeBefore !== outputMTimeAfter;
  }
  return { outputPath, changed };
}

function loadAddon() {
  return require(process.env.ADDON_PATH);
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
  optionsForAddon,
};
