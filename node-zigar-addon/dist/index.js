import { execFileSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { createRequire } from 'module';
import os from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { runCompiler } from '../../zigar-compiler/src/compiler.js';

export function createEnvironment(options) {
  const { createEnvironment } = loadAddon(options);
  return createEnvironment();
}

export function importModule(soPath, options) {
  const env = createEnvironment(options);
  env.loadModule(soPath);
  env.acquireStructures(options);
  return env.useStructures();
}

export function getGCStatistics(options) {
  const { getGCStatistics } = loadAddon(options);
  return getGCStatistics();
}

export function getLibraryPath() {
  return fileURLToPath(import.meta.url);
}

export async function buildAddon(options) {
  const { addonDir, recompile = false } = options;
  const arch = getArch();
  const platform = getPlatform();
  const addonPath = join(addonDir, `${platform}.${arch}.node`);
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
      await runCompiler('zig', args, cwd);
    }
  }
  return addonPath;
}

function loadAddon(options) {
  const { addonPath } = options;
  const require = createRequire(import.meta.url);
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