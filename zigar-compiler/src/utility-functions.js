import { createHash } from 'crypto';
import {
  chmodSync, closeSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, rmdirSync,
  statSync, unlinkSync, writeFileSync, writeSync
} from 'fs';
import {
  chmod, lstat, mkdir, open, readFile, readdir, rmdir, stat, unlink, writeFile
} from 'fs/promises';
import os from 'os';
import { join, parse } from 'path';

export async function findFile(path, follow = true) {
  try {
    return await (follow ? stat(path) : lstat(path));
  } catch (err) {
  }
}

export function findFileSync(path, follow = true) {
  try {
    return follow ? statSync(path) : lstatSync(path);
  } catch (err) {
  }
}

export async function findMatchingFiles(dir, re) {
  const map = new Map();
  const scanned = new Map();
  const scan = async (dir) => {
    /* c8 ignore next 3 */
    if (scanned.get(dir)) {
      return;
    } 
    scanned.set(dir, true);
    try {
      const list = await readdir(dir);
      for (const name of list) {
        if (name.startsWith('.') || name === 'node_modules' || name === 'zig-cache') {
          continue;
        }
        const path = join(dir, name);
        const info = await findFile(path);
        if (info?.isDirectory()) {
          await scan(path);
        } else if (info?.isFile() && re.test(name)) {
          map.set(path, info);
        }
      }
      /* c8 ignore next 2 */
    } catch (err) {
    }
  };
  await scan(dir);
  return map;
}

export function findMatchingFilesSync(dir, re) {
  const map = new Map();
  const scanned = new Map();
  const scan = (dir) => {
    /* c8 ignore next 3 */
    if (scanned.get(dir)) {
      return;
    } 
    scanned.set(dir, true);
    try {
      const list = readdirSync(dir);
      for (const name of list) {
        if (name.startsWith('.') || name === 'node_modules' || name === 'zig-cache') {
          continue;
        }
        const path = join(dir, name);
        const info = findFileSync(path);
        if (info?.isDirectory()) {
          scan(path);
        } else if (info?.isFile() && re.test(name)) {
          map.set(path, info);
        }
      }
      /* c8 ignore next 2 */
    } catch (err) {
    }
  };
  scan(dir);
  return map;
}

export async function acquireLock(soBuildDir, staleTime) {
  const pidPath = join(soBuildDir, 'pid');
  while (true)   {
    try {
      await createDirectory(soBuildDir);
      const handle = await open(pidPath, 'wx');
      handle.write(`${process.pid}`);
      handle.close();
      return;
    } catch (err) {
      if (err.code === 'EEXIST') {
        const last = (await findFile(pidPath))?.mtime;
        const now = new Date();
        const diff = now - last;
        if (diff > staleTime) {
          // lock file has been abandoned
          await deleteFile(pidPath);
          continue;
        }
      } else {
        throw err;
      }
    }
    await delay(250);
  }
}

export function acquireLockSync(soBuildDir, staleTime) {
  const pidPath = join(soBuildDir, 'pid');
  while (true)   {
    try {
      createDirectorySync(soBuildDir);
      const handle = openSync(pidPath, 'wx');
      writeSync(handle, `${process.pid}`);
      closeSync(handle);
      return;
    } catch (err) {
      if (err.code === 'EEXIST') {
        const last = findFileSync(pidPath)?.mtime;
        const now = new Date();
        const diff = now - last;
        if (diff > staleTime) {
          // lock file has been abandoned
          deleteFileSync(pidPath);
          continue;
        }
      } else {
        throw err;
      }
    }
    delaySync(50);
  }
}

export async function releaseLock(soBuildDir) {
  const pidPath = join(soBuildDir, 'pid');
  await deleteFile(pidPath);
}

export function releaseLockSync(soBuildDir) {
  const pidPath = join(soBuildDir, 'pid');
  deleteFileSync(pidPath);
}

export async function copyFile(srcPath, dstPath) {
  const info = await stat(srcPath);
  const data = await readFile(srcPath);
  await writeFile(dstPath, data);
  await chmod(dstPath, info.mode);
}

export function copyFileSync(srcPath, dstPath) {
  const info = statSync(srcPath);
  const data = readFileSync(srcPath);
  writeFileSync(dstPath, data);
  chmodSync(dstPath, info.mode);
}

export async function loadFile(path, def) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    return def;
  }
}

export function loadFileSync(path, def) {
  try {
    return readFileSync(path, 'utf8');
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

export function deleteFileSync(path) {
  try {
    unlinkSync(path);
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
      throw err;
    }
  }
}

export async function createDirectory(path) {
  const exists = await findDirectory(path);
  if (!exists) {
    const { root, dir } = parse(path);
    await createDirectory(dir);
    try {
      await mkdir(path);
    } catch (err) {
      /* c8 ignore next 3 */
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
  }
}

export function createDirectorySync(path) {
  const exists = findDirectorySync(path);
  if (!exists) {
    const { root, dir } = parse(path);
    createDirectorySync(dir);
    try {
      mkdirSync(path);
    } catch (err) {
      /* c8 ignore next 3 */
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
  }
}

export async function findDirectory(path) {
  return findFile(path);
}

export function findDirectorySync(path) {
  return findFileSync(path);
}

export async function deleteDirectory(dir) {
  try {
    const list = await readdir(dir);
    for (const name of list) {
      const path = join(dir, name);
      const info = await findFile(path, false);
      if (info?.isDirectory()) {
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

export function deleteDirectorySync(dir) {
  try {
    const list = readdirSync(dir);
    for (const name of list) {
      const path = join(dir, name);
      const info = findFileSync(path, false);
      if (info?.isDirectory()) {
        deleteDirectorySync(path);
      } else if (info) {
        deleteFileSync(path);
      }
    }
    rmdirSync(dir);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

export async function delay(ms) {
  await new Promise(r => setTimeout(r, ms));
}

export function delaySync(ms) {   
  const buffer = new SharedArrayBuffer(8);
  const ta = new BigInt64Array(buffer);
  Atomics.wait(ta, 0, 0n, ms);
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