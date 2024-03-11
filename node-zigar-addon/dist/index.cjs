const { join, parse, resolve } = require('path');
const { execFileSync } = require('child_process');
const { readdirSync, statSync } = require('fs');
const os = require('os');

function createEnvironment(addonDir) {
  const { createEnvironment } = loadAddon(addonDir);
  return createEnvironment();
}
  
function importModule(soPath, addonDir, options = {}) {
  const env = createEnvironment(addonDir);
  env.loadModule(soPath);
  env.acquireStructures(options);
  return env.useStructures();
}
  
function getGCStatistics(addonDir) {
  const { getGCStatistics } = loadAddon(addonDir);
  return getGCStatistics();
}
  
function buildAddOn(addonPath, options = {}) {
  const { platform, arch, exeName } = options;
  const cwd = resolve(__dirname, '../');
  const args = [ 'build', `-Doptimize=ReleaseSmall`, `-Doutput=${addonPath}` ];
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
  if (exeName) {
    args.push(`-Dexe=${exeName}`);
  }
  execFileSync('zig', args, { cwd, stdio: 'pipe' });
}
  
function loadAddon(addonDir) {
  const arch = getArch();
  const platform = getPlatform();
  let srcMTime;
  const srcDir = resolve(__dirname, '../src');
  for (const file of readdirSync(srcDir)) {
    const { mtime } = statSync(join(srcDir, file));
    if (!(srcMTime >= mtime)) {
      srcMTime = mtime;
    }
  }
  const addonPath = join(addonDir, `${platform}.${arch}.node`);
  let addonMTime;
  try {
    addonMTime = statSync(addonPath).mtime;
  } catch (err) {    
  }
  if (!(addonMTime > srcMTime)) {
    const exeName = parse(process.execPath).name;
    buildAddOn(addonPath, { platform, arch, exeName });
  }
  return require(addonPath);
}

let isGNU;

function getPlatform() {
  let platform = os.platform();
  if (platform === 'linux') {
    // differentiate glibc from musl
    if (isGNU === undefined) {
      /* c8 ignore next 3 */
      if (process.versions?.electron || process.__nwjs) {
        isGNU = true;
      } else {
        try {
          execFileSync('getconf', [ 'GNU_LIBC_VERSION' ], { stdio: 'pipe' });
          isGNU = true;
          /* c8 ignore next 3 */
        } catch (err) {
          isGNU = false;
        }  
      }
    }
    /* c8 ignore next 3 */
    if (!isGNU) {
      platform += '-musl';
    }
  }
  return platform;
}

function getArch() {
  return os.arch();
}

module.exports = {
  createEnvironment,
  importModule,
  getGCStatistics,
  buildAddOn,
};
