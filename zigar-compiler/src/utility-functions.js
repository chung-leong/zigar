import childProcess from 'child_process';
import { createHash } from 'crypto';
import { closeSync, openSync, readSync } from 'fs';
import {
  chmod, lstat, mkdir, open, readFile, readdir, rmdir, stat, unlink, writeFile
} from 'fs/promises';
import os from 'os';
import { dirname, join, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execFile = promisify(childProcess.execFile);

export async function acquireLock(pidPath, wait = true, staleTime = 60000 * 5) {
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
          if (!wait) {
            throw err;
          }
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

async function checkPidFile(pidPath, staleTime) {
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

export function sha1(text) {
  const hash = createHash('sha1');
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
        const libs = findElfDependencies(process.argv[0]);
        isGNU = libs.indexOf('libc.so.6') != -1;
      }
    }
    /* c8 ignore next 3 */
    if (!isGNU) {
      platform += '-musl';
    }
  }
  return platform;
}

function findElfDependencies(path) {
  const list = [];
  try {
    const fd = openSync(path, 'r');
    const sig = new Uint8Array(8);
    readSync(fd, sig);
    for (const [ index, value ] of [ '\x7f', 'E', 'L', 'F' ].entries()) {
      if (sig[index] !== value.charCodeAt(0)) {
        throw new Error('Incorrect magic number');
      }
    }
    const bits = sig[4] * 32;
    const le = sig[5] === 1;
    const Ehdr = (bits === 64)
    ? { size: 64, e_shoff: 40, e_shnum: 60 }
    : { size: 52, e_shoff: 32, e_shnum: 48 };
    const Shdr = (bits === 64)
    ? { size: 64, sh_type: 4, sh_offset: 24, sh_size: 32, sh_link: 40 }
    : { size: 40, sh_type: 4, sh_offset: 16, sh_size: 20, sh_link: 24 };
    const Dyn = (bits === 64)
    ? { size: 16, d_tag: 0, d_val: 8 }
    : { size: 8, d_tag: 0, d_val: 4 };
    const Usize = (bits === 64) ? BigInt : Number;
    const read = (position, size) => {
      const buf = new DataView(new ArrayBuffer(Number(size)));
      readSync(fd, buf, { position });
      buf.getUsize = (bits === 64) ? buf.getBigUint64 : buf.getUint32;
      return buf;
    };
    const SHT_DYNAMIC = 6;
    const DT_NEEDED = 1;
    const ehdr = read(0, Ehdr.size);
    let position = ehdr.getUsize(Ehdr.e_shoff, le);
    const sectionCount = ehdr.getUint16(Ehdr.e_shnum, le);
    const shdrs = [];
    for (let i = 0; i < sectionCount; i++, position += Usize(Shdr.size)) {
      shdrs.push(read(position, Shdr.size));
    }
    const decoder = new TextDecoder();
    for (const shdr of shdrs) {
      const sectionType = shdr.getUint32(Shdr.sh_type, le)
      if (sectionType == SHT_DYNAMIC) {
        const link = shdr.getUint32(Shdr.sh_link, le);
        const strTableOffset = shdrs[link].getUsize(Shdr.sh_offset, le);
        const strTableSize = shdrs[link].getUsize(Shdr.sh_size, le);
        const strTable = read(strTableOffset, strTableSize);
        const dynamicOffset = shdr.getUsize(Shdr.sh_offset, le);
        const dynamicSize = shdr.getUsize(Shdr.sh_size, le);
        const entryCount = Number(dynamicSize / Usize(Shdr.size));
        position = dynamicOffset;
        for (let i = 0; i < entryCount; i++, position += Usize(Dyn.size)) {
          const entry = read(position, Dyn.size);
          const tag = entry.getUsize(Dyn.d_tag, le);
          if (tag === Usize(DT_NEEDED)) {
            let offset = entry.getUsize(Dyn.d_val, le);
            let name = '', c;
            while (c = strTable.getUint8(Number(offset++))) {
              name += String.fromCharCode(c);
            }
            list.push(name);
          }
        }
      }
    }
    closeSync(fd);
  } catch (err) {
  }
  return list;
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

export async function getDirectoryStats(dirPath) {
  let size = 0, mtimeMs = 0;
  const names = await readdir(dirPath);
  for (const name of names) {
    const path = join(dirPath, name);
    let info = await stat(path);
    if(info.isDirectory()) {
      info = await getDirectoryStats(path);
    } else if (!info.isFile()) {
      continue;
    }
    size += info.size;
    if (mtimeMs < info.mtimeMs) {
      mtimeMs = info.mtimeMs;
    }
  }
  return { size, mtimeMs };
}

export async function copyZonFile(srcPath, dstPath) {
  const srcDir = dirname(srcPath);
  const dstDir = dirname(dstPath);
  const srcCode = await readFile(srcPath, 'utf-8');
  const dstCode = srcCode.replace(/(\.path\s+=\s+")(.*?)(")/g, (m0, pre, path, post) => {
    const srcModulePath = resolve(srcDir, path);
    const dstModulePath = relative(dstDir, srcModulePath);
    return pre + dstModulePath + post;
  });
  await writeFile(dstPath, dstCode);
}