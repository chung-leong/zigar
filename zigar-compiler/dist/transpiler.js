import childProcess from 'node:child_process';
import { createHash } from 'node:crypto';
import fs, { open, readdir, lstat, rmdir, unlink, readFile, stat, mkdir, writeFile, chmod, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import { sep, dirname, join, resolve, relative, parse, basename, isAbsolute } from 'node:path';
import { fileURLToPath, URL as URL$1 } from 'node:url';
import { promisify } from 'node:util';
import { writeFileSync } from 'node:fs';

const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  Union: 3,
  ErrorUnion: 4,
  ErrorSet: 5,
  Enum: 6,
  Optional: 7,
  Pointer: 8,
  Slice: 9,
  Vector: 10,
  Opaque: 11,
  ArgStruct: 12,
  VariadicStruct: 13,
  Function: 14,
};
const StructurePurpose = {
  Unknown: 0,
  Promise: 1,
  Generator: 2,
  AbortSignal: 3,
  Allocator: 4,
  Iterator: 5,
  Reader: 6,
  Writer: 7,
  File: 8,
  Directory: 9,
};
const structureNames = Object.keys(StructureType);
const StructureFlag = {
  HasValue: 1 << 0,
  HasObject: 1 << 1,
  HasPointer: 1 << 2,
  HasSlot: 1 << 3,
  HasProxy: 1 << 4,
};
const PrimitiveFlag = {
  IsSize: 1 << 5,
};
const ArrayFlag = {
  HasSentinel: 1 << 5,
  IsString: 1 << 6,
  IsTypedArray: 1 << 7,
  IsClampedArray: 1 << 8,
};
const StructFlag = {
  IsExtern: 1 << 5,
  IsPacked: 1 << 6,
  IsTuple: 1 << 7,
  IsOptional: 1 << 8,
};
const UnionFlag = {
  HasSelector: 1 << 5,
  HasTag: 1 << 6,
  HasInaccessible: 1 << 7};
const EnumFlag = {
  IsOpenEnded: 1 << 5,
};
const OptionalFlag = {
  HasSelector: 1 << 5,
};
const PointerFlag = {
  HasLength: 1 << 5,
  IsMultiple: 1 << 6,
  IsSingle: 1 << 7,
  IsConst: 1 << 8,
  IsNullable: 1 << 9,
};
const SliceFlag = {
  HasSentinel: 1 << 5,
  IsString: 1 << 6,
  IsTypedArray: 1 << 7,
  IsClampedArray: 1 << 8,
  IsOpaque: 1 << 9,
};
const ErrorSetFlag = {
  IsGlobal: 1 << 5,
};
const VectorFlag = {
  IsTypedArray: 1 << 5,
  IsClampedArray: 1 << 6,
};
const ArgStructFlag = {
  HasOptions: 1 << 5,
  IsThrowing: 1 << 6,
  IsAsync: 1 << 7,
};
const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Uint: 3,
  Float: 4,
  Object: 5,
  Type: 6,
  Literal: 7,
  Null: 8,
  Undefined: 9,
  Unsupported: 10,
};
const memberNames = Object.keys(MemberType);
const MemberFlag = {
  IsRequired:       0x0001,
  IsReadOnly:       0x0002,
  IsPartOfSet:      0x0004,
  IsMethod:         0x0010,
  IsBackingInt:     0x0040,
  IsString:         0x0080,
  IsPlain:          0x0100,
  IsTypedArray:     0x0200,
  IsClampedArray:   0x0400,
};
const ProxyType = {
  Pointer: 1 << 0,
  Slice: 1 << 1,
  Const: 1 << 2,  
  ReadOnly: 1 << 3,
};
const ModuleAttribute = {
  LittleEndian:     0x0001,
  RuntimeSafety:    0x0002,
  LibC:             0x0004,
  IoRedirection:    0x0008,
};
const VisitorFlag = {
  IsInactive:       0x0001,
  IsImmutable:      0x0002,

  IgnoreUncreated:  0x0004,
  IgnoreInactive:   0x0008,
  IgnoreArguments:  0x0010,
  IgnoreRetval:     0x0020,
};
const PosixError = { // values mirror std.os.wasi.errno_t
  NONE: 0,  
  EACCES: 2,
  EAGAIN: 6,
  EBADF: 8,
  EDEADLK: 16,
  EEXIST: 20,
  EFAULT: 21,
  EINVAL: 28,
  EIO: 29,
  EMFILE: 34,
  ENOENT: 44,
  ENOTSUP: 58,
  EPERM: 63,
  ESPIPE: 70,
  ENOTCAPABLE: 76,
};
const PosixFileType = {
  unknown: 0,
  blockDevice: 1,
  characterDevice: 2,
  directory: 3,
  file: 4,
  socketDgram: 5,
  socketStream: 6,
  symbolicLink: 7,
};
const PosixOpenFlag = {
  create: 1 << 0,
  directory: 1 << 1,
  exclusive: 1 << 2,
  truncate: 1 << 3,
};
const PosixLookupFlag = {
  symlinkFollow: 1 << 0,
};
const PosixDescriptorRight = {
  fd_datasync: 1 << 0,
  fd_read: 1 << 1,
  fd_seek: 1 << 2,
  fd_fdstat_set_flags: 1 << 3,
  fd_sync: 1 << 4,
  fd_tell: 1 << 5,
  fd_write: 1 << 6,
  fd_advise: 1 << 7,
  fd_allocate: 1 << 8,
  path_create_directory: 1 << 9,
  path_create_file: 1 << 10,
  path_link_source: 1 << 11,
  path_link_target: 1 << 12,
  path_open: 1 << 13,
  fd_readdir: 1 << 14,
  path_readlink: 1 << 15,
  path_rename_source: 1 << 16,
  path_rename_target: 1 << 17,
  path_filestat_get: 1 << 18,
  path_filestat_set_size: 1 << 19,
  path_filestat_set_times: 1 << 20,
  fd_filestat_get: 1 << 21,
  fd_filestat_set_size: 1 << 22,
  fd_filestat_set_times: 1 << 23,
  path_symlink: 1 << 24,
  path_remove_directory: 1 << 25,
  path_unlink_file: 1 << 26,
  poll_fd_readwrite: 1 << 27,
  sock_shutdown: 1 << 28,
  sock_accept: 1 << 29,
};
const PosixDescriptorFlag = {
  append: 1 << 0,
  dsync: 1 << 1,
  nonblock: 1 << 2,
  rsync: 1 << 3,
  sync: 1 << 4,
};
const PosixDescriptor = {
  stdin: 0,
  stdout: 1,
  stderr: 2,
  root: -1,

  min: 0x00f0_0000,
  max: 0x00ff_ffff, 
};
const PosixPollEventType = {
  CLOCK: 0,
  FD_READ: 1,
  FD_WRITE: 2,
};

const dict = globalThis[Symbol.for('ZIGAR')] ||= {};

function __symbol(name) {
  return dict[name] ||= Symbol(name);
}

function symbol(name) {
  return /*@__PURE__*/ __symbol(name);
}

const MEMORY = symbol('memory');
const SLOTS = symbol('slots');
const PARENT = symbol('parent');
const ZIG = symbol('zig');
const NAME = symbol('name');
const TYPE = symbol('type');
const FLAGS = symbol('flags');
const CLASS = symbol('class');
const TAG = symbol('tag');
const PROPS = symbol('props');
const SENTINEL = symbol('sentinel');
const TARGET = symbol('target');
const ENTRIES = symbol('entries');
const MAX_LENGTH = symbol('max length');
const KEYS = symbol('keys');
const ADDRESS = symbol('address');
const LENGTH = symbol('length');
const LAST_ADDRESS = symbol('last address');
const LAST_LENGTH = symbol('last length');
const CACHE = symbol('cache');
const SIZE = symbol('size');
const BIT_SIZE = symbol('bit size');
const ALIGN = symbol('align');
const ENVIRONMENT = symbol('environment');
const ATTRIBUTES = symbol('attributes');
const PRIMITIVE = symbol('primitive');
const GETTERS = symbol('getters');
const SETTERS = symbol('setters');
const TYPED_ARRAY = symbol('typed array');
const THROWING = symbol('throwing');
const PROMISE = symbol('promise');
const GENERATOR = symbol('generator');
const ALLOCATOR = symbol('allocator');
const SIGNATURE = symbol('signature');
const CONTROLLER = symbol('controller');
const PROXY_TYPE = symbol('proxy type');
const READ_ONLY = symbol('read only');
const NO_CACHE = symbol('no cache');

const UPDATE = symbol('update');
const RESTORE = symbol('restore');
const RESET = symbol('reset');
const VIVIFICATE = symbol('vivificate');
const VISIT = symbol('visit');
const SHAPE = symbol('shape');
const INITIALIZE = symbol('initialize');
const RESTRICT = symbol('restrict');
const FINALIZE = symbol('finalize');
const PROXY = symbol('proxy');
const CAST = symbol('cast');
const RETURN = symbol('return');
const YIELD = symbol('yield');
const TRANSFORM = symbol('transform');

function defineProperty(object, name, descriptor) {
  if (descriptor) {
    const {
      set,
      get,
      value,
      enumerable,
      configurable = true,
      writable = true,
    } = descriptor;
    Object.defineProperty(object, name, (get || set)
      ? { get, set, configurable, enumerable }
      : { value, configurable, enumerable, writable }
    );
  }
  return object;
}

function defineProperties(object, descriptors) {
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    defineProperty(object, name, descriptor);
  }
  for (const symbol of Object.getOwnPropertySymbols(descriptors)) {
    const descriptor = descriptors[symbol];
    defineProperty(object, symbol, descriptor);
  }
  return object;
}

function defineValue(value) {
  return (value !== undefined) ? { value } : undefined;
}

function getErrorHandler(options) {
  return (options?.error === 'return')
  ? (cb) => {
      try {
        return cb();
      } catch (err) {
        return err;
      }
    }
  : (cb) => cb();
}

function getPrimitiveName({ type, bitSize }) {
  switch (type) {
    case MemberType.Bool: return 'boolean';
    case MemberType.Int:
    case MemberType.Uint:
      if (bitSize > 32) {
        return 'bigint';
      }
    case MemberType.Float: return 'number';
  }
}

function decodeText(arrays, encoding = 'utf-8') {
  const decoder = decoders[encoding] ||= new TextDecoder(encoding);
  let array;
  if (Array.isArray(arrays)) {
    if (arrays.length === 1) {
      array = arrays[0];
    } else {
      let len = 0;
      for (const a of arrays) {
        len += a.length;
      }
      const { constructor } = arrays[0];
      array = new constructor(len);
      let offset = 0;
      for (const a of arrays) {
        array.set(a, offset);
        offset += a.length;
      }
    }
  } else {
    array = arrays;
  }
  if (array.buffer[Symbol.toStringTag] === 'SharedArrayBuffer') {
    array = new array.constructor(array);
  }
  return decoder.decode(array);
}

function encodeText(text, encoding = 'utf-8') {
  switch (encoding) {
    case 'utf-16': {
      const { length } = text;
      const ta = new Uint16Array(length);
      for (let i = 0; i < length; i++) {
        ta[i] = text.charCodeAt(i);
      }
      return ta;
    }
    default: {
      const encoder = encoders[encoding] ||= new TextEncoder();
      return encoder.encode(text);
    }
  }
}

function encodeBase64(dv) {
  const ta = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  const bstr = String.fromCharCode.apply(null, ta);
  return btoa(bstr);
}

function decodeBase64(str) {
  const bstr = atob(str);
  const ta = new Uint8Array(bstr.length);
  for (let i = 0; i < ta.byteLength; i++) {
    ta[i] = bstr.charCodeAt(i);
  }
  return new DataView(ta.buffer);
}

const decoders = {};
const encoders = {};

function findSortedIndex(array, value, cb) {
  let low = 0;
  let high = array.length;
  if (high === 0) {
    return 0;
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const value2 = cb(array[mid]);
    if (value2 <= value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return high;
}

function isMisaligned(address, align) {
  {
    return (align) ? !!(address & (align - 1)) : false;
  }
}

function alignForward(address, align) {
  {
    return (address + (align - 1)) & ~(align - 1);
  }
}

const usizeMin = 0;
const usizeMax = 0xFFFF_FFFF;
const usizeInvalid = -1;
const usizeByteSize = 4;

function usize(number) {
  {
    return Number(number);
  }
}

const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);
const minSafeInteger = BigInt(Number.MIN_SAFE_INTEGER);

function safeInt(bigInt) {
  if (bigInt > maxSafeInteger || bigInt < minSafeInteger) {
    throw new RangeError('Number is too big/small');
  }
  return Number(bigInt);
}

function readUsize(dv, offset, le) {
  {
    return dv.getUint32(offset, le);
  }
}

function readUsizeSafe(dv, offset, le) {
  {
    return readUsize(dv, offset, le);
  }
}

function isInvalidAddress(address) {
  {
    return address === 0xaaaa_aaaa || address === -1431655766;
  }
}

function adjustAddress(address, addend) {
  {
    return address + addend;
  }
}

function transformIterable(arg) {
  if (typeof(arg.length) === 'number') {
    // it's an array of sort
    return arg;
  }
  const iterator = arg[Symbol.iterator]();
  const first = iterator.next();
  const length = first.value?.length;
  if (typeof(length) === 'number' && Object.keys(first.value).join() === 'length') {
    // return generator with length attached
    return Object.assign((function*() {
      let result;
      while (!(result = iterator.next()).done) {
        yield result.value;
      }
    })(), { length });
  } else {
    const array = [];
    let result = first;
    while (!result.done) {
      array.push(result.value);
      result = iterator.next();
    }
    return array;
  }
}

function findElements(arg, Child) {
  // casting to a array/slice
  const { constructor: Arg } = arg;
  if (Arg === Child) {
    // matching object
    return 1;
  } else if (Arg.child === Child) {
    // matching slice/array
    return arg.length;
  }
}

function findObjects(structures, SLOTS) {
  const list = [];
  const found = new Map();
  const find = (object) => {
    if (!object || found.get(object)) {
      return;
    }
    found.set(object, true);
    list.push(object);
    if (object[SLOTS]) {
      for (const child of Object.values(object[SLOTS])) {
        find(child);
      }
    }
  };
  for (const structure of structures) {
    find(structure.instance.template);
    find(structure.static.template);
  }
  return list;
}

function isCompatibleType(TypeA, TypeB) {
  return (TypeA === TypeB)
      || ((TypeA?.[SIGNATURE] === TypeB[SIGNATURE]) && (TypeA?.[ENVIRONMENT] !== TypeB?.[ENVIRONMENT]));
}

function isCompatibleInstanceOf(object, Type) {
  return (object instanceof Type) || isCompatibleType(object?.constructor, Type);
}

function hasMethod(object, name) {
  return typeof(object?.[name]) === 'function';
}

function isPromise(object) {
  return typeof(object?.then) === 'function';
}

function decodeFlags(flags, set) {
  const object = {};
  for (const [ name, value ] of Object.entries(set)) {
    if (flags & value) {
      object[name] = true;
    }
  }
  return object;
}

function getEnumNumber(string, set) {
  for (const [ name, value ] of Object.entries(set)) {
    if (name === string) {
      return value;
    }
  }
}

function markAsSpecial({ get, set }) {
  get.special = set.special = true;
  return { get, set };
}

function createView(size) {
  return new DataView(new ArrayBuffer(size));
}

function copyView(dest, src, offset = 0) {
  const destA = new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength);
  const srcA = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
  destA.set(srcA, offset);
}

function clearView(dest, offset = 0, len = dest.byteLength - offset) {
  const destA = new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength);
  destA.fill(0, offset, offset + len);
}

const isDetached = (Object.hasOwn(ArrayBuffer.prototype, 'detached')) 
? function(buffer) {
    return buffer.detached;
  }
: function(buffer) {
  return buffer.byteLength === 0;
};
function copyObject(dest, src) {
  const destDV = dest[RESTORE]() ;
  const srcDV = src[RESTORE]() ;
  copyView(destDV, srcDV);
}

function getSelf() {
  return this;
}

function toString() {
  return String(this);
}

function empty() {}

class ObjectCache {
  map = new WeakMap();

  find(dv) {
    return (!dv[NO_CACHE]) ? this.map.get(dv) : undefined;
  }

  save(dv, object) {
    if (!dv[NO_CACHE]) {
      this.map.set(dv, object);
    }
  }
}

const TimeFlag = {
  atime: 1 << 0,
  atime_now: 1 << 1,
  mtime: 1 << 2,
  mtime_now: 1 << 3,
};

const now = () => new Date() * 1000;

function extractTimes(st_atim, st_mtim, fst_flags) {
  const times = {};
  if (fst_flags & TimeFlag.atime) {
    times.atime = st_atim;
  } else if (fst_flags & TimeFlag.atime_now) {
    times.atime = now();
  }
  if (fst_flags & TimeFlag.mtime) {
    times.mtime = st_mtim;
  } else if (fst_flags & TimeFlag.mtime_now) {
    times.mtime = now();
  }
  return times;
}

const require = createRequire(import.meta.url);
const execFile$1 = promisify(childProcess.execFile);

async function acquireLock(pidPath, wait = true, staleTime = 60000 * 5) {
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

async function releaseLock(pidPath) {
  await deleteFile(pidPath);
}

async function checkPidFile(pidPath, staleTime) {
  let stale = false;
  try {
    const pid = await loadFile(pidPath);
    if (pid) {
      const win32 = os.platform() === 'win32';
      const program = (win32) ? 'tasklist' : 'ps';
      const args = (win32) ? [ '/nh', '/fi', `pid eq ${pid}` ] : [ '-p', pid ];
      const { stdout } = await execFile$1(program, args, { windowsHide: true });
      if (win32 && !stdout.includes(pid)) {
        throw new Error('Process not found');
      }
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

async function copyFile(dstPath, srcPath) {
  const info = await stat(srcPath);
  const data = await readFile(srcPath);
  await writeFile(dstPath, data);
  await chmod(dstPath, info.mode);
}

async function loadFile(path, def) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    return def;
  }
}

async function deleteFile(path) {
  try {
    await unlink(path);
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
      throw err;
    }
  }
}

async function createDirectory(path) {
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

async function deleteDirectory(dir) {
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

async function delay(ms) {
  await new Promise(r => setTimeout(r, ms));
}

function sha1(text) {
  const hash = createHash('sha1');
  hash.update(text);
  return hash.digest('hex');
}

// this function (along with getArch() and getLibraryExt()) need to be self-contained 
// such that we'd have functional code if we use toString() on it; it can only depend
// on the variable 'os' being available
function getPlatform() {
  let platform = os.platform();
  if (platform === 'linux') {
    // differentiate glibc from musl
    if (process.__gnu === undefined) {
      /* c8 ignore next 3 */
      if (process.versions?.electron || process.__nwjs) {
        process.__gnu = true;
      } else {
        const list = [];
        try {
          // scan ELF executable for imported shared libraries
          const { closeSync, openSync, readSync } = require('fs');
          const fd = openSync(process.execPath, 'r');
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
            // deno can't handle bigint position
            readSync(fd, buf, { position: Number(position) });
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
            const sectionType = shdr.getUint32(Shdr.sh_type, le);
            if (sectionType == SHT_DYNAMIC) {
              const link = shdr.getUint32(Shdr.sh_link, le);
              const strTableOffset = shdrs[link].getUsize(Shdr.sh_offset, le);
              const strTableSize = shdrs[link].getUsize(Shdr.sh_size, le);
              const strTable = read(strTableOffset, strTableSize);
              const dynamicOffset = shdr.getUsize(Shdr.sh_offset, le);
              const dynamicSize = shdr.getUsize(Shdr.sh_size, le);
              const entryCount = Number(dynamicSize / Usize(Dyn.size));
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
        process.__gnu = (list.length > 0) ? list.indexOf('libc.so.6') != -1 : true;
      }
    }
    /* c8 ignore next 3 */
    if (!process.__gnu) {
      platform += '-musl';
    }
  }
  return platform;
}

function getArch() {
  return os.arch();
}

function getLibraryExt(platform) {
  switch (platform) {
    case 'win32': return 'dll';
    case 'darwin': return 'dylib';
    default: return 'so';
  }
}

function normalizePath(url) {
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

async function getDirectoryStats(dirPath) {
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

async function copyZonFile(srcPath, dstPath) {
  const srcDir = await realpath(dirname(srcPath));
  const dstDir = await realpath(dirname(dstPath));
  const srcCode = await readFile(srcPath, 'utf-8');
  const dstCode = srcCode.replace(/(\.path\s+=\s+)"(.*?)"/g, (m0, pre, path) => {
    const srcModulePath = resolve(srcDir, path);
    const dstModulePath = relative(dstDir, srcModulePath);
    return pre + JSON.stringify(dstModulePath);
  });
  await writeFile(dstPath, dstCode);
}

function generateCode(definition, params) {
  const { structures } = definition;
  const {
    runtimeURL,
    binarySource = null,
    topLevelAwait = true,
    omitExports = false,
    mixinPaths = [],
    moduleOptions,
    envVariables = {},
    standaloneLoader,
  } = params;
  const exports = getExports(structures);
  const lines = [];
  const type = standaloneLoader?.type ?? 'esm';
  const add = manageIndentation(lines);
  if (standaloneLoader) {
    const { addonDir } = standaloneLoader;
    if (type === 'esm') {
      add(`import { createRequire } from 'node:module';`);
      add(`import os from 'node:os';`);
      add(`import { dirname, resolve } from 'node:path';`);
      add(`import { fileURLToPath } from 'node:url';`);
      add(``);
      add(`const require = createRequire(import.meta.url);`);
      add(`const __dirname = dirname(fileURLToPath(import.meta.url));`);
    } else {
      add(`const os = require('os');`);
      add(`const { resolve } = require('path');`);
      add(``);
    }
    add(`const platform = getPlatform();`);
    add(`const arch = getArch();`);
    add(`const ext = getLibraryExt(platform);`);
    add(`const moduleName = \`\${platform}.\${arch}.\${ext}\`;`);
    add(`const addonName = \`\${platform}.\${arch}.node\`;`);
    add(`const { createEnvironment } = require(resolve(__dirname, ${JSON.stringify(addonDir)}, addonName));`);
  } else {
    // loading through node-zigar/bun-zigar
    add(`import { createEnvironment } from ${JSON.stringify(runtimeURL)};`);
  }
  for (const mixinPath of mixinPaths) {
    add(`import '${runtimeURL}/${mixinPath}';`);
  }
  // write out the structures as object literals
  addStructureDefinitions(lines, definition);
  if (Object.keys(envVariables).length > 0) {
    add(`\n// set environment variables`);
    for (const [ name, value ] of Object.entries(envVariables)) {
      add(`process.env.${name} = ${JSON.stringify(value)};`);
    }
  }
  add(`\n// create runtime environment`);
  add(`const env = createEnvironment();`);
  add(`\n// recreate structures`);
  add(`env.recreateStructures(structures, settings);`);
  if (binarySource) {
    if (moduleOptions) {
      add(`\n// initiate loading and compilation of WASM bytecodes`);
    } else {
      add(`\n// load shared library`);
    }
    add(`const source = ${binarySource};`);
    const loadOptions = (moduleOptions) ? {
      delay: !topLevelAwait,
      ...moduleOptions,
    } : null;
    add(`env.loadModule(source, ${loadOptions ? JSON.stringify(loadOptions) : null});`);
    // if top level await is used, we don't need to write changes into Zig memory buffers
    add(`env.linkVariables(${!topLevelAwait});`);
  } else if (standaloneLoader?.moduleDir) {
    const { moduleDir } = standaloneLoader;
    add(`env.loadModule(resolve(__dirname, ${JSON.stringify(moduleDir)}, moduleName));`);
    // write-back is never necessary in Node/Bun/Deno since loadModule() is synchronous
    add(`env.linkVariables(false);`);
  }
  add(`\n// export root namespace and its methods and constants`);
  let specialVarName;
  if (!omitExports) {
    // the first two exports are default and __zigar
    add(`const { constructor: v0 } = root;`);
    add(`const v1 = env.getSpecialExports();`);
    specialVarName = 'v1';
    if (exports.length > 2) {
      add(`const {`);
      for (const [ index, name ] of exports.entries()) {
        if (index >= 2) {
          add(`${name}: v${index},`);
        }
      }
      add(`} = v0;`);
    }
    if (type == 'esm') {
      add(`export {`);
      for (const [ index, name ] of exports.entries()) {
        add(`v${index} as ${name},`);
      }
      add(`};`);
    } else {
      add(`module.exports = {`);
      for (const [ index, name ] of exports.entries()) {
        add(`${name}: v${index},`);
      }
      add(`};`);
    }
  } else {
    add(`const { constructor } = root;`);
    add(`const __zigar = env.getSpecialExports();`);
    specialVarName = '__zigar';
  }
  if (moduleOptions && topLevelAwait && binarySource) {
    add(`await ${specialVarName}.init();`);
  }
  if (standaloneLoader) {
    add(`\n${getPlatform}`);
    add(`\n${getArch}`);
    add(`\n${getLibraryExt}`);
  }
  const code = lines.join('\n');
  return { code, exports, structures };
}

function addStructureDefinitions(lines, definition) {
  const { structures, settings } = definition;
  const add = manageIndentation(lines);
  const defaultStructure = {
    constructor: null,
    type: StructureType.Primitive,
    purpose: StructurePurpose.Unknown,
    flags: 0,
    signature: undefined,
    name: undefined,
    byteSize: undefined,
    align: 0,
    instance: {
      members: [],
      template: null,
    },
    static: {
      members: [],
      template: null,
    },
  };
  add(`\n// structure defaults`);
  add(`const s = {`);
  for (const [ name, value ] of Object.entries(defaultStructure)) {
    switch (name) {
      case 'instance':
      case 'static':
        add(`${name}: {`);
        for (const [ name2, value2 ] of Object.entries(value)) {
          add(`${name2}: ${JSON.stringify(value2)},`);
        }
        add(`},`);
        break;
      default:
        add(`${name}: ${JSON.stringify(value)},`);
    }
  }
  add(`};`);
  const defaultMember = {
    type: MemberType.Void,
    flags: 0,
  };
  add(`\n// member defaults`);
  add(`const m = {`);
  for (const [ name, value ] of Object.entries(defaultMember)) {
    add(`${name}: ${JSON.stringify(value)},`);
  }
  add(`};`);
  // create empty objects first, to allow objects to reference each other
  const structureNames = new Map();
  const structureMap = new Map();
  for (const [ index, structure ] of structures.entries()) {
    const varname = `s${index}`;
    structureNames.set(structure, varname);
    structureMap.set(structure.constructor, structure);
  }
  if (structureNames.size > 0) {
    add('\n// declare structure objects');
    for (const slice of chunk(structureNames.values(), 10)) {
      add(`const ${slice.map(n => `${n} = {}`).join(', ')};`);
    }
  }
  const objects = findObjects(structures, SLOTS);
  const objectNames = new Map();
  const views = [];
  for (const [ index, object ] of objects.entries()) {
    const varname = `o${index}`;
    objectNames.set(object, varname);
    if (object[MEMORY]) {
      views.push(object[MEMORY]);
    }
  }
  if (objectNames.size > 0) {
    add('\n// declare objects');
    for (const slice of chunk(objectNames.values(), 10)) {
      add(`const ${slice.map(n => `${n} = {}`).join(', ')};`);
    }
  }
  // define buffers
  const arrayBufferNames = new Map();
  let hasU;
  const addU = () => {
    if (!hasU) {
      add('\n// define byte arrays');
      add(`const U = i => new Uint8Array(i);`);
      hasU = true;
    }
  };
  let arrayCount = 0;
  const emptyBuffer = new ArrayBuffer(0);
  const zeroInit = function(ta) {
    for (const byte of ta) {
      if (byte !== 0) {
        return;
      }
    }
    return `${ta.length}`;
  };
  const existingInit = function(ta) {
    for (const [ buffer, name ] of arrayBufferNames) {
      if (buffer.byteLength === ta.byteLength) {
        const existing = new Uint8Array(buffer);
        let different = false;
        for (let i = 0; i < ta.length; i++) {
          if (existing[i] !== ta[i]) {
            different = true;
            break;
          }
        }
        if (!different) {
          return name;
        }
      }
    }
  };
  const listInit = function(ta) {
    return `[ ${ta.join(', ')} ]`;
  };
  for (const dv of views) {
    addU();
    const buffer = (dv.buffer.byteLength > 0) ? dv.buffer : emptyBuffer;
    if (!arrayBufferNames.get(buffer)) {
      const varname = `a${arrayCount++}`;
      const a = new Uint8Array(dv.buffer);
      add(`const ${varname} = U(${zeroInit(a) ?? existingInit(a) ?? listInit(a)});`);
      arrayBufferNames.set(buffer, varname);
    }
  }
  // add properties to objects
  let has$ = false;
  const add$ = () => {
    if (!has$) {
      add('\n// fill in object properties');
      add(`const $ = Object.assign;`);
      has$ = true;
    }
  };
  if (objects.length > 0) {
    for (const object of objects) {
      const varname = objectNames.get(object);
      const structure = structureMap.get(object.constructor);
      const { [MEMORY]: dv, [SLOTS]: slots } = object;
      add$();
      add(`$(${varname}, {`);
      if (structure) {
        add(`structure: ${structureNames.get(structure)},`);
      }
      if (dv) {
        const buffer = (dv.buffer.byteLength > 0) ? dv.buffer : emptyBuffer;
        const pairs = [ `array: ${arrayBufferNames.get(buffer)}` ];
        if (dv.byteLength < buffer.byteLength) {
          pairs.push(`offset: ${dv.byteOffset}`);
          pairs.push(`length: ${dv.byteLength}`);
        }
        add(`memory: { ${pairs.join(', ')} },`);
        const { handle } = dv;
        if (handle) {
          add(`handle: ${handle},`);
        }
      }
      if (slots) {
        const pairs = [];
        for (const [ slot, child ] of Object.entries(slots)) {
          const varname = objectNames.get(child);
          if (varname) {
            pairs.push(`${slot}: ${varname}`);
          }
        }
        if (pairs.length > 0) {
          add(`slots: {`);
          for (const slice of chunk(pairs, 10)) {
            add(slice.join(', ') + ',');
          }
          add(`},`);
        }
      }
      add(`});`);
    }
  }
  if (structures.length > 0) {
    add('\n// fill in structure properties');
    for (const structure of structures) {
      const varname = structureNames.get(structure);
      add$();
      add(`$(${varname}, {`);
      add(`...s,`);
      for (const [ name, value ] of Object.entries(structure)) {
        if (isDifferent(value, defaultStructure[name])) {
          switch (name) {
            case 'constructor':
            case 'typedArray':
            case 'sentinel':
              break;
            case 'signature':
              add(`${name}: 0x${value.toString(16).padStart(16, '0')}n,`);
              break;
            case 'instance':
            case 'static': {
              const { members, template } = value;
              add(`${name}: {`);
              add(`members: [`);
              if (members) {
                for (const member of members) {
                  add(`{`);
                  add(`...m,`);
                  for (const [ name, value ] of Object.entries(member)) {
                    if (isDifferent(value, defaultMember[name])) {
                      switch (name) {
                        case 'structure':
                          add(`${name}: ${structureNames.get(value)},`);
                          break;
                        default:
                          add(`${name}: ${JSON.stringify(value)},`);
                      }
                    }
                  }
                  add(`},`);
                }
              }
              add(`],`);
              if (template) {
                add(`template: ${objectNames.get(template)}`);
              }
              add(`},`);
            } break;
            default:
              add(`${name}: ${JSON.stringify(value)},`);
          }
        }
      }
      add(`});`);
    }
  }
  add(`const structures = [`);
  for (const slice of chunk([ ...structureNames.values() ], 10)) {
    add(slice.join(', ') + ',');
  }
  add(`];`);
  const root = structures[structures.length - 1];
  add(`const root = ${structureNames.get(root)};`);
  add(`const settings = {`);
  for (const [ name, value ] of Object.entries(settings)) {
    add(`${name}: ${value},`);
  }
  add(`};`);
  return lines;
}

function getExports(structures) {
  const root = structures[structures.length - 1];
  const { constructor } = root;
  const exportables = [];
  // export only members whose names are legal JS identifiers
  const legal = /^[$\w]+$/;
  for (const { name, flags } of root.static.members) {
    // only read-only properties are exportable
    if (flags & MemberFlag.IsReadOnly && legal.test(name)) {
      try {
        // make sure that getter wouldn't throw (possible with error union)
        constructor[name];
        exportables.push(name);
        /* c8 ignore next 2 */
      } catch (err) {
      }
    }
  }
  return [ 'default', '__zigar', ...exportables ];
}

function manageIndentation(lines) {
  let indent = 0;
  return (s) => {
    if (/^\s*[\]\}]/.test(s)) {
      indent--;
    }
    const lastLine = lines[lines.length - 1];
    if ((lastLine?.endsWith('[') && s.startsWith(']'))
     || (lastLine?.endsWith('{') && s.startsWith('}'))) {
      lines[lines.length - 1] += s;
    } else {
      lines.push(' '.repeat(indent * 2) + s);
    }
    if (/[\[\{]\s*$/.test(s)) {
      indent++;
    }
  };
}

function isDifferent(value, def) {
  if (value === def) {
    return false;
  }
  if (def == null) {
    return value != null;
  }
  if (typeof(def) === 'object' && typeof(value) === 'object') {
    const valueKeys = Object.keys(value);
    const defKeys = Object.keys(def);
    if (valueKeys.length !== defKeys.length) {
      return true;
    }
    for (const key of defKeys) {
      if (isDifferent(value[key], def[key])) {
        return true;
      }
    }
    return false;
  }
  return true;
}

function* chunk(arr, n) {
  if (!Array.isArray(arr)) {
    arr = [ ...arr ];
  }
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}

const execFile = promisify(childProcess.execFile);

async function compile(srcPath, modPath, options) {
  const srcInfo = (srcPath) ? await stat(srcPath) : null;
  if (srcInfo?.isDirectory()) {
    srcPath = join(srcPath, '?');
  }
  const config = createConfig(srcPath, modPath, options);
  const { moduleDir, outputPath, ignoreBuildFile } = config;
  let changed = false;
  let sourcePaths = [];
  if (srcPath) {
    if (!ignoreBuildFile) {
      try {
        // add custom build file if one is found
        const path = moduleDir + 'build.zig';
        const code = await readFile(path, 'utf-8');
        const remaining = code.replace(/\/\/.*/g, '').trim();
        if (remaining) {
          config.buildFilePath = path;
        }
      } catch (err) {
      }
    }
    try {
      // add path to build.extra.zig if it exists
      const path = moduleDir + 'build.extra.zig';
      await stat(path);
      config.extraFilePath = path;
    } catch (err) {
    }
    try {
    // add package manager manifest
      const path = moduleDir + 'build.zig.zon';
      await stat(path);
      config.packageConfigPath = path;
    } catch (err) {
    }
    const { zigPath, zigArgs, moduleBuildDir, pdbPath, optimize } = config;
    // only one process can compile a given file at a time
    const pidPath = `${moduleBuildDir}.pid`;
    await acquireLock(pidPath);
    const getOutputMTime = async () => {
      try {
        const stats = await stat(outputPath);
        return stats.mtimeMs;
      } catch (err) {
      }
    };
    const outputMTimeBefore = await getOutputMTime();
    try {
      if (!outputMTimeBefore || options.recompile !== false) {
        const { onStart, onEnd } = options;
        // create config file
        await createProject(config, moduleBuildDir);
        // then run the compiler
        await runCompiler(zigPath, zigArgs, { cwd: moduleBuildDir, onStart, onEnd });
      }
    } catch(err) {
      if (err.code === 'ENOENT') {
        if (!outputMTimeBefore) {
          throw new MissingModule(outputPath);
        }
      } else {
        throw err;
      }
    } finally {
      // get list of files involved in build
      sourcePaths = await findSourcePaths(moduleBuildDir);
      if (config.clean) {
        await deleteDirectory(moduleBuildDir);
      }
      if (optimize != 'Debug' && pdbPath) {
        await deleteFile(pdbPath);
      }
      await releaseLock(pidPath);
      cleanBuildDirectory(config).catch(() => {});
    }
    const outputMTimeAfter = await getOutputMTime();
    changed = outputMTimeBefore !== outputMTimeAfter;  
    sourcePaths.push(config.buildFilePath);
    if (config.packageConfigPath) {
      sourcePaths.push(config.packageConfigPath);
    }
  }
  return { outputPath, changed, sourcePaths }
}

let lock = null;

async function getLock() {
  const previous = lock;  
  let unlock;
  lock = new Promise(resolve => unlock = resolve);
  await previous;
  return unlock;
}

async function runCompiler(path, args, options) {
  const {
    cwd,
    onStart,
    onEnd,
  } = options;
  const unlock = await getLock();
  try {
    onStart?.();
    return await execFile(path, args, { cwd, windowsHide: true });
  } catch (err) {
    throw new CompilationError(path, args, cwd, err);
  } finally {
    unlock();
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

function formatProjectConfig(config) {
  const lines = [];
  const fields = [
    'moduleName', 'modulePath', 'moduleDir', 'outputPath', 'pdbPath', 'zigarSrcPath', 'useLibc', 
    'useRedirection', 'isWASM', 'multithreaded', 'stackSize', 'maxMemory', 'evalBranchQuota', 
    'omitFunctions', 'omitVariables',
  ];
  for (const [ name, value ] of Object.entries(config)) {
    if (fields.includes(name)) {
      const snakeCase = name.replace(/[A-Z]+/g, m => '_' + m.toLowerCase());
      lines.push(`pub const ${snakeCase} = ${JSON.stringify(value ?? null)};`);
    }
  }
  return lines.join('\n') + '\n';
}

async function createProject(config, dir) {
  await createDirectory(dir);
  const content = formatProjectConfig(config);
  const cfgFilePath = join(dir, 'build.cfg.zig');
  await writeFile(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  await copyFile(buildFilePath, config.buildFilePath);
  const extraFilePath = join(dir, 'build.extra.zig');
  if (config.extraFilePath) {
    await copyFile(extraFilePath, config.extraFilePath);
  } else {
    await writeFile(extraFilePath, '');
  }
  if (config.packageConfigPath) {
    const packageConfigPath = join(dir, 'build.zig.zon');
    await copyZonFile(config.packageConfigPath, packageConfigPath);
  }
}

const cwd = process.cwd();

function getCachePath(options) {
  const {
    cacheDir = join(cwd, '.zigar-cache'),
  } = options;
  return cacheDir;
}

function getModuleCachePath(srcPath, options) {
  const {
    optimize,
  } = options;
  const src = parse(srcPath);
  const folder = basename(src.dir).slice(0, 16).trim() + '-' + sha1(src.dir).slice(0, 8);
  const cacheDir = getCachePath(options);
  return join(cacheDir, folder, optimize, `${src.name}.zigar`);
}

function createConfig(srcPath, modPath, options = {}) {
  const {
    platform = getPlatform(),
    arch = getArch(),
    optimize = 'Debug',
    isWASM = false,
    useLibc = isWASM ? false : true,
    useRedirection = true,
    clean = false,
    buildDir = join(os.tmpdir(), 'zigar-build'),
    buildDirSize = 4294967296,
    zigPath = 'zig',
    zigArgs: zigArgsStr = '',
    multithreaded = (isWASM) ? false : true,
    stackSize = 256 * 1024,
    maxMemory = (isWASM && multithreaded) ? 64 * 1024 * 1024 : undefined,
    evalBranchQuota = 2000000,
    omitFunctions = false,
    omitVariables = false,
    ignoreBuildFile = false,
  } = options;
  const src = parse(srcPath ?? '');
  const mod = parse(modPath ?? '');
  const moduleName = mod.name || src.name;
  const modulePath = (src.name !== '?') ? srcPath : undefined;
  const moduleDir = src.dir + sep;
  const modulePrefix = basename(moduleName).slice(0, 16);
  const moduleHash = sha1(moduleDir).slice(0, 8);
  const moduleBuildDir = join(buildDir, modulePrefix + '-' + moduleHash);
  const outputPath = (() => {
    if (!modPath && isWASM) {
      // save output in build folder
      return join(moduleBuildDir, optimize, `${src.name}.wasm`);
    } else {
      const ext = getLibraryExt(platform);
      return join(modPath, `${platform}.${arch}.${ext}`);
    }
  })();
  let pdbPath;
  if (platform === 'win32') {
    pdbPath = join(modPath, `${platform}.${arch}.pdb`);
  }
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
    zigArgs.push(`-Dtarget=${cpuArch}-${osTag}`);
  }
  if (isWASM && !zigArgs.find(s => /^\-Dcpu=/.test(s))) {
    if (multithreaded) {
      // we need support for atomic operations, among other things
      zigArgs.push(`-Dcpu=generic+atomics+bulk_memory`);
    }
  }
  const zigarSrcPath = fileURLToPath(new URL$1('../zig/', import.meta.url));
  const buildFilePath = join(zigarSrcPath, `build.zig`);
  return {
    platform,
    arch,
    optimize,
    moduleName,
    modulePath,
    moduleDir,
    moduleBuildDir,
    zigarSrcPath,
    buildDir,
    buildDirSize,
    buildFilePath,
    packageConfigPath: undefined,
    outputPath,
    pdbPath,
    clean,
    zigPath,
    zigArgs,
    useLibc,
    useRedirection,
    isWASM,
    multithreaded,
    stackSize,
    maxMemory,
    evalBranchQuota,
    omitFunctions,
    omitVariables,
    ignoreBuildFile,
    extraFilePath: undefined,
  };
}

async function getManifestLists(buildPath) {
  let dirPath;
  let names;
  try {
    dirPath = join(buildPath, '.zig-cache', 'h');
    names = await readdir(dirPath);
    /* c8 ignore next 8 */
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
  const realBuildPath = await realpath(buildPath);
  const manifestPaths = await getManifestLists(realBuildPath);
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
            if(isAbsolute(srcPath) && !srcPath.startsWith(realBuildPath) && !srcPath.includes('/.cache/zig/')) {
              try {
                await stat(srcPath);
                involved[srcPath] = true;
              } catch {};
            }
          }
        }
      }
      /* c8 ignore next 2 */
    } catch (err) {
    }
  }
  return Object.keys(involved);
}

async function cleanBuildDirectory(config) {
  const { buildDir, buildDirSize } = config;
  try {
    const names = await readdir(buildDir);
    const list = [];
    let total = 0;
    for (const name of names) {
      const path = join(buildDir, name);
      const info = await stat(path);
      if (info.isDirectory()) {
        const { size, mtimeMs } = await getDirectoryStats(path);
        total += size;
        list.push({ path, size, mtimeMs });
      }
    }
    list.sort((a, b) => a.mtimeMs - b.mtimeMs);
    let free = Infinity;
    if (fs.statfs) {
      const { bsize, bavail } = await fs.statfs(buildDir);
      free = bsize * bavail;
    }
    for (const { path, size } of list) {
      if (!(total > buildDirSize) && (free > 1073741824)) {
        break;
      }
      try {
        const pidPath = `${path}.pid`;
        await acquireLock(pidPath, false);
        try {
          await deleteDirectory(path);
          total -= size;
          free += size;
        } finally {
          await releaseLock(pidPath);
        }
        /* c8 ignore next 2 */
      } catch (err) {
      }
    }
    /* c8 ignore next 2 */
  } catch (err) {
  }
}

const optionsForCompile = {
  optimize: {
    type: 'string',
    enum: [ 'Debug', 'ReleaseSmall', 'ReleaseFast', 'ReleaseSafe' ],
    title: 'Zig optimization mode',
  },
  omitFunctions: {
    type: 'boolean',
    title: 'Omit all Zig functions',
  },
  omitVariables: {
    type: 'boolean',
    title: 'Omit all variables',
  },
  omitExports: {
    type: 'boolean',
    title: 'Omit export statements',
  },
  evalBranchQuota: {
    type: 'number',
    title: 'Value provided to @setEvalBranchQuota() during export',
  },
  useLibc: {
    type: 'boolean',
    title: 'Link in C standard library',
  },
  useRedirection: {
    type: 'boolean',
    title: 'Redirect IO operations to JavaScript handlers',
  },
  topLevelAwait: {
    type: 'boolean',
    title: 'Use top-level await to load WASM file',
  },
  multithreaded: {
    type: 'boolean',
    title: 'Enable multithreading',
  },
  buildDir: {
    type: 'string',
    title: 'Root directory where temporary build directories are placed',
  },
  cacheDir: {
    type: 'string',
    title: 'Directory where compiled library files are placed',
  },
  zigPath: {
    type: 'string',
    title: 'Zig command used to build libraries',
  },
  zigArgs: {
    type: 'string',
    title: 'Addition command-line passed to the Zig compiler',
  },
  modules: {
    type: 'object',
    title: 'Information concerning individual modules, including source file and loader',
  },
  sourceFiles: {
    type: 'object',
    title: 'Map of modules to source files/directories (legacy)',
  },
  quiet: {
    type: 'boolean',
    title: 'Disable compilation indicator',
  },
  recompile: {
    type: 'boolean',
    title: 'Recompile module when source file have been changed',
  },
  clean: {
    type: 'boolean',
    title: 'Remove temporary build directory after compilation finishes',
  },
  targets: {
    type: 'object',
    title: 'List of cross-compilation targets',
  },
  ignoreBuildFile: {
    type: 'boolean',
    title: 'Ignore build.zig present alongside source files',
  },
};

const optionsForTranspile = {
  nodeCompat: {
    type: 'boolean',
    title: 'Produce code compatible with Node.js',
  },
  embedWASM: {
    type: 'boolean',
    title: 'Embed WASM file in JavaScript source code',
  },
  stripWASM: {
    type: 'boolean',
    title: 'Remove unnecessary code from WASM file',
  },
  stackSize: {
    type: 'number',
    title: 'Size of the call stack in bytes',
  },
  maxMemory: {
    type: 'number',
    title: 'Maximum amount of shared memory in bytes',
  },
  keepNames: {
    type: 'boolean',
    title: 'Keep names of function in WASM binary when stripping',
  },
};

const allOptions = {
  ...optionsForCompile,
  ...optionsForTranspile,
};

function extractOptions(searchParams, availableOptions) {
  const options = {};
  const names = Object.keys(availableOptions);
  for (const [ name, string ] of searchParams) {
    const key = getCamelCase(name, names);
    const option = availableOptions[key];
    if (!option) {
      throw new UnknownOption(name);
    }
    if (key === 'optimize') {
      options[key] = getCamelCase(string, [ 'Debug', 'ReleaseSafe', 'ReleaseFast', 'ReleaseSmall' ]);
    } else {
      switch (option.type) {
        case 'boolean':
          options[key] = !!parseInt(string);
          break;
        case 'number':
          options[key] = parseInt(string);
          break;
        default:
          options[key] = string;
      }
    }
  }
  return options;
}

function getCamelCase(name, names) {
  for (const nameCC of names) {
    const nameSC = nameCC.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    const nameKC = nameSC.replace(/_/g, '-');
    if (name === nameKC || name === nameSC || name === nameCC) {
      return nameCC;
    }
  }
  return name;
}

class UnknownOption extends Error {
  constructor(key) {
    const adjective = (allOptions[key]) ? 'Unavailable' : 'Unrecognized';
    super(`${adjective} option: ${key}`);
  }
}

async function findConfigFile(name, dir) {
  const path = join(dir, name);
  try {
    await stat(path);
    return path;
  } catch (err) {
    const parent = dirname(dir);
    if (parent !== dir) {
      return findConfigFile(name, parent);
    }
  }
}

async function loadConfigFile(cfgPath, availableOptions) {
  const text = await loadFile(cfgPath);
  const json = JSON.parse(text);
  return processConfig(json, cfgPath, availableOptions);
}

function processConfig(object, cfgPath, availableOptions) {
  const options = {};
  for (let [ key, value ] of Object.entries(object)) {
    const option = availableOptions[key];
    if (!option) {
      throw new UnknownOption(key);
    }
    if (typeof(value) !== option.type) {
      throw new Error(`${key} is expected to be a ${option.type}, received: ${value}`);
    }
    if (key === 'sourceFiles') {
      const modules = {};
      for (const [ modulePath, source ] of Object.entries(value)) {
        modules[modulePath] = { source };
      }
      value = modules;
      key = 'modules';
    }
    if (key === 'modules') {
      // expand to absolute paths
      const cfgDir = dirname(cfgPath);
      const modules = {};
      for (let [ modulePath, module ] of Object.entries(value)) {
        modulePath = resolve(cfgDir, modulePath);
        module.source = resolve(cfgDir, module.source);
        if (module.loader) {
          module.loader = resolve(cfgDir, module.loader);
        }
        modules[modulePath] = module;
      }
      value = modules;
    }
    options[key] = value;
  }
  return options;
}

function findSourceFile(modulePath, options) {
  const { modules } = options;
  return modules?.[modulePath]?.source;
}

const cls = {
  name: '',
  mixins: [],
};

function mixin(object) {
  if (!cls.mixins.includes(object)) {
    cls.mixins.push(object);
  }
  return object;
}

function defineEnvironment() {
  return defineClass(cls.name, cls.mixins);
}

function defineClass(name, mixins) {
  const initFunctions = [];
  const constructor = function() {
    for (const init of initFunctions) {
      init.call(this);
    }
    {
      this.trackingMixins = false;
      this.mixinUsage = new Map();
      this.use = (mixin) => {
        if (this.trackingMixins) {
          this.mixinUsage.set(mixin, true);
        }
      };
      this.using = (mixin) => {
        return !!this.mixinUsage.get(mixin);
      };
    }
  };
  const { prototype } = constructor;
  defineProperty(constructor, 'name', defineValue(name));
  for (const mixin of mixins) {
    for (let [ name, object ] of Object.entries(mixin)) {
      if (name === 'init') {
        initFunctions.push(object);
      } else {
        if (typeof(object) === 'function') {
          {
            const func = object;
            object = function(...args) {
              this.use?.(mixin);
              return func.call(this, ...args);
            };
          }
        } else {
          let current = prototype[name];
          if (current !== undefined) {
            if (current?.constructor === Object) {
              object = Object.assign({ ...current }, object);
            } else if (current !== object) {
              throw new Error(`Duplicate property: ${name}`);
            }
          }
        }
        defineProperty(prototype, name, defineValue(object));
      }
    }
  }
  return constructor;
}

// handle retrieval of accessors

var all$3 = mixin({
  init() {
    this.accessorCache = new Map();
  },
  getAccessor(access, member) {
    const { type, bitSize, bitOffset, byteSize } = member;
    const names = [];
    const unaligned = (byteSize === undefined) && (bitSize & 0x07 || bitOffset & 0x07);
    if (unaligned) {
      names.push('Unaligned');
    }
    let name = memberNames[type];
    if (bitSize > 32 && (type === MemberType.Int || type === MemberType.Uint)) {
      if (bitSize <= 64) {
        name = `Big${name}`;
      } else {
        name = `Jumbo${name}`;
      }
    }
    names.push(name, `${(type === MemberType.Bool && byteSize) ? byteSize << 3 : bitSize}`);
    if (unaligned) {
      names.push(`@${bitOffset}`);
    }
    const accessorName = access + names.join('');
    let accessor = this.accessorCache.get(accessorName);
    if (accessor) {
      return accessor;
    }
    // see if it's a built-in method of DataView
    accessor = DataView.prototype[accessorName];
    if (!accessor) {
      while (names.length > 0) {
        const handlerName = `getAccessor${names.join('')}`;
        if (accessor = this[handlerName]?.(access, member)) {
          break;
        }
        names.pop();
      }
      if (!accessor) {
        throw new Error(`No accessor available: ${accessorName}`);
      }
    }
    if (!accessor.name) {
      defineProperty(accessor, 'name', defineValue(accessorName));
    }
    this.accessorCache.set(accessorName, accessor);
    return accessor;
  },
});

var bigInt = mixin({
  getAccessorBigInt(access, member) {
    const { bitSize } = member;
    const signMask = 2n ** BigInt(bitSize - 1);
    const valueMask = signMask - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = this.getBigUint64(offset, littleEndian);
        return (n & valueMask) - (n & signMask);
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
        this.setBigUint64(offset, n, littleEndian);
      };
    }
  },
});

var bigUint = mixin({
  getAccessorBigUint(access, member) {
    const { bitSize } = member;
    const valueMask = (2n ** BigInt(bitSize)) - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = this.getBigInt64(offset, littleEndian);
        return n & valueMask;
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = value & valueMask;
        this.setBigUint64(offset, n, littleEndian);
      };
    }
  },
});

// handles bools, including implicit ones in optional pointers, where an address
// of zero would be treated as boolean false

var bool$1 = mixin({
  getAccessorBool(access, member) {
    const { byteSize } = member;
    const bitSize = byteSize * 8;
    const f = this.getAccessor(access, { type: MemberType.Uint, bitSize, byteSize });
    if (access === 'get') {
      return function(offset, littleEndian) {
        return !!f.call(this, offset, littleEndian);
      }
    } else {
      const zero = (bitSize <= 32) ? 0 : 0n;
      const one = (bitSize <= 32) ? 1 : 1n;
      return function(offset, value, littleEndian) {
        f.call(this, offset, value ? one : zero, littleEndian);
      }
    }
  }
});

// handles f128

var float128 = mixin({
  getAccessorFloat128(access, member) {
    const { byteSize } = member;
    const buf = createView(8);
    const get = function(offset, littleEndian) {
      const w1 = BigInt(this.getUint32(offset + (littleEndian ? 0 : byteSize - 4), littleEndian));
      const w2 = BigInt(this.getUint32(offset + (littleEndian ? 4 : byteSize - 8), littleEndian));
      const w3 = BigInt(this.getUint32(offset + (littleEndian ? 8 : byteSize - 12), littleEndian));
      const w4 = BigInt(this.getUint32(offset + (littleEndian ? 12 : byteSize - 16), littleEndian));
      return w1 | w2 << 32n | w3 << 64n | w4 << 96n;
    };
    const set = function(offset, value, littleEndian) {
      const w1 = value & 0xffff_ffffn;
      const w2 = (value >> 32n) & 0xffff_ffffn;
      const w3 = (value >> 64n) & 0xffff_ffffn;
      const w4 = (value >> 96n) & 0xffff_ffffn;
      this.setUint32(offset + (littleEndian ? 0 : byteSize - 4), Number(w1), littleEndian);
      this.setUint32(offset + (littleEndian ? 4 : byteSize - 8), Number(w2), littleEndian);
      this.setUint32(offset + (littleEndian ? 8 : byteSize - 12), Number(w3), littleEndian);
      this.setUint32(offset + (littleEndian ? 12 : byteSize - 16), Number(w4), littleEndian);
    };
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >> 127n;
        const exp = (n & 0x7fff_0000_0000_0000_0000_0000_0000_0000n) >> 112n;
        const frac = n & 0x0000_ffff_ffff_ffff_ffff_ffff_ffff_ffffn;
        if (exp === 0n) {
          const value = (frac) ? Number.MIN_VALUE : 0;
          return (sign) ? -value : value;
        } else if (exp === 0x7fffn) {
          if (!frac) {
            return (sign) ? -Infinity : Infinity;
          } else {
            return NaN;
          }
        }
        const exp64 = exp - 16383n + 1023n;
        if (exp64 >= 2047n) {
          const value = Infinity;
          return (sign) ? -value : value;
        }
        const n64 = (sign << 63n) | (exp64 << 52n) | (frac >> 60n) + BigInt((frac & (2n**60n - 1n)) >= 2n**59n);
        buf.setBigUint64(0, n64, littleEndian);
        return buf.getFloat64(0, littleEndian);
      }
    } else {
      return function(offset, value, littleEndian) {
        buf.setFloat64(0, value, littleEndian);
        const n = buf.getBigUint64(0, littleEndian);
        const sign = n >> 63n;
        const exp = (n & 0x7ff0_0000_0000_0000n) >> 52n;
        const frac = n & 0x000f_ffff_ffff_ffffn;
        let n128;
        if (exp === 0n) {
          n128 = sign << 127n | (frac << 60n);
        } else if (exp === 0x07ffn) {
          n128 = sign << 127n | 0x7fffn << 112n | (frac ? 1n : 0n);
        } else {
          n128 = sign << 127n | (exp - 1023n + 16383n) << 112n | (frac << 60n);
        }
        set.call(this, offset, n128, littleEndian);
      }
    }
  }
});

// handles f16

var float16 = mixin({
  getAccessorFloat16(access, member) {
    const buf = createView(4);
    const set = DataView.prototype.setUint16;
    const get = DataView.prototype.getUint16;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >>> 15;
        const exp = (n & 0x7c00) >> 10;
        const frac = n & 0x03ff;
        if (exp === 0) {
          return (sign) ? -0 : 0;
        } else if (exp === 0x1f) {
          if (!frac) {
            return (sign) ? -Infinity : Infinity;
          } else {
            return NaN;
          }
        }
        const n32 = (sign << 31) | ((exp - 15 + 127) << 23) | (frac << 13);
        buf.setUint32(0, n32, littleEndian);
        return buf.getFloat32(0, littleEndian);
      }
    } else {
      return function(offset, value, littleEndian) {
        buf.setFloat32(0, value, littleEndian);
        const n = buf.getUint32(0, littleEndian);
        const sign = n >>> 31;
        const exp = (n & 0x7f80_0000) >> 23;
        const frac = n & 0x007f_ffff;
        const exp16 = (exp - 127 + 15);
        let n16;
        if (exp === 0) {
          n16 = sign << 15;
        } else if (exp === 0xff) {
          n16 = sign << 15 | 0x1f << 10 | (frac ? 1 : 0);
        } else if (exp16 >= 31) {
          n16 = sign << 15 | 0x1f << 10;
        } else {
          n16 = sign << 15 | exp16 << 10 | (frac >> 13);
        }
        set.call(this, offset, n16, littleEndian);
      }
    }
  }
});

// handles f80

var float80 = mixin({
  getAccessorFloat80(access, member) {
    const { byteSize } = member;
    const buf = createView(8);
    const get = function(offset, littleEndian) {
      const w1 = BigInt(this.getUint32(offset + (littleEndian ? 0 : byteSize - 4), littleEndian));
      const w2 = BigInt(this.getUint32(offset + (littleEndian ? 4 : byteSize - 8), littleEndian));
      const w3 = BigInt(this.getUint32(offset + (littleEndian ? 8 : byteSize - 12), littleEndian));
      return w1 | w2 << 32n | w3 << 64n;
    };
    const set = function(offset, value, littleEndian) {
      const w1 = value & 0xffff_ffffn;
      const w2 = (value >> 32n) & 0xffff_ffffn;
      const w3 = (value >> 64n) & 0xffff_ffffn;
      this.setUint32(offset + (littleEndian ? 0 : byteSize - 4), Number(w1), littleEndian);
      this.setUint32(offset + (littleEndian ? 4 : byteSize - 8), Number(w2), littleEndian);
      this.setUint32(offset + (littleEndian ? 8 : byteSize - 12), Number(w3), littleEndian);
    };
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >> 79n;
        const exp = (n & 0x7fff_0000_0000_0000_0000n) >> 64n;
        const frac = n & 0x0000_7fff_ffff_ffff_ffffn;
        if (exp === 0n) {
          const value = (frac) ? Number.MIN_VALUE : 0;
          return (sign) ? -value : value;
        } else if (exp === 0x7fffn) {
          if (!frac) {
            return (sign) ? -Infinity : Infinity;
          } else {
            return NaN;
          }
        }
        const exp64 = exp - 16383n + 1023n;
        if (exp64 >= 2047n) {
          const value = Infinity;
          return (sign) ? -value : value;
        }
        const n64 = (sign << 63n) | (exp64 << 52n) | (frac >> 11n) + BigInt((frac & (2n**11n - 1n)) >= 2n**10n);
        buf.setBigUint64(0, n64, littleEndian);
        return buf.getFloat64(0, littleEndian);
      }
    } else {
      return function(offset, value, littleEndian) {
        buf.setFloat64(0, value, littleEndian);
        const n = buf.getBigUint64(0, littleEndian);
        const sign = n >> 63n;
        const exp = (n & 0x7ff0_0000_0000_0000n) >> 52n;
        const frac = n & 0x000f_ffff_ffff_ffffn;
        let n80;
        if (exp === 0n) {
          n80 = sign << 79n | (frac << 11n);
        } else if (exp === 0x07ffn) {
          n80 = sign << 79n | 0x7fffn << 64n | (frac ? 0x00002000000000000000n : 0n) | 0x00008000000000000000n;
          //                                                 ^ bit 61                       ^ bit 63
        } else {
          n80 = sign << 79n | (exp - 1023n + 16383n) << 64n | (frac << 11n) | 0x00008000000000000000n;
        }
        set.call(this, offset, n80, littleEndian);
      }
    }
  }
});

// handle non-standard ints 32-bit or smaller

var int$1 = mixin({
  getAccessorInt(access, member) {
    const { bitSize, byteSize } = member;
    if (byteSize) {
      const f = this.getAccessor(access, { type: MemberType.Uint, bitSize: byteSize * 8, byteSize });
      const signMask = 2 ** (bitSize - 1);
      const valueMask = signMask - 1;
      if (access === 'get') {
        return function(offset, littleEndian) {
          const n = f.call(this, offset, littleEndian);
          return (n & valueMask) - (n & signMask);
        };
      } else {
        return function(offset, value, littleEndian) {
          const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
          f.call(this, offset, n, littleEndian);
        };
      }
    }
  }
});

var jumboInt = mixin({
  getAccessorJumboInt(access, member) {
    const { bitSize } = member;
    const f = this.getJumboAccessor(access, bitSize);
    const signMask = 2n ** BigInt(bitSize - 1);
    const valueMask = signMask - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = f.call(this, offset, littleEndian);
        return (n & valueMask) - (n & signMask);
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
        f.call(this, offset, n, littleEndian);
      };
    }
  },
});

var jumboUint = mixin({
  getAccessorJumboUint(access, member) {
    const { bitSize } = member;
    const f = this.getJumboAccessor(access, bitSize);
    const valueMask = (2n ** BigInt(bitSize)) - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = f.call(this, offset, littleEndian);
        return n & valueMask;
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = value & valueMask;
        f.call(this, offset, n, littleEndian);
      };
    }
  },
});

var jumbo = mixin({
  getJumboAccessor(access, bitSize) {
    const wordCount = (bitSize + 63) >> 6;
    if (access === 'get') {
      return function(offset, littleEndian) {
        let n = 0n;
        if (littleEndian) {
          for (let i = 0, j = offset + (wordCount - 1) * 8; i < wordCount; i++, j -= 8) {
            const w = this.getBigUint64(j, littleEndian);
            n = (n << 64n) | w;
          }
        } else {
          for (let i = 0, j = offset; i < wordCount; i++, j += 8) {
            const w = this.getBigUint64(j, littleEndian);
            n = (n << 64n) | w;
          }
        }
        return n;
      };
    } else {
      return function(offset, value, littleEndian) {
        let n = value;
        const mask = 0xffff_ffff_ffff_ffffn;
        if (littleEndian) {
          for (let i = 0, j = offset; i < wordCount; i++, j += 8) {
            const w = n & mask;
            this.setBigUint64(j, w, littleEndian);
            n >>= 64n;
          }
        } else {
          for (let i = 0, j = offset + (wordCount - 1) * 8; i < wordCount; i++, j -= 8) {
            const w = n & mask;
            this.setBigUint64(j, w, littleEndian);
            n >>= 64n;
          }
        }
      };
    }
  }
});

// handle non-standard uints 32-bit or smaller

var uint$1 = mixin({
  getAccessorUint(access, member) {
    const { bitSize, byteSize } = member;
    if (byteSize) {
      const f = this.getAccessor(access, { ...member, bitSize: byteSize * 8 });
      const valueMask = (2 ** bitSize) - 1;
      if (access === 'get') {
        return function(offset, littleEndian) {
          const n = f.call(this, offset, littleEndian);
          return n & valueMask;
        };
      } else {
        return function(offset, value, littleEndian) {
          const n = value & valueMask;
          f.call(this, offset, n, littleEndian);
        };
      }
    }
  }
});

// handle bools in packed structs

var unalignedBool1 = mixin({
  getAccessorUnalignedBool1(access, member) {
    const { bitOffset } = member;
    const bitPos = bitOffset & 0x07;
    const mask = 1 << bitPos;
    if (access === 'get') {
      return function(offset) {
        const n = this.getInt8(offset);
        return !!(n & mask);
      };
    } else {
      return function(offset, value) {
        const n = this.getInt8(offset);
        const b = (value) ? n | mask : n & ~mask;
        this.setInt8(offset, b);
      };
    }
  },
});

// handle ints 7-bit or smaller in packed structs that are stored in a single byte
// other unaligned ints are handled by the mixin "unaligned"

var unalignedInt = mixin({
  getAccessorUnalignedInt(access, member) {
    const { bitSize, bitOffset } = member;
    const bitPos = bitOffset & 0x07;
    if (bitPos + bitSize <= 8) {
      const signMask = 2 ** (bitSize - 1);
      const valueMask = signMask - 1;
      if (access === 'get') {
        return function(offset) {
          const n = this.getUint8(offset);
          const s = n >>> bitPos;
          return (s & valueMask) - (s & signMask);
        };
      } else {
        const outsideMask = 0xFF ^ ((valueMask | signMask) << bitPos);
        return function(offset, value) {
          let b = this.getUint8(offset);
          const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
          b = (b & outsideMask) | (n << bitPos);
          this.setUint8(offset, b);
        };
      }
    }
  }
});

// handle uints 7-bit or smaller in packed structs that are stored in a single byte
// other unaligned ints are handled by the mixin "unaligned"

var unalignedUint = mixin({
  getAccessorUnalignedUint(access, member) {
    const { bitSize, bitOffset } = member;
    const bitPos = bitOffset & 0x07;
    if (bitPos + bitSize <= 8) {
      const valueMask = (2 ** bitSize - 1);
      if (access === 'get') {
        return function(offset) {
          const n = this.getUint8(offset);
          const s = n >>> bitPos;
          return s & valueMask;
        };
      } else {
        const outsideMask = 0xFF ^ (valueMask << bitPos);
        return function(offset, value) {
          const n = this.getUint8(offset);
          const b = (n & outsideMask) | ((value & valueMask) << bitPos);
          this.setUint8(offset, b);
        };
      }
    }
  },
});

// handle unaligned ints and floats by copying the bits into a
// temporary buffer, aligning them

var unaligned = mixin({
  getAccessorUnaligned(access, member) {
    const { bitSize, bitOffset } = member;
    const bitPos = bitOffset & 0x07;
    const byteSize = [ 1, 2, 4, 8 ].find(b => b * 8 >= bitSize) ?? Math.ceil(bitSize / 64) * 64;
    const buf = createView(byteSize);
    if (access === 'get') {
      const getAligned = this.getAccessor('get', { ...member, byteSize });
      const copyBits = getBitAlignFunction(bitPos, bitSize, true);
      return function(offset, littleEndian) {
        copyBits(buf, this, offset);
        return getAligned.call(buf, 0, littleEndian);
      };
    } else {
      const setAligned = this.getAccessor('set', { ...member, byteSize });
      const applyBits = getBitAlignFunction(bitPos, bitSize, false);
      return function(offset, value, littleEndian) {
        setAligned.call(buf, 0, value, littleEndian);
        applyBits(this, buf, offset);
      };
    }
  }
});

function getBitAlignFunction(bitPos, bitSize, toAligned) {
  if (bitPos + bitSize <= 8) {
    const mask = (2 ** bitSize) - 1;
    if (toAligned) {
      // from single byte
      return function(dest, src, offset) {
        const n = src.getUint8(offset);
        const b = (n >> bitPos) & mask;
        dest.setUint8(0, b);
      };
    } else {
      // to single byte
      const destMask = 0xFF ^ (mask << bitPos);
      return function(dest, src, offset) {
        const n = src.getUint8(0);
        const d = dest.getUint8(offset);
        const b = (d & destMask) | ((n & mask) << bitPos);
        dest.setUint8(offset, b);
      };
    }
  } else {
    const leadBits = 8 - bitPos;
    const leadMask = (2 ** leadBits) - 1;
    if (toAligned) {
      const trailBits = bitSize % 8;
      const trailMask = (2 ** trailBits) - 1;
      return function(dest, src, offset) {
        let i = offset, j = 0;
        let n = src.getUint8(i++), b;
        let bitBuf = (n >> bitPos) & leadMask;
        let bitCount = leadBits;
        let remaining = bitSize;
        do {
          if (remaining > bitCount) {
            n = src.getUint8(i++);
            bitBuf = bitBuf | (n << bitCount);
            //bitCount += 8;
          }
          b = (remaining >= 8) ? bitBuf & 0xFF : bitBuf & trailMask;
          dest.setUint8(j++, b);
          bitBuf >>= 8;
          //bitCount -= 8;
          remaining -= 8;
        } while (remaining > 0);
      }
    } else {
      const trailBits = (bitSize - leadBits) % 8;
      const trailMask = (2 ** trailBits) - 1;
      const destMask1 = 0xFF ^ (leadMask << bitPos);
      const destMask2 = 0xFF ^ trailMask;
      return function(dest, src, offset) {
        let i = 0, j = offset;
        // preserve bits ahead of bitPos
        let d = dest.getUint8(j), n, b;
        let bitBuf = d & destMask1;
        let bitCount = bitPos;
        let remaining = bitSize + bitCount;
        do {
          if (remaining > bitCount) {
            n = src.getUint8(i++);
            bitBuf = bitBuf | (n << bitCount);
            bitCount += 8;
          }
          if (remaining >= 8) {
            b = bitBuf & 0xFF;
          } else {
            // preserve bits at the destination sitting behind the trailing bits
            d = dest.getUint8(j);
            b = (d & destMask2) | (bitBuf & trailMask);
          }
          dest.setUint8(j++, b);
          bitBuf >>= 8;
          bitCount -= 8;
          remaining -= 8;
        } while (remaining > 0);
      }
    }
  }
}

class InvalidIntConversion extends SyntaxError {
  constructor(arg) {
    super(`Cannot convert ${arg} to an Int`);
  }
}

class Unsupported extends TypeError {
  errno = PosixError.ENOTSUP;

  constructor() {
    super(`Unsupported`);
  }
}

class NoInitializer extends TypeError {
  constructor(structure) {
    const { name } = structure;
    super(`An initializer must be provided to the constructor of ${name}, even when the intended value is undefined`);
  }
}

class BufferSizeMismatch extends TypeError {
  constructor(structure, dv, target = null) {
    const { name, type, byteSize } = structure;
    const actual = dv.byteLength;
    const s = (byteSize !== 1) ? 's' : '';
    let msg;
    if (type === StructureType.Slice && !target) {
      msg = `${name} has elements that are ${byteSize} byte${s} in length, received ${actual}`;
    } else {
      const total = (type === StructureType.Slice) ? target.length * byteSize : byteSize;
      msg = `${name} has ${total} byte${s}, received ${actual}`;
    }
    super(msg);
  }
}

class BufferExpected extends TypeError {
  constructor(structure) {
    const { type, byteSize, typedArray } = structure;
    const s = (byteSize !== 1) ? 's' : '';
    const acceptable = [ 'ArrayBuffer', 'DataView' ].map(addArticle);
    if (typedArray) {
      acceptable.push(addArticle(typedArray.name));
    }
    let msg;
    if (type === StructureType.Slice) {
      msg = `Expecting ${formatList(acceptable)} that can accommodate items ${byteSize} byte${s} in length`;
    } else {
      msg = `Expecting ${formatList(acceptable)} that is ${byteSize} byte${s} in length`;
    }
    super(msg);
  }
}

class EnumExpected extends TypeError {
  constructor(structure, arg) {
    const { name } = structure;
    let msg;
    if (typeof(arg) === 'number' || typeof(arg) === 'bigint') {
      msg = `Value given does not correspond to an item of enum ${name}: ${arg}`;
    } else {
      msg = `Enum item of the type ${name} expected, received ${arg}`;
    }
    super(msg);
  }
}

class ErrorExpected extends TypeError {
  constructor(structure, arg) {
    const { name } = structure;
    const type = typeof(arg);
    let msg;
    if (type === 'string' || type === 'number' || isErrorJSON(arg)) {
      if (isErrorJSON(arg)) {
        arg = `{ error: ${JSON.stringify(arg.error)} }`;
      }
      msg = `Error ${type} does not corresponds to any error in error set ${name}: ${arg}`;
    } else {
      msg = `Error of the type ${name} expected, received ${arg}`;
    }
    super(msg);
  }
}

class NotInErrorSet extends TypeError {
  constructor(structure, err) {
    const { name } = structure;
    super(`Error given is not a part of error set ${name}: ${err}`);
  }
}

class MultipleUnionInitializers extends TypeError {
  constructor(structure) {
    const { name } = structure;
    super(`Only one property of ${name} can be given a value`);
  }
}

class InactiveUnionProperty extends TypeError {
  constructor(structure, name, currentName) {
    super(`Accessing property ${name} when ${currentName} is active`);
  }
}

class MissingUnionInitializer extends TypeError {
  constructor(structure, arg, exclusion) {
    const { name, instance: { members } } = structure;
    const missing = members.slice(0, exclusion ? -1 : undefined).map(m => m.name);
    super(`${name} needs an initializer for one of its union properties: ${missing.join(', ')}`);
  }
}

class InvalidInitializer extends TypeError {
  constructor(structure, expected, arg) {
    const { name } = structure;
    const acceptable = [];
    if (Array.isArray(expected)) {
      for (const type of expected) {
        acceptable.push(addArticle(type));
      }
    } else {
      acceptable.push(addArticle(expected));
    }
    const received = getDescription(arg);
    super(`${name} expects ${formatList(acceptable)} as argument, received ${received}`);
  }
}

class InvalidArrayInitializer extends InvalidInitializer {
  constructor(structure, arg, shapeless = false) {
    const { instance: { members: [ member ] }, type, constructor } = structure;
    const acceptable = [];
    const primitive = getPrimitiveName(member);
    if (primitive) {
      let object;
      switch (member.structure?.type) {
        case StructureType.Enum: object = 'enum item'; break;
        case StructureType.ErrorSet: object = 'error'; break;
        default: object = primitive;
      }
      acceptable.push(`array of ${object}s`);
    } else {
      acceptable.push(`array of objects`);
    }
    if (constructor[TYPED_ARRAY]) {
      acceptable.push(constructor[TYPED_ARRAY].name);
    }
    if (type === StructureType.Slice && shapeless) {
      acceptable.push(`length`);
    }
    super(structure, acceptable.join(' or '), arg);
  }
}

class InvalidEnumValue extends TypeError {
  errno = PosixError.EINVAL;

  constructor(set, arg) {
    const keys = Object.keys(set);
    const list = keys.map(k => `${k}\n`).join('');
    super(`Received '${arg}', which is not among the following possible values:\n\n${list}`);
  }
}

class ArrayLengthMismatch extends TypeError {
  constructor(structure, target, arg) {
    const { name, length, instance: { members: [ member ] } } = structure;
    const { structure: { constructor: elementConstructor} } = member;
    const { length: argLength, constructor: argConstructor } = arg;
    // get length from object whech it's a slice
    const actualLength = target?.length ?? length;
    const s = (actualLength !== 1) ? 's' : '';
    let received;
    if (argConstructor === elementConstructor) {
      received = `only a single one`;
    } else if (argConstructor.child === elementConstructor) {
      received = `a slice/array that has ${argLength}`;
    } else {
      received = `${argLength} initializer${argLength > 1 ? 's' : ''}`;
    }
    super(`${name} has ${actualLength} element${s}, received ${received}`);
  }
}

class InvalidSliceLength extends TypeError {
  constructor(length, max) {
    if (length < 0) {
      super(`Length of slice cannot be negative`);
    } else {
      super(`Length of slice can be ${max} or less, received ${length}`);
    }
  }
}

class MissingInitializers extends TypeError {
  constructor(structure, missing) {
    const { name } = structure;
    super(`Missing initializers for ${name}: ${missing.join(', ')}`);
  }
}

class NoProperty extends TypeError {
  constructor(structure, propName) {
    const { name, instance: { members } } = structure;
    const member = members.find(m => m.name === propName);
    let msg;
    if (member) {
      msg = `Comptime value cannot be changed: ${propName}`;
    } else {
      msg = `${name} does not have a property with that name: ${propName}`;
    }
    super(msg);
  }
}

class ArgumentCountMismatch extends Error {
  constructor(expected, received, variadic = false) {
    super();
    const updateText = (argOffset) => {
      expected -= argOffset;
      received -= argOffset;
      const s = (expected !== 1) ? 's' : '';
      const p = (variadic) ? 'at least ' : '';
      this.message = `Expecting ${p}${expected} argument${s}, received ${received}`;
      this.stack = adjustStack(this.stack, 'new Arg(');
    };
    updateText(0);
    defineProperty(this, UPDATE, { value: updateText, enumerable: false });
  }
}

class UndefinedArgument extends Error {
  constructor() {
    super(`Undefined argument`);
  }
}

class NoCastingToPointer extends TypeError {
  constructor() {
    super(`Non-slice pointers can only be created with the help of the new operator`);
  }
}

class NoCastingToFunction extends TypeError {
  constructor() {
    super(`Casting to function is not allowed`);
  }
}

class ConstantConstraint extends TypeError {
  constructor(structure, pointer) {
    const { name: target } = structure;
    const { constructor: { name } } = pointer;
    super(`Conversion of ${name} to ${target} requires an explicit cast`);
  }
}

class MisplacedSentinel extends TypeError {
  constructor(structure, value, index, length) {
    const { name } = structure;
    super(`${name} expects the sentinel value ${value} at ${length - 1}, found at ${index}`);
  }
}

class MissingSentinel extends TypeError {
  constructor(structure, value, length) {
    const { name } = structure;
    super(`${name} expects the sentinel value ${value} at ${length - 1}`);
  }
}

class AlignmentConflict extends TypeError {
  constructor(align1, align2) {
    super(`Unable to simultaneously align memory to ${align2}-byte and ${align1}-byte boundary`);
  }
}

class TypeMismatch extends TypeError {
  constructor(expected, arg) {
    const received = getDescription(arg);
    super(`Expected ${addArticle(expected)}, received ${received}`);
  }
}

class InvalidStream extends TypeError {
  constructor(rights, arg) {
    const types = [];
    if (rights & PosixDescriptorRight.fd_read) {
      types.push('ReadableStreamDefaultReader', 'ReadableStreamBYOBReader', 'Blob', 'Uint8Array');
    }
    if (rights & PosixDescriptorRight.fd_write) {
      types.push('WritableStreamDefaultWriter', 'array', 'null');
    }
    if (rights & PosixDescriptorRight.fd_readdir) {
      types.push('Map');
    }
    const list = types.join(', ');
    super(`Expected ${list}, or an object with the appropriate stream interface, received ${arg}`);
  }
}

class InaccessiblePointer extends TypeError {
  constructor() {
    super(`Pointers within an untagged union are not accessible`);
  }
}

class NullPointer extends TypeError {
  constructor() {
    super(`Null pointer`);
  }
}

class PreviouslyFreed extends TypeError {
  constructor(arg) {
    super(`Object has been freed already: ${arg.constructor.name}`);
  }
}

class InvalidPointerTarget extends TypeError {
  constructor(structure, arg) {
    const { name } = structure;
    let target;
    if (arg != null) {
      const noun = (arg instanceof Object && arg.constructor !== Object) ? `${arg.constructor.name} object`: typeof(arg);
      const a = article(noun);
      target = `${a} ${noun}`;
    } else {
      target = arg + '';
    }
    super(`${name} cannot point to ${target}`);
  }
}

class ZigMemoryTargetRequired extends TypeError {
  constructor() {
    super(`Pointers in Zig memory cannot point to garbage-collected object`);
  }
}

class Overflow extends TypeError {
  constructor(member, value) {
    const { type, bitSize } = member;
    const name = (bitSize > 32 ? 'Big' : '') + memberNames[type] + bitSize;
    super(`${name} cannot represent the value given: ${value}`);
  }
}

class OutOfBound extends RangeError {
  constructor(member, index) {
    const { name } = member;
    super(`Index exceeds the size of ${name ?? 'array'}: ${index}`);
  }
}

class NotUndefined extends TypeError {
  constructor(member) {
    const { name } = member;
    const rvalue = (name !== undefined) ? `Property ${name}` : `Element`;
    super(`${rvalue} can only be undefined`);
  }
}

class NotOnByteBoundary extends TypeError {
  constructor(member) {
    const { name, structure: { name: struct } } = member;
    super(`Unable to create ${struct} as it is not situated on a byte boundary: ${name}`);
  }
}

class ReadOnly extends TypeError {
  constructor() {
    super(`Unable to modify read-only object`);
  }
}

class ReadOnlyTarget extends TypeError {
  constructor(structure) {
    const { name } = structure;
    super(`${name} cannot point to a read-only object`);
  }
}

class AccessingOpaque extends TypeError {
  constructor(structure) {
    const { name } = structure;
    super(`Unable to access opaque structure ${name}`);
  }
}

class CreatingOpaque extends TypeError {
  constructor(structure) {
    const { name } = structure;
    super(`Unable to create instance of ${name}, as it is opaque`);
  }
}

class InvalidVariadicArgument extends TypeError {
  constructor() {
    super(`Arguments passed to variadic function must be casted to a Zig type`);
  }
}

class UnexpectedGenerator extends TypeError {
  constructor() {
    super(`Unexpected async generator`);
  }
}

class InvalidFileDescriptor extends Error {
  errno = PosixError.EBADF;

  constructor() {
    super(`Invalid file descriptor`);
  }
}

class InvalidPath extends Error {
  errno = PosixError.ENOENT;

  constructor(path) {
    super(`Invalid relative path '${path}'`);
  }
}

class MissingStreamMethod extends Error {
  errno = PosixError.EPERM;

  constructor(name) {
    super(`Missing stream method '${name}'`);
  }
}

class InvalidArgument extends Error {
  errno = PosixError.EINVAL;

  constructor() {
    super(`Invalid argument`);
  }
}

class WouldBlock extends Error {
  errno = PosixError.EAGAIN;

  constructor() {
    super(`Would block`);
  }
}

class TooManyFiles extends Error {
  errno = PosixError.EMFILE;

  constructor() {
    super(`Too many open files`);
  }
}

class Deadlock extends Error {
  errno = PosixError.EDEADLK;

  constructor() {
    super(`Unable to await promise`);
  }
}

class ZigError extends Error {
  constructor(error, remove = 0) {
    if (error instanceof Error) {
      super(error.message);
      error.stack = adjustStack(this.stack, remove);
      return error;
    } else {
      super(error ?? 'Error encountered in Zig code');
    }
  }
}

class Exit extends ZigError {
  constructor(code) {
    super('Program exited');
    this.code = code;
  }
}

function adjustArgumentError(err, argIndex) {
  const updateText = (argOffset) => {
    argIndex -= argOffset;
    err.message = `args[${argIndex}]: ${err.message}`;
    err.stack = adjustStack(err.stack, 'new Arg(');
  };
  updateText(0);
  defineProperty(err, UPDATE, { value: updateText, enumerable: false });
  return err;
}

function adjustStack(stack, search) {
  if (typeof(stack) === 'string') {
    const lines = stack.split('\n');
    const index = lines.findIndex(s => s.includes(search));
    if (index !== -1) {
      lines.splice(1, index);
      stack = lines.join('\n');
    }
  }
  return stack;
}

function throwReadOnly() {
  throw new ReadOnly();
}

function checkInefficientAccess(progress, access, len) {
  progress.bytes += len;
  progress.calls++;
  if (progress.calls === 100) {
    const bytesPerCall = progress.bytes / progress.calls;
    if (bytesPerCall < 8) {
      const s = bytesPerCall !== 1 ? 's' : '';
      const action = (access === 'read') ? 'reading' : 'writing';
      const name = (access === 'read') ? 'Reader' : 'Writer';
      throw new Error(`Inefficient ${access} access. Each call is only ${action} ${bytesPerCall} byte${s}. Please use std.io.Buffered${name}.`);
    }
  }
}

function deanimalizeErrorName(name) {
  // deal with snake_case first
  let s = name.replace(/_/g, ' ');
  // then camelCase, using a try block in case Unicode regex fails
  try {
    s = s.replace(/(\p{Uppercase}+)(\p{Lowercase}*)/gu, (m0, m1, m2) => {
      if (m1.length === 1) {
        return ` ${m1.toLocaleLowerCase()}${m2}`;
      } else {
        if (m2) {
          return m0;
        } else {
          return ` ${m1}`;
        }
      }
    }).trimStart();
  } catch (err) {
  }
  return s.charAt(0).toLocaleUpperCase() + s.substring(1);
}

function catchPosixError(canWait = false, defErrorNo, run, resolve, reject) {
  const fail = (err) => {
    let result;
    if (reject) {
      result = reject(err);
    } else {
      if (err.errno !== PosixError.EAGAIN && err.errno !== PosixError.ENOTSUP) {
        console.error(err);
      }
    }
    return result ?? err.errno ?? defErrorNo;
  };
  const done = (value) => {
    const result = resolve?.(value);
    return result ?? PosixError.NONE;
  };
  try {
    const result = run();
    if (isPromise(result)) {
      if (!canWait) {
        throw new Deadlock();
      }
      return result.then(done).catch(fail);
    } else {
      return done(result);
    }
  } catch (err) {
    return fail(err);
  }
}

function checkAccessRight(rights, required) {
  if (!(rights[0] & required)) {
    throw new InvalidFileDescriptor();
  }
}

function checkStreamMethod(stream, name) {
  if (!hasMethod(stream, name)) {
    throw new MissingStreamMethod(name);
  }
}

function expectBoolean(result, errorCode) {
  if (result === true) return PosixError.NONE; 
  if (result === false) return errorCode;
  throw new TypeMismatch('boolean', result);
}

function isErrorJSON(arg) {
  return typeof(arg) === 'object' && typeof(arg.error) === 'string' && Object.keys(arg).length === 1  ;
}

function getDescription(arg) {
  const type = typeof(arg);
  let s;
  if (type === 'object') {
    s = (arg) ? Object.prototype.toString.call(arg) : 'null';
  } else {
    s = type;
  }
  return addArticle(s);
}

function addArticle(noun) {
  return `${article(noun)} ${noun}`;
}

function article(noun) {
  return /^\W*[aeiou]/i.test(noun) ? 'an' : 'a';
}

function formatList(list, conj = 'or') {
  const sep = ` ${conj} `;
  if (list.length > 2) {
    return list.slice(0, -1).join(', ') + sep + list[list.length - 1];
  } else {
    return list.join(sep);
  }
}

var allocatorMethods = mixin({
  defineAlloc() {
    return {
      value(len, align = 1) {
        const lz = Math.clz32(align);        
        if (align !== 1 << (31 - lz)) {
          throw new Error(`Invalid alignment: ${align}`);
        }
        const ptrAlign = 31 - lz;
        const { vtable: { alloc }, ptr } = this;
        const slicePtr = alloc(ptr, len, ptrAlign, 0);
        if (!slicePtr) {
          throw new Error('Out of memory');
        }
        // alloc returns a [*]u8, which has a initial length of 1
        slicePtr.length = len;
        const dv = slicePtr['*'][MEMORY];
        // attach alignment so we can find it again
        dv[ZIG].align = align;
        return dv;
      }
    };
  },
  defineFree() {
    const thisEnv = this;
    return {
      value(arg) {
        const { dv, align } = getMemory(arg);
        const zig = dv?.[ZIG];
        if (!zig) {
          throw new TypeMismatch('object containing allocated Zig memory', arg);
        }
        const { address } = zig;
        if (address === usizeInvalid) {
          throw new PreviouslyFreed(arg);
        }
        const { vtable: { free }, ptr } = this;
        const ptrAlign = 31 - Math.clz32(align);        
        free(ptr, dv, ptrAlign, 0);
        thisEnv.releaseZigView(dv);
      }
    };
  },
  defineDupe() {
    return {
      value(arg) {
        const { dv: src, align, constructor } = getMemory(arg);
        if (!src) {
          throw new TypeMismatch('string, DataView, typed array, or Zig object', arg);
        }
        const dest = this.alloc(src.byteLength, align);
        copyView(dest, src);
        return (constructor) ? constructor(dest) : dest;
      }
    };
  }
});

function getMemory(arg) {
  let dv, align = 1, constructor = null;
  if (arg instanceof DataView) {
    dv = arg;
    const zigMemoryAlign = dv?.[ZIG]?.align;
    if (zigMemoryAlign) {
      align = zigMemoryAlign;
    }
  } else if (arg instanceof ArrayBuffer) {
    dv = new DataView(arg);
  } else if (arg) {
    if (arg[MEMORY]) {
      if (arg.constructor[TYPE] === StructureType.Pointer) {
        arg = arg['*'];
      }
      dv = arg[MEMORY];
      constructor = arg.constructor;
      align = constructor[ALIGN];
    } else {
      if (typeof(arg) === 'string') {
        arg = encodeText(arg);
      }
      const { buffer, byteOffset, byteLength, BYTES_PER_ELEMENT } = arg;
      if (buffer && byteOffset !== undefined && byteLength !== undefined) {
        dv = new DataView(buffer, byteOffset, byteLength);
        align = BYTES_PER_ELEMENT;
      }
    }
  }
  return { dv, align, constructor };
}

const events = [ 'log', 'mkdir', 'stat', 'set_times', 'open', 'rmdir', 'unlink', 'syscall' ];

var baseline = mixin({
  init() {
    this.variables = [];
    this.listenerMap = new Map();
    this.envVariables = this.envVarArrays = null;
  },
  getSpecialExports() {
    const check = (v) => {
      if (v === undefined) throw new Error('Not a Zig type');
      return v;
    };
    return {
      init: () => this.initPromise,
      abandon: () => this.abandonModule?.(),
      redirect: (name, stream) => this.redirectStream(name, stream),
      sizeOf: (T) => check(T?.[SIZE]),
      alignOf: (T) => check(T?.[ALIGN]),
      typeOf: (T) => structureNamesLC[check(T?.[TYPE])],
      on: (name, cb) => this.addListener(name, cb),
      set: (name, value) => this.setObject(name, value),
    };
  },
  addListener(name, cb) {
    const index = events.indexOf(name);
    if (index >= 0) {
      if (!this.ioRedirection) {
        throw new Error(`Redirection disabled`);
      }
      this.listenerMap.set(name, cb);
    } else {
      throw new Error(`Unknown event: ${name}`);
    }
  },
  hasListener(name) {
    return this.listenerMap.get(name);
  },
  setObject(name, object) {
    if (typeof(object) !== 'object') {
      throw new TypeMismatch('object', object);
    }
    if (name === 'wasi' && "wasm" === 'wasm') {
      this.setCustomWASI(object);
    } else if (name === 'env') {
      this.envVariables = object;
      if (this.libc) {
        this.initializeLibc();
      }
    } else {
      throw new Error(`Unknown object: ${name}`);
    }
  },
  triggerEvent(name, event) {
    const listener = this.listenerMap.get(name);
    return listener?.(event);
  },
  recreateStructures(structures, settings) {
    Object.assign(this, settings);
    const insertObjects = (dest, placeholders) => {
      for (const [ slot, placeholder ] of Object.entries(placeholders)) {
        dest[slot] = createObject(placeholder);
      }
      return dest;
    };
    const readOnlyObjects = [];
    // empty arrays aren't replicated
    const getBuffer = a => (a.length) ? a.buffer : new ArrayBuffer(0);
    const createObject = (placeholder) => {
      const { memory, structure, actual, slots } = placeholder;
      if (memory) {
        if (actual) {
          return actual;
        } else {
          const { array, offset, length } = memory;
          const dv = this.obtainView(getBuffer(array), offset, length);
          const { handle } = placeholder;
          const { constructor } = structure;
          const object = constructor.call(ENVIRONMENT, dv);
          if (slots) {
            insertObjects(object[SLOTS], slots);
          }
          if (handle) {
            // need to replace dataview with one pointing to Zig memory later,
            // when the VM is up and running
            this.variables.push({ handle, object });
          } else if (offset === undefined && length > 0) {
            // save the object for later, since it constructor isn't isn't finalized yet
            // when offset is not undefined, the object is a child of another object and 
            // will be made read-only thru the parent (which might have a linkage handle)
            readOnlyObjects.push(object);
          }
          placeholder.actual = object;
          return object;
        }
      } else {
        return structure;
      }
    };
    const objectPlaceholders = new Map();
    for (const structure of structures) {
      // recreate the actual template using the provided placeholder
      for (const scope of [ structure.instance, structure.static ]) {
        if (scope.template) {
          const { slots, memory, handle } = scope.template;
          const object = scope.template = {};
          if (memory) {
            const { array, offset, length } = memory;
            object[MEMORY] = this.obtainView(getBuffer(array), offset, length);
            if (handle) {
              this.variables.push({ handle, object });
            }
          }
          if (slots) {
            // defer creation of objects until shapes of structures are finalized
            const realSlots = object[SLOTS] = {};
            objectPlaceholders.set(realSlots, slots);
          }
        }
      }
      this.defineStructure(structure);
    }
    // insert objects into template slots
    for (const [ slots, placeholders ] of objectPlaceholders) {
      insertObjects(slots, placeholders);
    }
    // add static members, methods, etc.
    for (const structure of structures) {
      this.finalizeStructure(structure);
    }
    // after finalization, constructors of objects will have the properties needed 
    // for proper detection of what they are
    for (const object of readOnlyObjects) {
      this.makeReadOnly(object);
    }
  },
  ...({
    imports: {
      initializeLibc: { argType: 'ii' },
    },
  } ),
});

const structureNamesLC = structureNames.map(name => name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());

var callMarshalingInbound = mixin({
  init() {
    this.jsFunctionThunkMap = new Map();
    this.jsFunctionCallerMap = new Map();
    this.jsFunctionControllerMap = new Map();
    this.jsFunctionIdMap = new WeakMap();
    this.jsFunctionNextId = 1;
  },
  getFunctionId(fn) {
    let id = this.jsFunctionIdMap.get(fn);
    if (id === undefined) {
      id = this.jsFunctionNextId++;
      this.jsFunctionIdMap.set(fn, id);
    }
    return id;
  },
  getFunctionThunk(fn, jsThunkController) {
    const id = this.getFunctionId(fn);
    let dv = this.jsFunctionThunkMap.get(id);
    if (dv === undefined) {
      const controllerAddress = this.getViewAddress(jsThunkController[MEMORY]);
      const thunkAddress = this.createJsThunk(controllerAddress, id);
      if (!thunkAddress) {
        throw new Error('Unable to create function thunk');
      }
      dv = this.obtainZigView(thunkAddress, 0);
      this.jsFunctionThunkMap.set(id, dv);
      this.jsFunctionControllerMap.set(id, jsThunkController);
    }
    return dv;
  },
  createInboundCaller(fn, ArgStruct) {
    const handler = (dv, canWait) => {
      try {
        const argStruct = ArgStruct(dv);
        if (VISIT in argStruct) {
          // reset pointers in arg so we don't pick up old pointers
          // objects in stack memory really shouldn't be cached
          argStruct[VISIT]('reset', VisitorFlag.IgnoreUncreated);
          const context = this.startContext();
          this.updatePointerTargets(context, argStruct, true);
          this.updateShadowTargets(context);
          this.endContext();
        }
        // obtain argument list so that argStruct[RETURN] gets set when there's a promise
        const args = [ ...argStruct ];
        const hasCallback = argStruct.hasOwnProperty(RETURN);
        // promise is acceptable when we can wait for it or its result is sent to a callback
        const result = catchPosixError(canWait || hasCallback, PosixError.EFAULT, () => {
          return fn(...args);
        }, (retval) => {
            if (retval?.[Symbol.asyncIterator]) {
              // send contents through [YIELD]
              if (!argStruct.hasOwnProperty(YIELD)) {
                throw new UnexpectedGenerator();
              }
              this.pipeContents(retval, argStruct);
            } else {
              // [RETURN] defaults to the setter of retval; if the function accepts a promise,
              // it'd invoke the callback
              argStruct[RETURN](retval);
            }
        }, (err) => {
            try {
              // if the error is not part of the error set returned by the function,
              // the following will throw
              if (ArgStruct[THROWING] && err instanceof Error) {                
                argStruct[RETURN](err);
                return PosixError.NONE;
              } else {
                throw err;
              }
            } catch (_) {
              console.error(err);
            }
        });
        // don't return promise when a callback is used
        return (hasCallback) ? PosixError.NONE : result;
      } catch (err) {
        console.error(err);
        return PosixError.EFAULT;
      }     
    };
    const id = this.getFunctionId(fn);
    this.jsFunctionCallerMap.set(id, handler);
    return function(...args) {
      return fn(...args);
    };
  },
  defineArgIterator(members) {
    const thisEnv = this;
    const allocatorTotal = members.filter(({ structure: s }) => {
      return (s.type === StructureType.Struct) && (s.purpose === StructurePurpose.Allocator);
    }).length;
    return {
      value() {
        let options;
        let allocatorCount = 0, callbackCount = 0, signalCount = 0;
        const args = [];
        for (const [ srcIndex, { structure, type } ] of members.entries()) {
          // error unions will throw on access, in which case we pass the error as the argument
          try {
            let arg = this[srcIndex];
            if (type === MemberType.Object && arg?.[MEMORY]?.[ZIG]) {
              // create copy in JS memory
              arg = new arg.constructor(arg);
            }
            let optName, opt;
            if (structure.type === StructureType.Struct) {
              switch (structure.purpose) {
                case StructurePurpose.Allocator: 
                  optName = (allocatorTotal === 1) ? `allocator` : `allocator${++allocatorCount}`;
                  opt = this[ALLOCATOR] = arg;
                  break;
                case StructurePurpose.Promise:
                  optName = 'callback';
                  if (++callbackCount === 1) {
                    opt = thisEnv.createPromiseCallback(this, arg);
                  }
                  break;
                case StructurePurpose.Generator:
                  optName = 'callback';
                  if (++callbackCount === 1) {
                    opt = thisEnv.createGeneratorCallback(this, arg);
                  }
                  break;
                case StructurePurpose.AbortSignal:
                  optName = 'signal';
                  if (++signalCount === 1) {
                    opt = thisEnv.createInboundSignal(arg);
                  }
                  break;
              }
            }
            if (optName !== undefined) {
              if (opt !== undefined) {
                options ||= {};
                options[optName] = opt;
              }
            } else {
              // just a regular argument
              args.push(arg);
            }
          } catch (err) {
            args.push(err);
          }
        }
        if (options) {
          args.push(options);
        }
        return args[Symbol.iterator]();
      }
    };
  },
  handleJscall(id, argAddress, argSize, canWait) {
    const dv = this.obtainZigView(argAddress, argSize, false);
    const caller = this.jsFunctionCallerMap.get(id);
    return (caller) ? caller(dv, canWait) : PosixError.EFAULT;
  },
  releaseFunction(id) {
    const thunk = this.jsFunctionThunkMap.get(id);
    const controller = this.jsFunctionControllerMap.get(id);
    if (thunk && controller) {
      const controllerAddress = this.getViewAddress(controller[MEMORY]);
      const thunkAddress = this.getViewAddress(thunk);
      this.destroyJsThunk(controllerAddress, thunkAddress);
      this.releaseZigView(thunk);
      if (id) {
        this.jsFunctionThunkMap.delete(id);
        this.jsFunctionCallerMap.delete(id);
        this.jsFunctionControllerMap.delete(id);
      }
    }
  },
  freeFunction(func) {
    this.releaseFunction(this.getFunctionId(func));
  },
  ...({
    exports: {
      handleJscall: { argType: 'iiib', returnType: 'i' },
      releaseFunction: { argType: 'i' },
    },
    imports: {
      createJsThunk: { argType: 'ii', returnType: 'i' },
      destroyJsThunk: { argType: 'ii', returnType: 'i' },
      finalizeAsyncCall: { argType: 'ii' },
    },
  } ),
});

var callMarshalingOutbound = mixin({
  createOutboundCaller(thunk, ArgStruct) {
    const thisEnv = this;
    const self = function (...args) {
      {
        if (!thisEnv.runThunk) {
          return thisEnv.initPromise.then(() => {
            return self(...args);
          });
        }
      }
      // `this` is present when running a promise and generator callback received from a inbound call
      // it's going to be the argument struct of that call
      const argStruct = new ArgStruct(args, this?.[ALLOCATOR]);
      {
        try {
          return thisEnv.invokeThunk(thunk, self, argStruct);
        } catch (err) {
          // do nothing when exit code is 0
          if (err instanceof Exit && err.code === 0) {
            return;
          }
          throw err;
        }
      }
    };
    return self;
  },
  copyArguments(argStruct, argList, members, options, argAlloc) {
    let destIndex = 0, srcIndex = 0;
    let allocatorCount = 0;
    const setters = argStruct[SETTERS];
    for (const { type, structure } of members) {
      let arg, promise, generator, signal;
      if (structure.type === StructureType.Struct) {
        switch (structure.purpose) {
          case StructurePurpose.Allocator:
            // use programmer-supplied allocator if found in options object, handling rare scenarios
            // where a function uses multiple allocators
            const allocator = (++allocatorCount === 1)
            ? options?.['allocator'] ?? options?.['allocator1']
            : options?.[`allocator${allocatorCount}`];
            // otherwise use default allocator which allocates relocatable memory from JS engine
            arg = allocator ?? this.createDefaultAllocator(argStruct, structure);
            break;
          case StructurePurpose.Promise:
            promise ||= this.createPromise(structure, argStruct, options?.['callback']);
            arg = promise;
            break;
          case StructurePurpose.Generator:
            generator ||= this.createGenerator(structure, argStruct, options?.['callback']);
            arg = generator;
            break;
          case StructurePurpose.AbortSignal:
            // create an Int32Array with one element, hooking it up to the programmer-supplied
            // AbortSignal object if found
            signal ||= this.createSignal(structure, options?.['signal']);
            arg = signal;
            break;
          case StructurePurpose.Reader:
            arg = this.createReader(argList[srcIndex++]);
            break;
          case StructurePurpose.Writer:
            arg = this.createWriter(argList[srcIndex++]);
            break;
          case StructurePurpose.File:
            arg = this.createFile(argList[srcIndex++]);
            break;
          case StructurePurpose.Directory:
            arg = this.createDirectory(argList[srcIndex++]);
            break;
        }
      }
      if (arg === undefined) {
        // just a regular argument
        arg = argList[srcIndex++];
        // only void has the value of undefined
        if (arg === undefined && type !== MemberType.Void) {
          throw new UndefinedArgument();
        }
      }
      try {
        const set = setters[destIndex++];
        set.call(argStruct, arg, argAlloc);
      } catch (err) {
        throw adjustArgumentError(err, destIndex - 1);
      }
    }
  },
  invokeThunk(thunk, fn, argStruct) {
    const context = this.startContext();
    const attrs = argStruct[ATTRIBUTES];
    const thunkAddress = this.getViewAddress(thunk[MEMORY]);
    const fnAddress = this.getViewAddress(fn[MEMORY]);
    const isAsync = FINALIZE in argStruct;
    const hasPointers = VISIT in argStruct;
    if (hasPointers) {
      this.updatePointerAddresses(context, argStruct);
    }
    // return address of shadow for argumnet struct
    const argAddress = this.getShadowAddress(context, argStruct, null, false)
    ;
    // get address of attributes if function variadic
    const attrAddress = (attrs) ? this.getShadowAddress(context, attrs) : 0
    ;
    this.updateShadows(context);
    let finalized = false;
    const finalize = () => {
      this.updateShadowTargets(context);
      // create objects that pointers point to
      if (hasPointers) {
        this.updatePointerTargets(context, argStruct);
      }
      this.flushStreams?.();
      this.endContext();
      finalized = true;
    };
    if (isAsync) {
      argStruct[FINALIZE] = finalize;
    }
    {
      this.trackingMixins = true;
    }
    const success = (attrs)
    ? this.runVariadicThunk(thunkAddress, fnAddress, argAddress, attrAddress, attrs.length)
    : this.runThunk(thunkAddress, fnAddress, argAddress);
    if (!success) {
      if (!finalized) {
        finalize();
      }
      throw new ZigError();
    }
    {
      // finalized can be true here, if a function chooses to immediately invoke a promise's resolve method
      if (!finalized) {
        // copy retval from shadow view
        argStruct[UPDATE]?.(this.findShadowView(argStruct[MEMORY]));
      }
    }
    const transform = fn[TRANSFORM];
    if (isAsync) {
      let retval = null;
      // if a function has returned a value or failed synchronmously, the promise is resolved immediately
      if (!finalized) {
        try {
          retval = argStruct.retval;
        } catch (err) {
          retval = new ZigError(err, 1);
        }
      }
      if (retval != null) {
        if (transform) {
          retval = transform(retval);
        }
        argStruct[RETURN](retval);
      } else {
        if (transform) {
          // so the promise or generator can perform the transform 
          argStruct[TRANSFORM] = transform;
        }
      }
      // this would be undefined if a callback function is used instead
      return argStruct[PROMISE] ?? argStruct[GENERATOR];
    } else {
      finalize();
      try {
        const { retval } = argStruct;
        return (transform) ? transform(retval) : retval;
      } catch (err) {
        throw new ZigError(err, 1);
      }
    }
  },
  ...({
    imports: {
      runThunk: { argType: 'iii', returnType: 'b' },
      runVariadicThunk: { argType: 'iiiii', returnType: 'b' },
    },
  } ),
});

class AsyncReader {
  bytes = null;
  promise = null;
  done = false;  

  readnb(len) {
    const avail = this.poll();
    if (typeof(avail) != 'number') {
      throw new WouldBlock();
    }
    return this.shift(len);
  }

  async read(len) {
    await this.poll();
    return this.shift(len);
  }

  store({ done, value: chunk }) {
    if (done) {
      this.done = true;
      return 0;
    }
    if (!(chunk instanceof Uint8Array)) {
      if (chunk instanceof ArrayBuffer) {
        chunk = new Uint8Array(chunk);
      } else if (chunk.buffer instanceof ArrayBuffer) {
        chunk = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      } else {
        chunk = encodeText(chunk + '');
      }
    }
    this.bytes = chunk;
    return chunk.length;
  }

  shift(len) {
    let chunk;
    if (this.bytes) {
      if (this.bytes.length > len) {
        chunk = this.bytes.subarray(0, len);
        this.bytes = this.bytes.subarray(len);
      } else {
        chunk = this.bytes;
        this.bytes = null;
      }
    }
    return chunk ?? new Uint8Array(0);    
  }

  poll() {
    const len = this.bytes?.length;
    if (len) {
      return len;
    } else {
      return this.promise ??= this.fetch().then((chunk) => {
        this.promise = null;
        return this.store(chunk);
      });
    }
  }
}

class WebStreamReader extends AsyncReader {
  onClose = null;

  constructor(reader) {
    super();
    this.reader = reader;
    attachClose(reader, this);
  }

  async fetch() {
    return this.reader.read();
  }

  destroy() {
    if (!this.done) {
      this.reader.cancel();
    }
    this.bytes = null;
  }

  valueOf() {
    return this.reader;
  }
}

class WebStreamReaderBYOB extends WebStreamReader {
  async fetch() {
    const buffer = new Uint8Array(size8k);
    return this.reader.read(buffer);
  }
}

class AsyncWriter {
  promise = null;

  writenb(bytes) {
    const avail = this.poll();
    if (typeof(avail) !== 'number') {
      throw new WouldBlock();
    }
    this.queue(bytes);
  }

  async write(bytes) {
    await this.poll();
    await this.queue(bytes);
  }

  queue(bytes) {
    return this.promise = this.send(bytes).then(() => {
      this.promise = null;
    });
  }

  poll() {
    return this.promise?.then?.(() => size16meg) ?? size16meg;
  }
}

class WebStreamWriter extends AsyncWriter {
  onClose = null;
  done = false;

  constructor(writer) {
    super();
    this.writer = writer;
    writer.closed.catch(empty).then(() => {
      this.done = true;
      this.onClose?.();
    });
  }

  async send(bytes) {
    await this.writer.write(bytes);
  }

  destroy() {
    if (!this.done) {
      this.writer.close();
    }
  }

  valueOf() {
    return this.writer;
  }
}

class BlobReader extends AsyncReader {
  pos = 0;
  onClose = null;

  constructor(blob) {
    super();
    this.blob = blob;
    this.size = blob.size;
    attachClose(blob, this);
  }

  async fetch() {
    const chunk = await this.pread(size8k, this.pos);
    const { length } = chunk;
    return { done: !length, value: (length) ? chunk : null };
  }

  async pread(len, offset) {
    const slice = this.blob.slice(offset, offset + len);
    const response = new Response(slice);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
  
  async read(len) {
    const chunk = await super.read(len);
    this.pos += chunk.length;
    return chunk;
  }

  tell() {
    return this.pos;
  }

  seek(offset, whence) {
    this.done = false;
    this.bytes = null;
    return this.pos = reposition(whence, offset, this.pos, this.size);
  }

  valueOf() {
    return this.blob;
  }
}

class Uint8ArrayReader {
  pos = 0;
  onClose = null;

  constructor(array) {
    this.array = array;
    this.size = array.length;    
    attachClose(array, this);
  }

  readnb(len) {
    return this.read(len);
  }

  read(len) {
    const buf = this.pread(len, this.pos);
    this.pos += buf.length;
    return buf;
  }

  pread(len, offset) {
    return this.array.subarray(offset, offset + len);
  }

  tell() {
    return this.pos;
  }

  seek(offset, whence) {
    return this.pos = reposition(whence, offset, this.pos, this.size);
  }

  poll() {
    return this.size - this.pos;
  }

  valueOf() {
    return this.array;
  }
}

class Uint8ArrayReadWriter extends Uint8ArrayReader {
  writenb(buf) {
    return this.write(buf);
  }

  write(buf) {
    this.pwrite(buf, this.pos);
    this.pos += buf.length;
  }

  pwrite(buf, offset) {
    this.array.set(buf, offset);
  }
}

class StringReader extends Uint8ArrayReader {
  constructor(string) {
    super(encodeText(string));
    this.string = string;
    attachClose(string, this);
  }

  valueOf() {
    return this.string;
  }
}

class ArrayWriter {
  constructor(array) {
    this.array = array;
    this.closeCB = null;
    attachClose(array, this);
  }

  writenb(bytes) {
    this.write(bytes);
  }

  write(bytes) {
    this.array.push(bytes);
  }

  poll() {
    return size16meg;
  }

  valueOf() {
    return this.array;
  }
}

class NullStream {
  read() {
    return this.pread();
  }

  pread() {
    return new Uint8Array(0);
  }

  write() {}

  pwrite() {}

  poll(tag) {
    return (tag === PosixPollEventType.FD_READ) ? 0 : size16meg;
  }

  valueOf() {
    return null;
  }
}

class MapDirectory {
  onClose = null;
  keys = null;
  cookie = 0;

  constructor(map) {
    this.map = map;
    this.size = map.size;
    attachClose(map, this);
  }

  readdir() {
    const offset = this.cookie;
    let dent;
    switch (offset) {
      case 0:
      case 1: 
        dent = { name: '.'.repeat(offset + 1), type: 'directory' };
        break;
      default:
        if (!this.keys) {
          this.keys = [ ...this.map.keys() ];
        }
        const name = this.keys[offset - 2];
        if (name === undefined) {
          return null;
        }
        const stat = this.map.get(name);
        dent = { name, ...stat };        
    }
    this.cookie++;
    return dent;
  }

  seek(cookie) {
    return this.cookie = cookie;
  }

  tell() {
    return this.cookie;
  }

  valueOf() {
    return this.map;
  }
}

function reposition(whence, offset, current, size) {
  let pos = -1;
  switch (whence) {
    case 0: pos = offset; break;
    case 1: pos = current + offset; break;
    case 2: pos = size + offset; break;
  }
  if (!(pos >= 0 && pos <= size)) throw new InvalidArgument();
  return pos;
}

function attachClose(target, stream) {
  if (typeof(target) === 'object') {
    const previous = target.close;
    defineProperty(target, 'close', { 
      value: () => {
        previous?.();
        stream.onClose?.();
        delete target.close;
      }
    });
  }
}

const size8k = 8192;
const size16meg = 16777216;

var dirConversion = mixin({
  convertDirectory(arg) {
    if (arg instanceof Map) {
      return new MapDirectory(arg);
    } else if (hasMethod(arg, 'readdir')) {
      return arg;
    }
  }
});

var intConversion = mixin({
  addIntConversion(getAccessor) {
    return function (access, member) {
      const accessor = getAccessor.call(this, access, member);
      const { flags, bitSize } = member;
      if (access === 'set') {
        return (bitSize > 32)
        ? function(offset, value, littleEndian) {
            accessor.call(this, offset, BigInt(value), littleEndian);
          }
        : function(offset, value, littleEndian) {
          const number = Number(value);
          if (!isFinite(number)) {
            throw new InvalidIntConversion(value)
          }
          accessor.call(this, offset, number, littleEndian);
        };
      } else {
        const { flags: structureFlags } = member.structure;
        if ((structureFlags & PrimitiveFlag.IsSize) && bitSize > 32) {
          const max = BigInt(Number.MAX_SAFE_INTEGER);
          const min = BigInt(Number.MIN_SAFE_INTEGER);
          return function(offset, littleEndian) {
            const bigint = accessor.call(this, offset, littleEndian);
            return (min <= bigint && bigint <= max) ? Number(bigint) : bigint;
          };
        }
      }
      return accessor;
    };
  },
});

var memoryMapping = mixin({
  init() {
    this.isMemoryMapping = true;
    this.memoryList = [];
    this.contextCount = 0;
  },
  startContext() {
    ++this.contextCount;
    return { shadowList: [] };
  },
  endContext() {
    if (--this.contextCount === 0) {
      for (const { shadowDV } of this.memoryList) {
        if (shadowDV) {
          this.freeShadowMemory(shadowDV);
        }
      }
      this.memoryList.splice(0);
    }
  },
  getShadowAddress(context, target, cluster, writable) {
    const targetDV = target[MEMORY];
    if (cluster) {
      if (cluster.address === undefined) {
        const { start, end, targets } = cluster;
        // look for largest align
        let maxAlign = 0, maxAlignOffset;
        for (const target of targets) {
          const dv = target[MEMORY];
          const offset = dv.byteOffset;
          const align = target.constructor[ALIGN] ?? dv[ALIGN];
          if (maxAlign === undefined || align > maxAlign) {
            maxAlign = align;
            maxAlignOffset = offset;
          }
        }
        // ensure the shadow buffer is large enough to accommodate necessary adjustments
        const len = end - start;
        const unalignedDV = this.allocateShadowMemory(len + maxAlign, 1);
        const unalignedAddress = this.getViewAddress(unalignedDV);
        const maxAlignAddress = alignForward(adjustAddress(unalignedAddress, maxAlignOffset - start), maxAlign);
        const address = adjustAddress(maxAlignAddress, start - maxAlignOffset);
        // make sure that other pointers are correctly aligned also
        for (const target of targets) {
          const dv = target[MEMORY];
          const offset = dv.byteOffset;
          if (offset !== maxAlignOffset) {
            const align = target.constructor[ALIGN] ?? dv[ALIGN];
            if (isMisaligned(adjustAddress(address, offset - start), align)) {
              throw new AlignmentConflict(align, maxAlign);
            }
          }
        }
        const shadowOffset = unalignedDV.byteOffset + Number(address - unalignedAddress);
        const shadowDV = new DataView(unalignedDV.buffer, shadowOffset, len);
        {
          // attach Zig memory info to aligned data view so it gets freed correctly
          shadowDV[ZIG] = { address, len, align: 1, unalignedAddress, type: MemoryType.Scratch };
        }
        const clusterDV = new DataView(targetDV.buffer, Number(start), len);
        const entry = this.registerMemory(address, len, 1, writable, clusterDV, shadowDV);
        context.shadowList.push(entry);
        cluster.address = address;
      }
      return adjustAddress(cluster.address, targetDV.byteOffset - cluster.start);
    } else {
      const align = target.constructor[ALIGN] ?? targetDV[ALIGN];
      const len = targetDV.byteLength;
      const shadowDV = this.allocateShadowMemory(len, align);
      const address = this.getViewAddress(shadowDV);
      const entry = this.registerMemory(address, len, 1, writable, targetDV, shadowDV);
      context.shadowList.push(entry);
      return address;
    }
  },
  updateShadows(context) {
    for (let { targetDV, shadowDV } of context.shadowList) {
      {
        shadowDV = this.restoreView(shadowDV);
      }
      copyView(shadowDV, targetDV);
    }
  },
  updateShadowTargets(context) {
    for (let { targetDV, shadowDV, writable } of context.shadowList) {
      if (writable) {
        {
          shadowDV = this.restoreView(shadowDV);
        }
        copyView(targetDV, shadowDV);
      }
    }
  },
  registerMemory(address, len, align, writable, targetDV, shadowDV) {
    const index = findMemoryIndex(this.memoryList, address);
    let entry = this.memoryList[index - 1];
    if (entry?.address === address && entry.len === len) {
      entry.writable ||= writable;
    } else {
      entry = { address, len, align, writable, targetDV, shadowDV };
      this.memoryList.splice(index, 0, entry);
    }
    return entry;
  },
  unregisterMemory(address, len) {
    const index = findMemoryIndex(this.memoryList, address);
    const entry = this.memoryList[index - 1];
    if (entry?.address === address && entry.len === len) {
      this.memoryList.splice(index - 1, 1);
      return entry;
    }
  },
  findMemory(context, address, count, size) {
    let len = count * (size ?? 0);
    const index = findMemoryIndex(this.memoryList, address);
    const entry = this.memoryList[index - 1];
    let dv;
    if (entry?.address === address && entry.len === len) {
      dv = entry.targetDV;
    } else if (entry?.address <= address && adjustAddress(address, len) <= adjustAddress(entry.address, entry.len)) {
      const offset = Number(address - entry.address);
      const isOpaque = size === undefined;
      const { targetDV } = entry;
      if (isOpaque) {
        len = targetDV.byteLength - offset;
      }
      dv = this.obtainView(targetDV.buffer, targetDV.byteOffset + offset, len);
      if (isOpaque) {
        // opaque structure--need to save the alignment
        dv[ALIGN] = entry.align;
      }
    }
    if (!dv) {
      // not found in any of the buffers we've seen--assume it's Zig memory
      dv = this.obtainZigView(address, len);
    } else {
      let { targetDV, shadowDV } = entry;
      if (shadowDV && context && !context.shadowList.includes(entry)) {
        {
          shadowDV = this.restoreView(shadowDV);
        }
        copyView(targetDV, shadowDV);
      }
    }
    return dv;
  },
  findShadowView(dv) {
    for (const { shadowDV, targetDV } of this.memoryList) {
      if (targetDV === dv) {
        return shadowDV;
      }
    }
  },
  releaseZigView(dv) {
    const zig = dv[ZIG];
    const address = zig?.address;
    if (address && address !== usizeInvalid) {
      // set address to invalid to avoid double free
      zig.address = usizeInvalid;
    }
  },
  getViewAddress(dv) {
    const zig = dv[ZIG];
    if (zig) {
      return zig.address;
    } else {
      const address = this.getBufferAddress(dv.buffer);
      return adjustAddress(address, dv.byteOffset);
    }
  },
  ...({
    imports: {
      allocateScratchMemory: { argType: 'ii', returnType: 'i' },
      freeScratchMemory: { argType: 'iii' },
    },
    exports: {
      getViewAddress: { argType: 'v', returnType: 'i' },
    },
    usizeMaxBuffer: new ArrayBuffer(0),

    allocateShadowMemory(len, align) {
      const address = (len) ? this.allocateScratchMemory(len, align) : 0;
      if (!address && len) {
        throw new Error('Out of memory');
      }
      const dv = this.obtainZigView(address, len);
      const zig = dv?.[ZIG];
      if (zig) {
        zig.align = align;
      }
      return dv;
    },
    freeShadowMemory(dv) {
      const { address, unalignedAddress, len, align } = dv[ZIG];
      if (len) {
        this.freeScratchMemory(unalignedAddress ?? address, len, align);
      }
      this.releaseZigView(dv);
    },
    obtainZigView(address, len, cache = true) {
      if (isInvalidAddress(address)) {
        address = (len > 0) ? 0 : usizeMax;
      }
      if (!address && len) {
        return null;
      }
      let { buffer } = this.memory;
      if (address === usizeMax) {
        buffer = this.usizeMaxBuffer;
        address = usizeMin;
        len = 0;
      }
      return this.obtainView(buffer, address, len, cache);
    },
    getTargetAddress(context, target, cluster, writable) {
      const dv = target[MEMORY];
      if (dv[ZIG]) {
        return this.getViewAddress(dv);
      } else if (dv.byteLength === 0) {
        // it's a null pointer/empty slice
        return 0;
      }
      // JS buffers always need shadowing
      return this.getShadowAddress(context, target, cluster, writable);
    },
    getBufferAddress(buffer) {
      return 0;
    },
  } ),
});

function findMemoryIndex(array, address) {
  return findSortedIndex(array, address, m => m.address);
}

const MemoryType = {
  Scratch: 1,
};

var moduleLoading = mixin({
  init() {
    this.abandoned = false;
    this.destructors = [];
    {
      this.nextValueIndex = 1;
      this.valueMap = new Map();
      this.valueIndices = new Map();
      this.options = null;
      this.executable = null;
      this.instance = null;
      this.memory = null;
      this.table = null;
      this.initialTableLength = 0;
      this.exportedFunctions = null;
      this.customWASI = null;
    }
  },
  abandonModule() {
    if (!this.abandoned) {
      for (const destructor of this.destructors.reverse()) {
        destructor();
      }
      this.abandoned = true;
    }
  },
  ...({
    imports: {
      initialize: { argType: '' },
    },
    exports: {
      displayPanic: { argType: 'ii' },
    },

    getObjectIndex(object) {
      if (object != null) {
        let index = this.valueIndices.get(object);
        if (index === undefined) {
          index = this.nextValueIndex++;
          this.valueIndices.set(object, index);
          this.valueMap.set(index, object);
        }
        return index;
      } else {
        return 0;
      }
    },
    fromWebAssembly(type, arg) {
      switch (type) {
        case 'v':
        case 's': return this.valueMap.get(arg);
        case 'i': return arg;
        case 'b': return !!arg;
      }
    },
    toWebAssembly(type, arg) {
      switch (type) {
        case 'v':
        case 's': return this.getObjectIndex(arg);
        case 'i': return arg;
        case 'b': return arg ? 1 : 0;
      }
    },
    exportFunction(fn, argType = '', returnType = '', name) {
      if (!fn) {
        return () => {};
      }
      return (...args) => {
        args = args.map((arg, i) => this.fromWebAssembly(argType.charAt(i), arg));
        const retval = fn.apply(this, args);
        const retval2 = this.toWebAssembly(returnType, retval);
        return retval2;
      };
    },
    importFunction(fn, argType = '', returnType = '') {
      return (...args) => {
        args = args.map((arg, i) => this.toWebAssembly(argType.charAt(i), arg));
        const retval = fn.apply(this, args);
        return this.fromWebAssembly(returnType, retval);
      };
    },
    exportFunctions() {
      const imports = {};
      for (const [ name, { argType, returnType, alias } ] of Object.entries(this.exports)) {
        const fn = this[alias ?? name];
        if (fn) {
          imports[`_${name}`] = this.exportFunction(fn, argType, returnType, name);
        }
      }
      return imports;
    },
    importFunctions(exports) {
      for (const [ name, { argType, returnType } ] of Object.entries(this.imports)) {
        const fn = exports[name];
        if (fn) {
          defineProperty(this, name, defineValue(this.importFunction(fn, argType, returnType)));
          this.destructors.push(() => this[name] = throwError$1);
        }
      }
    },
    async instantiateWebAssembly(source, options) {
      const {
        memoryInitial,
        memoryMax,
        tableInitial,
        multithreaded,
      } = this.options = options;
      const res = await source;
      const suffix = (res[Symbol.toStringTag] === 'Response') ? 'Streaming' : '';
      const w = WebAssembly;
      const f = w['compile' + suffix];
      const executable = this.executable = await f(res);
      const functions = this.exportFunctions();
      const env = {}, wasi = {}, wasiPreview = {};
      const exports = this.exportedModules = { env, wasi, wasi_snapshot_preview1: wasiPreview };
      for (const { module, name, kind } of w.Module.imports(executable)) {
        if (kind === 'function') {
          if (module === 'env') {
            env[name] = functions[name] ?? empty;
          } else if (module === 'wasi_snapshot_preview1') {
            wasiPreview[name] = this.getWASIHandler(name);
          } else if (module === 'wasi') {
            wasi[name] = this.getThreadHandler?.(name) ?? empty;
          }
        }
      }
      this.memory = env.memory = new w.Memory({
        initial: memoryInitial,
        maximum: memoryMax,
        shared: multithreaded,
      });
      this.table = env.__indirect_function_table = new w.Table({
        initial: tableInitial,
        element: 'anyfunc',
        shared: multithreaded,
      });
      this.initialTableLength = tableInitial;
      return w.instantiate(executable, exports);
    },
    loadModule(source, options) {
      return this.initPromise = (async () => {
        const instance = this.instance = await this.instantiateWebAssembly(source, options);
        this.importFunctions(instance.exports);
        this.initializeCustomWASI();
        this.initialize();
      })();
    },
    getWASIHandler(name) {
      const nameCamelized = name.replace(/_./g, m => m.charAt(1).toUpperCase());
      const handler = this[nameCamelized]?.bind?.(this);
      const eventName = this[nameCamelized + 'Event'];
      return (...args) => {
        const result = handler?.(...args) ?? PosixError.ENOTSUP;
        const onResult = (result) => {
          if (result === PosixError.ENOTSUP || result === PosixError.ENOTCAPABLE) {
            // the handler has is either missing or has declined to deal with it, 
            // try with the method from the programmer supplied WASI interface
            if (result === PosixError.ENOTSUP) {
              const custom = this.customWASI?.wasiImport?.[name];
              if (custom) {
                return custom(...args);
              }
            }
            // if we can't fallback onto a custom handler, explain the failure
            if (eventName) {
              console.error(`WASI method '${name}' requires the handling of the '${eventName}' event`);
            }
            return PosixError.ENOTSUP;
          }
          return result;
        };
        return isPromise(result) ? result.then(onResult) : onResult(result);
      };
    },
    setCustomWASI(wasi) {
      this.customWASI = wasi;
      if (this.instance) {
        this.initializeCustomWASI();
      }
    },
    initializeCustomWASI() {
      const wasi = this.customWASI;
      if (wasi) {
        // use a proxy to attach the memory object to the list of exports
        const exportsPlusMemory = { ...this.instance.exports, memory: this.memory };
        const instanceProxy = new Proxy(this.instance, {
          get(inst, name) {
            return (name === 'exports') ? exportsPlusMemory : inst[name];
          }
        });
        wasi.initialize?.(instanceProxy);
      }
    },
    displayPanic(address, len) {
      const array = new Uint8Array(this.memory.buffer, address, len);
      const msg = decodeText(array);
      console.error(`Zig panic: ${msg}`);
    },
  } ),
});

const throwError$1 = () => { throw new Error(`Module was abandoned`) };

var objectLinkage = mixin({
  linkVariables(writeBack) {
    {
      // linkage occurs when WASM compilation is complete and functions have been imported
      if (!this.memory) {
        this.initPromise = this.initPromise.then(() => this.linkVariables(writeBack));
        return;
      }
    }
    for (const { object, handle } of this.variables) {
      const jsDV = object[MEMORY];
      // objects in WebAssembly have fixed addresses so the handle is the address
      // for native code module, locations of objects in memory can change depending on
      // where the shared library is loaded
      const address = handle ;
      let zigDV = object[MEMORY] = this.obtainZigView(address, jsDV.byteLength);
      if (writeBack) {
        copyView(zigDV, jsDV);
      }
      object.constructor[CACHE]?.save?.(zigDV, object);
      this.destructors.push(() => {
        {
          zigDV = this.restoreView(object[MEMORY]);
        }
        const jsDV = object[MEMORY] = this.allocateMemory(zigDV.byteLength);
        copyView(jsDV, zigDV);
      });
      const linkChildren = (object) => {
        const slots = object[SLOTS];
        if (slots) {
          const parentOffset = zigDV.byteOffset;
          for (const child of Object.values(slots)) {
            if (child) {
              const childDV = child[MEMORY];
              if (childDV.buffer === jsDV.buffer) {
                const offset = parentOffset + childDV.byteOffset - jsDV.byteOffset;
                child[MEMORY] = this.obtainView(zigDV.buffer, offset, childDV.byteLength);
                child.constructor[CACHE]?.save?.(zigDV, child);
                linkChildren(child);
              }
            }
          }
        }
      };
      linkChildren(object);
      // update pointer targets
      object[VISIT]?.(function() { this[UPDATE](); }, VisitorFlag.IgnoreInactive);
    }
    // create thunks of function objects that were created prior to compilation
    this.createDeferredThunks?.();
  },
  ...({
    imports: {
      recreateAddress: { argType: 'i', returnType: 'i' },
    },
  } ),
  });

var pointerSynchronization = mixin({
  updatePointerAddresses(context, object) {
    // first, collect all the pointers
    const pointerMap = new Map();
    const bufferMap = new Map();
    const potentialClusters = [];
    const callback = function(flags) {
      // bypass proxy
      if (pointerMap.get(this) === undefined) {
        const target = this[SLOTS][0];
        if (target) {
          const writable = !this.constructor.const;
          const entry = { target, writable };
          // only targets in JS memory need updating
          const dv = target[MEMORY];
          if (!dv[ZIG]) {
            pointerMap.set(this, target);
            // see if the buffer is shared with other objects
            const other = bufferMap.get(dv.buffer);
            if (other) {
              const array = Array.isArray(other) ? other : [ other ];
              const index = findSortedIndex(array, dv.byteOffset, e => e.target[MEMORY].byteOffset);
              array.splice(index, 0, entry);
              if (!Array.isArray(other)) {
                bufferMap.set(dv.buffer, array);
                potentialClusters.push(array);
              }
            } else {
              bufferMap.set(dv.buffer, entry);
            }
            // scan pointers in target
            target[VISIT]?.(callback, 0);
          } else {
            // in Zig memory--no need to update
            pointerMap.set(this, null);
          }
        }
      }
    };
    const flags = VisitorFlag.IgnoreRetval | VisitorFlag.IgnoreInactive;
    object[VISIT](callback, flags);
    // find targets that overlap each other
    const clusters = this.findTargetClusters(potentialClusters);
    const clusterMap = new Map();
    for (const cluster of clusters) {
      for (const target of cluster.targets) {
        clusterMap.set(target, cluster);
      }
    }
    // process the pointers
    for (const [ pointer, target ] of pointerMap) {
      if (target) {
        const cluster = clusterMap.get(target);
        const writable = cluster?.writable ?? !pointer.constructor.const;
        pointer[ADDRESS] = this.getTargetAddress(context, target, cluster, writable);
        if (LENGTH in pointer) {
          pointer[LENGTH] = target.length;
        }
      }
    }
  },
  updatePointerTargets(context, object, inbound = false) {
    const pointerMap = new Map();
    const callback = function(flags) {
      // bypass proxy
      if (!pointerMap.get(this)) {
        pointerMap.set(this, true);
        const currentTarget = this[SLOTS][0];
        const newTarget = (!currentTarget || !(flags & VisitorFlag.IsImmutable))
        ? this[UPDATE](context, true, !(flags & VisitorFlag.IsInactive))
        : currentTarget;
        const targetFlags = (this.constructor.const) ? VisitorFlag.IsImmutable : 0;
        if (!(targetFlags & VisitorFlag.IsImmutable)) {
          // update targets of pointers in original target if it's in JS memory
          // pointers in Zig memory are updated on access so we don't need to do it here
          // (and they should never point to reloctable memory)
          if (currentTarget && !currentTarget[MEMORY][ZIG]) {
            currentTarget[VISIT]?.(callback, targetFlags);
          }
        }        
        if (newTarget !== currentTarget) {
          // acquire targets of pointers in new target if it;s in JS memory
          if (newTarget && !newTarget[MEMORY][ZIG]) {
            newTarget?.[VISIT]?.(callback, targetFlags);
          }
        }
      }
    };
    const flags = (inbound) ? VisitorFlag.IgnoreRetval : 0;
    object[VISIT](callback, flags);
  },
  findTargetClusters(potentialClusters) {
    const clusters = [];
    for (const entries of potentialClusters) {
      let prevTarget = null, prevStart = 0, prevEnd = 0;
      let currentCluster = null;
      for (const { target, writable } of entries) {
        const dv = target[MEMORY];
        const { byteOffset: start, byteLength } = dv;
        const end = start + byteLength;
        let forward = true;
        if (prevTarget) {
          if (prevEnd > start) {
            // the previous target overlaps this one
            if (!currentCluster) {
              currentCluster = {
                targets: [ prevTarget ],
                start: prevStart,
                end: prevEnd,
                address: undefined,
                misaligned: undefined,
                writable,
              };
              clusters.push(currentCluster);
            } else {
              currentCluster.writable ||= writable;
            }
            currentCluster.targets.push(target);
            if (end > prevEnd) {
              // set cluster end offset to include this one
              currentCluster.end = end;
            } else {
              // the previous target contains this one
              forward = false;
            }
          } else {
            currentCluster = null;
          }
        }
        if (forward) {
          prevTarget = target;
          prevStart = start;
          prevEnd = end;
        }
      }
    }
    return clusters;
  },
});

var readerConversion = mixin({
  convertReader(arg) {
    if (arg instanceof ReadableStreamDefaultReader) {
      return new WebStreamReader(arg);
    } else if(arg instanceof ReadableStreamBYOBReader) {
      return new WebStreamReaderBYOB(arg);
    } else if (arg instanceof Blob) {
      return new BlobReader(arg);
    } else if (arg instanceof Uint8Array) {
      return new Uint8ArrayReadWriter(arg);
    } else if (typeof(arg) === 'string' || arg instanceof String) {
      return new StringReader(arg);
    } else if (arg === null) {
      return new NullStream();
    } else if (hasMethod(arg, 'read')) {
      return arg;
    }
  }
});

var runtimeSafety = mixin({
  addRuntimeCheck(getAccessor) {
    return function (access, member) {
      const accessor = getAccessor.call(this, access, member);
      if (access === 'set') {
        const { min, max } = getIntRange(member);
        return function(offset, value, littleEndian) {
          if (value < min || value > max) {
            throw new Overflow(member, value);
          }
          accessor.call(this, offset, value, littleEndian);
        };
      }
      return accessor;
    };
  },
});

function getIntRange(member) {
  const { type, bitSize } = member;
  const signed = (type === MemberType.Int);
  let magBits = (signed) ? bitSize - 1 : bitSize;
  if (bitSize <= 32) {
    const max = 2 ** magBits - 1;
    const min = (signed) ? -(2 ** magBits) : 0;
    return { min, max };
  } else {
    magBits = BigInt(magBits);
    const max = 2n ** magBits - 1n;
    const min = (signed) ? -(2n ** magBits) : 0n;
    return { min, max };
  }
}

var streamLocation = mixin({
  init() {
    this.streamLocationMap = new Map([ [ PosixDescriptor.root, '' ]]);
  },
  obtainStreamLocation(dirFd, pathAddress, pathLen) {
    const pathDV = this.obtainZigView(pathAddress, pathLen, false);
    const pathArray = new Uint8Array(pathDV.buffer, pathDV.byteOffset, pathDV.byteLength);
    let path = decodeText(pathArray).trim();
    if (path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    const parts = path.trim().split('/');
    const list = [];
    for (const part of parts) {
      if (part === '..') {
        if (list.length > 0) {
          list.pop();
        } else {
          throw new InvalidPath(path);
        }
      } else if (part !== '.' && part != '') {
        list.push(part);
      }
    }
    if (!parts[0]) {
      // absolute path
      dirFd = PosixDescriptor.root;
    }
    const [ stream ] = this.getStream(dirFd);
    return { parent: stream.valueOf(), path: list.join('/') };
  },
  getStreamLocation(fd) {
    return this.streamLocationMap.get(fd);
  },
  setStreamLocation(fd, loc) {
    const m = this.streamLocationMap;
    if (loc) {
      m.set(fd, loc);
    } else {
      m.delete(fd);
    }
  },
});

const stdinRights = [ PosixDescriptorRight.fd_read, 0 ];
const stdoutRights = [ PosixDescriptorRight.fd_write, 0 ];

const defaultDirRights =  PosixDescriptorRight.fd_seek
                        | PosixDescriptorRight.fd_fdstat_set_flags
                        | PosixDescriptorRight.fd_tell
                        | PosixDescriptorRight.path_create_directory
                        | PosixDescriptorRight.path_create_file
                        | PosixDescriptorRight.path_open
                        | PosixDescriptorRight.fd_readdir
                        | PosixDescriptorRight.path_filestat_get
                        | PosixDescriptorRight.path_filestat_set_size
                        | PosixDescriptorRight.path_filestat_set_times
                        | PosixDescriptorRight.fd_filestat_get
                        | PosixDescriptorRight.fd_filestat_set_times
                        | PosixDescriptorRight.path_remove_directory
                        | PosixDescriptorRight.path_unlink_file;
const defaultFileRights = PosixDescriptorRight.fd_datasync
                        | PosixDescriptorRight.fd_read
                        | PosixDescriptorRight.fd_seek
                        | PosixDescriptorRight.fd_sync
                        | PosixDescriptorRight.fd_tell
                        | PosixDescriptorRight.fd_write
                        | PosixDescriptorRight.fd_advise
                        | PosixDescriptorRight.fd_allocate
                        | PosixDescriptorRight.fd_filestat_get
                        | PosixDescriptorRight.fd_filestat_set_times
                        | PosixDescriptorRight.fd_filestat_set_size;

var streamRedirection = mixin({
  init() {
    const root = {
      cookie: 0n,
      readdir() {
        const offset = Number(this.cookie);
        let dent = null;
        switch (offset) {
          case 0:
          case 1: 
            dent = { name: '.'.repeat(offset + 1), type: 'directory' };
        }
        return dent;
      },
      seek(cookie) { 
        return this.cookie = cookie;
      },
      tell() { 
        return this.cookie;
      },
      valueOf() { 
        return null;
      },
    };
    this.streamMap = new Map([ 
      [ PosixDescriptor.root, [ root, this.getDefaultRights('dir'), 0 ] ], 
      [ PosixDescriptor.stdout, [ this.createLogWriter('stdout'), stdoutRights, 0 ] ], 
      [ PosixDescriptor.stderr, [ this.createLogWriter('stderr'), stdoutRights, 0 ] ], 
    ]);
    this.flushRequestMap = new Map();
    this.nextStreamHandle = PosixDescriptor.min;
  },
  getStream(fd) {
    {
      if (fd === 3) fd = PosixDescriptor.root;
    }
    const entry = this.streamMap.get(fd);
    if (!entry) {
      if (2 < fd && fd < PosixDescriptor.min) {
        throw new Unsupported();
      }
      throw new InvalidFileDescriptor();
    }
    return entry;
  },  
  createStreamHandle(stream, rights, flags = 0) {
    if (!this.ioRedirection) {
      throw new Unsupported();
    }
    let fd = this.nextStreamHandle++;
    if (fd > PosixDescriptor.max) {
      // look for free slot
      fd = PosixDescriptor.min;
      while (this.streamMap.get(fd)) {      
        fd++;
        if (fd > PosixDescriptor.max) {
          throw new TooManyFiles();
        }
      }
      this.nextStreamHandle = fd + 1;
    }
    this.streamMap.set(fd, [ stream, rights, flags ]);
    stream.onClose = () => this.destroyStreamHandle(fd);
    return fd;
  },
  destroyStreamHandle(fd) {
    const entry = this.streamMap.get(fd);
    if (entry) {
      const [ stream ] = entry;
      stream?.destroy?.();
      this.streamMap.delete(fd);
    }
  },
  redirectStream(name, arg) {
    const map = this.streamMap;
    const fd = PosixDescriptor[name];
    const previous = map.get(fd);
    if (arg !== undefined) {
      let stream, rights;
      if (fd === PosixDescriptor.stdin) {
        stream = this.convertReader(arg);
        rights = stdinRights;
      } else if (fd === PosixDescriptor.stdout || fd === PosixDescriptor.stderr) {
        stream = this.convertWriter(arg);
        rights = stdoutRights;
      } else if (fd === PosixDescriptor.root) {
        stream = this.convertDirectory(arg);
        rights = this.getDefaultRights('dir');
      } else {
        throw new Error(`Expecting 'stdin', 'stdout', 'stderr', or 'root', received ${name}`);
      }
      if (!stream) {
        throw new InvalidStream(rights[0], arg);
      }
      map.set(fd, [ stream, rights, 0 ]);
    } else {
      map.delete(fd);
    }
    return previous?.[0];
  },
  createLogWriter(source) {
    const env = this;
    return {
      pending: [],

      write(chunk) {
          // send text up to the last newline character
          const index = chunk.lastIndexOf(0x0a);
          if (index === -1) {
            this.pending.push(chunk);
          } else {
            const beginning = chunk.subarray(0, index);
            const remaining = chunk.subarray(index + 1);
            this.dispatch([ ...this.pending, beginning ]);
            this.pending.splice(0);
            if (remaining.length > 0) {
              this.pending.push(remaining);
            }
          }
          env.scheduleFlush(this, this.pending.length > 0, 250);
      },
      dispatch(array) {
        const message = decodeText(array);
        if (env.triggerEvent('log', { source, message }) == undefined) {
          console.log(message);
        }
      },
      flush() {
        if (this.pending.length > 0) {
          this.dispatch(this.pending);
          this.pending.splice(0);
        }
      }
    };
  },
  scheduleFlush(stream, active, delay) {
    const map = this.flushRequestMap;
    const timeout = map.get(stream);
    if (timeout) {
      clearTimeout(timeout);
      map.delete(stream);
    }
    if (active) {
      map.set(stream, setTimeout(() => {
        stream.flush();
        map.delete(stream);
      }, delay));
    }
  },
  flushStreams() {
    const map = this.flushRequestMap;
    if (map.size > 0) {
      for (const [ stream, timeout ] of map) {
        stream.flush();
        clearTimeout(timeout);
      }
      map.clear();
    }
  },
  getDefaultRights(type) {
    if (type === 'dir') {
      return [ defaultDirRights, defaultDirRights | defaultFileRights ];
    } else {
      return [ defaultFileRights, 0 ];
    }
  },
});

var thunkAllocation = mixin({
  ...({
    exports: {
      allocateJsThunk: { argType: 'ii', returnType: 'i' },
      freeJsThunk: { argType: 'ii', returnType: 'i' },
      findJsThunk: { argType: 'ii', returnType: 'i' },
    },
    imports: {
      identifyJsThunk: { argType: 'ii', returnType: 'i' },
    },
    init() {
      this.thunkSources = [];
      this.thunkMap = new Map();
    },
    addJsThunkSource() {
      const {
        memoryInitial,
        memoryMax,
        tableInitial,
        multithreaded,
      } = this.options;
      const w = WebAssembly;
      const env = {}, wasi = {}, wasiPreview = {};
      const imports = { env, wasi, wasi_snapshot_preview1: wasiPreview };
      for (const { module, name, kind } of w.Module.imports(this.executable)) {
        if (kind === 'function') {
          if (module === 'env') {
            env[name] = empty;
          } else if (module === 'wasi_snapshot_preview1') {
            wasiPreview[name] = empty;
          }
        }
      }
      env.memory = new w.Memory({
        initial: memoryInitial,
        maximum: memoryMax,
        shared: multithreaded,
      });
      const table = env.__indirect_function_table = new w.Table({
        initial: tableInitial,
        element: 'anyfunc',
      });
      const { exports } = new w.Instance(this.executable, imports);
      const { createJsThunk, destroyJsThunk, identifyJsThunk } = exports;
      const source = {
        thunkCount: 0,
        createJsThunk,
        destroyJsThunk,
        identifyJsThunk,
        table,
      };
      this.thunkSources.unshift(source);
      return source;
    },
    allocateJsThunk(controllerAddress, funcId) {
      let source, sourceAddress = 0;
      for (source of this.thunkSources) {
        sourceAddress = source.createJsThunk(controllerAddress, funcId);
        break;
      }
      if (!sourceAddress) {
        source = this.addJsThunkSource();
        sourceAddress = source.createJsThunk(controllerAddress, funcId);
      }
      // sourceAddress is an index into the function table of the source instance
      // we need to get the function object and place it into the main instance's
      // function table
      const thunkObject = source.table.get(sourceAddress);
      let thunkAddress = 0;
      for (let i = this.table.length - 1; i >= this.initialTableLength; i--) {
        if (!this.table.get(i)) {
          thunkAddress = i;
          break;
        }
      }
      if (!thunkAddress) {
        thunkAddress = this.table.length;
        this.table.grow(8);
      }
      this.table.set(thunkAddress, thunkObject);
      source.thunkCount++;
      // remember where the object is from
      this.thunkMap.set(thunkObject, { source, sourceAddress });
      return thunkAddress;
    },
    freeJsThunk(controllerAddress, thunkAddress) {
      let fnId = 0;
      const thunkObject = this.table.get(thunkAddress);
      this.table.set(thunkAddress, null);
      const entry = this.thunkMap.get(thunkObject);
      if (entry) {
        const { source, sourceAddress } = entry;
        fnId = source.destroyJsThunk(controllerAddress, sourceAddress);
        if (--source.thunkCount === 0) {
          const index = this.thunkSources.indexOf(source);
          if (index !== -1) {
            this.thunkSources.splice(index, 1);
          }
        }
        this.thunkMap.delete(thunkObject);
      }
      return fnId;
    },
    findJsThunk(controllerAddress, thunkAddress) {
      let fnId = 0;
      const thunkObject = this.table.get(thunkAddress);
      this.table.set(thunkAddress, null);
      const entry = this.thunkMap.get(thunkObject);
      if (entry) {
        const { source, sourceAddress } = entry;
        fnId = source.identifyJsThunk(controllerAddress, sourceAddress);
      }
      return fnId;
    },
  } ),
});

var writerConversion = mixin({
  convertWriter(arg) {
    if (arg instanceof WritableStreamDefaultWriter) {
      return new WebStreamWriter(arg);
    } else if (Array.isArray(arg)) {
      return new ArrayWriter(arg);
    } else if (arg instanceof Uint8Array) {
      return new Uint8ArrayReadWriter(arg);
    } else if (arg === null) {
      return new NullStream();
    } else if (typeof(arg?.write) === 'function') {
      return arg;
    }
  },
});

var abortSignal = mixin({
  createSignal(structure, signal) {
    const { constructor: { child: Int32 } } = structure.instance.members[0].structure;
    const ta = new Int32Array([ signal?.aborted ? 1 : 0 ]);
    const int32 = Int32(ta);
    if (signal) {
      signal.addEventListener('abort', () => {
        {
          // WASM doesn't directly access JavaScript memory, we need to find the
          // shadow memory that's been assigned to the object and store the value there
          const shadowDV = this.findShadowView(int32[MEMORY]);
          if (shadowDV) {
            // we'd only find the shadow before the function return
            // nothing happens if the controller's fired afterward
            const shadowTA = new Int32Array(shadowDV.buffer, shadowDV.byteOffset, 1);
            Atomics.store(shadowTA, 0, 1);
          }
        }
      }, { once: true });
    }
    return { ptr: int32 };
  },
  createInboundSignal(signal) {
    const controller = new AbortController();
    if (signal.ptr['*']) {
      controller.abort();
    } else {
      const interval = setInterval(() => {
        if (signal.ptr['*']) {
          controller.abort();
          clearInterval(interval);
        }
      }, 50);
    }
    return controller.signal;
  },
});

var allocator = mixin({
  init() {
    this.defaultAllocator = null;
    this.allocatorVtable =  null;
    this.allocatorContextMap = new Map();
    this.nextAllocatorContextId = usize(0x1000);
  },
  createDefaultAllocator(args, structure) {
    let allocator = this.defaultAllocator;
    if (!allocator) {
      allocator = this.defaultAllocator = this.createJsAllocator(args, structure, false);
    }
    return allocator;
  },
  createJsAllocator(args, structure, resettable) {
    const { constructor: Allocator } = structure;
    let vtable = this.allocatorVtable;
    if (!vtable) {      
      const { noResize, noRemap } = Allocator;
      vtable = this.allocatorVtable = {
        alloc: this.allocateHostMemory.bind(this),
        free: this.freeHostMemory.bind(this),
        resize: noResize,
      };
      if (noRemap) {
        vtable.remap = noRemap;
      }
      this.destructors.push(() => this.freeFunction(vtable.alloc));
      this.destructors.push(() => this.freeFunction(vtable.free));
    }
    let contextId = usizeMax;
    if (resettable) {
      // create list used to clean memory allocated for generator
      const list = [];
      contextId = this.nextAllocatorContextId++;
      this.allocatorContextMap.set(contextId, list);
      args[RESET] = (done) => {
        for (const { address, len } of list) {
          const entry = this.unregisterMemory(address, len);
          {
            if (entry) {
              this.freeShadowMemory(entry.shadowDV);
            }
          }
          if (done) {
            this.allocatorContextMap.delete(contextId);
          }
        }
        list.splice(0);
      };
    }
    const ptr = this.obtainZigView(contextId, 0);
    return new Allocator({ ptr, vtable });
  },
  allocateHostMemory(ptr, len, ptrAlign) {
    // see if we're dealing with a resettable allocator
    const contextId = this.getViewAddress(ptr['*'][MEMORY]);
    const list = (contextId != usizeMax) ? this.allocatorContextMap.get(contextId) : null;
    const align = 1 << ptrAlign;
    const targetDV = this.allocateJSMemory(len, align);
    {
      try {
        const shadowDV = this.allocateShadowMemory(len, align);
        const address = this.getViewAddress(shadowDV);
        this.registerMemory(address, len, align, true, targetDV, shadowDV);
        // save address and len if resettable
        list?.push({ address, len });
        return shadowDV;
      } catch (err) {
        return null;
      }
    }
  },
  freeHostMemory(ptr, buf, ptrAlign) {
    const dv = buf['*'][MEMORY];
    const address = this.getViewAddress(dv);
    const len = dv.byteLength;
    const entry = this.unregisterMemory(address, len);
    {
      if (entry) {
        this.freeShadowMemory(entry.shadowDV);
      }
    }
  },
});

var dir = mixin({
  // create Dir struct for outbound call
  createDirectory(arg) {
    if (typeof(arg) === 'object' && typeof(arg?.fd) === 'number') {
      return arg;
    }
    const dir = this.convertDirectory(arg);
    if (!dir) {
      throw new InvalidStream(PosixDescriptorRight.fd_readdir, arg);
    }
    let fd = this.createStreamHandle(dir, this.getDefaultRights('dir'));
    return { fd };
  },
});

var file = mixin({
  // create File struct for outbound call
  createFile(arg) {
    if (typeof(arg) === 'object' && typeof(arg?.handle) === 'number') {
      return arg;
    }
    const file = this.convertReader(arg) ?? this.convertWriter(arg);
    if (!file) {
      throw new InvalidStream(PosixDescriptorRight.fd_read | PosixDescriptorRight.fd_write, arg);
    } 
    const rights = this.getDefaultRights('file');
    const methodRights = {
      read: PosixDescriptorRight.fd_read,
      write: PosixDescriptorRight.fd_write,
      seek: PosixDescriptorRight.fd_seek,
      tell: PosixDescriptorRight.fd_tell,
      allocate: PosixDescriptorRight.fd_allocate,
    };
    // remove rights to actions that can't be performed
    for (const [ name, right ] of Object.entries(methodRights)) {
      if (!hasMethod(file, name)) {
        rights[0] &= ~right;
      }
    }
    let fd = this.createStreamHandle(file, rights);
    return { handle: fd };
  },
});

var generator = mixin({
  init() {
    this.generatorCallbackMap = new Map();
    this.generatorContextMap = new Map();
    this.nextGeneratorContextId = usize(0x2000);
  },
  createGenerator(structure, args, func) {
    const { constructor, instance: { members } } = structure;
    if (func) {
      if (typeof(func) !== 'function') {
        throw new TypeMismatch('function', func);
      }
    } else {
      const generator = args[GENERATOR] = new AsyncGenerator();
      func = generator.push.bind(generator);
    }
    // create a handle referencing the function 
    const contextId = this.nextGeneratorContextId++;
    const ptr = this.obtainZigView(contextId, 0, false);
    this.generatorContextMap.set(contextId, { func, args });
    // use the same callback for all generators of a given type
    let callback = this.generatorCallbackMap.get(constructor);
    if (!callback) {
      callback = async (ptr, result) => {
        // the function assigned to args[RETURN] down below calls this function
        // with a DataView instead of an actual pointer
        const dv = (ptr instanceof DataView) ? ptr : ptr['*'][MEMORY];
        const contextId = this.getViewAddress(dv);
        const instance = this.generatorContextMap.get(contextId);
        if (instance) {
          const { func, args } = instance;
          const isError = result instanceof Error;
          if (!isError && result) {
            const f = args[TRANSFORM];
            if (f) {
              result = f(result);
            }
          }
          const retval = await ((func.length === 2)
          ? func(isError ? result : null, isError ? null : result)
          : func(result));
          const done = retval === false || isError || result === null;
          // reset allocator
          args[RESET]?.(done);
          if (!done) return true;
          args[FINALIZE]();
          this.generatorContextMap.delete(contextId);
        }
        return false
      };
      this.generatorCallbackMap.set(constructor, callback);
      this.destructors.push(() => this.freeFunction(callback));
    }
    args[RETURN] = result => callback(ptr, result);
    const generator = { ptr, callback };
    const allocatorMember = members.find(m => m.name === 'allocator');
    if (allocatorMember) {
      const { structure } = allocatorMember;     
      generator.allocator = this.createJsAllocator(args, structure, true);
    }
    return generator;
  },
  createGeneratorCallback(args, generator) {
    const { ptr, callback } = generator;
    const f = callback['*'];
    args[YIELD] = result => f.call(args, ptr, result);
    return (...argList) => {
      const result = (argList.length === 2) ? argList[0] ?? argList[1] : argList[0];
      return args[YIELD](result);
    };
  },
  async pipeContents(generator, args) {
    try {
      try {
        const iter = generator[Symbol.asyncIterator]();
        for await (const elem of iter) {
          if (elem !== null) {
            if (!args[YIELD](elem)) {
              break;
            }
          }
        }
        args[YIELD](null);
      } catch (err) {
        if (args.constructor[THROWING]) {
          args[YIELD](err);
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error(err);
    }
  },
});

class AsyncGenerator {
  result = null;
  stopped = false;
  finished = false;
  promises = {};

  async next() {
    if (this.stopped) {
      return { done: true };
    }
    while (true) {
      const value = this.result;
      if (value !== null) {
        this.result = null;
        this.wake('space');
        return { value, done: false };
      } else if (this.error) {
        throw this.error;
      } else if (this.finished) {
        return { done: true };
      }
      // wait for more content
      await this.sleep('content');
    }
  }

  async return(retval) {
    await this.break();
    return { value: retval, done: true };
  }

  async throw(error) {
    await this.break();
    throw error;
  }

  async break() {
    if (!this.finished) {
      this.stopped = true;
      // wait for a push() to ensure that the Zig side has stopped generating
      await this.sleep('break');
    }
  }

  async push(result) {
    if (this.stopped) {
      this.wake('break');
      return false;
    }
    if (result instanceof Error) {
      this.error = result;
      this.finished = true;
    } else if (result === null) {
      this.finished = true;
    } else {
      if (this.result !== null) {
        await this.sleep('space');
      }
      this.result = result;
    }
    this.wake('content');
    return !this.finished;
  }

  sleep(name) {
    let resolve;
    const promise = this.promises[name] ||= new Promise(f => resolve = f);
    if (resolve) promise.resolve = resolve;
    return promise;
  }

  wake(name) {
    const promise = this.promises[name];
    if (promise) {
      this.promises[name] = null;
      {
        // on the WebAssembly side we the main thread can't wait for worker threads
        // so we don't have this problem
        promise.resolve();
      }
    }
  }

  [Symbol.asyncIterator]() { return this }
}

var promise = mixin({
  init() {
    this.promiseCallbackMap = new Map();
    this.promiseContextMap = new Map();
    this.nextPromiseContextId = usize(0x1000);
  },
  // create promise struct for outbound call
  createPromise(structure, args, func) {
    const { constructor } = structure;
    if (func) {
      if (typeof(func) !== 'function') {
        throw new TypeMismatch('function', func);
      }
    } else {
      args[PROMISE] = new Promise((resolve, reject) => {
        func = (result) => {
          if (result?.[MEMORY]?.[ZIG]) {
            // the memory in the result object is stack memory, which will go bad after the function
            // returns; we need to copy the content into JavaScript memory
            result = new result.constructor(result);
          }
          if (result instanceof Error) {
            reject(result);
          } else {
            if (result) {
              const f = args[TRANSFORM];
              if (f) {
                result = f(result);
              }
            }
            resolve(result);
          }        };
      });
    }
    // create a handle referencing the function 
    const contextId = this.nextPromiseContextId++;
    const ptr = this.obtainZigView(contextId, 0, false);
    this.promiseContextMap.set(contextId, { func, args });
    // use the same callback for all promises of a given type
    let callback = this.promiseCallbackMap.get(constructor);
    if (!callback) {
      callback = (ptr, result) => {
        // the function assigned to args[RETURN] down below calls this function
        // with a DataView instead of an actual pointer
        const dv = (ptr instanceof DataView) ? ptr : ptr['*'][MEMORY];
        const contextId = this.getViewAddress(dv);
        const instance = this.promiseContextMap.get(contextId);
        if (instance) {
          const { func, args } = instance;
          if (func.length === 2) {
            const isError = result instanceof Error;
            func(isError ? result : null, isError ? null : result);
          } else {
            func(result);
          }
          args[FINALIZE]();
          this.promiseContextMap.delete(contextId);  
        }
      };
      this.promiseCallbackMap.set(constructor, callback);
      this.destructors.push(() => this.freeFunction(callback));
    }
    args[RETURN] = result => callback(ptr, result);
    return { ptr, callback };
  },
  // create callback for inbound call
  createPromiseCallback(args, promise) {
    const { ptr, callback } = promise;
    const f = callback['*'];
    args[RETURN] = result => f.call(args, ptr, result);
    return (...argList) => {
      const result = (argList.length === 2) ? argList[0] ?? argList[1] : argList[0];
      return args[RETURN](result);
    };
  },
});

var reader = mixin({
  init() {
    this.readerCallback = null;
    this.readerMap = new Map();
    this.nextReaderId = usize(0x1000);
    if (import.meta.env?.PROD !== true) {
      this.readerProgressMap = new Map();
    }
  },
  // create AnyReader struct for outbound call
  createReader(arg) {
    // check if argument isn't already an AnyReader struct
    if (typeof(arg) === 'object' && arg) {
      if('context' in arg && 'readFn' in arg) return arg;
    }
    const reader = this.convertReader(arg);
    if (!reader) {
        throw new InvalidStream(PosixDescriptorRight.fd_read, arg);
    }
    // create a handle referencing the reader 
    const readerId = this.nextReaderId++;
    const context = this.obtainZigView(readerId, 0, false);
    const onClose = reader.onClose = () => {
      this.readerMap.delete(readerId);
      if (import.meta.env?.PROD !== true) {
        this.readerProgressMap.delete(readerId);
      }
    };
    this.readerMap.set(readerId, reader);
    if (import.meta.env?.PROD !== true) {
      this.readerProgressMap.set(readerId, { bytes: 0, calls: 0 });
    }
    // use the same callback for all readers
    let readFn = this.readerCallback;
    if (!readFn) {
      const onError = (err) => {
        console.error(err);
        onClose();
        throw err;
      };
      readFn = this.readerCallback = (context, buffer) => {
        const readerId = this.getViewAddress(context['*'][MEMORY]);
        const reader = this.readerMap.get(readerId);
        if (!reader) return 0;    
        try {
          const dv = buffer['*'][MEMORY];
          const len = dv.byteLength;
          const onResult = (chunk) => {
            const len = chunk.length;
            const address = this.getViewAddress(buffer['*'][MEMORY]);
            this.moveExternBytes(chunk, address, true);
            return len;
          };
          if (import.meta.env?.PROD !== true) {
            const progress = this.readerProgressMap.get(readerId);
            checkInefficientAccess(progress, 'read', len);
          }
          const result = reader.read(len);          
          return isPromise(result) ? result.then(onResult).catch(onError) : onResult(result);
        } catch (err) {
          onError(err);
        }
      };
      this.destructors.push(() => this.freeFunction(readFn));
    }
    return { context, readFn };
  },
});

var writer = mixin({
  init() {
    this.writerCallback = null;
    this.writerMap = new Map();
    this.nextWriterContextId = usize(0x2000);
    if (import.meta.env?.PROD !== true) {
      this.writerProgressMap = new Map();
    }
  },
  // create AnyWriter struct for outbound call
  createWriter(arg) {
    // check if argument isn't already an AnyWriter struct
    if (typeof(arg) === 'object' && arg) {
      if('context' in arg && 'writeFn' in arg) return arg;
    }
    const writer = this.convertWriter(arg);
    if (!writer) {
      throw new InvalidStream(PosixDescriptorRight.fd_write, arg);
    }
    // create a handle referencing the writer 
    const writerId = this.nextWriterContextId++;
    const context = this.obtainZigView(writerId, 0, false);
    const onClose = writer.onClose = () => {
      this.writerMap.delete(writerId);
      if (import.meta.env?.PROD !== true) {
        this.writerProgressMap.delete(writerId);
      }
    };
    this.writerMap.set(writerId, writer);
    if (import.meta.env?.PROD !== true) {
      this.writerProgressMap.set(writerId, { bytes: 0, calls: 0 });
    }
    // use the same callback for all writers
    let writeFn = this.writerCallback;
    if (!writeFn) {
      const onError = (err) => {
        console.error(err);
        onClose();
        throw err;
      };
      writeFn = this.writerCallback = (context, buffer) => {
        const writerId = this.getViewAddress(context['*'][MEMORY]);
        const writer = this.writerMap.get(writerId);
        if (!writer) return 0;
        try {
          const dv = buffer['*'][MEMORY];
          if (import.meta.env?.PROD !== true) {
            const progress = this.writerProgressMap.get(writerId);
            checkInefficientAccess(progress, 'write', dv.byteLength);
          }
          const len = dv.byteLength;
          const src = new Uint8Array(dv.buffer, dv.byteOffset, len);
          const copy = new Uint8Array(src);
          const result = writer.write(copy);
          return isPromise(result) ? result.then(() => len, onError) : len;
        } catch (err) {
          onError(err);
        }
      };
      this.destructors.push(() => this.freeFunction(writeFn));
    }
    return { context, writeFn };
  },
});

var environGet = mixin({
  environGet(environAddress, environBufAddress) {
    const arrays = this.envVarArrays;
    let size = 0, count = 0;
    for (const array of arrays) {
      size += array.length;
      count++;
    }
    const ptrDV = createView(usizeByteSize * count);
    const bytes = new Uint8Array(size);
    let p = 0, b = 0, le = this.littleEndian;
    for (const array of arrays) {
      {
        ptrDV.setUint32(p, environBufAddress + b, le);
        p += 4;
      }
      bytes.set(array, b);
      b += array.length;
    }
    this.moveExternBytes(ptrDV, environAddress, true);
    this.moveExternBytes(bytes, environBufAddress, true);
    return 0;
  },
});

var copyInt = mixin({
  copyUint64(bufAddress, value) {
    const buf = createView(8);
    buf.setBigUint64(0, BigInt(value), this.littleEndian);
    this.moveExternBytes(buf, bufAddress, true);
  },
  copyUint32(bufAddress, value) {
    const buf = createView(4);    
    buf.setUint32(0, value, this.littleEndian);
    this.moveExternBytes(buf, bufAddress, true);
  },
});

var environSizesGet = mixin({
  environSizesGet(environCountAddress, environBufSizeAddress) {
    let object = this.envVariables;
    if (!object) {
      {
        if (!this.customWASI?.wasiImport?.environ_sizes_get) {
          object = {};
        } else {
          return PosixError.ENOTSUP;
        }
      }
    }
    const env = this.envVarArrays = [];
    for (const [ name, value ] of Object.entries(object)) {
      const array = encodeText(`${name}=${value}\0`);
      env.push(array);
    }
    let size = 0;
    for (const array of env) {
      size += array.length;
    }    
    this.copyUint32(environCountAddress, env.length);
    this.copyUint32(environBufSizeAddress, size);
    return 0;
  },
});

const Advice = {
  normal: 0,
  sequential: 1,
  random: 2,
  willNeed: 3,
  dontNeed: 4,
  noReuse: 5,
};

var fdAdvise = mixin({
  fdAdvise(fd, offset, len, advice, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      if (hasMethod(stream, 'advise')) {
        const adviceKeys = Object.keys(Advice);
        return stream.advise?.(safeInt(offset), safeInt(len), adviceKeys[advice]);
      }
    });
  },
});

var fdAllocate = mixin({
  fdAllocate(fd, offset, len, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      checkStreamMethod(stream, 'allocate');
      return stream.allocate(safeInt(offset), safeInt(len));
    });
  },
});

var fdClose = mixin({
  fdClose(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      this.setStreamLocation?.(fd); 
      return this.destroyStreamHandle(fd);
    });
  },
});

var fdDatasync = mixin({
  fdDatasync(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      if (hasMethod(stream, 'datasync')) {
        return stream.datasync?.();
      }
    });
  },
});

var fdFdstatGet = mixin({
  fdFdstatGet(fd, bufAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream, rights, flags ] = this.getStream(fd);
      let type;
      if (stream.type) {
        type = getEnumNumber(stream.type, PosixFileType);
        if (type === undefined) {
          throw new InvalidEnumValue(PosixFileType, stream.type);
        }
      } else {
        if (rights[0] & (PosixDescriptorRight.fd_read | PosixDescriptorRight.fd_write)) {
          type = PosixFileType.file;
        } else {
          type = PosixFileType.directory;
        }
      }
      const dv = createView(24);
      dv.setUint8(0, type);
      dv.setUint16(2, flags, true);
      dv.setBigUint64(8, BigInt(rights[0]), true);
      dv.setBigUint64(16, BigInt(rights[1]), true);
      this.moveExternBytes(dv, bufAddress, true);
    });
  },
});

var fdFdstatSetFlags = mixin({
  fdFdstatSetFlags(fd, newFlags, canWait) {
    // only these flags can be changed
    const mask = PosixDescriptorFlag.append | PosixDescriptorFlag.nonblock;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const entry = this.getStream(fd);
      const [ stream, rights, flags ] = entry;
      if (newFlags & PosixDescriptorFlag.nonblock) {
        if (rights[0] & PosixDescriptorRight.fd_read) {
          checkStreamMethod(stream, 'readnb');
        }
        if (rights[0] & PosixDescriptorRight.fd_write) {
          checkStreamMethod(stream, 'writenb');
        }
      }
      entry[2] = (flags & ~mask) | (newFlags & mask);
    });    
  },
});

var fdFdstatSetRights = mixin({
  fdFdstatSetRights(fd, newRights, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const entry = this.getStream(fd);
      const [ stream, rights ] = entry;
      if (newRights & ~rights) {
        // rights can only be removed, not added
        throw new InvalidFileDescriptor();
      }
      entry[1] = rights;
    });    
  },
});

var copyStat = mixin({
  copyStat(bufAddress, stat) {
    if (stat === false) {
      return PosixError.ENOENT;
    }
    if (typeof(stat) !== 'object' || !stat) {
      throw new TypeMismatch('object or false', stat);
    }
    const { ino = 1, type = 'unknown', size = 0, atime = 0, mtime = 0, ctime = 0 } = stat;
    const typeNum = getEnumNumber(type, PosixFileType);
    if (typeNum === undefined) {
      throw new InvalidEnumValue(PosixFileType, type);
    }
    const le = this.littleEndian;
    const buf = createView(64);
    buf.setBigUint64(0, 0n, le); // dev
    buf.setBigUint64(8, BigInt(ino), le);  
    buf.setUint8(16, typeNum);
    buf.setBigUint64(24, 1n, le);  // nlink
    buf.setBigUint64(32, BigInt(size), le);
    buf.setBigUint64(40, BigInt(atime), le);
    buf.setBigUint64(48, BigInt(mtime), le);
    buf.setBigUint64(56, BigInt(ctime), le);
    this.moveExternBytes(buf, bufAddress, le);
  },
  inferStat(stream) {
    if (!stream) return;
    return { 
      size: stream.size, 
      type: hasMethod(stream, 'readdir') ? 'directory' : 'file',
    };
  },
});

var fdFilestatGet = mixin({
  fdFilestatGet(fd, bufAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      if (this.hasListener('stat')) {
        const target = stream.valueOf();
        const loc = this.getStreamLocation?.(fd);
        return this.triggerEvent('stat', { ...loc, target, flags: {} });
      } else {
        return this.inferStat(stream);
      }
    }, (stat) => this.copyStat(bufAddress, stat));
  },
});

var fdFileStatSetTimes = mixin({
  fdFilestatSetTimesEvent: 'set_times',
  fdFilestatSetTimes(fd, atime, mtime, tFlags, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      const target = stream.valueOf();
      const loc = this.getStreamLocation?.(fd);
      const times = extractTimes(atime, mtime, tFlags);
      const flags = {};
      return this.triggerEvent('set_times', { ...loc, target, times, flags });
    }, (result) => (result === undefined) ? PosixError.ENOTCAPABLE : expectBoolean(result, PosixError.EBADF));
  },
});

var fdPread = mixin({
  fdPread(fd, iovsAddress, iovsCount, offset, readAddress, canWait) {
    const le = this.littleEndian;
    const iovsSize = usizeByteSize * 2;
    const ops = [];
    let total = 0;
    return catchPosixError(canWait, PosixError.EIO, () => {        
      const[ reader, rights ] = this.getStream(fd);
      checkAccessRight(rights, PosixDescriptorRight.fd_read);
      const iovs = createView(iovsSize * iovsCount);
      this.moveExternBytes(iovs, iovsAddress, false);
      for (let i = 0; i < iovsCount; i++) {
        const ptr = readUsize(iovs, i * iovsSize, le);
        const len = readUsizeSafe(iovs, i * iovsSize + usizeByteSize, le);
        ops.push({ ptr, len });
        total += len;
      }
      return reader.pread(total, safeInt(offset));
    }, (chunk) => {
      let { byteOffset: pos, byteLength: remaining, buffer } = chunk;
      for (const { ptr, len } of ops) {
        if (remaining > 0) {
          const part = new DataView(buffer, pos, Math.min(remaining, len));
          this.moveExternBytes(part, ptr, true);
          pos += len;
          remaining -= len;
        }
      }
      this.copyUint32(readAddress, chunk.length);
    });
  },
});

var fdPrestatDirName = mixin({
  fdPrestatDirName(fd, pathAddress, pathLen) {
    if (!this.customWASI?.wasiImport?.fd_prestat_get) {
      if (fd === 3) {
        return 0;
      } else {
        return PosixError.EBADF;
      }
    } else {
      return PosixError.ENOTSUP;
    }
  }
}) ;

var fdPrestatGet = mixin({
  fdPrestatGet(fd, bufAddress) {
    if (!this.customWASI?.wasiImport?.fd_prestat_get) {
      if (fd === 3) {
        // descriptor 3 is the root directory, I think
        this.streamMap.set(fd, this.streamMap.get(PosixDescriptor.root));
        const dv = createView(8);      
        dv.setUint8(0, 0);
        dv.setUint32(4, 0, this.littleEndian);
        this.moveExternBytes(dv, bufAddress, true);
        return 0;
      } else {
        return PosixError.EBADF;
      }
    } else {
      return PosixError.ENOTSUP;
    }
  },
}) ;

var fdPwrite = mixin({
  fdPwrite(fd, iovsAddress, iovsCount, offset, writtenAddress, canWait) {
    const le = this.littleEndian;
    const iovsSize = usizeByteSize * 2;
    let total = 0;
    return catchPosixError(canWait, PosixError.EIO, () => {        
      const[ writer, rights ] = this.getStream(fd);
      checkAccessRight(rights, PosixDescriptorRight.fd_write);
      const iovs = createView(iovsSize * iovsCount);
      this.moveExternBytes(iovs, iovsAddress, false);
      const ops = [];
      for (let i = 0; i < iovsCount; i++) {
        const ptr = readUsize(iovs, i * iovsSize, le);
        const len = readUsizeSafe(iovs, i * iovsSize + usizeByteSize, le);
        ops.push({ ptr, len });
        total += len;
      }
      const buffer = new ArrayBuffer(total);
      let pos = 0;
      for (const { ptr, len } of ops) {
        const part = new DataView(buffer, pos, len);
        this.moveExternBytes(part, ptr, false);
        pos += len;
      }
      const chunk = new Uint8Array(buffer);
      return writer.pwrite(chunk, safeInt(offset));
    }, () => this.copyUint32(writtenAddress, total));
  },
});

var fdRead = mixin({
  fdRead(fd, iovsAddress, iovsCount, readAddress, canWait) {
    const le = this.littleEndian;
    const iovsSize = usizeByteSize * 2;
    const ops = [];
    let total = 0;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const[ reader, rights, flags ] = this.getStream(fd);
      checkAccessRight(rights, PosixDescriptorRight.fd_read);
      const iovs = createView(iovsSize * iovsCount);
      this.moveExternBytes(iovs, iovsAddress, false);
      for (let i = 0; i < iovsCount; i++) {
        const ptr = readUsize(iovs, i * iovsSize, le);
        const len = readUsizeSafe(iovs, i * iovsSize + usizeByteSize, le);
        ops.push({ ptr, len });
        total += len;
      }
      const method = (flags & PosixDescriptorFlag.nonblock) ? reader.readnb : reader.read;
      return method.call(reader, total);
    }, (chunk) => {
      let { byteOffset: pos, byteLength: remaining, buffer } = chunk;
      for (const { ptr, len } of ops) {
        const copying = Math.min(remaining, len);
        if (copying > 0) {
          const part = new DataView(buffer, pos, copying);
          this.moveExternBytes(part, ptr, true);
          pos += copying;
          remaining -= copying;
        }
      }
      this.copyUint32(readAddress, chunk.length);
    });
  },
});

var fdReaddir = mixin({
  fdReaddir(fd, bufAddress, bufLen, cookie, bufusedAddress, canWait) {
    if (bufLen < 24) {
      return PosixError.EINVAL;
    }
    let dir, async;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      [ dir ] = this.getStream(fd);
      if ("wasm" === 'node') ; else {
        return dir.seek(Number(cookie));
      }
    }, (pos) => catchPosixError(canWait, PosixError.EBADF, () => {      
      cookie = pos;
      // retrieve the first entry, checking if the call is async
      const result = dir.readdir();
      async = isPromise(result);
      return result;
    }, (dent) => {
      const dv = createView(bufLen);
      let remaining = bufLen;
      let p = 0;
      while (dent) {
        const { name, type = 'unknown', ino = 1 } = dent;
        const nameArray = encodeText(name);
        const typeIndex = getEnumNumber(type, PosixFileType);
        if (typeIndex === undefined) {
          throw new InvalidEnumValue(PosixFileType, type);
        }
        if (remaining < 24 + nameArray.length) {
          break;
        }
        dv.setBigUint64(p, BigInt(++cookie), true);
        dv.setBigUint64(p + 8, BigInt(ino), true);
        dv.setUint32(p + 16, nameArray.length, true);
        dv.setUint8(p + 20, typeIndex);
        p += 24;
        remaining -= 24;
        for (let i = 0; i < nameArray.length; i++, p++) {
          dv.setUint8(p, nameArray[i]);
        }
        remaining -= nameArray.length;
        // get next entry if call is sync
        dent = (remaining > 24 + 16 && !async) ? dir.readdir() : null;
      }
      this.moveExternBytes(dv, bufAddress, true);
      this.copyUint32(bufusedAddress, p);
    }));
  },
});

var fdSeek = mixin({
  fdSeek(fd, offset, whence, newOffsetAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      checkStreamMethod(stream, 'seek');
      return stream.seek(safeInt(offset), whence);
    }, (pos) => this.copyUint64(newOffsetAddress, pos));
  },
});

var fdSync = mixin({
  fdSync(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      if (hasMethod(stream, 'sync')) {
        return stream.sync?.();
      }
    });
  },
});

var fdTell = mixin({
  fdTell(fd, newOffsetAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      checkStreamMethod(stream, 'tell');
      return stream.tell();
    }, (pos) => this.copyUint64(newOffsetAddress, pos));
  },
});

var fdWrite = mixin({
  fdWrite(fd, iovsAddress, iovsCount, writtenAddress, canWait) {
    const le = this.littleEndian;
    const iovsSize = usizeByteSize * 2;
    let total = 0;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const[ writer, rights, flags ] = this.getStream(fd);
      checkAccessRight(rights, PosixDescriptorRight.fd_write);
      const iovs = createView(iovsSize * iovsCount);
      this.moveExternBytes(iovs, iovsAddress, false);
      const ops = [];
      for (let i = 0; i < iovsCount; i++) {
        const ptr = readUsize(iovs, i * iovsSize, le);
        const len = readUsizeSafe(iovs, i * iovsSize + usizeByteSize, le);
        ops.push({ ptr, len });
        total += len;
      }
      const buffer = new ArrayBuffer(total);
      let pos = 0;
      for (const { ptr, len } of ops) {
        const part = new DataView(buffer, pos, len);
        this.moveExternBytes(part, ptr, false);
        pos += len;
      }
      const chunk = new Uint8Array(buffer);
      const method = (flags & PosixDescriptorFlag.nonblock) ? writer.writenb : writer.write;
      return method.call(writer, chunk);
    }, () => this.copyUint32(writtenAddress, total));
  },
});

var pathCreateDirectory = mixin({
  pathCreateDirectoryEvent: 'mkdir',
  pathCreateDirectory(dirFd, pathAddress, pathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('mkdir', loc, PosixError.ENOENT);
    }, (result) => {
      if (result === undefined) {
        return PosixError.ENOTSUP;
      }
      if (result instanceof Map) {
        return PosixError.EEXIST;
      }
      return expectBoolean(result, PosixError.ENOENT);
    });
  },
});

var pathFilestatGet = mixin({
  pathFilestatGetEvent: 'stat/open',
  pathFilestatGet(dirFd, lFlags, pathAddress, pathLen, bufAddress, canWait) {
    let infer = false;
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      let flags = {
        ...decodeFlags(lFlags, PosixLookupFlag),
      };
      if (this.hasListener('stat')) {
        return this.triggerEvent('stat', { ...loc, flags });
      } else {
        flags = { ...flags, dryrun: true };
        infer = true;
        return this.triggerEvent('open', { ...loc, rights: {}, flags });
      }
    }, (result) => {
      if (result === undefined) {
        return PosixError.ENOTSUP;
      } else if (result === false) {
        return PosixError.ENOENT;
      }
      if (infer) {
        const stream = this.convertReader(result) ?? this.convertWriter(result) ?? this.convertDirectory(result);
        if (!stream) {
          throw new InvalidStream(PosixDescriptorRight.fd_read | PosixDescriptorRight.fd_write | PosixDescriptorRight.fd_readdir, result);
        }
        result = this.inferStat(stream);
      }
      return this.copyStat(bufAddress, result);
    });
  },
});

var pathFilestatSetTimes = mixin({
  pathFilestatSetTimesEvent: 'set_times',
  pathFilestatSetTimes(dirFd, lFlags, pathAddress, pathLen, atime, mtime, tFlags, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      const times = extractTimes(atime, mtime, tFlags);
      const flags = decodeFlags(lFlags, PosixLookupFlag) ;
      return this.triggerEvent('set_times', { ...loc, times, flags });
    }, (result) => (result === undefined) ? PosixError.ENOTSUP : expectBoolean(result, PosixError.ENOENT));
  },
});

const Right = {
  read: PosixDescriptorRight.fd_read,
  write: PosixDescriptorRight.fd_write,
  readdir: PosixDescriptorRight.fd_readdir,
};

var pathOpen = mixin({
  pathOpenEvent: 'open',
  pathOpen(dirFd, lFlags, pathAddress, pathLen, oFlags, rightsBase, rightsInheriting, fdFlags, fdAddress, canWait) {
    const fdRights = [ Number(rightsBase), Number(rightsInheriting) ];
    if (!(fdRights[0] & (PosixDescriptorRight.fd_read | PosixDescriptorRight.fd_write | PosixDescriptorRight.fd_readdir))) {
      fdRights[0] |= PosixDescriptorRight.fd_read;
    }
    let loc;
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      const rights = decodeFlags(fdRights[0], Right);
      const flags = {
        ...decodeFlags(lFlags, PosixLookupFlag),
        ...decodeFlags(oFlags, PosixOpenFlag),
        ...decodeFlags(fdFlags, PosixDescriptorFlag),
      };
      return this.triggerEvent('open', { ...loc, rights, flags });
    }, (arg) => {
      if (arg === undefined) {
        return PosixError.ENOTSUP;
      } else if (arg === false) {
        return PosixError.ENOENT;
      }
      const stream = this.convertReader(arg) ?? this.convertWriter(arg) ?? this.convertDirectory(arg);
      if (!stream) {
        throw new InvalidStream(fdRights[0], arg);
      }
      const fd = this.createStreamHandle(stream, fdRights, fdFlags);
      this.setStreamLocation?.(fd, loc);
      this.copyUint32(fdAddress, fd);
    });
  },
});

var pathRemoveDirectory = mixin({
  pathRemoveDirectory: 'rmdir',
  pathRemoveDirectory(dirFd, pathAddress, pathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('rmdir', loc, PosixError.ENOENT);
    }, (result) => (result === undefined) ? PosixError.ENOTSUP : expectBoolean(result, PosixError.ENOENT));
  },
});

var pathUnlinkFile = mixin({
  pathUnlinkFileEvent: 'unlink',
  pathUnlinkFile(dirFd, pathAddress, pathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('unlink', loc, PosixError.ENOENT);
    }, (result) => (result === undefined) ? PosixError.ENOTSUP : expectBoolean(result, PosixError.ENOENT));
  },
});

var pollOneoff = mixin({
  pollOneoff(subscriptionAddress, eventAddress, subscriptionCount, eventCountAddress, canWait) {
    const subscriptionSize = 48;
    const eventSize = 32;
    const results = [], promises = [];
    const le = this.littleEndian;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const subscriptions = createView(subscriptionSize * subscriptionCount);
      this.moveExternBytes(subscriptions, subscriptionAddress, false);
      for (let i = 0; i < subscriptionCount; i++) {
        const offset = i * subscriptionSize;
        const userdata = subscriptions.getBigUint64(offset, le);
        const tag = subscriptions.getUint8(offset + 8);
        const result = { tag, userdata, error: PosixError.NONE };
        results.push(result);
        let promise;
        switch (tag) {
          case PosixPollEventType.CLOCK: {
            let timeout = subscriptions.getBigUint64(offset + 24, le);
            const array = new Int32Array(new SharedArrayBuffer(4));
            const onResult = resolveClock.bind(result);
            if (timeout === 0n) {
              onResult();
            } else {
              const millisec = Math.ceil(Number(timeout) / 1000000);
              promise = Atomics.waitAsync(array, 0, 0, millisec).value.then(onResult);
            }
          } break;
          case PosixPollEventType.FD_WRITE: 
          case PosixPollEventType.FD_READ: {
            const fd = subscriptions.getInt32(offset + 16, le);
            const onResult = resolveLength.bind(result);
            const onError = resolveError.bind(result);
            try {
              const [ stream ] = this.getStream(fd);  
              checkStreamMethod(stream, 'poll');
              const pollResult = stream.poll(tag);
              if (isPromise(pollResult)) {
                promise = pollResult.then(onResult, onError);
              } else {
                onResult(pollResult);
              }
            } catch (err) {
              if (err.errno === PosixError.ENOTSUP) {
                throw err;
              }
              onError(err);
            }
          } break;
          default:
            throw new InvalidArgument();
        }
        if (promise) {
          promises.push(promise);
        }        
      }
      if (promises.length === results.length) {
        return Promise.any(promises);
      }
    }, () => {
      let eventCount = 0;
      for (const result of results) {
        if (result.resolved) {
          eventCount++;
        }
      }
      const events = createView(eventSize * eventCount);
      let index = 0;
      for (const result of results) {
        if (result.resolved) {
          const offset = index * eventSize;
          events.setBigUint64(offset, result.userdata, le);
          events.setUint16(offset + 8, result.error, le);
          events.setUint8(offset + 10, result.tag);          
          if (result.length !== undefined) {
            if (result.length === 0) {
              // hangup
              events.setUint16(offset + 24, 1, le);
            } else {
              events.setBigUint64(offset + 16, BigInt(result.length), le);
            }
          }
          index++;
        }
      }
      this.moveExternBytes(events, eventAddress, true);
      this.copyUint32(eventCountAddress, eventCount);
    });
  },
});

function resolveClock() {
  Object.assign(this, { resolved: true });
}

function resolveLength(len) {
  Object.assign(this, { resolved: true, length: len });
}

function resolveError(err) {
  console.error(err);
  Object.assign(this, { resolved: true, error: PosixError.EBADF });
}

var procExit = mixin({
  procExit(code) {
    throw new Exit(code);
  }
}) ;

var randomGet = mixin({
  randomGet(bufAddress, bufLen) {
    const dv = createView(bufLen);
    for (let i = 0; i < bufLen; i++) {
      dv.setUint8(i, Math.floor(256 * Math.random()));
    }
    this.moveExternBytes(dv, bufAddress, true);
    return 0;
  }
}) ;

var workerSupport = mixin({
  init() {
    this.nextThreadId = 1;
    this.workers = [];
  },
  getThreadHandler(name) {
    switch (name) {
      case 'thread-spawn':
        if (typeof(window) === 'object' && !window.crossOriginIsolated) {
          console.warn(
            '%cHTML document is not cross-origin isolated %c\n\nWebAssembly multithreading in the browser is only possibly when %cwindow.crossOriginIsolated%c = true. Visit https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated for information on how to enable it.',
            'color: red;font-size: 200%;font-weight:bold', '', 'background-color: lightgrey;font-weight:bold', ''
          );
        }
        return this.spawnThread.bind(this);
    }
  },
  spawnThread(arg) {
    const tid = this.nextThreadId;
    this.nextThreadId++;
    const { executable, memory, options } = this;
    const workerData = { executable, memory, options, tid, arg };
    const handler = (worker, msg) => {
      if (msg.type === 'call') {
        const { module, name, args, array } = msg;        
        const fn = this.exportedModules[module]?.[name];
        // add a true argument to indicate that waiting is possible
        const result = fn?.(...args, true);
        const finish = (value) => {
          if (array) {
            array[1] = value|0;
            array[0] = 1;
            Atomics.notify(array, 0, 1);
          }
        };
        if (isPromise(result)) {
          result.then(finish);
        } else {
          finish(result);
        }
      } else if (msg.type === 'exit') {
        const index = this.workers.indexOf(worker);
        if (index !== -1) {
          worker.detach();
          this.workers.splice(index, 1);
        }
      }
    };
    const evtName = 'message';
    {
      // web worker
      const url = getWorkerURL();
      const worker = new Worker(url, { name: 'zig' });
      const listener = evt => handler(worker, evt.data);
      worker.addEventListener(evtName, listener);
      worker.detach = () => worker.removeEventListener(evtName, listener);
      worker.postMessage(workerData);
      this.workers.push(worker);
    }
    return tid;
  },
});

function getWorkerCode() {
  const s = workerMain.toString();
  const si = s.indexOf('{') + 1;
  const ei = s.lastIndexOf('}');
  return s.slice(si, ei);
}

let workerURL;

function getWorkerURL() {
  if (!workerURL) {
    const code = getWorkerCode();
    workerURL = URL.createObjectURL(new Blob([ code ], { type: 'text/javascript' }));
  }
  return workerURL;
}

function workerMain() {
  let postMessage, exit;

  {
    // web worker
    self.onmessage = evt => run(evt.data);
    postMessage = msg => self.postMessage(msg);
    exit = () => self.close();
  }

  function run({ executable, memory, options, tid, arg }) {
    const w = WebAssembly;
    const env = { memory }, wasi = {}, wasiPreview = {};
    const imports = { env, wasi, wasi_snapshot_preview1: wasiPreview };
    for (const { module, name, kind } of w.Module.imports(executable)) {
      if (kind === 'function') {
        const f = createRouter(module, name);
        if (module === 'env') {
          env[name] = f;
        } else if (module === 'wasi_snapshot_preview1') {
          wasiPreview[name] = f;
        } else if (module === 'wasi') {
          wasi[name] = f;
        }
      }
    }
    const { tableInitial } = options;
    env.__indirect_function_table = new w.Table({
      initial: tableInitial,
      element: 'anyfunc',
    });
    const { exports } = new w.Instance(executable, imports);
    const { wasi_thread_start } = exports;
    wasi_thread_start(tid, arg);
    postMessage({ type: 'exit' });
    exit();
  }

  function createRouter(module, name) {
    const array = new Int32Array(new SharedArrayBuffer(8));
    return function(...args) {
      array[0] = 0;
      postMessage({ type: 'call', module, name, args, array });
      Atomics.wait(array, 0, 0);
      return array[1];
    };
  }
}

var structureAcquisition = mixin({
  init() {
    this.comptime = false;
    this.slots = {};
    this.structures = [];
    this.structureCounters = {
      struct: 0,
      union: 0,
      errorSet: 0,
      enum: 0,
      opaque: 0,
    };
    this.littleEndian = true;
    this.runtimeSafety = false;
    this.ioRedirection = true;
    this.libc = false;
  },
  createView(address, len, copy, handle) {
    if (copy) {
      // copy content into JavaScript memory
      const dv = this.allocateJSMemory(len, 0);
      if (len > 0) {
        this.moveExternBytes(dv, address, false);
      }
      return dv;
    } else {
      // link into Zig memory
      const dv = this.obtainZigView(address, len);
      {
        dv[ZIG].handle = address;
      }
      return dv;
    }
  },
  createInstance(structure, dv, slots) {
    const { constructor } = structure;
    const object = constructor.call(ENVIRONMENT, dv);
    if (slots) {
      Object.assign(object[SLOTS], slots);
    }
    return object;
  },
  createTemplate(dv, slots) {
    return { [MEMORY]: dv, [SLOTS]: slots };
  },
  appendList(list, element) {
    list.push(element);
  },
  getSlotValue(slots, slot) {
    if (!slots) slots = this.slots;
    return slots[slot];
  },
  setSlotValue(slots, slot, value) {
    if (!slots) slots = this.slots;
    slots[slot] = value;
  },
  beginStructure(structure) {
    this.defineStructure(structure);
  },
  finishStructure(structure) {
    if (!structure.name) {
      this.inferTypeName(structure);
    }
    this.structures.push(structure);
    this.finalizeStructure(structure);
  },
  acquireStructures() {
    const attrs = this.getModuleAttributes();
    this.littleEndian = !!(attrs & ModuleAttribute.LittleEndian);
    this.runtimeSafety = !!(attrs & ModuleAttribute.RuntimeSafety);
    this.ioRedirection = !!(attrs & ModuleAttribute.IoRedirection);
    this.libc = !!(attrs & ModuleAttribute.LibC);
    const thunkAddress = this.getFactoryThunk();
    const thunk = { [MEMORY]: this.obtainZigView(thunkAddress, 0) };
    this.comptime = true;
    this.mixinUsage = new Map();
    this.invokeThunk(thunk, thunk, thunk);
    this.comptime = false;
    // acquire pointer targets now that we have all constructors
    for (const structure of this.structures) {
      const { constructor, flags, instance: { template } } = structure;
      // update decls that are pointers
      for (const name of constructor[PROPS]) {
        try {
          const decl = constructor[name];
          if (decl?.[VISIT]) {
            this.updatePointerTargets(null, decl);
          }
        } catch {}
      }
      // update default values held in template
      if (flags & StructureFlag.HasPointer && template && template[MEMORY]) {
        // create a placeholder object
        const placeholder = Object.create(constructor.prototype);
        placeholder[MEMORY] = template[MEMORY];
        placeholder[SLOTS] = template[SLOTS];
        this.updatePointerTargets(null, placeholder);
      }
    }
  },
  getRootModule() {
    const root = this.structures[this.structures.length - 1];
    return root.constructor;
  },
  hasMethods() {
    return !!this.structures.find(s => s.type === StructureType.Function);
  },
  exportStructures() {
    this.prepareObjectsForExport();
    const { structures, runtimeSafety, littleEndian, ioRedirection, libc } = this;
    return {
      structures,
      settings: { runtimeSafety, littleEndian, ioRedirection, libc },
    };
  },
  prepareObjectsForExport() {
    const list = [];
    for (const object of findObjects(this.structures, SLOTS)) {
      const zig = object[MEMORY]?.[ZIG];
      if (zig) {
        // replace Zig memory
        const { address, len, handle } = zig;
        const jsDV = object[MEMORY] = this.createView(address, len, true, 0);
        if (handle) {
          jsDV.handle = handle;
        }
        list.push({ address, len, owner: object, replaced: false, handle });
      } else {
        // make const object read-only, for no other reasons than to force the inclusion 
        // of the features/write-protection mixin
        this.makeReadOnly(object);
      }
    }
    // larger memory blocks come first
    list.sort((a, b) => b.len - a.len);
    for (const a of list) {
      if (!a.replaced) {
        for (const b of list) {
          if (a !== b && !b.replaced && !b.handle) {
            if (a.address <= b.address && adjustAddress(b.address, b.len) <= adjustAddress(a.address, a.len)) {
              // B is inside A--replace it with a view of A's buffer
              const dvA = a.owner[MEMORY];
              const pos = Number(b.address - a.address) + dvA.byteOffset;
              b.owner[MEMORY] = this.obtainView(dvA.buffer, pos, b.len);
              b.replaced = true;
            }
          }
        }
      }
    }
    {
      this.use(baseline);
      if (list.length > 0) {
        // mixin "features/object-linkage" is used when there are objects linked to Zig memory
        this.use(objectLinkage);
      }
      if (this.hasMethods()) {
        this.use(moduleLoading);
        this.use(callMarshalingOutbound);
        this.use(pointerSynchronization);
      }
      for (const name of Object.keys(this.exportedModules.wasi)) {
        switch (name) {
          case 'thread-spawn': this.use(workerSupport); break;
        }
      }
      if (this.ioRedirection) {
        for (const name of Object.keys(this.exportedModules.wasi_snapshot_preview1)) {
          switch (name) {
            case 'environ_get': this.use(environGet); break;
            case 'environ_sizes_get': this.use(environSizesGet); break;
            case 'fd_advise': this.use(fdAdvise); break;
            case 'fd_allocate': this.use(fdAllocate); break;
            case 'fd_close': this.use(fdClose); break;
            case 'fd_datasync': this.use(fdDatasync); break;
            case 'fd_fdstat_get': this.use(fdFdstatGet); break;
            case 'fd_fdstat_set_flags': this.use(fdFdstatSetFlags); break;
            case 'fd_fdstat_set_rights': this.use(fdFdstatSetRights); break;
            case 'fd_filestat_get':this.use(fdFilestatGet); break;
            case 'fd_filestat_set_times': this.use(fdFileStatSetTimes); break;
            case 'fd_pread': this.use(fdPread); break;
            case 'fd_prestat_get': this.use(fdPrestatGet); break;
            case 'fd_prestat_dir_name': this.use(fdPrestatDirName); break;
            case 'fd_pwrite': this.use(fdPwrite); break;
            case 'fd_read': this.use(fdRead); break;
            case 'fd_readdir': this.use(fdReaddir); break;
            case 'fd_seek': this.use(fdSeek); break;
            case 'fd_sync': this.use(fdSync); break;
            case 'fd_tell': this.use(fdTell); break;
            case 'fd_write': this.use(fdWrite); break;
            case 'path_create_directory': this.use(pathCreateDirectory); break;
            case 'path_filestat_get': this.use(pathFilestatGet); break;
            case 'path_remove_directory': this.use(pathRemoveDirectory); break;
            case 'path_filestat_set_times': this.use(pathFilestatSetTimes); break;
            case 'path_open': this.use(pathOpen); break;
            case 'path_unlink_file': this.use(pathUnlinkFile); break;
            case 'poll_oneoff': this.use(pollOneoff); break;
            case 'proc_exit': this.use(procExit); break;
            case 'random_get': this.use(randomGet); break;
          }
          const isPathFunc = name.startsWith('path_');
          const isFdFunc = name.startsWith('fd_');
          if (isPathFunc || isFdFunc) {
            if (isPathFunc) {
              this.use(streamLocation);
            }
            if (isFdFunc) {
              this.use(streamRedirection);
            }
            this.use(readerConversion);
            this.use(writerConversion);
            this.use(dirConversion);
          }
        }
      }
      for (const structure of this.structures) {
        if (structure.type === StructureType.ArgStruct) {
          for (const { structure: { purpose } } of structure.instance.members) {
            switch (purpose) {
              case StructurePurpose.Allocator:
                this.use(allocator);
                break;
              case StructurePurpose.Promise:
                this.use(promise);
                break;
              case StructurePurpose.Generator:
                this.use(generator);
                break;
              case StructurePurpose.AbortSignal:
                this.use(abortSignal);
                break;
              case StructurePurpose.Reader:
                this.use(reader);
                this.use(readerConversion);
                break;
              case StructurePurpose.Writer:
                this.use(writer);
                this.use(writerConversion);
                break;
              case StructurePurpose.File:
                this.use(file);
                this.use(streamRedirection);
                this.use(readerConversion);
                this.use(writerConversion);
                break;
              case StructurePurpose.Directory:
                this.use(dir);
                this.use(dirConversion);
                this.use(streamRedirection);
                this.use(streamLocation);
                break;
            }
          }
        } else if (structure.type === StructureType.Function) {
          const { static: { template: jsThunkController } } = structure;
          if (jsThunkController) {
            this.use(callMarshalingInbound);
            this.use(pointerSynchronization);
            if (!this.use(workerSupport)) {
              this.use(thunkAllocation);
            }
          }
        }
      }
    }
  },
  useStructures() {
    const module = this.getRootModule();
    // add Zig memory object to list so they can be unlinked
    const objects = findObjects(this.structures, SLOTS);
    for (const object of objects) {
      if (object[MEMORY]?.[ZIG]) {
        this.variables.push({ object });
      }
    }
    // clear comptime-only variables
    this.slots = {};
    this.structures = [];
    module.__zigar = this.getSpecialExports();
    return module;
  },
  inferTypeName(s) {
    const handlerName = `get${structureNames[s.type]}Name`;
    const handler = this[handlerName];
    s.name = handler.call(this, s);
  },
  getPrimitiveName(s) {
    const { instance: { members: [member] }, flags = 0 } = s;
    switch (member.type) {
      case MemberType.Bool:
        return `bool`;
      case MemberType.Int:
        return (flags & PrimitiveFlag.IsSize) ? `isize` : `i${member.bitSize}`;
      case MemberType.Uint:
        return (flags & PrimitiveFlag.IsSize) ? `usize` : `u${member.bitSize}`;
      case MemberType.Float:
        return `f${member.bitSize}`;
      case MemberType.Void:
        return 'void';
      case MemberType.Literal:
        return 'enum_literal';
      case MemberType.Null:
        return 'null';
      case MemberType.Undefined:
        return 'undefined';
      case MemberType.Type:
        return 'type';
      case MemberType.Object:
        return 'comptime';
      default:
        return 'unknown';
    }
  },
  getArrayName(s) {
    const { instance: { members: [element] }, length } = s;
    return `[${length}]${element.structure.name}`;
  },
  getStructName(s) {
    for (const name of ['Allocator', 'Promise', 'Generator', 'Read', 'Writer']) {
      if (s.flags & StructFlag[`Is${name}`]) return name;
    }
    return `S${this.structureCounters.struct++}`;
  },
  getUnionName(s) {
    return `U${this.structureCounters.union++}`;
  },
  getErrorUnionName(s) {
    const { instance: { members: [payload, errorSet] } } = s;
    return `${errorSet.structure.name}!${payload.structure.name}`;
  },
  getErrorSetName(s) {
    return (s.flags & ErrorSetFlag.IsGlobal) ? 'anyerror' : `ES${this.structureCounters.errorSet++}`;
  },
  getEnumName(s) {
    return `EN${this.structureCounters.enum++}`;
  },
  getOptionalName(s) {
    const { instance: { members: [payload] } } = s;
    return `?${payload.structure.name}`;
  },
  getPointerName(s) {
    const { instance: { members: [target] }, flags } = s;
    let prefix = '*';
    let targetName = target.structure.name;
    if (target.structure.type === StructureType.Slice) {
      targetName = targetName.slice(3);
    }
    if (flags & PointerFlag.IsMultiple) {
      if (flags & PointerFlag.HasLength) {
        prefix = '[]';
      } else if (flags & PointerFlag.IsSingle) {
        prefix = '[*c]';
      } else {
        prefix = '[*]';
      }
    }
    if (!(flags & PointerFlag.IsSingle)) {
      // constructor can be null when a structure is recursive
      const sentinel = target.structure.constructor?.[SENTINEL];
      if (sentinel) {
        prefix = prefix.slice(0, -1) + `:${sentinel.value}` + prefix.slice(-1);
      }
    }
    if (flags & PointerFlag.IsConst) {
      prefix = `${prefix}const `;
    }
    return prefix + targetName;
  },
  getSliceName(s) {
    const { instance: { members: [element] }, flags } = s;
    return (flags & SliceFlag.IsOpaque) ? 'anyopaque' : `[_]${element.structure.name}`;
  },
  getVectorName(s) {
    const { instance: { members: [element] }, length } = s;
    return `@Vector(${length}, ${element.structure.name})`;
  },
  getOpaqueName(s) {
    return `O${this.structureCounters.opaque++}`;
  },
  getArgStructName(s) {
    const { instance: { members } } = s;
    const retval = members[0];
    const args = members.slice(1);
    const rvName = retval.structure.name;
    const argNames = args.map(a => a.structure.name);
    return `Arg(fn (${argNames.join(', ')}) ${rvName})`;
  },
  getVariadicStructName(s) {
    const { instance: { members } } = s;
    const retval = members[0];
    const args = members.slice(1);
    const rvName = retval.structure.name;
    const argNames = args.map(a => a.structure.name);
    return `Arg(fn (${argNames.join(', ')}, ...) ${rvName})`;
  },
  getFunctionName(s) {
    const { instance: { members: [args] } } = s;
    const argName = args.structure.name;
    return (argName) ? argName.slice(4, -1) : 'fn ()';
  },
  ...({
    exports: {
      createBool: { argType: 'b', returnType: 'v' },
      createInteger: { argType: 'ib', returnType: 'v' },
      createBigInteger: { argType: 'ib', returnType: 'v' },
      createString: { argType: 'ii', returnType: 'v' },
      createView: { argType: 'iib', returnType: 'v' },
      createInstance: { argType: 'vvv', returnType: 'v' },
      createTemplate: { argType: 'vv', returnType: 'v' },
      createList: { argType: '', returnType: 'v' },
      createObject: { argType: '', returnType: 'v' },
      getProperty: { argType: 'vii', returnType: 'v' },
      setProperty: { argType: 'viiv' },
      getSlotValue: { argType: 'vi', returnType: 'v' },
      setSlotValue: { argType: 'viv' },
      appendList: { argType: 'vv' },
      beginStructure: { argType: 'v' },
      finishStructure: { argType: 'v' },
    },
    imports: {
      getFactoryThunk: { argType: '', returnType: 'i' },
      getModuleAttributes: { argType: '', returnType: 'i' },
    },
    createBool(initializer) {
      return initializer;
    },
    createInteger(initializer, unsigned) {
      if (unsigned && initializer < 0) {
        return 0x1_0000_0000 + initializer;
      }
      return initializer
    },
    createBigInteger(initializer, unsigned) {
      if (unsigned && initializer < 0) {
        return 0x1_0000_0000_0000_0000n + initializer;
      }
      return initializer
    },
    createString(address, len) {
      const { buffer } = this.memory;
      const ta = new Uint8Array(buffer, address, len);
      return decodeText(ta);
    },
    createList() {
      return [];
    },
    createObject() {
      return {};
    },
    getProperty(object, address, len) {
      const key = this.createString(address, len);
      return object[key];
    },
    setProperty(object, address, len, value) {
      const key = this.createString(address, len);
      object[key] = value;
    },
  } ),
});

var viewManagement = mixin({
  init() {
    this.viewMap = new WeakMap();
  },
  extractView(structure, arg, onError = throwError) {
    const { type, byteSize, constructor } = structure;
    let dv;
    // not using instanceof just in case we're getting objects created in other contexts
    const tag = arg?.[Symbol.toStringTag];
    if (tag) {
      if (tag === 'DataView') {
        // capture relationship between the view and its buffer
        dv = this.registerView(arg);
      } else if (tag === 'ArrayBuffer') {
        dv = this.obtainView(arg, 0, arg.byteLength);
      } else if ((tag && tag === constructor[TYPED_ARRAY]?.name) || (tag === 'Uint8ClampedArray' && constructor[TYPED_ARRAY] === Uint8Array)) {
        dv = this.obtainView(arg.buffer, arg.byteOffset, arg.byteLength);
      } else ;
    }
    if (!dv) {
      const memory = arg?.[MEMORY];
      if (memory) {
        // arg a Zig data object
        const { constructor, instance: { members: [ member ] } } = structure;
        if (isCompatibleInstanceOf(arg, constructor)) {
          // same type, no problem
          return memory;
        } else {
          if (isArrayLike(type)) {
            // make sure the arg has the same type of elements
            const { byteSize: elementSize, structure: { constructor: Child } } = member;
            const number = findElements(arg, Child);
            if (number !== undefined) {
              if (type === StructureType.Slice || number * elementSize === byteSize) {
                return memory;
              } else {
                throw new ArrayLengthMismatch(structure, null, arg);
              }
            }
          }
        }
      }
    }
    if (dv) {
      if (byteSize !== undefined) {
        checkDataViewSize(dv, structure);
      }
    } else {
      onError?.(structure, arg);
    }
    return dv;
  },
  assignView(target, dv, structure, copy, allocator) {
    const { byteSize, type } = structure;
    const elementSize = byteSize ?? 1;
    const source = { [MEMORY]: dv, [RESTORE]() { return this[MEMORY] } }
    ;
    if (!target[MEMORY]) {
      if (byteSize !== undefined) {
        checkDataViewSize(dv, structure);
      }
      const len = dv.byteLength / elementSize;
      target.constructor[SENTINEL]?.validateData?.(source, len);
      if (allocator) {
        // need to copy when target object is in Zig memory
        copy = true;
      }
      target[SHAPE](copy ? null : dv, len, allocator);
      if (copy) {
        copyObject(target, source);
      }
    } else {
      const byteLength = (type === StructureType.Slice) ? elementSize * target.length : elementSize;
      if (dv.byteLength !== byteLength) {
        throw new BufferSizeMismatch(structure, dv, target);
      }
      target.constructor[SENTINEL]?.validateData?.(source, target.length);
      copyObject(target, source);
    }
  },
  findViewAt(buffer, offset, len) {
    let entry = this.viewMap.get(buffer);
    let existing;
    if (entry) {
      if (entry instanceof DataView) {
        // only one view created thus far--see if that's the matching one
        if (entry.byteOffset === offset && entry.byteLength === len) {
          existing = entry;
          entry = null;
        } else {
          // no, need to replace the entry with a hash keyed by `offset:len`
          const prev = entry;
          const prevKey = `${prev.byteOffset}:${prev.byteLength}`;
          entry = new Map([ [ prevKey, prev ] ]);
          this.viewMap.set(buffer, entry);
        }
      } else {
        existing = entry.get(`${offset}:${len}`);
      }
    }
    {
      if (existing?.[ZIG]?.address === usizeInvalid) {
        // view was of previously freed memory
        existing = null;
      }
    }
    return { existing, entry };
  },
  obtainView(buffer, offset, len, cache = true) {
    let dv;
    if (cache) {
      const { existing, entry } = this.findViewAt(buffer, offset, len);
      if (existing) {
        return existing;
      }
      dv = new DataView(buffer, offset, len);
      if (entry) {
        entry.set(`${offset}:${len}`, dv);
      } else {
        // just one view of this buffer for now
        this.viewMap.set(buffer, dv);
      }
    } else {
      dv = new DataView(buffer, offset, len);
      dv[NO_CACHE] = true;
    }
    {
      if (buffer === this.memory?.buffer || buffer === this.usizeMaxBuffer) {
        dv[ZIG] = { address: offset, len };
      }
      return dv;
    }
  },
  registerView(dv) {
    if (!dv[ZIG]) {
      const { buffer, byteOffset, byteLength } = dv;
      const { existing, entry } = this.findViewAt(buffer, byteOffset, byteLength);
      if (existing) {
        // return existing view instead of this one
        return existing;
      } else if (entry) {
        entry.set(`${byteOffset}:${byteLength}`, dv);
      } else {
        this.viewMap.set(buffer, dv);
      }
    }
    return dv;
  },
  allocateMemory(len, align = 0, allocator = null) {
    return allocator?.alloc?.(len, align) ?? this.allocateJSMemory(len, align);
  },
  ...({
    allocateJSMemory(len, align) {
      // alignment doesn't matter since memory always needs to be shadowed
      return this.obtainView(new ArrayBuffer(len), 0, len);
    },
    restoreView(dv) {
      const zig = dv?.[ZIG];
      if (zig && isDetached(dv.buffer)) {
        dv = this.obtainZigView(zig.address, zig.len);
        if (zig.align) {
          dv[ZIG].align = zig.align;
        }
      }
      return dv;
    },
    defineRestorer() {
      const thisEnv = this;
      return {
        value() {
          const dv = this[MEMORY];
          const newDV = thisEnv.restoreView(dv);
          if (dv !== newDV) {
            this[MEMORY] = newDV;
            this.constructor[CACHE]?.save?.(newDV, this);
          }
          return newDV;
        },
      }
    },
    moveExternBytes(jsDV, address, to) {
      const { memory } = this;
      const len = jsDV.byteLength;
      if (len === 0) return;
      const zigDV = new DataView(memory.buffer, address, len);
      if (!(jsDV instanceof DataView)) {
        // assume it's a typed array
        jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
      }
      copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
    },
  } ),
});

function checkDataViewSize(dv, structure) {
  const { byteSize, type } = structure;
  const isSizeMatching = type === StructureType.Slice
  ? dv.byteLength % byteSize === 0
  : dv.byteLength === byteSize;
  if (!isSizeMatching) {
    throw new BufferSizeMismatch(structure, dv);
  }
}

function isArrayLike(type) {
  return type === StructureType.Array || type === StructureType.Vector || type === StructureType.Slice;
}

function throwError(structure) {
  throw new BufferExpected(structure);
}

const proxyMaps = [ 
  0, 
  ProxyType.Const, 
  ProxyType.ReadOnly, 
  ProxyType.Const | ProxyType.ReadOnly 
].reduce((hash, type) => {
  hash[type] = new WeakMap();
  return hash;
}, {});
const proxyTargetMap = new WeakMap();

function getProxy(target, type) {
  const key = target;
  const map = proxyMaps[type & (ProxyType.Const | ProxyType.ReadOnly)];
  let proxy = map.get(key);
  if (!proxy) {
    proxy = new Proxy(target, handlersHash[type]);
    map.set(key, proxy);
    proxyTargetMap.set(proxy, { target, type });
  }
  return proxy;
}

function getProxyType(structure, readOnly = false) {
  const { type, flags } = structure;
  // functions don't mean to be made read-only
  let proxyType = (readOnly && type !== StructureType.Function) ? ProxyType.ReadOnly : 0;
  if (flags & StructureFlag.HasProxy) {
    if (type === StructureType.Pointer) {
      proxyType |= ProxyType.Pointer;
      if (flags & PointerFlag.IsConst) {
        proxyType |= ProxyType.Const;
      }
    } else {
      proxyType |= ProxyType.Slice;
    }
  }
  return proxyType;
}

function getProxyTarget(arg) {
  if ((typeof(arg) === 'object' || typeof(arg) === 'function') && arg) {
    return proxyTargetMap.get(arg);
  }
}

function removeProxy(arg) {
  const proxy = getProxyTarget(arg);
  return (proxy) ? [ proxy.target, proxy.type ] : [ arg, 0 ];
}

function getReadOnlyProxy(object) {
  const proxy = getProxyTarget(object);
  let proxyType;
  if (proxy) {
    if (proxy.type & ProxyType.ReadOnly) {
      // it's already a read-only proxy
      return object;
    } else {
      proxyType = proxy.type | ProxyType.ReadOnly;
      object = proxy.target;
    }
  } else {
    // the check below will filter out functions, which doesn't need the protection
    if (!object || typeof(object) !== 'object' || object[READ_ONLY]) {
      return object;
    }
    proxyType = object.constructor[PROXY_TYPE] ?? ProxyType.ReadOnly;
  }
  return getProxy(object, proxyType);
}

const pointerHandlers = {
  get(pointer, name) {
    if (name in pointer) {
      return pointer[name];
    } else {
      const target = pointer[TARGET];
      return target[name];
    }
  },
  set(pointer, name, value) {
    if (name in pointer) {
      pointer[name] = value;
    } else {
      const target = pointer[TARGET];
      target[name] = value;
    }
    return true;
  },
  deleteProperty(pointer, name) {
    if (name in pointer) {
      delete pointer[name];
    } else {
      const target = pointer[TARGET];
      delete target[name];
    }
    return true;
  },
  has(pointer, name) {
    if (name in pointer) {
      return true;
    } else {
      const target = pointer[TARGET];
      return name in target;
    }
  },
  apply(pointer, thisArg, args) {
    const f = pointer['*'];
    return f.apply(thisArg, args);
  },
};

const readOnlyPointerHandlers = {
  ...pointerHandlers,
  set(pointer, name, value) {
    if (name in pointer) {
      throwReadOnly();
    } else {
      const target = pointer[TARGET];
      target[name] = value;
    }
    return true;
  },
};

const readOnlyHandlers = {
  get(target, name) {
    const value = target[name];
    return (typeof(name) === 'string') ? getReadOnlyProxy(value) : value;
  },
  set(target, name, value) {
    throwReadOnly();
  }
};

const constPointerHandlers = {
  ...pointerHandlers,
  get(pointer, name) {
    if (name in pointer) {
      return readOnlyHandlers.get(pointer, name);
    } else {
      return readOnlyHandlers.get(pointer[TARGET], name);
    }
  },
  set(pointer, name, value) {
    if (name in pointer) {
      pointer[name] = value;
    } else {
      throwReadOnly();
    }
    return true;
  },
};

const readOnlyConstPointerHandlers = {
  ...readOnlyPointerHandlers,
  set: readOnlyHandlers.set,
};

const sliceHandlers = {
  get(slice, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return slice.get(index);
    } else {
      return slice[name];
    }
  },
  set(slice, name, value) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      slice.set(index, value);
    } else {
      slice[name] = value;
    }
    return true;
  },
  deleteProperty(slice, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return false;
    } else {
      delete slice[name];
      return true;
    }
  },
  has(slice, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return (index >= 0 && index < slice.length);
    } else {
      return slice[name];
    }
  },
  ownKeys(slice) {
    const keys = [];
    for (let i = 0, len = slice.length; i < len; i++) {
      keys.push(`${i}`);
    }
    keys.push('length');
    return keys;
  },
  getOwnPropertyDescriptor(slice, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      if (index >= 0 && index < slice.length) {
        return { value: slice.get(index), enumerable: true, writable: true, configurable: true };
      }
    } else {
      return Object.getOwnPropertyDescriptor(slice, name);
    }
  },
};

const readOnlySliceHandlers = {
  ...sliceHandlers,
  get (slice, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return getReadOnlyProxy(slice.get(index));
    } else if (name === 'set') {
      return throwReadOnly;
    } else {
      return slice[name];
    }
  },
  set: throwReadOnly,
};

const handlersHash = {
  [ProxyType.Pointer]: pointerHandlers,
  [ProxyType.Pointer | ProxyType.Const]: constPointerHandlers,
  [ProxyType.Pointer | ProxyType.ReadOnly]: readOnlyPointerHandlers,
  [ProxyType.Pointer | ProxyType.ReadOnly | ProxyType.Const ]: readOnlyConstPointerHandlers,
  [ProxyType.Slice]: sliceHandlers,
  [ProxyType.Slice | ProxyType.ReadOnly]: readOnlySliceHandlers,
  [ProxyType.ReadOnly]: readOnlyHandlers,
};

var writeProtection = mixin({
  makeReadOnly(object) {
    protect(object);
  }
});

function protect(object) {
  const [ objectNoProxy ] = removeProxy(object);
  if (objectNoProxy?.[MEMORY] && !objectNoProxy[READ_ONLY]) {
    objectNoProxy[READ_ONLY] = true;
    const type = objectNoProxy.constructor[TYPE];
    if (type === StructureType.Pointer) {
      // protect all properties except length
      protectProperties(objectNoProxy, [ 'length' ]);
    } else if (type === StructureType.Array || type === StructureType.Slice) {
      protectProperties(objectNoProxy);
      protectElements(objectNoProxy);
    } else {
      protectProperties(objectNoProxy);
    }
  }
  return object;
}

function protectProperties(object, exclude = []) {
  const descriptors = Object.getOwnPropertyDescriptors(object.constructor.prototype);
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    if (!exclude.includes(name)) {
      const { get, set } = descriptor;
      descriptor.get = (get) ? function() {
        return protect(get.call(this));
      } : undefined;
      descriptor.set = (set) ? throwReadOnly : undefined;
      defineProperty(object, name, descriptor);
    }
  }
}

function protectElements(array) {
  const { get } = array;
  defineProperties(array, {
    get: defineValue(function(index) { 
      return protect(get.call(this, index));
    }),
    set: defineValue(throwReadOnly),
  });
}

var forArray = mixin({
  defineArrayEntries() {
    return defineValue(getArrayEntries);
  },
  defineArrayIterator() {
    return defineValue(getArrayIterator);
  }
});

function getArray(arg) {
  const proxy = getProxyTarget(arg);
  if (proxy) {
    const { target } = proxy;
    return (proxy.type & ProxyType.Pointer) ? target['*'] : target;
  }
  return arg;
}

function getArrayIterator() {
  const array = getArray(this);
  const length = array.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = array.get(current);
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function getArrayEntriesIterator(options) {
  const handleError = getErrorHandler(options);
  const array = getArray(this);
  const length = array.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = [ current, handleError(() => array.get(current)) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function getArrayEntries(options) {
  return {
    [Symbol.iterator]: getArrayEntriesIterator.bind(this, options),
    length: this.length,
  };
}

var forStruct = mixin({
  defineStructEntries() {
    return defineValue(getStructEntries);
  },
  defineStructIterator() {
    return defineValue(getStructIterator);
  }
});

function getStructEntries(options) {
  return {
    [Symbol.iterator]: getStructEntriesIterator.bind(this, options),
    length: this[PROPS].length,
  };
}

function getStructIterator(options) {
  const entries = getStructEntries.call(this, options);
  return entries[Symbol.iterator]();
}

function getStructEntriesIterator(options) {
  const handleError = getErrorHandler(options);
  const self = this;
  const props = this[PROPS];
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < props.length) {
        const current = props[index++];
        value = [ current, handleError(() => self[current]) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

var forUnion = mixin({
  defineUnionEntries() {
    return defineValue(getUnionEntries);
  },
  defineUnionIterator() {
    return defineValue(getUnionIterator);
  }
});

function getUnionEntries(options) {
  return {
    [Symbol.iterator]: getUnionEntriesIterator.bind(this, options),
    length: this[PROPS].length,
  };
}

function getUnionIterator(options) {
  const entries = getUnionEntries.call(this, options);
  return entries[Symbol.iterator]();
}

function getUnionEntriesIterator(options) {
  const handleError = getErrorHandler(options);
  const self = this;
  const props = this[PROPS];
  const getters = this[GETTERS];
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < props.length) {
        const current = props[index++];
        // get value of prop with no check
        value = [ current, handleError(() => getters[current].call(self)) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

var forVector = mixin({
  defineVectorEntries() {
    return defineValue(getVectorEntries);
  },
  defineVectorIterator() {
    return defineValue(getVectorIterator);
  },
});

function getVectorIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = self[current];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function getVectorEntriesIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = [ current, self[current] ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function getVectorEntries() {
  return {
    [Symbol.iterator]: getVectorEntriesIterator.bind(this),
    length: this.length,
  };
}

var forZig = mixin({
  defineZigIterator() {
    return defineValue(getZigIterator);
  },
});

function getZigIterator(arg = {}) {
  const self = this;
  const args = (self.next.length === 1) ? [arg] : [];
  return {
    next() {
      const value = self.next(...args);
      const done = value === null;
      return { value, done };
    },
  };
}

var all$2 = mixin({
  defineMember(member, applyTransform = true) {
    if (!member) {
      return {};
    }
    const { type, structure } = member;
    const handleName = `defineMember${memberNames[type]}`;
    const f = this[handleName];
    const descriptor = f.call(this, member);
    if (applyTransform) {
      if (structure) {
        // we use int/uint getters to access underlying values of enums and error sets;
        // the transform functions put wrapper functions around the accessors that
        // perform item lookup
        const { type } = structure;
        const handleName = `transformDescriptor${structureNames[type]}`;
        const f = this[handleName];
        if (f) {
          return f.call(this, descriptor, member);
        }
      }
    }
    return descriptor;
  },
});

function bindSlot(slot, { get, set }) {
  if (slot !== undefined) {
    return {
      get: function() {
        return get.call(this, slot);
      },
      set: (set)
      ? function(arg, allocator) {
          return set.call(this, slot, arg, allocator);
        }
      : undefined,
    };
  } else {
    // array accessors
    return { get, set };
  }
}

var base64 = mixin({
  defineBase64(structure) {
    const thisEnv = this;
    return markAsSpecial({
      get() {
        return encodeBase64(this.dataView);
      },
      set(str, allocator) {
        if (typeof(str) !== 'string') {
          throw new TypeMismatch('string', str);
        }
        const dv = decodeBase64(str);
        thisEnv.assignView(this, dv, structure, false, allocator);
      }
    });
  },
});

var bool = mixin({
  defineMemberBool(member) {
    return this.defineMemberUsing(member, this.getAccessor);
  },
});

var clampedArray = mixin({
  defineClampedArray(structure) {
    const thisEnv = this;
    const ClampedArray = Uint8ClampedArray;
    return markAsSpecial({
      get() {
        const ta = this.typedArray;
        return new ClampedArray(ta.buffer, ta.byteOffset, ta.length);
      },
      set(ta, allocator) {
        if (ta?.[Symbol.toStringTag] !== ClampedArray.name) {
          throw new TypeMismatch(ClampedArray.name, ta);
        }
        const dv = new DataView(ta.buffer, ta.byteOffset, ta.byteLength);
        thisEnv.assignView(this, dv, structure, true, allocator);
      },
    });
  },
});

var dataView = mixin({
  defineDataView(structure) {
    const thisEnv = this;
    return markAsSpecial({
      get() {
        const dv = this[RESTORE]() ;
        return dv;
      },
      set(dv, allocator) {
        if (dv?.[Symbol.toStringTag] !== 'DataView') {
          throw new TypeMismatch('DataView', dv);
        }
        thisEnv.assignView(this, dv, structure, true, allocator);
      },
    });
  },
});

var float = mixin({
  defineMemberFloat(member) {
    return this.defineMemberUsing(member, this.getAccessor);
  },
});

var int = mixin({
  defineMemberInt(member) {
    let getAccessor = this.getAccessor;
    if (this.runtimeSafety) {
      getAccessor = this.addRuntimeCheck(getAccessor);
    }
    getAccessor = this.addIntConversion(getAccessor);
    return this.defineMemberUsing(member, getAccessor);
  },
});

var literal = mixin({
  defineMemberLiteral(member) {
    const { slot } = member;
    return bindSlot(slot, {
      get(slot) {
        const object = this[SLOTS][slot];
        return object.string;
      },
      set: throwReadOnly,
    });
  },
});

var _null = mixin({
  defineMemberNull(member) {
    return {
      get: function() {
        return null;
      },
      set: throwReadOnly,
    };
  },
});

var object = mixin({
  defineMemberObject(member) {
    const { flags, structure, slot } = member;
    let get, set;
    if (flags & MemberFlag.IsString) {
      get = getString;
    } else if (flags & MemberFlag.IsTypedArray) {
      get = getTypedArray;
    } else if (flags & MemberFlag.IsClampedArray) {
      get = getClampedArray;
    } else if (flags & MemberFlag.IsPlain) {
      get = getPlain;
    } else if (structure.flags & (StructureFlag.HasValue | StructureFlag.HasProxy)) {
      get = getValue;
    } else {
      get = getObject;
    }
    if (flags & MemberFlag.IsReadOnly) {
      set = throwReadOnly;
    } else {
      set = setValue;
    }
    return bindSlot(slot, { get, set });
  }
});

function getValue(slot) {
  return getObject.call(this, slot).$;
}

function getString(slot) {
  return getValue.call(this, slot)?.string ?? null;
}

function getTypedArray(slot) {
  return getValue.call(this, slot)?.typedArray ?? null;
}

function getClampedArray(slot) {
  return getValue.call(this, slot)?.clampedArray ?? null;
}

function getPlain(slot) {
  return getValue.call(this, slot)?.valueOf?.() ?? null;
}

function getObject(slot) {
  return this[SLOTS][slot] ?? this[VIVIFICATE](slot);
}

function setValue(slot, value, allocator) {
  const object = getObject.call(this, slot);
  object[INITIALIZE](value, allocator);
}

var primitive$1 = mixin({
  ...({
    defineMemberUsing(member, getAccessor) {
      const { littleEndian } = this;
      const { bitOffset, byteSize } = member;
      const getter = getAccessor.call(this, 'get', member);
      const setter = getAccessor.call(this, 'set', member);
      if (bitOffset !== undefined) {
        const offset = bitOffset >> 3;
        return {
          get: function getValue() {
            const dv = this[RESTORE]() ;
            return getter.call(dv, offset, littleEndian);
          },
          set: function setValue(value) {
            const dv = this[RESTORE]() ;
            return setter.call(dv, offset, value, littleEndian);
          }
        }
      } else {
        return {
          get: function getElement(index) {
            const dv = this[RESTORE]() ;
            return getter.call(dv, index * byteSize, littleEndian);
          },
          set: function setElement(index, value) {
            const dv = this[RESTORE]() ;
            return setter.call(dv, index * byteSize, value, littleEndian);
          },
        }
      }
    },
  } ),
});

var retval = mixin({
  ...({
    defineRetvalCopier({ byteSize, bitOffset }) {
      if (byteSize > 0) {
        const thisEnv = this;
        const offset = bitOffset >> 3;
        return {
          value(shadowDV) {
            const dv = this[MEMORY];
            const { address } = shadowDV[ZIG];
            const src = new DataView(thisEnv.memory.buffer, address + offset, byteSize);
            const dest = new DataView(dv.buffer, dv.byteOffset + offset, byteSize);
            copyView(dest, src);
          }
        };
      }
    },
  } ),
});

var sentinel = mixin({
  defineSentinel(structure) {
    const {
      byteSize,
      instance: { members: [ member, sentinel ], template },
    } = structure;
    const { get: getSentinelValue } = this.defineMember(sentinel);
    const { get } = this.defineMember(member);
    const value = getSentinelValue.call({ 
      [MEMORY]: template[MEMORY],
      [RESTORE]() { return this[MEMORY] },
    }, 0)
    ;
    const isRequired = !!(sentinel.flags & MemberFlag.IsRequired);
    const { runtimeSafety } = this;
    return defineValue({
      value,
      bytes: template[MEMORY],
      validateValue(v, i, l) {
        if (isRequired) {
          if (runtimeSafety && v === value && i !== l - 1) {
            throw new MisplacedSentinel(structure, v, i, l);
          }
          if (v !== value && i === l - 1) {
            throw new MissingSentinel(structure, value, l);
          }
        }
      },
      validateData(source, len) {
        if (isRequired) {
          if (runtimeSafety) {
            for (let i = 0; i < len; i++) {
              const v = get.call(source, i);
              if (v === value && i !== len - 1) {
                throw new MisplacedSentinel(structure, value, i, len);
              } else if (v !== value && i === len - 1) {
                throw new MissingSentinel(structure, value, len);
              }
            }
          } else {
            // if the length doesn't match, let the operation fail elsewhere
            if (len > 0 && len * byteSize === source[MEMORY].byteLength) {
              const v = get.call(source, len - 1);
              if (v !== value) {
                throw new MissingSentinel(structure, value, len);
              }
            }
          }
        }
      },
      isRequired,
    });
  },
  ...({
    findSentinel(address, bytes) {
      const { memory } = this;
      const len = bytes.byteLength;
      const end = memory.buffer.byteLength - len + 1;
      for (let i = address; i < end; i += len) {
        const dv = new DataView(memory.buffer, i, len);
        let match = true;
        for (let j = 0; j < len; j++) {
          const a = dv.getUint8(j);
          const b = bytes.getUint8(j);
          if (a !== b) {
            match = false;
            break;
          }
        }
        if (match) {
          return (i - address) / len;
        }
      }
    },
  } ),
});

var string = mixin({
  defineString(structure) {
    const thisEnv = this;
    const { byteSize } = structure.instance.members[0];
    const encoding = `utf-${byteSize * 8}`;
    return markAsSpecial({
      get() {
        let str = decodeText(this.typedArray, encoding);
        const sentinelValue = this.constructor[SENTINEL]?.value;
        if (sentinelValue !== undefined && str.charCodeAt(str.length - 1) === sentinelValue) {
          str = str.slice(0, -1);
        }
        return str;
      },
      set(str, allocator) {
        if (typeof(str) !== 'string') {
          throw new TypeMismatch('string', str);
        }
        const sentinelValue = this.constructor[SENTINEL]?.value;
        if (sentinelValue !== undefined && str.charCodeAt(str.length - 1) !== sentinelValue) {
          str += String.fromCharCode(sentinelValue);
        }
        const ta = encodeText(str, encoding);
        const dv = new DataView(ta.buffer);
        thisEnv.assignView(this, dv, structure, false, allocator);
      },
    });
  },
});

var valueOf = mixin({
  defineValueOf() {
    return {
      value() {
        return normalizeObject(this, false);
      },
    };
  },
});

const INT_MAX = BigInt(Number.MAX_SAFE_INTEGER);
const INT_MIN = BigInt(Number.MIN_SAFE_INTEGER);

function normalizeObject(object, forJSON) {
  const options = { error: (forJSON) ? 'return' : 'throw' };
  const handleError = getErrorHandler(options);
  const resultMap = new Map();
  const process = function(value) {
    // handle type (i.e. constructor) like a struct
    const type = (typeof(value) === 'function') ? StructureType.Struct : value?.constructor?.[TYPE];
    if (type === undefined) {
      if (forJSON) {
        if (typeof(value) === 'bigint' && INT_MIN <= value && value <= INT_MAX) {
          return Number(value);
        } else if (value instanceof Error) {
          return { error: value.message };
        }
      }
      return value;
    }
    let result = resultMap.get(value);
    if (result === undefined) {
      let entries;
      switch (type) {
        case StructureType.Struct:
          entries = value[ENTRIES](options);
          result = (value.constructor[FLAGS] & StructFlag.IsTuple) ? [] : {};
          break;
        case StructureType.Union:
          entries = value[ENTRIES](options);
          result = {};
          break;
        case StructureType.Array:
        case StructureType.Vector:
        case StructureType.Slice:
          entries = value[ENTRIES]();
          result = [];
          break;
        case StructureType.Pointer:
          try {
            result = value['*'];
          } catch (err) {
            result = Symbol.for('inaccessible');
          }
          break;
        case StructureType.Enum:
          result = handleError(() => String(value));
          break;
        case StructureType.Opaque:
          result = {};
          break;
        default:
          result = handleError(() => value.$);
      }
      result = process(result);
      resultMap.set(value, result);
      if (entries) {
        for (const [ key, child ] of entries) {
          result[key] = process(child);
        }
      }
    }
    return result;
  };
  return process(object);
}

var toJson = mixin({
  defineToJSON() {
    return {
      value() {
        return normalizeObject(this, true);
      },
    };
  },
});

var type = mixin({
  defineMemberType(member, env) {
    const { slot } = member;
    return bindSlot(slot, {
      get(slot) {
        // unsupported types will have undefined structure
        const structure = this[SLOTS][slot];
        return structure?.constructor;
      },
      set: throwReadOnly,
    });
  }
});

var typedArray = mixin({
  defineTypedArray(structure) {
    const thisEnv = this;
    const TypedArray = this.getTypedArray(structure); // (from mixin "structures/all")
    return markAsSpecial({
      get() {
        const dv = this.dataView;
        const length = dv.byteLength / TypedArray.BYTES_PER_ELEMENT;
        return new TypedArray(dv.buffer, dv.byteOffset, length);
      },
      set(ta, allocator) {
        if (ta?.[Symbol.toStringTag] !== TypedArray.name) {
          throw new TypeMismatch(TypedArray.name, ta);
        }
        const dv = new DataView(ta.buffer, ta.byteOffset, ta.byteLength);
        thisEnv.assignView(this, dv, structure, true, allocator);
      },
    });
  },
});

var uint = mixin({
  defineMemberUint(member) {
    let getAccessor = this.getAccessor;
    if (this.runtimeSafety) {
      getAccessor = this.addRuntimeCheck(getAccessor);
    }
    getAccessor = this.addIntConversion(getAccessor);
    return this.defineMemberUsing(member, getAccessor);
  },
});

var _undefined = mixin({
  defineMemberUndefined(member) {
    return {
      get: function() {
        return undefined;
      },
      set: throwReadOnly,
    };
  },
});

var unsupported = mixin({
  defineMemberUnsupported(member) {
    const throwUnsupported = function() {
      throw new Unsupported();
    };
    return { get: throwUnsupported, set: throwUnsupported };
  },
});

var _void = mixin({
  defineMemberVoid(member, env) {
    const { bitOffset } = member;
    return {
      get() {
        return undefined;
      },
      set: (bitOffset !== undefined)
      ? function(value) {
        if (value !== undefined) {
          throw new NotUndefined(member);
        }
      }
      : function(index, value) {
        if (value !== undefined) {
          throw new NotUndefined(member);
        }
        if (index < 0 || index >= this.length) {
          throw new OutOfBound(member, index);
        }
      },
    };
  }
});

var all$1 = mixin({
  defineStructure(structure) {
    const {
      type,
      byteSize,
    } = structure;
    const handlerName = `define${structureNames[type]}`;
    const f = this[handlerName];
    // default discriptors
    const keys = [];
    const setters = {};
    const descriptors = {
      dataView: this.defineDataView(structure),
      base64: this.defineBase64(structure),
      toJSON: this.defineToJSON(),
      valueOf: this.defineValueOf(),
      [SETTERS]: defineValue(setters),
      [KEYS]: defineValue(keys),
      ...({
        // add method for recoverng from array detachment
        [RESTORE]: this.defineRestorer(),
      } ),
    };
    const constructor = structure.constructor = f.call(this, structure, descriptors);
    for (const [ name, descriptor ] of Object.entries(descriptors)) {
      const s = descriptor?.set;
      if (s && !setters[name] && name !== '$') {
        setters[name] = s;
        keys.push(name);
      }
    }
    defineProperties(constructor.prototype, descriptors);
    return constructor;
  },
  finalizeStructure(structure) {
    const {
      name,
      type,
      constructor,
      align,
      byteSize,
      flags,
      signature,
      static: { members, template },
    } = structure;
    const props = [];
    const staticDescriptors = {
      name: defineValue(name),
      toJSON: this.defineToJSON(),
      valueOf: this.defineValueOf(),
      [SIGNATURE]: defineValue(signature),
      [ENVIRONMENT]: defineValue(this),
      [ALIGN]: defineValue(align),
      [SIZE]: defineValue(byteSize),
      [TYPE]: defineValue(type),
      [FLAGS]: defineValue(flags),
      [PROPS]: defineValue(props),
      [TYPED_ARRAY]: defineValue(this.getTypedArray(structure)),
      [Symbol.iterator]: this.defineStructIterator(),
      [ENTRIES]: this.defineStructEntries(),
      [PROPS]: defineValue(props),
    };
    const descriptors = {
      [Symbol.toStringTag]: defineValue(name),
    };
    if (members) {
      for (const member of members) {
        const { name, slot, flags } = member;
        if (member.structure.type === StructureType.Function) {
          let fn = template[SLOTS][slot];
          if (flags & MemberFlag.IsString) {
            fn[TRANSFORM] = (retval) => retval.string;
          } else if (flags & MemberFlag.IsClampedArray) {
            fn[TRANSFORM] = (retval) => retval.clampedArray;
          } else if (flags & MemberFlag.IsTypedArray) {
            fn[TRANSFORM] = (retval) => retval.typedArray;
          } else if (flags & MemberFlag.IsPlain) {
            fn[TRANSFORM] = (retval) => retval.valueOf();
          }
          staticDescriptors[name] = defineValue(fn);
          // provide a name if one isn't assigned yet
          if (!fn.name) {
            defineProperty(fn, 'name', defineValue(name));
          }
          // see if it's a getter or setter
          const [ accessorType, propName ] = /^(get|set)\s+([\s\S]+)/.exec(name)?.slice(1) ?? [];
          const argRequired = (accessorType === 'get') ? 0 : 1;
          if (accessorType && fn.length  === argRequired) {
            staticDescriptors[propName] ||= {};
            const descriptor = staticDescriptors[propName];
            descriptor[accessorType] = fn;
          }
          // see if it's a method
          if (member.flags & MemberFlag.IsMethod) {
            const method = function(...args) {
              try {
                return fn(this, ...args);
              } catch (err) {
                // adjust argument index/count
                err[UPDATE]?.(1);
                throw err;
              }
            };
            defineProperties(method, {
              name: defineValue(name),
              length: defineValue(fn.length - 1),
            });
            descriptors[name] = defineValue(method);
            if (accessorType && method.length === argRequired) {
              const descriptor = descriptors[propName] ||= {};
              descriptor[accessorType] = method;
            }
          }
        } else {
          staticDescriptors[name] = this.defineMember(member);
          props.push(name);
        }
      }
    }
    // static variable/constants are stored in slots
    staticDescriptors[SLOTS] = (props.length > 0) && defineValue(template[SLOTS]);
    const handlerName = `finalize${structureNames[type]}`;
    const f = this[handlerName];
    if (f?.call(this, structure, staticDescriptors, descriptors) !== false) {
      defineProperties(constructor.prototype, descriptors);
      defineProperties(constructor, staticDescriptors);
    }
  },
  createConstructor(structure, handlers = {}) {
    const {
      type,
      byteSize,
      align,
      flags,
      instance: { members, template },
    } = structure;
    const { onCastError } = handlers;
    // comptime fields are stored in the instance template's slots
    let comptimeFieldSlots;
    if (template?.[SLOTS]) {
      const comptimeMembers = members.filter(m => m.flags & MemberFlag.IsReadOnly);
      if (comptimeMembers.length > 0) {
        comptimeFieldSlots = comptimeMembers.map(m => m.slot);
      }
    }
    const cache = new ObjectCache();
    const thisEnv = this;
    const constructor = function(arg, options = {}) {
      const {
        allocator,
      } = options;
      const creating = this instanceof constructor;
      let self, dv, cached = false;
      if (creating) {
        if (arguments.length === 0) {
          throw new NoInitializer(structure);
        }
        self = this;
        if (flags & StructureFlag.HasSlot) {
          self[SLOTS] = {};
        }
        if (SHAPE in self) {
          // provided by defineStructureSlice(); the slice is different from other structures
          // as it does not have a zig size; memory is allocated by the slice initializer
          // based on the argument given
          self[INITIALIZE](arg, allocator);
          dv = self[MEMORY];
        } else {
          // don't use allocator to create storage for pointer
          const a = (type !== StructureType.Pointer) ? allocator : null;
          self[MEMORY] = dv = thisEnv.allocateMemory(byteSize, align, a);
        }
      } else {
        if (CAST in constructor) {
          // casting from number, string, etc.
          self = constructor[CAST].call(this, arg, options);
          if (self !== false) {
            return self;
          }
        }
        // look for buffer
        dv = thisEnv.extractView(structure, arg, onCastError);
        if (self = cache.find(dv)) {
          cached = true;
        } else {
          self = Object.create(constructor.prototype);
          if (SHAPE in self) {
            thisEnv.assignView(self, dv, structure, false, false);
          } else {
            self[MEMORY] = dv;
          }
          if (flags & StructureFlag.HasSlot) {
            self[SLOTS] = {};
          }
        }
      }
      if (!cached) {
        if (comptimeFieldSlots) {
          for (const slot of comptimeFieldSlots) {
            self[SLOTS][slot] = template[SLOTS][slot];
          }
        }
        self[RESTRICT]?.();
        if (creating) {
          // initialize object unless that's done already
          if (!(SHAPE in self)) {
            self[INITIALIZE](arg, allocator);
          }
        }
        if (FINALIZE in self) {
          self = self[FINALIZE]();
        }
        cache.save(dv, self);
      }
      if (flags & StructureFlag.HasProxy) {
        if (creating || !this) {
          return self[PROXY]();
        }
      }
      return self;
    };
    defineProperty(constructor, CACHE, defineValue(cache));
    {
      if (template?.[MEMORY]) {
        defineProperty(template, RESTORE, this.defineRestorer());
      }
    }
    return constructor;
  },
  createInitializer(handler) {
    return function(arg, allocator) {
      const [ argNoProxy, argProxyType ] = removeProxy(arg);
      const [ self ] = removeProxy(this);
      return handler.call(self, argNoProxy, allocator, argProxyType);
    }
  },
  createApplier(structure) {
    const { instance: { template } } = structure;
    return function(arg, allocator) {
      const [ argNoProxy ] = removeProxy(arg);
      const [ self ] = removeProxy(this);
      const argKeys = Object.keys(argNoProxy);
      if (argNoProxy instanceof Error) {
        throw argNoProxy;
      }
      const keys = self[KEYS];
      const setters = self[SETTERS];
      // don't accept unknown props
      for (const key of argKeys) {
        if (!(key in setters)) {
          throw new NoProperty(structure, key);
        }
      }
      // checking each name so that we would see inenumerable initializers as well
      let normalCount = 0;
      let normalFound = 0;
      let normalMissing = 0;
      let specialFound = 0;
      for (const key of keys) {
        const set = setters[key];
        if (set.special) {
          if (key in argNoProxy) {
            specialFound++;
          }
        } else {
          normalCount++;
          if (key in argNoProxy) {
            normalFound++;
          } else if (set.required) {
            normalMissing++;
          }
        }
      }
      if (normalMissing !== 0 && specialFound === 0) {
        const missing = keys.filter(k => setters[k].required && !(k in argNoProxy));
        throw new MissingInitializers(structure, missing);
      }
      if (specialFound + normalFound > argKeys.length) {
        // some props aren't enumerable
        for (const key of keys) {
          if (key in argNoProxy) {
            if (!argKeys.includes(key)) {
              argKeys.push(key);
            }
          }
        }
      }
      // apply default values unless all properties are initialized
      if (normalFound < normalCount && specialFound === 0) {
        if (template) {
          if (template[MEMORY]) {
            copyObject(self, template);
          }
        }
      }
      for (const key of argKeys) {
        const set = setters[key];
        set.call(self, argNoProxy[key], allocator);
      }
      return argKeys.length;
    };
  },
  getTypedArray(structure) {
    const { type, instance } = structure;
    if (type !== undefined && instance) {
      switch (type) {
        case StructureType.Enum:
        case StructureType.ErrorSet:
        case StructureType.Primitive: {
          const { byteSize, type } = instance.members[0];
          const intType = (type === MemberType.Float)
                        ? 'Float'
                        : (type === MemberType.Int) ? 'Int' : 'Uint';
          const prefix = (byteSize > 4 && type !== MemberType.Float) ? 'Big' : '';
          const arrayName = prefix + intType + (byteSize * 8) + 'Array';
          return globalThis[arrayName];
        }        case StructureType.Array:
        case StructureType.Slice:
        case StructureType.Vector:
          return this.getTypedArray(instance.members[0].structure);
      }
    }
  },
});

var argStruct = mixin({
  defineArgStruct(structure, descriptors) {
    const {
      flags,
      byteSize,
      align,
      length,
      instance: { members },
    } = structure;
    const thisEnv = this;
    const argMembers = members.slice(1);
    const constructor = function(args, argAlloc) {
      const creating = this instanceof constructor;
      let self, dv;
      if (creating) {
        self = this;
        dv = thisEnv.allocateMemory(byteSize, align);
      } else {
        self = Object.create(constructor.prototype);
        dv = args;
      }
      self[MEMORY] = dv;
      if (flags & StructureFlag.HasSlot) {
        self[SLOTS] = {};
      }
      if (creating) {
        let options;
        if (flags & ArgStructFlag.HasOptions) {
          if (args.length === length + 1) {
            options = args.pop();
          }
        }
        // length holds the minimum number of arguments
        if (args.length !== length) {
          throw new ArgumentCountMismatch(length, args.length);
        }
        if (flags & ArgStructFlag.IsAsync) {
          self[FINALIZE] = null;
        }
        thisEnv.copyArguments(self, args, argMembers, options, argAlloc);
      } else {
        return self;
      }
    };
    for (const member of members) {
      descriptors[member.name] = this.defineMember(member);
    }
    const retvalSetter = descriptors.retval.set;
    descriptors.length = defineValue(argMembers.length);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArgStruct(members);
    descriptors[RETURN] = defineValue(function(value) {
      // pass allocator associated with argument to setter
      retvalSetter.call(this, value, this[ALLOCATOR]);
    });
    descriptors[Symbol.iterator] = this.defineArgIterator?.(argMembers);
    {
      descriptors[UPDATE] = this.defineRetvalCopier(members[0]);
    }
    return constructor;
  },
  finalizeArgStruct(structure, staticDescriptors) {
    const { flags } = structure;
    staticDescriptors[THROWING] = defineValue(!!(flags & ArgStructFlag.IsThrowing));
  },
});

var arrayLike = mixin({
  defineFinalizerArray({ get, set }) {
    return {
      value() {
        defineProperties(this, {
          get: { value: get.bind(this) },
          set: set && { value: set.bind(this) },
        });
        return this;
      },
    };
  },
  defineVivificatorArray(structure) {
    const { instance: { members: [ member ]} } = structure;
    const { byteSize, structure: elementStructure } = member;
    const thisEnv = this;
    const value = function getChild(index) {
      const { constructor } = elementStructure;
      const dv = this[RESTORE]() ;
      const parentOffset = dv.byteOffset;
      const offset = parentOffset + byteSize * index;
      const childDV = thisEnv.obtainView(dv.buffer, offset, byteSize, !dv[NO_CACHE]);
      const object = this[SLOTS][index] = constructor.call(PARENT, childDV);
      return object;
    };
    return { value };
  },
});

var array = mixin({
  defineArray(structure, descriptors) {
    const {
      length,
      instance: { members: [ member ] },
      flags,
    } = structure;
    const propApplier = this.createApplier(structure);
    const descriptor = this.defineMember(member);
    const { set } = descriptor;
    const constructor = this.createConstructor(structure);
    const initializer = this.createInitializer(function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        copyObject(this, arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', VisitorFlag.Vivificate, arg);
        }
      } else {
        if (typeof(arg) === 'string' && flags & ArrayFlag.IsString) {
          arg = { string: arg };
        }
        if (arg?.[Symbol.iterator]) {
          arg = transformIterable(arg);
          if (arg.length !== length) {
            throw new ArrayLengthMismatch(structure, this, arg);
          }
          let i = 0;
          for (const value of arg) {
            set.call(this, i++, value, allocator);
          }
        } else if (arg && typeof(arg) === 'object') {
          if (propApplier.call(this, arg) === 0) {
            throw new InvalidArrayInitializer(structure, arg);
          }
        } else if (arg !== undefined) {
          throw new InvalidArrayInitializer(structure, arg);
        }
      }
    });
    descriptors.$ = { 
      get: function() { return getProxy(this, ProxyType.Slice) },
      set: initializer 
    };
    descriptors.length = defineValue(length);
    descriptors.entries = descriptors[ENTRIES] = this.defineArrayEntries();
    if (flags & ArrayFlag.IsTypedArray) {
      descriptors.typedArray = this.defineTypedArray(structure);
      if (flags & ArrayFlag.IsString) {
        descriptors.string = this.defineString(structure);
      }
      if (flags & ArrayFlag.IsClampedArray) {
        descriptors.clampedArray = this.defineClampedArray(structure);
      }
    }
    descriptors[Symbol.iterator] = this.defineArrayIterator();
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = this.defineFinalizerArray(descriptor);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorArray(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArray();
    descriptors[PROXY] = {
      value() {
        return getProxy(this, ProxyType.Slice);
      }
    };
    descriptors[PROXY_TYPE] = defineValue(ProxyType.Slice);
    return constructor;
  },
  finalizeArray(structure, staticDescriptors) {
    const {
      flags,
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors.child = defineValue(member.structure.constructor);
    staticDescriptors[SENTINEL] = (flags & ArrayFlag.HasSentinel) && this.defineSentinel(structure);
  },
});

var _enum = mixin({
  defineEnum(structure, descriptors) {
    const {
      instance: {
        members: [ member ],
      },
    } = structure;
    const descriptor = this.defineMember(member);
    const { get, set } = descriptor;
    const { get: getNumber } = this.defineMember(member, false);
    const propApplier = this.createApplier(structure);
    const expected = [ 'string', 'number', 'tagged union' ];
    const initializer = function(arg) {
      if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg) === 0) {
          throw new InvalidInitializer(structure, expected, arg);
        }
      } else if (arg !== undefined) {
        set.call(this, arg);
      }
    };
    const constructor = this.createConstructor(structure, {
      onCastError(structure, arg) {
        throw new InvalidInitializer(structure, expected, arg);
      }
    });
    descriptors.$ = descriptor;
    descriptors.toString = defineValue(toString);
    descriptors[Symbol.toPrimitive] = {
      value(hint)  {
        switch (hint) {
          case 'string':
          case 'default':
            return this.$[NAME];
          default:
            return getNumber.call(this);
        }
      },
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    return constructor;
  },
  finalizeEnum(structure, staticDescriptors) {
    const {
      flags,
      constructor,
      instance: { members: [ member ] },
      static: { members, template },
    } = structure;
    const items = template[SLOTS];
    // obtain getter/setter for accessing int values directly
    const { get, set } = this.defineMember(member, false);
    const itemsByIndex = {};
    for (const { name, flags, slot } of members) {
      if (flags & MemberFlag.IsPartOfSet) {
        const item = items[slot];
        // attach name to item so tagged union code can quickly find it
        defineProperty(item, NAME, defineValue(name));
        const index = get.call(item);
        // make item available by name 
        staticDescriptors[name] = { value: item, writable: false };
        itemsByIndex[index] = item;
      }
    }
    // add cast handler allowing strings, numbers, and tagged union to be casted into enums
    staticDescriptors[CAST] = {
      value(arg) {
        if (typeof(arg)  === 'string') {
          return constructor[arg];
        } else if(typeof(arg) === 'number' || typeof(arg) === 'bigint') {
          let item = itemsByIndex[arg];
          if (!item) {
            if (flags & EnumFlag.IsOpenEnded) {
              // create the item on-the-fly when enum is non-exhaustive
              item = new constructor(undefined);
              // write the value into memory
              set.call(item, arg);
              // attach the new item to the enum set
              const name = `${arg}`;
              defineProperty(item, NAME, defineValue(name));
              defineProperty(constructor, name, defineValue(item));
              itemsByIndex[arg] = item;
            }
          }
          return item;
        } else if (arg instanceof constructor) {
          return arg;
        } else if (arg?.[TAG] instanceof constructor) {
          // a tagged union, return the active tag
          return arg[TAG];
        } else {
          return false;
        }
      }
    };
    staticDescriptors[TYPED_ARRAY] = defineValue(this.getTypedArray(structure));
  },
  transformDescriptorEnum(descriptor, member) {
    const { type, structure } = member;
    if (type === MemberType.Object) {
      return descriptor;
    }
    const findEnum = function(value) {
      const { constructor } = structure;
      // the enumeration constructor returns the object for the int value
      const item = constructor(value);
      if (!item) {
        throw new EnumExpected(structure, value);
      }
      return item
    };
    const { get, set } = descriptor;
    return {
      get: (get.length === 0)
      ? function getEnum() {
          const value = get.call(this);
          return findEnum(value);
        }
      : function getEnumElement(index) {
          const value = get.call(this, index);
          return findEnum(value);
        },
      set: (set.length === 1)
      ? function setEnum(value) {
          const item = findEnum(value);
          // call Symbol.toPrimitive directly as enum can be bigint or number
          value = item[Symbol.toPrimitive]();
          set.call(this, value);
        }
      : function setEnumElement(index, value) {
          const item = findEnum(value);
          set.call(this, index, item[Symbol.toPrimitive]());
        },
    };
  },
});

var errorSet = mixin({
  init() {
    this.ZigError = null,
    this.globalItemsByIndex = {};
    this.globalErrorSet = null;
  },
  defineErrorSet(structure, descriptors) {
    const {
      instance: { members: [ member ] },
      byteSize,
      flags,
    } = structure;
    if (!this.ZigError) {
      // create anyerror set
      this.ZigError = class Error extends ZigErrorBase {};
      const ae = {
        type: StructureType.ErrorSet,
        flags: ErrorSetFlag.IsGlobal,
        byteSize,
        name: 'anyerror',
        instance: { members: [ member ] },
        static: { members: [], template: { SLOTS: {} } },
      };
      const es = this.defineStructure(ae);
      this.finalizeStructure(ae);
      this.globalErrorSet = es;
    }
    if (this.globalErrorSet && (flags & ErrorSetFlag.IsGlobal)) {
      return this.globalErrorSet;
    }
    const descriptor = this.defineMember(member);
    const { set } = descriptor;
    const expected = [ 'string', 'number' ];
    const propApplier = this.createApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor[CLASS]) {
        set.call(this, arg);
      } else if (arg && typeof(arg) === 'object' && !isErrorJSON(arg)) {
        if (propApplier.call(this, arg) === 0) {
          throw new InvalidInitializer(structure, expected, arg);
        }
      } else if (arg !== undefined) {
        set.call(this, arg);
      }
    };
    const constructor = this.createConstructor(structure, {
      onCastError(structure, arg) {
        throw new InvalidInitializer(structure, expected, arg);
      }
    });
    descriptors.$ = descriptor;
    descriptors[INITIALIZE] = defineValue(initializer);
    return constructor;
  },
  finalizeErrorSet(structure, staticDescriptors) {
    const {
      constructor,
      flags,
      instance: { members: [ member ] },
      static: { members, template },
    } = structure;
    if (this.globalErrorSet && (flags & ErrorSetFlag.IsGlobal)) {
      // already finalized
      return false;
    }
    const items = template?.[SLOTS] ?? {};
    const itemsByIndex = (flags & ErrorSetFlag.IsGlobal) ? this.globalItemsByIndex : {};
    // obtain getter/setter for accessing int values directly
    const { get } = this.defineMember(member, false);
    for (const { name, slot } of members) {
      const item = items[slot];
      // unlike enums, error objects in an error-set aren't instances of the error-set class
      // they're instance of a superclass of JavaScript's Error; here we need to extract the
      // error number from the error-set instance and create the error object, if hasn't been
      // created already for an earlier set
      const number = get.call(item);
      let error = this.globalItemsByIndex[number];
      const inGlobalSet = !!error;
      if (!error) {
        error = new this.ZigError(name, number);
      }
      // make the error object available by name
      const descriptor = defineValue(error);
      staticDescriptors[name] = descriptor;
      // make it available by error.toString() as well, so that the in operator can be used
      // to see if an error is in a set; note that the text will be prefixed with "Error: "
      // so it's not the same as error.message
      const stringified = `${error}`;
      staticDescriptors[stringified] = descriptor;
      itemsByIndex[number] = error;
      // add to global set
      if (!inGlobalSet) {        
        defineProperties(this.globalErrorSet, {
          [name]: descriptor,
          [stringified]: descriptor,
        });
        this.globalErrorSet[PROPS].push(name);
        this.globalItemsByIndex[number] = error;
      }
    }
    // add cast handler allowing strings, numbers, and JSON object to be casted into error set
    staticDescriptors[CAST] = {
      value(arg) {
        if (typeof(arg) === 'number') {
          return itemsByIndex[arg];
        } else if (typeof(arg) === 'string') {
          return constructor[arg];
        } else if (arg instanceof constructor[CLASS]) {
          return itemsByIndex[Number(arg)];
        } else if (isErrorJSON(arg)) {
          return constructor[`Error: ${arg.error}`];
        } else if (arg instanceof Error) {
          return constructor[`${arg}`];
        } else {
          return false;
        }
      }
    };
    staticDescriptors[CLASS] = defineValue(this.ZigError);
  },
  transformDescriptorErrorSet(descriptor, member) {
    const { type, structure } = member;
    if (type === MemberType.Object) {
      return descriptor;
    }
    const findError = (value) => {
      const { constructor, flags } = structure;
      const item = constructor(value);
      if (!item) {
        if (flags & ErrorSetFlag.IsGlobal) {
          if (typeof(value) === 'number') {
            const newItem = new this.ZigError(`Unknown error: ${value}`, value);
            this.globalItemsByIndex[value] = newItem;
            defineProperty(this.globalErrorSet, `${newItem}`, defineValue(newItem));
            return newItem;
          }
        }
        if (value instanceof Error) {
          throw new NotInErrorSet(structure, value);
        } else {
          throw new ErrorExpected(structure, value);
        }
      }
      return item
    };
    const { get, set } = descriptor;
    return {
      get: (get.length === 0)
      ? function getError() {
          const value = get.call(this);
          return findError(value);
        }
      : function getErrorElement(index) {
          const value = get.call(this, index);
          return findError(value);
        },
      set: (set.length === 1)
      ? function setError(value) {
        const item = findError(value);
          value = Number(item);
          set.call(this, value);
        }
      : function setError(index, value) {
          const item = findError(value);
          value = Number(item);
          set.call(this, index, value);
        },
    };
  },
});

class ZigErrorBase extends Error {
  constructor(name, number) {
    super(deanimalizeErrorName(name));
    this.number = number;
    this.stack = undefined;
  }

  [Symbol.toPrimitive](hint) {
    switch (hint) {
      case 'string':
      case 'default':
        return Error.prototype.toString.call(this, hint);
      default:
        return this.number;
    }
  }

  toJSON() {
    return { error: this.message };
  }
}

var errorUnion = mixin({
  defineErrorUnion(structure, descriptors) {
    const {
      instance: { members: [ valueMember, errorMember ] },
      flags,
    } = structure;
    const { get: getValue, set: setValue } = this.defineMember(valueMember);
    const { get: getError, set: setError } = this.defineMember(errorMember);
    const { get: getErrorNumber, set: setErrorNumber } = this.defineMember(errorMember, false);
    const get = function() {
      const errNum = getErrorNumber.call(this);
      if (errNum) {
        throw getError.call(this);
      } else {
        return getValue.call(this);
      }
    };
    const isValueVoid = valueMember.type === MemberType.Void;
    const ErrorSet = errorMember.structure.constructor;
    const { bitOffset, byteSize } = valueMember;
    const clearValue = function() {
      clearView(this[MEMORY], bitOffset >> 3, byteSize);
      this[VISIT]?.('clear', VisitorFlag.IgnoreUncreated);
    };
    const propApplier = this.createApplier(structure);
    const initializer = this.createInitializer(function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        copyObject(this, arg);
        if (flags & StructureFlag.HasPointer) {
          if (!getErrorNumber.call(this)) {
            this[VISIT]('copy', 0, arg);
          }
        }
      } else if (arg instanceof ErrorSet[CLASS] && ErrorSet(arg)) {
        setError.call(this, arg);
        clearValue.call(this);
      } else if (arg !== undefined || isValueVoid) {
        try {
          // call setValue() first, in case it throws
          setValue.call(this, arg, allocator);
          setErrorNumber.call(this, 0);
          return;
        } catch (err) {
          if (arg instanceof Error) {
            const match = ErrorSet(arg) ?? ErrorSet.Unexpected;
            if (match) {
              setError.call(this, match);
              clearValue.call(this);
            } else {
              // we gave setValue a chance to see if the error is actually an acceptable value
              // now is time to throw an error
              throw new NotInErrorSet(errorMember.structure, arg);
            }
          } else if (isErrorJSON(arg)) {
            // setValue() failed because the argument actually is an error as JSON
            setError.call(this, arg);
            clearValue.call(this);
          } else if (arg && typeof(arg) === 'object') {
            // maybe the argument contains a special property like `dataView` or `base64`
            if (propApplier.call(this, arg) === 0) {
              // propApplier() found zero prop, so it's time to throw
              throw err;
            }
          } else {
            throw err;
          }
        }
      }
    });
    const constructor = this.createConstructor(structure);
    descriptors.$ = { get, set: initializer };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    // for operating on pointers contained in the error union
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorErrorUnion(valueMember, getErrorNumber);
    return constructor;
  },
});

var _function = mixin({
  defineFunction(structure, descriptors) {
    const {
      instance: { members: [ member ], template: thunk },
    } = structure;
    const { structure: { constructor: ArgStruct } } = member;
    const thisEnv = this;
    const constructor = function(arg) {
      const creating = this instanceof constructor;
      let dv;
      if (creating) {
        // creating a Zig function object from a JavaScript function
        if (arguments.length === 0) {
          throw new NoInitializer(structure);
        }
        if (typeof(arg) !== 'function') {
          throw new TypeMismatch('function', arg);
        }
        if (ArgStruct[TYPE] === StructureType.VariadicStruct || !constructor[CONTROLLER]) {
          throw new Unsupported();
        }
        if (thisEnv.instance) {
          // create an inbound thunk for function (from mixin "features/call-marshaling-inbound")
          dv = thisEnv.getFunctionThunk(arg, constructor[CONTROLLER]);
        }
      } else {
        if (this !== ENVIRONMENT) {
          // casting from buffer to function is allowed only if request comes from the runtime
          throw new NoCastingToFunction();
        }
        // casting a memory pointing to Zig binary
        dv = arg;
      }
      const argCount = ArgStruct.prototype.length;
      const self = (creating)
      ? thisEnv.createInboundCaller(arg, ArgStruct)
      : thisEnv.createOutboundCaller(thunk, ArgStruct);
      defineProperties(self, {
        length: defineValue(argCount),
        name: defineValue(creating ? arg.name : ''),
      });
      // make self an instance of this function type
      Object.setPrototypeOf(self, constructor.prototype);
      if (dv) {
        self[MEMORY] = dv;
      } else {
        thisEnv.deferredThunks ??= [];
        thisEnv.deferredThunks.push({ target: self, fn: arg });
      }
      return self;
    };
    // make function type a superclass of Function
    Object.setPrototypeOf(constructor.prototype, Function.prototype);
    descriptors.valueOf = descriptors.toJSON = defineValue(getSelf);
    return constructor;
  },
  finalizeFunction(structure, staticDescriptors, descriptors) {
    const {
      static: { template },
    } = structure;
    staticDescriptors[CONTROLLER] = defineValue(template);
    // don't change the tag of functions
    descriptors[Symbol.toStringTag] = undefined;
  },
  ...({
    createDeferredThunks() {
      const list = this.deferredThunks;
      if (list) {
        for (const { target, fn } of list) {
          const { constructor } = target;
          const dv = this.getFunctionThunk(fn, constructor[CONTROLLER]);
          target[MEMORY] = dv;
        }
      }
    },
  } ),
});

var opaque = mixin({
  defineOpaque(structure, descriptors) {
    const {
      purpose,
    } = structure;
    const initializer = () => { throw new CreatingOpaque(structure) };
    const valueAccessor = () => { throw new AccessingOpaque(structure) };
    const constructor = this.createConstructor(structure);
    descriptors.$ = { get: valueAccessor, set: valueAccessor };
    descriptors[Symbol.iterator] = (purpose === StructurePurpose.Iterator) && this.defineZigIterator();
    descriptors[Symbol.toPrimitive] = {
      value(hint) {
        const { name } = structure;
        return `[opaque ${name}]`;
      },
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    return constructor;
  },
});

var optional = mixin({
  defineOptional(structure, descriptors) {
    const {
      instance: { members: [ valueMember, presentMember ] },
      flags,
    } = structure;
    const { get: getValue, set: setValue } = this.defineMember(valueMember);
    const { get: getPresent, set: setPresent } = this.defineMember(presentMember);
    const get = function() {
      const present = getPresent.call(this);
      if (present) {
        return getValue.call(this);
      } else {
        this[VISIT]?.('clear', VisitorFlag.IgnoreUncreated);
        return null;
      }
    };
    const isValueVoid = valueMember.type === MemberType.Void;
    const { bitOffset, byteSize } = valueMember;
    const initializer = this.createInitializer(function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        copyObject(this, arg);
        if (flags & StructureFlag.HasPointer) {
          // don't bother copying pointers when it's empty
          if (getPresent.call(this)) {
            this[VISIT]('copy', VisitorFlag.Vivificate, arg);
          }
        }
      } else if (arg === null) {
        setPresent.call(this, 0);
        if (flags & OptionalFlag.HasSelector) {
          clearView(this[MEMORY], bitOffset >> 3, byteSize);
        }
        // clear references so objects can be garbage-collected
        this[VISIT]?.('clear', VisitorFlag.IgnoreUncreated);
      } else if (arg !== undefined || isValueVoid) {
        // call setValue() first, in case it throws
        setValue.call(this, arg, allocator);
        if (flags & OptionalFlag.HasSelector) {
          setPresent.call(this, 1);
        } else if (flags & StructureFlag.HasPointer) {
          // since setValue() wouldn't write address into memory when the target is in
          // JS memory, we need to use setPresent() in order to write something
          // non-zero there so that we know the field is populated
          if (!getPresent.call(this)) {
            setPresent.call(this, 13);
          }
        }
      }
    });
    const constructor = structure.constructor = this.createConstructor(structure);
    descriptors.$ = { get, set: initializer };
    // we need to clear the value portion when there's a separate bool indicating whether a value
    // is present; for optional pointers, the bool overlaps the usize holding the address; setting
    // it to false automatically clears the address
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorOptional(valueMember, getPresent);
    return constructor;
  },
});

var pointer = mixin({
  definePointer(structure, descriptors) {
    const {
      type,
      flags,
      byteSize,
      instance: { members: [ member ] },
    } = structure;
    const { structure: targetStructure } = member;
    const {
      type: targetType,
      flags: targetFlags,
      byteSize: targetSize = 1
    } = targetStructure;
    // length for slice can be zero or undefined
    const addressSize = (flags & PointerFlag.HasLength) ? byteSize / 2 : byteSize;
    const { get: readAddress, set: writeAddress } = this.defineMember({
      type: MemberType.Uint,
      bitOffset: 0,
      bitSize: addressSize * 8,
      byteSize: addressSize,
      structure: { byteSize: addressSize },
    });
    const { get: readLength, set: writeLength } = (flags & PointerFlag.HasLength) ? this.defineMember({
      type: MemberType.Uint,
      bitOffset: addressSize * 8,
      bitSize: addressSize * 8,
      byteSize: addressSize,
      structure: {
        flags: PrimitiveFlag.IsSize,
        byteSize: addressSize
      },
    }) : {};
    const updateTarget = function(context, all = true, active = true) {
      if (all || this[MEMORY][ZIG]) {
        if (active) {
          const Target = constructor.child;
          const address = readAddress.call(this);
          const length = (flags & PointerFlag.HasLength)
          ? readLength.call(this)
          : (targetType === StructureType.Slice && targetFlags & SliceFlag.HasSentinel)
            ? thisEnv.findSentinel(address, Target[SENTINEL].bytes) + 1
            : 1;
          if (address !== this[LAST_ADDRESS] || length !== this[LAST_LENGTH]) {
            const dv = thisEnv.findMemory(context, address, length, Target[SIZE]);
            const newTarget = (dv) ? Target.call(ENVIRONMENT, dv) : null;
            this[SLOTS][0] = newTarget;
            this[LAST_ADDRESS] = address;
            this[LAST_LENGTH] = length;
            if (flags & PointerFlag.HasLength) {
              this[MAX_LENGTH] = null;
            }
            return newTarget;
          }
        } else {
          return this[SLOTS][0] = undefined;
        }
      }
      return this[SLOTS][0];
    };
    const setAddress = function(address) {
      writeAddress.call(this, address);
      this[LAST_ADDRESS] = address;
    };
    const sentinelCount = (targetFlags & SliceFlag.HasSentinel) ? 1 : 0;
    const setLength = (flags & PointerFlag.HasLength || targetFlags & SliceFlag.HasSentinel)
    ? function(length) {
        writeLength?.call?.(this, length - sentinelCount);
        this[LAST_LENGTH] = length;
      }
    : null;
    const proxyType = getProxyType(structure);
    const targetProxyType = getProxyType(targetStructure, flags & PointerFlag.IsConst);
    const getTargetObject = function(useProxy = true) {
      const empty = !this[SLOTS][0];
      const target = updateTarget.call(this, null, empty);
      if (!target) {
        if (flags & PointerFlag.IsNullable) {
          return null;
        }
        throw new NullPointer();
      }
      return (targetProxyType && useProxy) ? getProxy(target, targetProxyType) : target;
    };
    const setTargetObject = function(arg) {
      if (arg === undefined) {
        return;
      }
      if (arg) {
        const zig = arg[MEMORY][ZIG];
        if (zig) {
          // the target sits in Zig memory--apply the change immediately
          const { address, js } = zig;
          setAddress.call(this, address);
          setLength?.call?.(this, arg.length);
          if (js) {
            // remove the fake Zig memory attributes now that we've bypassed the check
            arg[MEMORY][ZIG] = undefined;
          }
        } else {
          if (this[MEMORY][ZIG]) {
            throw new ZigMemoryTargetRequired();
          }
        }
      } else if (this[MEMORY][ZIG]) {
        setAddress.call(this, 0);
        setLength?.call?.(this, 0);
      }
      this[SLOTS][0] = arg ?? null;
      if (flags & PointerFlag.HasLength) {
        this[MAX_LENGTH] = null;
      }
    };
    const getTarget = (targetFlags & StructureFlag.HasValue)
    ? function() { return getTargetObject.call(this).$ }
    : getTargetObject;
    const setTarget = (flags & PointerFlag.IsConst)
    ? throwReadOnly
    : function(value) {
        const target = getTargetObject.call(this);
        return target.$ = value;
      };
    const getTargetLength = function() {
      const target = getTargetObject.call(this, false);
      return (target) ? target.length : 0;
    };
    const setTargetLength = function(len) {
      len = len | 0;
      const target = getTargetObject.call(this, false);
      if (target) {
        if (target.length === len) {
          return;
        }
      } else {
        if (len !== 0) {
          throw new InvalidSliceLength(len, 0);
        }
        return;
      }
      const dv = target[RESTORE]() ;
      const zig = dv[ZIG];
      // determine the maximum length
      let max;
      if (!zig) {
        if (flags & PointerFlag.HasLength) {
          this[MAX_LENGTH] ||= target.length;
          max = this[MAX_LENGTH];
        } else {
          const bytesAvailable = dv.buffer.byteLength - dv.byteOffset;
          max = (bytesAvailable / targetSize) | 0;
        }
      }
      if (len < 0 || len > max) {
        throw new InvalidSliceLength(len, max);
      }
      const byteLength = len * targetSize;
      const newDV = (zig)
      ? thisEnv.obtainZigView(zig.address, byteLength)
      : thisEnv.obtainView(dv.buffer, dv.byteOffset, byteLength);
      const Target = targetStructure.constructor;
      this[SLOTS][0] = Target.call(ENVIRONMENT, newDV);
      setLength?.call?.(this, len);
    };
    const thisEnv = this;
    const initializer = this.createInitializer(function(arg, allocator, targetProxyType) {
      const Target = targetStructure.constructor;
      if (isPointerOf(arg, Target)) {
        if (!(flags & PointerFlag.IsConst) && arg.constructor.const) {
          throw new ConstantConstraint(structure, arg);
        }
        // initialize with the other pointer's target
        arg = arg[SLOTS][0];
      } else if (flags & PointerFlag.IsMultiple) {
        if (isCompatiblePointer(arg, Target, flags)) {
          arg = Target.call(ENVIRONMENT, arg[SLOTS][0][MEMORY]);
        }
      } else if (targetType === StructureType.Slice && (targetFlags & SliceFlag.IsOpaque) && arg) {
        if (arg.constructor[TYPE] === StructureType.Pointer) {
          arg = arg[TARGET]?.[MEMORY];
        } else if (arg[MEMORY]) {
          arg = arg[MEMORY];
        } else if (arg?.buffer instanceof ArrayBuffer) {
          if (!(arg instanceof Uint8Array || arg instanceof DataView)) {
            const { byteOffset, byteLength } = arg;
            if (byteOffset !== undefined && byteLength !== undefined) {
              arg = new DataView(arg.buffer, byteOffset, byteLength);
            }
          }
        }
      }
      if (arg instanceof Target) {
        {
          arg[RESTORE]();
        }
        // if the target is read-only, then only a const pointer can point to it
        if (targetProxyType === ProxyType.ReadOnly || arg[READ_ONLY]) {
          if (!(flags & PointerFlag.IsConst)) {
            throw new ReadOnlyTarget(structure);
          }
        }
      } else if (isCompatibleInstanceOf(arg, Target)) {
        // compatible object from a different module
        arg = Target.call(ENVIRONMENT, arg[MEMORY]);
      } else if (flags & PointerFlag.IsSingle && flags & PointerFlag.IsMultiple && arg instanceof Target.child) {
        // C pointer
        arg = Target.call(ENVIRONMENT, arg[MEMORY]);
      } else if (isCompatibleBuffer(arg, Target)) {
        // autocast to target type
        const dv = thisEnv.extractView(targetStructure, arg);
        arg = Target.call(ENVIRONMENT, dv);
      } else if (arg != undefined && !arg[MEMORY]) {
        if (flags & PointerFlag.IsSingle && flags & PointerFlag.IsMultiple) {
          // C pointer
          if (typeof(arg) === 'object' && !arg[Symbol.iterator]) {
            let single = true;
            // make sure the object doesn't contain special props for the slice
            const propSetters = Target.prototype[SETTERS];
            for (const key of Object.keys(arg)) {
              const set = propSetters[key];
              if (set?.special) {
                single = false;
                break;
              }
            }
            if (single) {
              arg = [ arg ];
            }
          }
        }
        if (TYPED_ARRAY in Target && arg?.buffer && arg[Symbol.iterator]) {
          throw new InvalidPointerTarget(structure, arg);
        }
        // autovivificate target object
        const autoObj = arg = new Target(arg, { allocator });
        if (targetFlags & StructureFlag.HasProxy) {
          // point to the actual object instead of the proxy
          arg = getProxyTarget(autoObj).target;
        }
      } else if (arg !== undefined) {
        if (!(flags & PointerFlag.IsNullable) || arg !== null) {
          throw new InvalidPointerTarget(structure, arg);
        }
      }
      const zig = arg?.[MEMORY]?.[ZIG];
      if (zig?.address === usizeInvalid) {
        throw new PreviouslyFreed(arg);
      }
      this[TARGET] = arg;
    });
    const constructor = this.createConstructor(structure);
    descriptors['*'] = { get: getTarget, set: setTarget };
    descriptors.$ = { 
      get: (targetType === StructureType.Pointer) 
      ? getSelf 
      : function() { return getProxy(this, proxyType) }, 
      set: initializer 
    };
    descriptors.length = { get: getTargetLength, set: setTargetLength };
    descriptors.slice = (targetType === StructureType.Slice) && {
      value(begin, end) {
        const newTarget = this[TARGET].slice(begin, end);
        return new constructor(newTarget);
      }
    };
    descriptors.subarray = (targetType === StructureType.Slice) && {
      value(begin, end, options) {
        const newTarget = this[TARGET].subarray(begin, end, options);
        return new constructor(newTarget);
      }
    };
    descriptors[Symbol.toPrimitive] = (targetType === StructureType.Primitive) && {
      value(hint) {
        return this[TARGET][Symbol.toPrimitive](hint);
      }
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = (targetType === StructureType.Function) && {
      value() {
        const self = (...args) => {
          const f = self['*'];
          return f(...args);
        };
        self[MEMORY] = this[MEMORY];
        self[SLOTS] = this[SLOTS];
        Object.setPrototypeOf(self, constructor.prototype);
        return self;
      }
    };
    descriptors[PROXY] = (proxyType) && {
      value() {
        return getProxy(this, proxyType);
      },
    };
    descriptors[PROXY_TYPE] = defineValue(proxyType);
    descriptors[TARGET] = { get: getTargetObject, set: setTargetObject };
    descriptors[UPDATE] = defineValue(updateTarget);
    descriptors[ADDRESS] = { set: setAddress };
    descriptors[LENGTH] = { set: setLength };
    descriptors[VISIT] = this.defineVisitor();
    descriptors[LAST_ADDRESS] = defineValue(0);
    descriptors[LAST_LENGTH] = defineValue(0);
    descriptors[MAX_LENGTH] = (flags & PointerFlag.HasLength) && defineValue(null);
    // disable these so the target's properties are returned instead through auto-dereferencing
    descriptors.dataView = descriptors.base64 = undefined;
    return constructor;
  },
  finalizePointer(structure, staticDescriptors) {
    const {
      flags,
      constructor,
      instance: { members: [ member ] },
    } = structure;
    const { structure: targetStructure } = member;
    const { type: targetType, constructor: Target } = targetStructure;
    staticDescriptors.child = (Target !== Object) ? defineValue(Target) : {
      // deal with self-referencing pointer
      get() { return targetStructure.constructor }
    };
    staticDescriptors.const = defineValue(!!(flags & PointerFlag.IsConst));
    staticDescriptors[CAST] = {
      value(arg, options) {
        if (this === ENVIRONMENT || this === PARENT || arg instanceof constructor) {
          // casting from buffer to pointer is allowed only if request comes from the runtime
          // casting from writable to read-only is also allowed
          return false;
        } else if (isPointerOf(arg, Target)) {
          // const/non-const casting
          return new constructor(Target(arg['*']), options);
        } else if (isCompatiblePointer(arg, Target, flags)) {
          // casting between C/multi/slice pointers
          return new constructor(arg);
        } else if (targetType === StructureType.Slice) {
          // allow casting to slice through constructor of its pointer
          return new constructor(Target(arg), options);
        } else {
          throw new NoCastingToPointer(structure);
        }
      }
    };
  }
});

function isPointerOf(arg, Target) {
  return isCompatibleType(arg?.constructor?.child, Target) && arg['*'];
}

function isCompatiblePointer(arg, Target, flags) {
  if (flags & PointerFlag.IsMultiple) {
    if (arg?.constructor?.child?.child === Target.child && arg['*']) {
      return true;
    } else if (flags & PointerFlag.IsSingle && isPointerOf(arg, Target.child)) {
      // C pointer
      return true;
    }
  }
  return false;
}

function isCompatibleBuffer(arg, constructor) {
  // TODO: merge this with extractView in mixin "view-management"
  const tag = arg?.[Symbol.toStringTag];
  if (tag) {
    const typedArray = constructor[TYPED_ARRAY];
    if (typedArray) {
      switch (tag) {
        case typedArray.name:
        case 'DataView':
          return true;
        case 'ArrayBuffer':
          return typedArray === Uint8Array || typedArray === Int8Array;
        case 'Uint8ClampedArray':
          return typedArray === Uint8Array;
      }
    }
    if (constructor.child) {
      if (findElements(arg, constructor.child) !== undefined) {
        return true;
      }
    }
  }
  return false;
}

var primitive = mixin({
  definePrimitive(structure, descriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    const propApplier = this.createApplier(structure);
    const { get, set } = this.defineMember(member);
    const initializer = function(arg) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        copyObject(this, arg);
      } else {
        if (arg && typeof(arg) === 'object') {
          if (propApplier.call(this, arg) === 0) {
            const type = getPrimitiveName(member);
            throw new InvalidInitializer(structure, type, arg);
          }
        } else if (arg !== undefined) {
          set.call(this, arg);
        }
      }
    };
    const constructor = this.createConstructor(structure);
    descriptors.$ = { get, set: initializer };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[Symbol.toPrimitive] = defineValue(get);
    return constructor;
  },
  finalizePrimitive(structure, staticDescriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors[BIT_SIZE] = defineValue(member.bitSize);
    staticDescriptors[PRIMITIVE] = defineValue(member.type);
  },
});

var slice = mixin({
  defineSlice(structure, descriptors) {
    const {
      align,
      flags,
      instance: {
        members: [ member ],
      },
    } = structure;
    const { byteSize: elementSize } = member;
    const thisEnv = this;
    const shapeDefiner = function(dv, length, allocator) {
      if (!dv) {
        dv = thisEnv.allocateMemory(length * elementSize, align, allocator);
      }
      this[MEMORY] = dv;
      this[LENGTH] = length;
    };
    const shapeChecker = function(arg, length) {
      if (length !== this[LENGTH]) {
        throw new ArrayLengthMismatch(structure, this, arg);
      }
    };
    const descriptor = this.defineMember(member);
    const { set } = descriptor;
    // the initializer behave differently depending on whether it's called by the
    // constructor or by a member setter (i.e. after object's shape has been established)
    const propApplier = this.createApplier(structure);
    const initializer = this.createInitializer(function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, arg.length, allocator);
        } else {
          shapeChecker.call(this, arg, arg.length);
        }
        copyObject(this, arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', VisitorFlag.Vivificate, arg);
        }
      } else if (typeof(arg) === 'string' && flags & SliceFlag.IsString) {
        initializer.call(this, { string: arg }, allocator);
      } else if (arg?.[Symbol.iterator]) {
        arg = transformIterable(arg);
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, arg.length, allocator);
        } else {
          shapeChecker.call(this, arg, arg.length);
        }
        let i = 0;
        for (const value of arg) {
          constructor[SENTINEL]?.validateValue(value, i, arg.length);
          set.call(this, i++, value, allocator);
        }
      } else if (typeof(arg) === 'number') {
        if (!this[MEMORY] && arg >= 0 && isFinite(arg)) {
          shapeDefiner.call(this, null, arg, allocator);
        } else {
          throw new InvalidArrayInitializer(structure, arg, !this[MEMORY]);
        }
      } else if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg, allocator) === 0) {
          throw new InvalidArrayInitializer(structure, arg);
        }
      } else if (arg !== undefined) {
        throw new InvalidArrayInitializer(structure, arg);
      }
    });
    const getSubArrayView = function(begin, end) {
      const length = this[LENGTH];
      const dv = this[MEMORY];
      begin = (begin === undefined) ? 0 : adjustIndex(begin, length);
      end = (end === undefined) ? length : adjustIndex(end, length);
      const offset = begin * elementSize;
      const len = (end * elementSize) - offset;
      return thisEnv.obtainView(dv.buffer, dv.byteOffset + offset, len);
    };
    const constructor = this.createConstructor(structure);
    descriptors.$ = { 
      get: function() { return getProxy(this, ProxyType.Slice) },
      set: initializer 
    };
    descriptors.length = { get: getLength };
    if (flags & SliceFlag.IsTypedArray) {
      descriptors.typedArray = this.defineTypedArray(structure);
      if (flags & SliceFlag.IsString) {
        descriptors.string = this.defineString(structure);
      }
      if (flags & SliceFlag.IsClampedArray) {
        descriptors.clampedArray = this.defineClampedArray(structure);
      }
    }
    descriptors.entries = descriptors[ENTRIES] = this.defineArrayEntries();
    descriptors.subarray = {
      value(begin, end) {
        const dv = getSubArrayView.call(this, begin, end);
        return constructor(dv);
      },
    };
    descriptors.slice = {
      value(begin, end, options = {}) {
        const {
          zig = false
        } = options;
        const dv1 = getSubArrayView.call(this, begin, end);
        const dv2 = thisEnv.allocateMemory(dv1.byteLength, align, zig);
        const slice = constructor(dv2);
        copyView(dv2, dv1);
        return slice;
      },
    };
    descriptors[Symbol.iterator] = this.defineArrayIterator();
    descriptors[SHAPE] = defineValue(shapeDefiner);
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = this.defineFinalizerArray(descriptor);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorArray(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArray();
    descriptors[PROXY] = {
      value() {
        return getProxy(this, ProxyType.Slice);
      }
    };    
    descriptors[PROXY_TYPE] = defineValue(ProxyType.Slice);
    return constructor;
  },
  finalizeSlice(structure, staticDescriptors) {
    const {
      flags,
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors.child = defineValue(member.structure.constructor);
    staticDescriptors[SENTINEL] = (flags & SliceFlag.HasSentinel) && this.defineSentinel(structure);
  },
});

function getLength() {
  return this[LENGTH];
}

function adjustIndex(index, len) {
  index = index | 0;
  if (index < 0) {
    index = len + index;
    if (index < 0) {
      index = 0;
    }
  } else {
    if (index > len) {
      index = len;
    }
  }
  return index;
}

var structLike = mixin({
  defineVivificatorStruct(structure) {
    const { instance: { members } } = structure;
    const objectMembers = {};
    for (const member of members.filter(m => m.type === MemberType.Object)) {
      objectMembers[member.slot] = member;
    }
    const thisEnv = this;
    return {
      value(slot) {
        const member = objectMembers[slot];
        const { bitOffset, byteSize, structure: { constructor } } = member;
        const dv = this[RESTORE]() ;
        const parentOffset = dv.byteOffset;
        const offset = parentOffset + (bitOffset >> 3);
        let len = byteSize;
        if (len === undefined) {
          if (bitOffset & 7) {
            throw new NotOnByteBoundary(member);
          }
          len = member.bitSize >> 3;
        }
        const childDV = thisEnv.obtainView(dv.buffer, offset, len, !dv[NO_CACHE]);
        const object = this[SLOTS][slot] = constructor.call(PARENT, childDV);
        return object;
      }
    };
  },
});

var struct = mixin({
  defineStruct(structure, descriptors) {
    const {
      purpose,
      flags,
      length,
      instance: { members },
    } = structure;
    const backingIntMember = members.find(m => m.flags & MemberFlag.IsBackingInt);
    const backingInt = backingIntMember && this.defineMember(backingIntMember);
    const propApplier = this.createApplier(structure);
    const initializer = this.createInitializer(function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        copyObject(this, arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', 0, arg);
        }
      } else if (arg && typeof(arg) === 'object') {
        propApplier.call(this, arg, allocator);
      } else if ((typeof(arg) === 'number' || typeof(arg) === 'bigint') && backingInt) {
        backingInt.set.call(this, arg);
      } else if (arg !== undefined) {
        throw new InvalidInitializer(structure, 'object', arg);
      }
    });
    const constructor = this.createConstructor(structure);
    // add descriptors of struct field
    const setters = descriptors[SETTERS].value;
    const keys = descriptors[KEYS].value;
    const props = [];
    for (const member of members.filter(m => !!m.name)) {
      const { name, flags } = member;
      const { set } = descriptors[name] = this.defineMember(member);
      if (set) {
        if (flags & MemberFlag.IsRequired) {
          set.required = true;
        }
        setters[name] = set;
        keys.push(name);
      }
      props.push(name);
    }
    descriptors.$ = { get: getSelf, set: initializer };
    // add length and entries if struct is a tuple
    descriptors.length = defineValue(length);
    descriptors.entries = (flags & StructFlag.IsTuple) && this.defineVectorEntries();
    // allow conversion of packed struct to number when there's a backing int
    descriptors[Symbol.toPrimitive] = backingInt && {
      value(hint) {
        return (hint === 'string')
          ? Object.prototype.toString.call(this)
          : backingInt.get.call(this);
      }
    };
    // add iterator
    descriptors[Symbol.iterator] = (purpose === StructurePurpose.Iterator)
    ? this.defineZigIterator()
    : (flags & StructFlag.IsTuple)
      ? this.defineVectorIterator()
      : this.defineStructIterator();
    descriptors[INITIALIZE] = defineValue(initializer);
    // for creating complex fields on access
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    // for operating on pointers contained in the struct
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(members);
    descriptors[ENTRIES] = (flags & StructFlag.IsTuple) ? this.defineVectorEntries() : this.defineStructEntries();
    descriptors[PROPS] = defineValue(props);
    if (purpose === StructurePurpose.Allocator) {
      descriptors.alloc = this.defineAlloc();
      descriptors.free = this.defineFree();
      descriptors.dupe = this.defineDupe();
    }
    return constructor;
  }
});

var union = mixin({
  defineUnion(structure, descriptors) {
    const {
      purpose,
      flags,
      instance: { members },
    } = structure;
    const exclusion = !!(flags & UnionFlag.HasSelector);
    const valueMembers = (exclusion) ? members.slice(0, -1) : members;
    const selectorMember = (exclusion) ? members[members.length - 1] : null;
    const { get: getSelector, set: setSelector } = this.defineMember(selectorMember);
    const { get: getSelectorNumber } = this.defineMember(selectorMember, false);
    const getActiveField = (flags & UnionFlag.HasTag)
    ? function() {
        const item = getSelector.call(this);
        return item[NAME];
      }
    : function() {
        const index = getSelector.call(this);
        return valueMembers[index].name;
      };
    const setActiveField = (flags & UnionFlag.HasTag)
    ? function(name) {
        const { constructor } = selectorMember.structure;
        setSelector.call(this, constructor[name]);
      }
    : function(name) {
        const index = valueMembers.findIndex(m => m.name === name);
        setSelector.call(this, index);
      };
    const propApplier = this.createApplier(structure);
    const initializer = this.createInitializer(function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        copyObject(this, arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', VisitorFlag.Vivificate, arg);
        }
      } else if (arg && typeof(arg) === 'object') {
        let found = 0;
        for (const key of props) {
          if (key in arg) {
            found++;
          }
        }
        if (found > 1) {
          throw new MultipleUnionInitializers(structure);
        }
        if (propApplier.call(this, arg, allocator) === 0) {
          throw new MissingUnionInitializer(structure, arg, exclusion);
        }
      } else if (arg !== undefined) {
        throw new InvalidInitializer(structure, 'object with a single property', arg);
      }
    });
    const constructor = this.createConstructor(structure);
    const getters = {};
    const setters = descriptors[SETTERS].value;
    const keys = descriptors[KEYS].value;
    const props = [];
    for (const member of valueMembers) {
      const { name } = member;
      const { get: getValue, set: setValue } = this.defineMember(member);
      const get = (exclusion)
      ? function() {
          const currentName = getActiveField.call(this);
          if (name !== currentName) {
            if (flags & UnionFlag.HasTag) {
              // tagged union allows inactive member to be queried
              return null;
            } else {
              // whereas bare union does not, since the condition is not detectable
              // when runtime safety is off
              throw new InactiveUnionProperty(structure, name, currentName);
            }
          }
          return getValue.call(this);
        }
      : getValue;
      const set = (exclusion && setValue)
      ? function(value) {
          const currentName = getActiveField.call(this);
          if (name !== currentName) {
            throw new InactiveUnionProperty(structure, name, currentName);
          }
          setValue.call(this, value);
        }
      : setValue;
      const init = (exclusion && setValue)
      ? function(value) {
          setActiveField.call(this, name);
          this[VISIT]?.('clear', VisitorFlag.IgnoreUncreated);
          setValue.call(this, value);
        }
      : setValue;
      descriptors[name] = { get, set };
      setters[name] = init;
      getters[name] = getValue;
      keys.push(name);
      props.push(name);
    }
    descriptors.$ = { get: function() { return this }, set: initializer };
    descriptors[Symbol.iterator] = (purpose === StructurePurpose.Iterator)
    ? this.defineZigIterator()
    : this.defineUnionIterator();
    descriptors[Symbol.toPrimitive] = (flags & UnionFlag.HasTag) && {
      value(hint) {
        switch (hint) {
          case 'string':
          case 'default':
            return getActiveField.call(this);
          default:
            return getSelectorNumber.call(this);
        }
      }
    };
    const { comptime } = this;
    descriptors[RESTRICT] = (flags & UnionFlag.HasInaccessible) && {
      value() {
        if (!comptime) {
          // pointers in non-tagged union are not accessible--we need to disable them
          this[VISIT](disablePointer);
        }
        // no need to visit them again
        this[VISIT] = empty;
        return this;
      }
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[TAG] = (flags & UnionFlag.HasTag) && { get: getSelector, set : setSelector };
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] =  (flags & StructureFlag.HasPointer) && this.defineVisitorUnion(valueMembers, (flags & UnionFlag.HasTag) ? getSelectorNumber : null);
    descriptors[ENTRIES] = this.defineUnionEntries();
    descriptors[PROPS] = (flags & UnionFlag.HasTag) ? {
      get() {
        return [ getActiveField.call(this) ];
      }
    } : defineValue(props);
    descriptors[GETTERS] = defineValue(getters);
    return constructor;
  },
  finalizeUnion(structure, staticDescriptors) {
    const {
      flags,
      instance: { members },
    } = structure;
    if (flags & UnionFlag.HasTag) {
      staticDescriptors.tag = defineValue(members[members.length - 1].structure.constructor);
    }
  }
});

function throwInaccessible() {
  throw new InaccessiblePointer();
}
function disablePointer() {
  const disabledProp = { get: throwInaccessible, set: throwInaccessible };
  defineProperties(this, {
    '*': disabledProp,
    '$': disabledProp,
    [TARGET]: disabledProp,
  });
}

var variadicStruct = mixin({
  defineVariadicStruct(structure, descriptors) {
    const {
      byteSize,
      align,
      flags,
      length,
      instance: { members },
    } = structure;
    const thisEnv = this;
    const argMembers = members.slice(1);
    const constructor = function(args) {
      if (args.length < length) {
        throw new ArgumentCountMismatch(length, args.length, true);
      }
      // calculate the actual size of the struct based on arguments given
      let totalByteSize = byteSize;
      let maxAlign = align;
      const varArgs = args.slice(length);
      const offsets = {};
      for (const [ index, arg ] of varArgs.entries()) {
        const dv = arg?.[MEMORY];
        const argAlign = Math.max(4, arg?.constructor?.[ALIGN])
        ;
        if (!dv || !argAlign) {
          const err = new InvalidVariadicArgument();
          throw adjustArgumentError(err, length + index);
        }
        if (argAlign > maxAlign) {
          maxAlign = argAlign;
        }
        // can't use alignForward() here, since that uses bigint when platform is 64-bit
        const byteOffset = offsets[index] = (totalByteSize + (argAlign - 1)) & ~(argAlign - 1);
        totalByteSize = byteOffset + dv.byteLength;
      }
      const attrs = new ArgAttributes(args.length);
      const dv = thisEnv.allocateMemory(totalByteSize, maxAlign);
      // attach the alignment so we can correctly shadow the struct
      dv[ALIGN] = maxAlign;
      this[MEMORY] = dv;
      this[SLOTS] = {};
      // copy fixed args
      thisEnv.copyArguments(this, args, argMembers);
      // set their attributes
      let maxSlot = -1;
      for (const [ index, { bitOffset, bitSize, type, slot, structure: { align } } ] of argMembers.entries()) {
        attrs.set(index, bitOffset >> 3, bitSize, align, type);
        if (slot > maxSlot) {
          maxSlot = slot;
        }
      }
      // create additional child objects and copy arguments into them
      for (const [ index, arg ] of varArgs.entries()) {
        const slot = maxSlot + index + 1;
        const { byteLength } = arg[MEMORY];
        const offset = offsets[index];
        const childDV = thisEnv.obtainView(dv.buffer, offset, byteLength);
        const child = this[SLOTS][slot] = arg.constructor.call(PARENT, childDV);
        const bitSize = arg.constructor[BIT_SIZE] ?? byteLength * 8;
        const align = arg.constructor[ALIGN];
        const type = arg.constructor[PRIMITIVE];
        child.$ = arg;
        // set attributes
        attrs.set(length + index, offset, bitSize, align, type);
      }
      this[ATTRIBUTES] = attrs;
    };
    for (const member of members) {
      descriptors[member.name] = this.defineMember(member);
    }
    const retvalSetter = descriptors.retval.set;
    const ArgAttributes = function(length) {
      this[MEMORY] = thisEnv.allocateMemory(length * 8, 4);
      this.length = length;
      this.littleEndian = thisEnv.littleEndian;
    };
    const setAttributes = function(index, offset, bitSize, align, type) {
      const dv = this[MEMORY];
      const le = thisEnv.littleEndian;
      dv.setUint16(index * 8, offset, le);
      dv.setUint16(index * 8 + 2, bitSize, le);
      dv.setUint16(index * 8 + 4, align, le);
      dv.setUint8(index * 8 + 6, type == MemberType.Float);
      dv.setUint8(index * 8 + 7, type == MemberType.Int || type == MemberType.Float);
    };
    defineProperties(ArgAttributes, {
      [ALIGN]: { value: 4 },
    });
    defineProperties(ArgAttributes.prototype, {
      set: defineValue(setAttributes),
    });
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = this.defineVisitorVariadicStruct(members);
    descriptors[RETURN] = defineValue(function(value) {
      retvalSetter.call(this, value, this[ALLOCATOR]);
    });
    {
      descriptors[UPDATE] = this.defineRetvalCopier(members[0]);
    }
    return constructor;
  },
  finalizeVariadicStruct(structure, staticDescriptors) {
    const { flags } = structure;
    staticDescriptors[THROWING] = defineValue(!!(flags & ArgStructFlag.IsThrowing));
    // variadic struct doesn't have a known alignment--we attach the necessary alignment to the
    // data view instead (see above)
    staticDescriptors[ALIGN] = defineValue(undefined);
  },
});

var vector = mixin({
  defineVector(structure, descriptors) {
    const {
      flags,
      length,
      instance: { members: [ member ] },
    } = structure;
    const propApplier = this.createApplier(structure);
    const initializer = this.createInitializer(function(arg) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        copyObject(this, arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', VisitorFlag.Vivificate, arg);
        }
      } else if (arg?.[Symbol.iterator]) {
        let argLen = arg.length;
        if (typeof(argLen) !== 'number') {
          arg = [ ...arg ];
          argLen = arg.length;
        }
        if (argLen !== length) {
          throw new ArrayLengthMismatch(structure, this, arg);
        }
        let i = 0;
        for (const value of arg) {
          this[i++] = value;
        }
      } else if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg) === 0) {
          throw new InvalidArrayInitializer(structure, arg);
        }
      } else if (arg !== undefined) {
        throw new InvalidArrayInitializer(structure, arg);
      }
    });
    const constructor = this.createConstructor(structure);
    const { bitSize: elementBitSize } = member;
    for (let i = 0, bitOffset = 0; i < length; i++, bitOffset += elementBitSize) {
      if (flags & StructureFlag.HasPointer) {
        descriptors[i] = this.defineMember({ ...member, slot: i });
      } else {
        descriptors[i] = this.defineMember({ ...member, bitOffset });
      }
    }
    descriptors.$ = { get: getSelf, set: initializer };
    descriptors.length = defineValue(length);
    if (flags & VectorFlag.IsTypedArray) {
      descriptors.typedArray = this.defineTypedArray(structure);
      if (flags & VectorFlag.IsClampedArray) {
        descriptors.clampedArray = this.defineClampedArray(structure);
      }
    }
    descriptors.entries = descriptors[ENTRIES] = this.defineVectorEntries();
    descriptors[Symbol.iterator] = this.defineVectorIterator();
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorArray(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArray();
    return constructor;
  },
  finalizeVector(structure, staticDescriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors.child = defineValue(member.structure.constructor);
  },
});

var fdLockGet = mixin({
  fdLockGet(fd, flockAddress, canWait) {
    const le = this.littleEndian;
    return catchPosixError(canWait, PosixError.EACCES, () => {      
      const [ stream ] = this.getStream(fd);
      if (hasMethod(stream, 'getlock')) {
        const flock = createView(24);
        this.moveExternBytes(flock, flockAddress, false);
        const type = flock.getUint16(0, le);
        const whence = flock.getUint16(2, le);
        const pid = flock.getUint32(4, le);
        const start = safeInt(flock.getBigInt64(8, le));
        const length = safeInt(flock.getBigUint64(16, le));
        return stream.getlock({ type, whence, start, length, pid });
      } 
    }, (lock) => {
      let flock;
      if (lock) {
        // conflict
        flock = createView(24);
        flock.setUint16(0, lock.type ?? 0, le);
        flock.setUint16(2, lock.whence ?? 0, le);
        flock.setUint32(4, lock.pid ?? 0, le);
        flock.setBigInt64(8, BigInt(lock.start ?? 0), le);
        flock.setBigUint64(16, BigInt(lock.length ?? 0), le);
      } else {
        // change type to unlock (2)
        flock = createView(2);
        flock.setUint16(0, 2, le);
      }
      this.moveExternBytes(flock, flockAddress, true);
    });
  },
});

var fdLockSet = mixin({
  fdLockSet(fd, flockAddress, wait, canWait) {
    const le = this.littleEndian;
    return catchPosixError(canWait, PosixError.EAGAIN, () => {
      const [ stream ] = this.getStream(fd);
      if (hasMethod(stream, 'setlock')) {
        const flock = createView(24);
        this.moveExternBytes(flock, flockAddress, false);
        const type = flock.getUint16(0, le);
        const whence = flock.getUint16(2, le);
        const pid = flock.getUint32(4, le);
        const start = safeInt(flock.getBigUint64(8, le));
        const len = safeInt(flock.getBigUint64(16, le));
        return stream.setlock({ type, whence, start, len, pid }, wait);
      } else {
        return true;
      }
    }, (set) => expectBoolean(set, PosixError.EAGAIN));
  },
});

var all = mixin({
  defineVisitor() {
    return {
      value(cb, flags, src) {
        let fn;
        if (typeof(cb) === 'string') {
          fn = builtinVisitors[cb];
        } else {
          fn = cb;
        }
        fn.call(this, flags, src);
      }
    };
  },
});

function visitChild(slot, cb, flags, src) {
  let child = this[SLOTS][slot];
  if (!child) {
    if (!(flags & VisitorFlag.IgnoreUncreated)) {
      child = this[VIVIFICATE](slot);
    } else {
      return;
    }
  }
  let srcChild;
  if (src) {
    srcChild = src[SLOTS][slot];
    if (!srcChild) {
      return;
    }
  }
  child[VISIT](cb, flags, srcChild);
}

const builtinVisitors = {
  copy(flags, src) {
    const target = src[SLOTS][0];
    if (this[MEMORY][ZIG]) {
      if (target && !target[MEMORY][ZIG]) {
        throw new ZigMemoryTargetRequired();
      }
    }
    this[SLOTS][0] = target;
  },
  clear(flags) {
    if (flags & VisitorFlag.IsInactive) {
      this[SLOTS][0] = undefined;
    }
  },
  reset() {
    this[SLOTS][0] = undefined;
    this[LAST_ADDRESS] = undefined;
  },
};

var inArgStruct = mixin({
  defineVisitorArgStruct(members) {
    const argSlots = [];
    let rvSlot = undefined;
    for (const [ index, { slot, structure } ] of members.entries()) {
      if (structure.flags & StructureFlag.HasPointer) {
        if (index === 0) {
          rvSlot = slot;
        } else {
          argSlots.push(slot);
        }
      }
    }
    return {
      value(cb, flags, src) {
        if (!(flags & VisitorFlag.IgnoreArguments) && argSlots.length > 0) {
          for (const slot of argSlots) {
            visitChild.call(this, slot, cb, flags | VisitorFlag.IsImmutable, src);
          }
        }
        if (!(flags & VisitorFlag.IgnoreRetval) && rvSlot !== undefined) {
          visitChild.call(this, rvSlot, cb, flags, src);
        }
      }
    };
  }
});

var inArray = mixin({
  defineVisitorArray() {
    return {
      value(cb, flags, src) {
        for (let slot = 0, len = this.length; slot < len; slot++) {
          visitChild.call(this, slot, cb, flags, src);
        }
      }
    };
  },
});

var inErrorUnion = mixin({
  defineVisitorErrorUnion(valueMember, getErrorNumber) {
    const { slot } = valueMember;
    return {
      value(cb, flags, src) {
        if (getErrorNumber.call(this)) {
          flags |= VisitorFlag.IsInactive;
        }
        if (!(flags & VisitorFlag.IsInactive) || !(flags & VisitorFlag.IgnoreInactive)) {
          visitChild.call(this, slot, cb, flags, src);
        }
      }
    };
  }
});

var inOptional = mixin({
  defineVisitorOptional(valueMember, getPresent) {
    const { slot } = valueMember;
    return {
      value(cb, flags, src) {
        if (!getPresent.call(this)) {
          flags |= VisitorFlag.IsInactive;
        }
        if (!(flags & VisitorFlag.IsInactive) || !(flags & VisitorFlag.IgnoreInactive)) {
          visitChild.call(this, slot, cb, flags, src);
        }
      }
    };
  }
});

var inStruct = mixin({
  defineVisitorStruct(members) {
    const slots = members.filter(m => m.structure?.flags & StructureFlag.HasPointer).map(m => m.slot);
    return {
      value(cb, flags, src) {
        for (const slot of slots) {
          visitChild.call(this, slot, cb, flags, src);
        }
      }
    };
  }
});

var inUnion = mixin({
  defineVisitorUnion(members, getSelectorNumber) {
    const pointers = [];
    for (const [ index, { slot, structure } ] of members.entries()) {
      if (structure?.flags & StructureFlag.HasPointer) {
        pointers.push({ index, slot });
      }
    }
    return {
      value(cb, flags, src) {
        const selected = getSelectorNumber?.call(this);
        for (const { index, slot } of pointers) {
          let fieldFlags = flags;
          if (index !== selected) {
            fieldFlags |= VisitorFlag.IsInactive;
          }
          if (!(fieldFlags & VisitorFlag.IsInactive) || !(fieldFlags & VisitorFlag.IgnoreInactive)) {
            visitChild.call(this, slot, cb, fieldFlags, src);
          }
        }
      }
    };
  }
});

var inVariadicStruct = mixin({
  defineVisitorVariadicStruct(members) {
    const rvMember = members[0];
    const rvSlot = (rvMember.structure.flags & StructureFlag.HasPointer) ? rvMember.slot : undefined;
    return {
      value(cb, flags, src) {
        if (!(flags & VisitorFlag.IgnoreArguments)) {
          for (const [ slot, child ] of Object.entries(this[SLOTS])) {
            if (slot !== rvSlot && VISIT in child) {
              visitChild.call(this, slot, cb, flags | VisitorFlag.IsImmutable, src);
            }
          }
        }
        if (!(flags & VisitorFlag.IgnoreRetval) && rvSlot !== undefined) {
          visitChild.call(this, rvSlot, cb, flags, src);
        }
      }
    };
  }
});

// generated by rollup.config.js

var mixins = /*#__PURE__*/Object.freeze({
  __proto__: null,
  AccessorAll: all$3,
  AccessorBigInt: bigInt,
  AccessorBigUint: bigUint,
  AccessorBool: bool$1,
  AccessorFloat128: float128,
  AccessorFloat16: float16,
  AccessorFloat80: float80,
  AccessorInt: int$1,
  AccessorJumbo: jumbo,
  AccessorJumboInt: jumboInt,
  AccessorJumboUint: jumboUint,
  AccessorUint: uint$1,
  AccessorUnaligned: unaligned,
  AccessorUnalignedBool1: unalignedBool1,
  AccessorUnalignedInt: unalignedInt,
  AccessorUnalignedUint: unalignedUint,
  FeatureAllocatorMethods: allocatorMethods,
  FeatureBaseline: baseline,
  FeatureCallMarshalingInbound: callMarshalingInbound,
  FeatureCallMarshalingOutbound: callMarshalingOutbound,
  FeatureDirConversion: dirConversion,
  FeatureIntConversion: intConversion,
  FeatureMemoryMapping: memoryMapping,
  FeatureModuleLoading: moduleLoading,
  FeatureObjectLinkage: objectLinkage,
  FeaturePointerSynchronization: pointerSynchronization,
  FeatureReaderConversion: readerConversion,
  FeatureRuntimeSafety: runtimeSafety,
  FeatureStreamLocation: streamLocation,
  FeatureStreamRedirection: streamRedirection,
  FeatureStructureAcquisition: structureAcquisition,
  FeatureThunkAllocation: thunkAllocation,
  FeatureViewManagement: viewManagement,
  FeatureWorkerSupport: workerSupport,
  FeatureWriteProtection: writeProtection,
  FeatureWriterConversion: writerConversion,
  IteratorForArray: forArray,
  IteratorForStruct: forStruct,
  IteratorForUnion: forUnion,
  IteratorForVector: forVector,
  IteratorForZig: forZig,
  MemberAll: all$2,
  MemberBase64: base64,
  MemberBool: bool,
  MemberClampedArray: clampedArray,
  MemberDataView: dataView,
  MemberFloat: float,
  MemberInt: int,
  MemberLiteral: literal,
  MemberNull: _null,
  MemberObject: object,
  MemberPrimitive: primitive$1,
  MemberRetval: retval,
  MemberSentinel: sentinel,
  MemberString: string,
  MemberToJson: toJson,
  MemberType: type,
  MemberTypedArray: typedArray,
  MemberUint: uint,
  MemberUndefined: _undefined,
  MemberUnsupported: unsupported,
  MemberValueOf: valueOf,
  MemberVoid: _void,
  StructureAbortSignal: abortSignal,
  StructureAll: all$1,
  StructureAllocator: allocator,
  StructureArgStruct: argStruct,
  StructureArray: array,
  StructureArrayLike: arrayLike,
  StructureDir: dir,
  StructureEnum: _enum,
  StructureErrorSet: errorSet,
  StructureErrorUnion: errorUnion,
  StructureFile: file,
  StructureFunction: _function,
  StructureGenerator: generator,
  StructureOpaque: opaque,
  StructureOptional: optional,
  StructurePointer: pointer,
  StructurePrimitive: primitive,
  StructurePromise: promise,
  StructureReader: reader,
  StructureSlice: slice,
  StructureStruct: struct,
  StructureStructLike: structLike,
  StructureUnion: union,
  StructureVariadicStruct: variadicStruct,
  StructureVector: vector,
  StructureWriter: writer,
  SyscallCopyInt: copyInt,
  SyscallCopyStat: copyStat,
  SyscallEnvironGet: environGet,
  SyscallEnvironSizesGet: environSizesGet,
  SyscallFdAdvise: fdAdvise,
  SyscallFdAllocate: fdAllocate,
  SyscallFdClose: fdClose,
  SyscallFdDatasync: fdDatasync,
  SyscallFdFdstatGet: fdFdstatGet,
  SyscallFdFdstatSetFlags: fdFdstatSetFlags,
  SyscallFdFdstatSetRights: fdFdstatSetRights,
  SyscallFdFilestatGet: fdFilestatGet,
  SyscallFdFilestatSetTimes: fdFileStatSetTimes,
  SyscallFdLockGet: fdLockGet,
  SyscallFdLockSet: fdLockSet,
  SyscallFdPread: fdPread,
  SyscallFdPrestatDirName: fdPrestatDirName,
  SyscallFdPrestatGet: fdPrestatGet,
  SyscallFdPwrite: fdPwrite,
  SyscallFdRead: fdRead,
  SyscallFdReaddir: fdReaddir,
  SyscallFdSeek: fdSeek,
  SyscallFdSync: fdSync,
  SyscallFdTell: fdTell,
  SyscallFdWrite: fdWrite,
  SyscallPathCreateDirectory: pathCreateDirectory,
  SyscallPathFilestatGet: pathFilestatGet,
  SyscallPathFilestatSetTimes: pathFilestatSetTimes,
  SyscallPathOpen: pathOpen,
  SyscallPathRemoveDirectory: pathRemoveDirectory,
  SyscallPathUnlinkFile: pathUnlinkFile,
  SyscallPollOneoff: pollOneoff,
  SyscallProcExit: procExit,
  SyscallRandomGet: randomGet,
  VisitorAll: all,
  VisitorInArgStruct: inArgStruct,
  VisitorInArray: inArray,
  VisitorInErrorUnion: inErrorUnion,
  VisitorInOptional: inOptional,
  VisitorInStruct: inStruct,
  VisitorInUnion: inUnion,
  VisitorInVariadicStruct: inVariadicStruct
});

const MagicNumber = 0x6d736100;
const Version = 1;
const SectionType = {
  Custom: 0,
  Import: 2,
  Function: 3,
  Export: 7,
  Start: 8,
  Element: 9,
  Code: 10};
const ObjectType = {
  Function: 0,
  Table: 1,
  Memory: 2,
  Global: 3,
};

function stripUnused(binary, options = {}) {
  const {
    keepNames = false,
  } = options;
  const { sections, size } = parseBinary(binary);
  const blacklist = [
    /^getFactoryThunk$/,
    /^getModuleAttributes$/,
    /^exporter\.getFactoryThunk/,
  ];

  function getSection(type) {
    return sections.find(s => s.type === type);
  }

  const nameSection = sections.find(s => s.type === SectionType.Custom && s.name === 'name');
  const { moduleName, functionNames, localNames } = parseNames(nameSection);
  const functions = [];
  // allocate indices for imported functions first
  const importSection = sections.find(s => s.type === SectionType.Import);
  if (importSection) {
    for (const object of importSection.imports) {
      if (object.type === ObjectType.Function) {
        const index = functions.length;
        functions[index] = {
          type: 'imported',
          name: functionNames[index],
          descriptor: object,
          typeIndex: object.type,
          using: undefined,
          index,
          newIndex: -1,
        };
      }
    }
  }
  // allocate indices for internal functions
  const funcSection = getSection(SectionType.Function);
  const codeSection = getSection(SectionType.Code);
  if (funcSection && codeSection) {
    for (const [ i, typeIndex ] of funcSection.types.entries()) {
      const code = codeSection.functions[i];
      const index = functions.length;
      let parsed = null;
      const fn = {
        type: 'internal',
        name: functionNames[index],
        typeIndex,
        code,
        using: undefined,
        index,
        newIndex: -1,

        get instructions() {
          if (!parsed) {
            parsed = parseFunction(this.code);
          }
          return parsed.instructions;
        },
        get size() {
          return parsed.size;
        },
        get locals() {
          return parsed.locals;
        },
      };
      functions.push(fn);
    }
  }

  if (functionNames.length === 0) {
    // get the names from the export and import section if they're missing
    const exportSection = getSection(SectionType.Export);
    if (exportSection) {
      for (const object of exportSection.exports) {
        if (object.type === ObjectType.Function) {
          const fn = functions[object.index];
          fn.name = object.name;
        }
      }
    }
    const importSection = getSection(SectionType.Import);
    if (importSection) {
      for (const object of importSection.imports) {
        if (object.type === ObjectType.Function) {
          const fn = functions[object.index];
          fn.name = object.name;
        }
      }
    }
  }

  // mark blacklisted functions as unused
  for (const fn of functions) {
    if (fn.name && blacklist.some(re => re.test(fn.name))) {
      if (fn.name === 'getFactoryThunk' && functionNames.length === 0) {
        // when compiled for ReleaseSmall, we don't get the name section
        // therefore unable to remove the factory function by name
        // we know that getFactoryThunk loads its address, however
        // and that a function pointer is just an index into table 0
        const ops = fn.instructions;
        if (ops.length === 2 && ops[0].opcode === 0x41 && ops[1].opcode === 0x0B) {
          // 0x41 is i32.const
          // 0x0B is end
          const elemIndex = ops[0].operand;
          const elemSection = getSection(SectionType.Element);
          for (const segment of elemSection.segments) {
            if (segment.indices) {
              const funcIndex = segment.indices[elemIndex - 1];
              const fn = functions[funcIndex];
              fn.using = false;
            }
          }
        }
      }
    }
  }

  function useFunction(index) {
    const fn = functions[index];
    /* c8 ignore next 3 */
    if (!fn) {
      throw new Error(`Function #${index} does not exist`);
    }
    if (fn.using === undefined) {
      fn.using = true;
      if (fn.type === 'internal') {
        // mark all functions called by this one as being in-use as well
        for (const { opcode, operand } of fn.instructions) {
          switch (opcode) {
            case 0x10:    // function call
            case 0x12:    // return call
            case 0xD2: {  // function reference
              useFunction(operand);
            } break;
          }
        }
      }
    }
  }

  // mark functions in table elements as used
  const elemSection = getSection(SectionType.Element);
  if (elemSection) {
    for (const segment of elemSection.segments) {
      if (segment.indices) {
        for (const index of segment.indices) {
          useFunction(index);
        }
      }
    }
  }

  // mark exported functions as being in-use
  const exportSection = getSection(SectionType.Export);
  if (exportSection) {
    for (const object of exportSection.exports) {
      if (object.type === ObjectType.Function) {
        useFunction(object.index);
      }
    }
  }

  // mark start function as being in-use
  const startSection = getSection(SectionType.Start);
  if (startSection) {
    useFunction(startSection.funcidx);
  }

  // assign new indices to functions
  const newFunctions = [];
  for (const fn of functions) {
    if (fn.using) {
      fn.newIndex = newFunctions.length;
      newFunctions.push(fn);
    }
  }

  // update call instructions with new indices
  for (const fn of newFunctions) {
    if (fn.type === 'internal') {
      for (const op of fn.instructions) {
        switch (op.opcode) {
          case 0x10:    // function call
          case 0x12:    // return call
          case 0xD2: {  // function reference
            const target = functions[op.operand];
            op.operand = target.newIndex;
          } break;
        }
      }
      fn.code = repackFunction(fn);
    }
  }

  // create new code and function section
  const newCodeSection = { type: SectionType.Code, functions: [] };
  const newFuncSection = { type: SectionType.Function, types: [] };
  for (const fn of newFunctions) {
    if (fn.type === 'internal') {
      newCodeSection.functions.push(fn.code);
      newFuncSection.types.push(fn.typeIndex);
    }
  }

  // create new element section
  let newElementSection = null;
  if (elemSection) {
    newElementSection = { type: SectionType.Element, segments: [] };
    for (const segment of elemSection.segments) {
      if (segment.indices) {
        const indices = segment.indices.map((index) => {
          const fn = functions[index];
          return (fn.using) ? fn.newIndex : 0;
        });
        newElementSection.segments.push({ ...segment, indices });
        /* c8 ignore next 3 */
      } else {
        newElementSection.segments.push(segment);
      }
    }
  }
  // create new export section
  let newExportSection = null;
  if (exportSection) {
    newExportSection = { type: SectionType.Export, exports: [] };
    for (const object of exportSection.exports) {
      if (object.type === ObjectType.Function) {
        const fn = functions[object.index];
        if (fn.using) {
          const { name, type } = object;
          const index = fn.newIndex;
          newExportSection.exports.push({ name, type, index });
        }
      } else {
        newExportSection.exports.push(object);
      }
    }
  }
  // create new import section
  let newImportSection = null;
  if (importSection) {
    newImportSection = { type: SectionType.Import, imports: [] };
    let fnIndex = 0;
    for (const object of importSection.imports) {
      if (object.type === ObjectType.Function) {
        const fn = functions[fnIndex++];
        if (fn.using) {
          newImportSection.imports.push(object);
        }
        /* c8 ignore next 3 */
      } else {
        newImportSection.imports.push(object);
      }
    }
  }
  // create new start section
  let newStartSection = null;
  if (startSection) {
    const fn = functions[startSection.funcidx];
    newStartSection = { type: SectionType.Start, funcidx: fn.newIndex };
  }
  // create new name section
  let newNameSection = null;
  if (nameSection && keepNames) {
    const newFunctionNames = [];
    const newLocalNames = [];
    for (const fn of newFunctions) {
      newFunctionNames.push(fn.name);
      /* c8 ignore next 3 -- can't find a file with local names */
      if (localNames.length > 0) {
        newLocalNames.push(localNames[fn.index]);
      }
    }
    const data = repackNames({
      moduleName,
      functionNames: newFunctionNames,
      localNames: newLocalNames,
      size: nameSection.data.byteLength,
    });
    newNameSection = { type: SectionType.Custom, name: 'name', data };
  }

  // create new module sections
  const newSections = [];
  for (const section of sections) {
    switch (section.type) {
      case SectionType.Code:
        newSections.push(newCodeSection);
        break;
      case SectionType.Function:
        newSections.push(newFuncSection);
        break;
      case SectionType.Element:
        newSections.push(newElementSection);
        break;
      case SectionType.Export:
        newSections.push(newExportSection);
        break;
      case SectionType.Import:
        newSections.push(newImportSection);
        break;
      case SectionType.Start:
        newSections.push(newStartSection);
        break;
      case SectionType.Custom:
        if (section.name === 'name' && newNameSection) {
          newSections.push(newNameSection);
        }
        break;
      default:
        newSections.push(section);
        break;
    }
  }
  return repackBinary({ sections: newSections, size });
}

function parseBinary(binary) {
  const {
    eof,
    readBytes,
    readU8,
    readU32,
    readString,
    readArray,
    readU32Leb128,
    readExpression,
    readLimits,
    readCustom,
  } = createReader(binary);
  const magic = readU32();
  if (magic !== MagicNumber) {
    throw new Error(`Incorrect magic number: ${magic.toString(16)}`);
  }
  const version = readU32();
  if (version !== Version) {
    throw new Error(`Incorrect version: ${version}`);
  }
  const sections = [];
  while(!eof()) {
    sections.push(readSection());
  }
  const size = binary.byteLength;
  return { sections, size };

  function readSection() {
    const type = readU8();
    const len = readU32Leb128();
    switch(type) {
      case SectionType.Custom:
        const { name, data } = readCustom(len);
        return { type, name, data };
      case SectionType.Import: {
        const imports = readArray(() => {
          const module = readString();
          const name = readString();
          const type = readU8();
          switch (type) {
            case ObjectType.Function: {
              const index = readU32Leb128();
              return { module, name, type, index };
            }
            case ObjectType.Table: {
              const reftype = readU8();
              const limits = readLimits();
              return { module, name, type, reftype, limits };
            }
            case ObjectType.Memory: {
              const limits = readLimits();
              return { module, name, type, limits };
            }
            case ObjectType.Global: {
              const valtype = readU8();
              const mut = readU8();
              return { module, name, type, valtype, mut };
            }
            /* c8 ignore next 3 */
            default: {
              throw new Error(`Unknown object type: ${type}`);
            }
          }
        });
        return { type, imports };
      }
      case SectionType.Export: {
        const exports = readArray(() => {
          const name = readString();
          const type = readU8();
          const index = readU32Leb128();
          return { name, type, index };
        });
        return { type, exports };
      }
      case SectionType.Function: {
        const types = readArray(readU32Leb128);
        return { type, types };
      }
      case SectionType.Code: {
        const functions = readArray(() => {
          const len = readU32Leb128();
          return readBytes(len);
        });
        return { type, functions };
      }
      case SectionType.Element: {
        const segments = readArray(() => {
          const type = readU32Leb128();
          switch (type) {
            case 0: {
              const expr = readExpression();
              const indices = readArray(readU32Leb128);
              return { type, expr, indices };
            }
            case 1: {
              const kind = readU8();
              const indices = readArray(readU32Leb128);
              return { type, kind, indices };
            }
            case 2: {
              const tableidx = readU32Leb128();
              const expr = readExpression();
              const kind = readU8();
              const indices = readArray(readU32Leb128);
              return { type, tableidx, expr, kind, indices };
            }
            case 3: {
              const kind = readU8();
              const indices = readArray(readU32Leb128);
              return { type, kind, indices };
            }
            case 4: {
              const expr = readExpression();
              const entries = readArray(readExpression);
              return { type, expr, entries };
            }
            case 5: {
              const reftype = readU8();
              const entries = readArray(readExpression);
              return { type, reftype, entries };
            }
            case 6: {
              const tableidx = readU32Leb128();
              const expr = readExpression();
              const reftype = readU8();
              const entries = readArray(readExpression);
              return { type, tableidx, expr, reftype, entries };
            }
            case 7: {
              const reftype = readU8();
              const entries = readArray(readExpression);
              return { type, reftype, entries };
            }
          }
        });
        return { type, segments };
      }
      case SectionType.Start: {
        const funcidx = readU32Leb128();
        return { type, funcidx };
      }
      default: {
        const data = readBytes(len);
        return { type, data };
      }
    }
    /* c8 ignore next -- unreachable */
  }
}

function extractLimits(binary) {
  const {
    eof,
    skip,
    readU8,
    readU32,
    readString,
    readU32Leb128,
    readLimits,
  } = createReader(binary);
  const magic = readU32();
  /* c8 ignore next 3 */
  if (magic !== MagicNumber) {
    throw new Error(`Incorrect magic number: ${magic.toString(16)}`);
  }
  const version = readU32();
  /* c8 ignore next 3 */
  if (version !== Version) {
    throw new Error(`Incorrect version: ${version}`);
  }
  let memoryInitial, memoryMax, tableInitial, done = false;
  while(!eof() && !done) {
    const type = readU8();
    const len = readU32Leb128();
    if (type === SectionType.Import) {
      const count = readU32Leb128();
      for (let i = 0; i < count && !done; i++) {
        const module = readString();
        const name = readString();
        const type = readU8();
        switch (type) {
          /* c8 ignore next 3 */
          case ObjectType.Function: {
            readU32Leb128();
          } break;
          case ObjectType.Table: {
            readU8();
            const { min } = readLimits();
            if (module === 'env' && name === '__indirect_function_table') {
              tableInitial = min;
            }
          } break;
          case ObjectType.Memory: {
            const { min, max } = readLimits();
            if (module === 'env' && name === 'memory') {
              memoryInitial = min;
              memoryMax = max;
            }
          } break;
          /* c8 ignore next 4 */
          case ObjectType.Global: {
            readU8();
            readU8();
          } break;
          /* c8 ignore next 3 */
          default: {
            throw new Error(`Unknown object type: ${type}`);
          }
        }
      }
      done = tableInitial !== undefined && memoryInitial !== undefined;
    } else {
      skip(len);
    }
  }
  return { memoryMax, memoryInitial, tableInitial };
}

function repackBinary(module) {
  const {
    finalize,
    writeBytes,
    writeU8,
    writeU32,
    writeLength,
    writeString,
    writeArray,
    writeU32Leb128,
    writeExpression,
    writeLimits,
    writeCustom,
  } = createWriter(module.size);
  writeU32(MagicNumber);
  writeU32(Version);
  for (const section of module.sections) {
    writeSection(section);
  }
  return finalize();

  function writeSection(section) {
    writeU8(section.type);
    writeLength(() => {
      switch(section.type) {
        case SectionType.Custom: {
          writeCustom(section);
        } break;
        case SectionType.Import: {
          writeArray(section.imports, (object) => {
            writeString(object.module);
            writeString(object.name);
            writeU8(object.type);
            switch (object.type) {
              case ObjectType.Function: {
                writeU32Leb128(object.index);
              } break;
              case ObjectType.Table: {
                writeU8(object.reftype);
                writeLimits(object.limits);
              } break;
              case ObjectType.Memory: {
                writeLimits(object.limits);
              } break;
              case ObjectType.Global: {
                writeU8(object.valtype);
                writeU8(object.mut);
              } break;
            }
          });
        } break;
        case SectionType.Export: {
          writeArray(section.exports, (object) => {
            writeString(object.name);
            writeU8(object.type);
            writeU32Leb128(object.index);
          });
        } break;
        case SectionType.Function: {
          writeArray(section.types, writeU32Leb128);
        } break;
        case SectionType.Code: {
          writeArray(section.functions, (code) => {
            writeU32Leb128(code.byteLength);
            writeBytes(code);
          });
        } break;
        case SectionType.Element: {
          writeArray(section.segments, (segment) => {
            writeU32Leb128(segment.type);
            switch (segment.type) {
              case 0: {
                writeExpression(segment.expr);
                writeArray(segment.indices, writeU32Leb128);
              } break;
              case 1: {
                writeU8(segment.kind);
                writeArray(segment.indices, writeU32Leb128);
              } break;
              case 2: {
                writeU32Leb128(segment.tableidx);
                writeExpression(segment.expr);
                writeU8(segment.kind);
                writeArray(segment.indices, writeU32Leb128);
              } break;
              case 3: {
                writeU8(segment.kind);
                writeArray(segment.indices, writeU32Leb128);
              } break;
              case 4: {
                writeExpression(segment.expr);
                writeArray(segment.entries, writeExpression);
              } break;
              case 5: {
                writeU8(segment.reftype);
                writeArray(segment.entries, writeExpression);
              } break;
              case 6: {
                writeU32Leb128(segment.tableidx);
                writeExpression(segment.expr);
                writeU8(segment.reftype);
                writeArray(segment.entries, writeExpression);
              } break;
              case 7: {
                writeU8(segment.reftype);
                writeArray(segment.entries, writeExpression);
              } break;
            }
          });
        } break;
        case SectionType.Start: {
          writeU32Leb128(section.funcidx);
        } break;
        default: {
          writeBytes(section.data);
        }
      }
    });
  }
}

function createReader(dv) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  let offset = 0;

  function eof() {
    return (offset >= dv.byteLength);
  }

  function skip(len) {
    offset += len;
  }

  function readBytes(len) {
    const bytes = new DataView(dv.buffer, dv.byteOffset + offset, len);
    offset += len;
    return bytes;
  }

  function readU8() {
    return dv.getUint8(offset++);
  }

  function readU32() {
    const value = dv.getUint32(offset, true);
    offset += 4;
    return value;
  }

  function readF64() {
    const value = dv.getFloat64(offset, true);
    offset += 8;
    return value;
  }

  function readString() {
    const len = readU32Leb128();
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset + offset, len);
    offset += len;
    return decoder.decode(bytes);
  }

  function readArray(cb) {
    const len = readU32Leb128();
    const array = [];
    for (let i = 0; i < len; i++) {
      array.push(cb());
    }
    return array;
  }

  function readU32Leb128() {
    let value = 0;
    let shift = 0;
    while (true) {
      const byte = readU8();
      value |= (byte & 0x7f) << shift;
      shift += 7;
      if ((0x80 & byte) === 0) {
        if (value < 0) {
          value += 2 ** 32;
        }
        return value;
      }
    }
  }

  function readI32Leb128() {
    let value = 0;
    let shift = 0;
    while (true) {
      const byte = dv.getUint8(offset++);
      value |= (byte & 0x7f) << shift;
      shift += 7;
      if ((0x80 & byte) === 0) {
        if (shift < 32 && (byte & 0x40) !== 0) {
          return value | (-1 << shift);
        }
        return value;
      }
    }
  }

  function readI64Leb128() {
    let value = 0n;
    let shift = 0n;
    while (true) {
      const byte = dv.getUint8(offset++);
      value |= BigInt(byte & 0x7f) << shift;
      shift += 7n;
      if ((0x80 & byte) === 0) {
        if ((byte & 0x40) !== 0) {
          return value | (~0n << shift);
        }
        return value;
      }
    }
  }

  function readExpression() {
    const start = offset;
    const { decodeNext } = createDecoder(self);
    let op;
    while (op = decodeNext()) {
      if (op.opcode === 0x0B) {
        break;
      }
    }
    const len = offset - start;
    return new DataView(dv.buffer, dv.byteOffset + start, len);
  }

  function readLimits() {
    const flags = readU8();
    const min = readU32Leb128();
    let max = undefined;
    let shared = undefined;
    if (flags & 0x01) {
      max = readU32Leb128();
    }
    if (flags & 0x02) {
      shared = true;
    }
    return { flags, min, max, shared };
  }

  function readCustom(len) {
    const offsetBefore = offset;
    const name = readString();
    const nameLen = offset - offsetBefore;
    const data = readBytes(len - nameLen);
    return { name, data };
  }

  const self = {
    eof,
    skip,
    readBytes,
    readU8,
    readU32,
    readF64,
    readString,
    readArray,
    readU32Leb128,
    readI32Leb128,
    readI64Leb128,
    readExpression,
    readLimits,
    readCustom,
  };
  return self;
}

function createWriter(maxSize) {
  const dv = new DataView(new ArrayBuffer(maxSize));
  const encoder = new TextEncoder();
  let offset = 0, lengthChecking = false;

  function finalize() {
    return new DataView(dv.buffer, 0, offset);
  }

  function writeBytes(bytes) {
    for (let i = 0; i < bytes.byteLength; i++) {
      writeU8(bytes.getUint8(i));
    }
  }

  function writeU8(value) {
    if (!lengthChecking) {
      dv.setUint8(offset, value);
    }
    offset++;
  }

  function writeU32(value) {
    if (!lengthChecking) {
      dv.setUint32(offset, value, true);
    }
    offset += 4;
  }

  function writeF64(value) {
    if (!lengthChecking) {
      dv.setFloat64(offset, value, true);
    }
    offset += 8;
  }

  function writeString(string) {
    const bytes = encoder.encode(string);
    writeU32Leb128(bytes.length);
    for (const byte of bytes) {
      writeU8(byte);
    }
  }

  function writeArray(values, cb) {
    writeU32Leb128(values.length);
    for (const value of values) {
      cb(value);
    }
  }

  function writeU32Leb128(value) {
    while (true) {
      const byte = value & 0x7f;
      value >>>= 7;
      if (value === 0) {
        writeU8(byte);
        return;
      }
      writeU8(byte | 0x80);
    }
  }

  function writeI32Leb128(value) {
    while (true) {
      const byte = value & 0x7f;
      value >>= 7;
      if ((value === 0 && (byte & 0x40) === 0) || (value === -1 && (byte & 0x40) !== 0)) {
        writeU8(byte);
        return;
      }
      writeU8(byte | 0x80);
    }
  }

  function writeI64Leb128(value) {
    while (true) {
      const byte = Number(value & 0x7fn);
      value >>= 7n;
      if ((value === 0n && (byte & 0x40) === 0) || (value === -1n && (byte & 0x40) !== 0)) {
        writeU8(byte);
        return;
      }
      writeU8(byte | 0x80);
    }
  }

  function writeLength(cb) {
    const saved = offset;
    lengthChecking = true;
    cb();
    const length = offset - saved;
    offset = saved;
    lengthChecking = false;
    writeU32Leb128(length);
    cb();
  }

  function writeExpression(code) {
    writeBytes(code);
  }

  function writeLimits(limits) {
    writeU8(limits.flags);
    writeU32Leb128(limits.min);
    if (limits.max !== undefined) {
      writeU32Leb128(limits.max);
    }
  }

  function writeCustom({ name, data }) {
    writeString(name);
    writeBytes(data);
  }

  return {
    finalize,
    writeBytes,
    writeU8,
    writeU32,
    writeF64,
    writeString,
    writeArray,
    writeU32Leb128,
    writeI32Leb128,
    writeI64Leb128,
    writeExpression,
    writeLimits,
    writeCustom,
    writeLength,
  };
}

function parseFunction(dv) {
  const reader = createReader(dv);
  const {
    readU8,
    readArray,
    readU32Leb128,
  } = reader;
  // read locals first
  const locals = readArray(() => {
    const number = readU32Leb128();
    const type = readU8();
    return { number, type };
  });
  // decode the expression
  const { decodeNext } = createDecoder(reader);
  const instructions = [];
  let op;
  while (op = decodeNext()) {
    instructions.push(op);
  }
  const size = dv.byteLength;
  return { locals, instructions, size };
}

function createDecoder(reader) {
  const {
    eof,
    readBytes,
    readU8,
    readArray,
    readU32Leb128,
    readI32Leb128,
    readI64Leb128,
    readU32,
    readF64,
  } = reader;
  const readOne = readU32Leb128;
  const readTwo = () => [ readOne(), readOne() ];
  const readMultiple = (count) => {
    const indices = [];
    for (let i = 0; i < count; i++) {
      indices.push(readOne());
    }
    return indices;
  };
  const operandReaders = {
    0x02: readI32Leb128,
    0x03: readI32Leb128,
    0x04: readI32Leb128,
    0x05: readI32Leb128,
    0x0C: readOne,
    0x0D: readOne,
    0x0E: () => [ readArray(readOne), readU32Leb128() ],

    0x10: readOne,
    0x11: readTwo,
    0x12: readOne,
    0x13: readTwo,

    0x1C: () => readArray(readU8),

    0x20: readOne,
    0x21: readOne,
    0x22: readOne,
    0x23: readOne,
    0x24: readOne,
    0x25: readOne,
    0x26: readOne,
    0x28: readTwo,
    0x29: readTwo,
    0x2A: readTwo,
    0x2B: readTwo,
    0x2C: readTwo,
    0x2D: readTwo,
    0x2E: readTwo,
    0x2F: readTwo,

    0x30: readTwo,
    0x31: readTwo,
    0x32: readTwo,
    0x33: readTwo,
    0x34: readTwo,
    0x35: readTwo,
    0x36: readTwo,
    0x37: readTwo,
    0x38: readTwo,
    0x39: readTwo,
    0x3A: readTwo,
    0x3B: readTwo,
    0x3C: readTwo,
    0x3D: readTwo,
    0x3E: readTwo,
    0x3F: readOne,

    0x40: readOne,
    0x41: readI32Leb128,
    0x42: readI64Leb128,
    0x43: readU32,  // avoid precision loss due to float-to-double conversion
    0x44: readF64,

    0xD0: readU8,
    0xD2: readOne,

    0xFC: () => {
      const op1 = readOne();
      switch (op1) {
        case 9:
        case 11:
        case 13:
        case 15:
        case 16:
        case 17:
          return [ op1, readOne() ];
        case 8:
        case 10:
        case 12:
        case 14:
          return [ op1, readOne(), readOne() ];
        default:
          return op1;
      }
    },
    0xFD: () => {
      const op1 = readOne();
      switch (op1) {
        case 21:
        case 22:
        case 23:
        case 24:
        case 25:
        case 26:
        case 27:
        case 28:
        case 29:
        case 30:
        case 31:
        case 32:
        case 33:
        case 34:
          return [ op1, readOne() ];
        case 0:
        case 1:
        case 2:
        case 3:
        case 5:
        case 6:
        case 7:
        case 8:
        case 9:
        case 10:
        case 11:
        case 92:
        case 93:
          return [ op1, readOne(), readOne() ];
        case 84:
        case 85:
        case 86:
        case 87:
        case 88:
        case 89:
        case 90:
        case 91:
          return [ op1, readOne(), readOne(), readOne() ];
        case 12:
          return [ op1, readBytes(16) ];
        case 13:
          return [ op1, ...readMultiple(16) ];
        default:
          return op1;
      }
    },
    0xFE: () => {
      const op1 = readOne();
      switch (op1) {
        /* c8 ignore next 2 */
        case 3:
          return [ op1, readU8() ];
        default:
          return [ op1, readOne(), readOne() ];
      }
    },
  };

  function decodeNext() {
    if (eof()) {
      return null;
    }
    const opcode = readU8();
    const f = operandReaders[opcode];
    const operand = f?.();
    return { opcode, operand };
  }

  return { decodeNext };
}

function repackFunction({ locals, instructions, size }) {
  const writer = createWriter(size);
  const {
    finalize,
    writeU8,
    writeArray,
    writeU32Leb128,
  } = writer;
  writeArray(locals, ({ number, type }) => {
    writeU32Leb128(number);
    writeU8(type);
  });
  const { encodeNext } = createEncoder(writer);
  for (const op of instructions) {
    encodeNext(op);
  }
  return finalize();
}

function createEncoder(writer) {
  const {
    writeBytes,
    writeU8,
    writeArray,
    writeU32Leb128,
    writeI32Leb128,
    writeI64Leb128,
    writeU32,
    writeF64,
  } = writer;
  const writeOne = writeU32Leb128;
  const writeTwo = (op) => {
    writeOne(op[0]);
    writeOne(op[1]);
  };
  const writeMultiple = (indices) => {
    for (const index of indices) {
      writeOne(index);
    }
  };
  const operandWriters = {
    0x02: writeI32Leb128,
    0x03: writeI32Leb128,
    0x04: writeI32Leb128,
    0x05: writeI32Leb128,
    0x0C: writeOne,
    0x0D: writeOne,
    0x0E: (op) => [ writeArray(op[0], writeOne), writeOne(op[1]) ],

    0x10: writeOne,
    0x11: writeTwo,
    0x12: writeOne,
    0x13: writeTwo,
    0x1C: (op) => writeArray(op, writeU8),

    0x20: writeOne,
    0x21: writeOne,
    0x22: writeOne,
    0x23: writeOne,
    0x24: writeOne,
    0x25: writeOne,
    0x26: writeOne,
    0x28: writeTwo,
    0x29: writeTwo,
    0x2A: writeTwo,
    0x2B: writeTwo,
    0x2C: writeTwo,
    0x2D: writeTwo,
    0x2E: writeTwo,
    0x2F: writeTwo,

    0x30: writeTwo,
    0x31: writeTwo,
    0x32: writeTwo,
    0x33: writeTwo,
    0x34: writeTwo,
    0x35: writeTwo,
    0x36: writeTwo,
    0x37: writeTwo,
    0x38: writeTwo,
    0x39: writeTwo,
    0x3A: writeTwo,
    0x3B: writeTwo,
    0x3C: writeTwo,
    0x3D: writeTwo,
    0x3E: writeTwo,
    0x3F: writeOne,

    0x40: writeOne,
    0x41: writeI32Leb128,
    0x42: writeI64Leb128,
    0x43: writeU32,   // avoid precision loss due to float-to-double conversion
    0x44: writeF64,

    0xD0: writeU8,
    0xD2: writeOne,

    0xFC: (op) => {
      if (op instanceof Array) {
        writeMultiple(op);
      } else {
        writeOne(op);
      }
    },
    0xFD: (op) => {
      if (op instanceof Array) {
        if (op[0] === 12) {
          writeOne(op[0]);
          writeBytes(op[1]);
        } else {
          writeMultiple(op);
        }
      } else {
        writeOne(op);
      }
    },
    0xFE: (op) => {
      writeMultiple(op);
    },
  };

  function encodeNext({ opcode, operand }) {
    writeU8(opcode);
    const f = operandWriters[opcode];
    f?.(operand);
  }

  return { encodeNext };
}

function parseNames(section) {
  let moduleName = '';
  const functionNames = [];
  const localNames = [];
  if (section) {
    const {
      eof,
      readString,
      readU8,
      readU32Leb128,
      readArray,
      readBytes,
    } = createReader(section.data);
    const readMap = () => readArray(() => {
      const index = readU32Leb128();
      const name = readString();
      return { index, name };
    });
    while(!eof()) {
      const id = readU8();
      const size = readU32Leb128();
      switch (id) {
        case 0: {
          moduleName = readString();
        } break;
        case 1: {
          const map = readMap();
          for (const { index, name } of map) {
            functionNames[index] = name;
          }
        } break;
        case 2:
          const map = readArray(() => {
            const index = readU8();
            const locals = readMap();
            return { index, locals };
          });
          for (const { index, locals } of map) {
            localNames[index] = locals;
          }
          break;
        default: {
          readBytes(size);
        }
      }
    }
  }
  return { moduleName, functionNames, localNames };
}

function repackNames({ moduleName, functionNames, localNames, size }) {
  const {
    finalize,
    writeString,
    writeU8,
    writeU32Leb128,
    writeArray,
    writeLength,
  } = createWriter(size);
  const writeMap = (entries) => writeArray(entries, ({ index, name }) => {
    writeU32Leb128(index);
    writeString(name);
  });
  if (moduleName) {
    writeU8(0);
    writeLength(() => {
      writeString(moduleName);
    });
  }
  if (functionNames.length > 0) {
    writeU8(1);
    writeLength(() => {
      const map = [];
      for (const [ index, name ] of functionNames.entries()) {
        map.push({ index, name });
      }
      writeMap(map);
    });
  }
  if (localNames.length > 0) {
    writeU8(2);
    writeLength(() => {
      const imap = [];
      for (const [ index, locals ] of localNames.entries()) {
        imap.push({ index, locals });
      }
      writeArray(imap, ({ index, locals }) => {
        writeU32Leb128(index);
        writeMap(locals);
      });
    });
  }
  return finalize();
}

async function transpile(srcPath, options) {
  const {
    nodeCompat = false,
    embedWASM = true,
    topLevelAwait = true,
    omitExports = false,
    stripWASM = (options.optimize && options.optimize !== 'Debug'),
    keepNames = false,
    moduleResolver = (name) => name,
    wasmLoader,
    ...compileOptions
  } = options;
  if (typeof(wasmLoader) !== 'function') {
    if (embedWASM !== true) {
      throw new Error(`wasmLoader is a required option when embedWASM is false`);
    }
  }
  Object.assign(compileOptions, { arch: 'wasm32', platform: 'wasi', isWASM: true });
  const { outputPath, sourcePaths } = await compile(srcPath, null, compileOptions);
  const content = await readFile(outputPath);
  const { memoryMax, memoryInitial, tableInitial } = extractLimits(new DataView(content.buffer));
  const { multithreaded = false } = compileOptions;
  const moduleOptions = {
    memoryMax,
    memoryInitial,
    tableInitial,
    multithreaded,
  };
  const Env = defineEnvironment();
  const env = new Env();
  env.loadModule(content, moduleOptions);
  await env.initPromise;
  env.acquireStructures();
  const definition = env.exportStructures();
  const usage = {};
  for (const [ name, mixin ] of Object.entries(mixins)) {
    if (env.mixinUsage.get(mixin) && name !== 'FeatureStructureAcquisition') {
      usage[name] = true;
    }
  }
  if (nodeCompat && usage.FeatureWorkerSupport) {
    usage.FeatureWorkerSupportCompat = true;
    usage.FeatureWorkerSupport = false;
  }
  const mixinPaths = [];
  for (const [ name, inUse ] of Object.entries(usage)) {
    if (inUse) {
      // change name to snake_case
      const parts = name.replace(/\B([A-Z])/g, ' $1').toLowerCase().split(' ');
      const type = parts.shift();
      const dir =  (type === 'wasi') ? 'wasi' : `${type}s`;
      const filename = parts.join('-') + '.js';
      mixinPaths.push(`${dir}/${filename}`);
    }
  }
  const runtimeURL = moduleResolver('zigar-runtime');
  let binarySource;
  if (env.hasMethods()) {
    let dv = new DataView(content.buffer);
    if (stripWASM) {
      dv = stripUnused(dv, { keepNames });
    }
    if (embedWASM) {
      binarySource = embed(srcPath, dv);
    } else {
      binarySource = await wasmLoader(srcPath, dv);
    }
  }
  const { code, exports, structures } = generateCode(definition, {
    runtimeURL,
    binarySource,
    topLevelAwait,
    omitExports,
    moduleOptions,
    mixinPaths,
  });
  return { code, exports, structures, sourcePaths };
}

function embed(path, dv) {
  const base64 = Buffer.from(dv.buffer, dv.byteOffset, dv.byteLength).toString('base64');
  return `(async () => {
  // ${basename(path)}
  const binaryString = atob(${JSON.stringify(base64)});
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  await new Promise(r => setTimeout(r, 0));
  return bytes.buffer;
})()`;
}

export { compile, extractOptions, findConfigFile, findSourceFile, generateCode, getArch, getCachePath, getModuleCachePath, getPlatform, loadConfigFile, normalizePath, optionsForCompile, optionsForTranspile, transpile };
