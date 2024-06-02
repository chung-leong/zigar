import childProcess, { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import {
  chmod, lstat, mkdir, open, readFile, readdir, rmdir, stat, unlink, writeFile
} from 'fs/promises';
import os from 'os';
import { dirname, join, sep } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execFile = promisify(childProcess.execFile);

export async function acquireLock(pidPath, staleTime) {
  while (true)   {
    try {
      await createDirectory(dirname(pidPath));
      const handle = await open(pidPath, 'wx');
      handle.write(`${process.pid}`);
      handle.close();
      break;
    } catch (err) {
      if (err.code === 'EEXIST') {
        if (await checkPidFile(pidPath, staleTime)) {
          await delay(250);
          continue;
        }
        /* c8 ignore next 3 */
      } else {
        throw err;
      }
    }
  }
}

export async function releaseLock(pidPath) {
  await deleteFile(pidPath);
}

export async function isOlderThan(targetPath, srcPaths) {
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

async function checkPidFile(pidPath, staleTime = 60000 * 5) {
  let stale = false;
  try {
    const pid = await loadFile(pidPath);
    if (pid) {
      /* c8 ignore start */
      const win32 = os.platform() === 'win32';
      const program = (win32) ? 'tasklist' : 'ps';
      const args = (win32) ? [ '/nh', '/fi', `pid eq ${pid}` ] : [ '-p', pid ];
      const { stdout } = await execFile(program, args, { windowsHide: true });
      if (win32 && !stdout.includes(pid)) {
        throw new Error('Process not found');
      }
      /* c8 ignore end */
    }
    const stats = await stat(pidPath);
    const diff = new Date() - stats.mtime;
    if (diff > staleTime) {
      stale = true;
    }
  } catch (err) {
    stale = true;
  }
  if (stale) {
    await deleteFile(pidPath);
  }
  return !stale;
}

export async function copyFile(srcPath, dstPath) {
  const info = await stat(srcPath);
  const data = await readFile(srcPath);
  await writeFile(dstPath, data);
  await chmod(dstPath, info.mode);
}

export async function loadFile(path, def) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    return def;
  }
}

export async function deleteFile(path) {
  try {
    await unlink(path);
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
      throw err;
    }
  }
}

export async function createDirectory(path) {
  try {
    await stat(path);
  } catch (err) {
    const dir = dirname(path);
    await createDirectory(dir);
    try {
      await mkdir(path);
      /* c8 ignore next 5 */
    } catch (err) {
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
  }
}

export async function deleteDirectory(dir) {
  try {
    const list = await readdir(dir);
    for (const name of list) {
      const path = join(dir, name);
      const info = await lstat(path);
      if (info.isDirectory()) {
        await deleteDirectory(path);
      } else if (info) {
        await deleteFile(path);
      }
    }
    await rmdir(dir);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

export async function delay(ms) {
  await new Promise(r => setTimeout(r, ms));
}

export function md5(text) {
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

let isGNU;

export function getPlatform() {
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

export function getArch() {
  return os.arch();
}

export function normalizePath(url) {
  let archive;
  const parts = fileURLToPath(url).split(sep).map((part) => {
    if (part === 'app.asar') {
      archive = 'asar';
      return part + '.unpacked';
    }
    return part;
  });
  const path = parts.join(sep);
  return { path, archive }
}