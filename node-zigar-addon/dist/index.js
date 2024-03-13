import { execFileSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { createRequire } from 'module';
import os from 'os';
import { join, parse } from 'path';
import { fileURLToPath } from 'url';

export function createEnvironment(addonDir) {
  const { createEnvironment } = loadAddon(addonDir);
  return createEnvironment();
}

export function importModule(soPath, addonDir, options = {}) {
  const env = createEnvironment(addonDir);
  env.loadModule(soPath);
  env.acquireStructures(options);
  return env.useStructures();
}

export function getGCStatistics(addonDir) {
  const { getGCStatistics } = loadAddon(addonDir);
  return getGCStatistics();
}

export function buildAddOn(addonPath, options = {}) {
  const { platform, arch } = options;
  const cwd = fileURLToPath(new URL('../', import.meta.url));
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
  execFileSync('zig', args, { cwd, stdio: 'pipe' });
}

function loadAddon(addonDir) {
  const arch = getArch();
  const platform = getPlatform();
  const addonPath = join(addonDir, `${platform}.${arch}.node`);
  const recompile = !addonDir.includes('/app.asar.unpacked/');
  if (recompile) {
    let srcMTime;
    const srcDir = fileURLToPath(new URL('../src', import.meta.url));
    for (const file of readdirSync(srcDir)) {
      const { mtime } = statSync(join(srcDir, file));
      if (!(srcMTime >= mtime)) {
        srcMTime = mtime;
      }
    }
    let addonMTime;
    try {
      addonMTime = statSync(addonPath).mtime;
    } catch (err) {    
    }
    if (!(addonMTime > srcMTime)) {
      buildAddOn(addonPath, { platform, arch });
    }
  }
  const require = createRequire(import.meta.url);
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