'use strict';

var crypto = require('crypto');
var child_process = require('child_process');
var path = require('path');
var os = require('os');
var promises = require('fs/promises');

const cwd = process.cwd();

async function compile(path$1, options = {}) {
  const {
    optimize = 'Debug',
    clean = false,
    platform = os.platform(),
    arch = os.arch(),
    buildDir = os.tmpdir(),
    cacheDir = path.join(cwd, 'zigar-cache'),
    zigCmd = `zig build -Doptimize=${optimize}`,
    staleTime = 60000,
  } = options;
  const fullPath = path.resolve(path$1);
  const rootFile = path.parse(fullPath);
  const prefix = isWASM(arch) ? 'wasm' : 'cpp';
  const config = {
    platform,
    arch,
    packageName: rootFile.name,
    packagePath: fullPath,
    packageRoot: rootFile.dir,
    exporterPath: absolute(`../zig/${prefix}-exporter.zig`),
    stubPath: absolute(`../zig/${prefix}-stub.zig`),
    buildFilePath: absolute(`../zig/build.zig`),
    useLibC: false,
  };
  const soName = getLibraryName(rootFile.name, platform, arch);
  const soDir = path.join(cacheDir, platform, arch, optimize);
  const soPath = path.join(soDir, soName);
  const soMTime = (await findFile(soPath))?.mtime;
  if (!buildDir || !cacheDir || !zigCmd) {
    // can't build when no command or build directory is set to empty
    if (soMTime) {
      return soPath;
    } else {
      throw new Error(`Cannot find shared library and compilation is disabled: ${soPath}`);
    }
  }
  if (!await findFile(fullPath)) {
    throw new Error(`Source file not found: ${fullPath}`);
  }
  // scan the dir containing the file to see if recompilation is necessary
  // also check if there's a custom build file and for C dependency
  let changed = false;
  await scanDirectory(rootFile.dir, /\.zig$/i, async (dir, name, { mtime }) => {
    if (dir === rootFile.dir && name === 'build.zig') {
      config.buildFilePath = path.join(dir, name);
    }
    if (!config.useLibC) {
      const content = await loadFile(path.join(dir, name));
      if (content.includes('@cImport')) {
        config.useLibC = true;
      }
    }
    if (!(soMTime > mtime)) {
      changed = true;
    }
  });
  if (!changed) {
    const { pathname } = new URL('../zig', (typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (document.currentScript && document.currentScript.src || new URL('index.cjs', document.baseURI).href)));
    // rebuild when source files have changed
    await scanDirectory(pathname, /\.zig$/i, (dir, name, { mtime }) => {
      if (!(soMTime > mtime)) {
        changed = true;
      }
    });
  }
  if (!changed) {
    return soPath;
  }
  // build in a unique temp dir
  const soBuildDir = getBuildFolder(fullPath, platform, arch);
  // only one process can compile a given file at a time
  await acquireLock(soBuildDir, staleTime);
  try {
    // create config file
    await createProject(config, soBuildDir);
    // then run the compiler
    await runCompiler(zigCmd, soBuildDir);
    // move library to cache directory
    const libPath = path.join(soBuildDir, 'zig-out', 'lib', soName);
    await createDirectory(soDir);
    await moveFile(libPath, soPath);
    await touchFile(soPath);
  } finally {
    await releaseLock(soBuildDir);
    if (clean) {
      await deleteDirectory(soBuildDir);
    }
  }
  return soPath;
}

function isWASM(arch) {
  switch (arch) {
    case 'wasm32':
    case 'wasm64':
      return true;
    default:
      return false;
  }
}

function getLibraryName(name, platform, arch) {
  switch (arch) {
    case 'wasm32':
    case 'wasm64':
      return `${name}.wasm`;
    default:
      switch (platform) {
        case 'darwin':
          return `lib${name}.dylib`;
        case 'windows':          return `lib${name}.dll`;
        default:
          return `lib${name}.so`;
      }
  }
}

function getBuildFolder(path$1, platform, arch) {
  const buildDir = os.tmpdir();
  const fullPath = path.resolve(path$1);
  return path.join(buildDir, md5(fullPath), platform, arch)
}

async function runCompiler(zigCmd, soBuildDir) {
  const options = {
    cwd: soBuildDir,
    windowsHide: true,
  };
  return new Promise((resolve, reject) => {
    child_process.exec(zigCmd, options, (err, stdout, stderr) => {
      if (err) {
        const log = stderr;
        if (log) {
          const logPath = path.join(soBuildDir, 'log');
          promises.writeFile(logPath, log).catch(() => {});
          err = new Error(`Zig compilation failed\n\n${log}`);
        }
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function findFile(path, follow = true) {
  try {
    return await (follow ? promises.stat(path) : promises.lstat(path));
  } catch (err) {
  }
}

async function scanDirectory(dir, re, cb) {
  const ino = (await findFile(dir))?.ino;
  /* c8 ignore next 3 */
  if (!ino) {
    return;
  }
  const scanned = [ ino ];
  const scan = async (dir) => {
    try {
      const list = await promises.readdir(dir);
      for (const name of list) {
        if (name.startsWith('.') || name === 'node_modules' || name === 'zig-cache') {
          continue;
        }
        const path$1 = path.join(dir, name);
        const info = await findFile(path$1);
        if (info?.isDirectory() && !scanned.includes(info.ino)) {
          await scan(path$1);
        } else if (info?.isFile() && re.test(name)) {
          await cb(dir, name, info);
        }
      }
      /* c8 ignore next 2 */
    } catch (err) {
    }
  };
  await scan(dir);
}

async function acquireLock(soBuildDir, staleTime) {
  const pidPath = path.join(soBuildDir, 'pid');
  while (true)   {
    try {
      await createDirectory(soBuildDir);
      const handle = await promises.open(pidPath, 'wx');
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
    await delay(50);
  }
}

async function releaseLock(soBuildDir) {
  const pidPath = path.join(soBuildDir, 'pid');
  await deleteFile(pidPath);
}

async function createProject(config, dir) {
  // translate from names used by Node to those used by Zig
  const cpuArchs = {
    arm: 'arm',
    arm64: 'aarch64',
    ia32: 'x86',
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
    linux: 'linux',
    openbsd: 'openbsd',
    sunos: 'solaris',
    win32: 'windows',
  };
  const cpuArch = cpuArchs[config.arch] ?? config.arch;
  const osTag = osTags[config.platform] ?? config.platform;
  const target = `.{ .cpu_arch = .${cpuArch}, .os_tag = .${osTag} }`;
  const lines = [];
  lines.push(`const std = @import("std");\n`);
  lines.push(`pub const target: std.zig.CrossTarget = ${target};`);
  lines.push(`pub const package_name = ${JSON.stringify(config.packageName)};`);
  lines.push(`pub const package_path = ${JSON.stringify(config.packagePath)};`);
  lines.push(`pub const package_root = ${JSON.stringify(config.packageRoot)};`);
  lines.push(`pub const exporter_path = ${JSON.stringify(config.exporterPath)};`);
  lines.push(`pub const stub_path = ${JSON.stringify(config.stubPath)};`);
  lines.push(`pub const use_libc = ${config.useLibC ? true : false};`);
  lines.push(``);
  const content = lines.join('\n');
  const cfgFilePath = path.join(dir, 'build-cfg.zig');
  await promises.writeFile(cfgFilePath, content);
  const buildFilePath = path.join(dir, 'build.zig');
  await copyFile(config.buildFilePath, buildFilePath);
}

async function moveFile(srcPath, dstPath) {
  try {
    await promises.rename(srcPath, dstPath);
    /* c8 ignore next 8 -- hard to test */
  } catch (err) {
    if (err.code == 'EXDEV') {
      await copyFile(srcPath, dstPath);
      await deleteFile(srcPath);
    } else {
      throw err;
    }
  }
}

async function copyFile(srcPath, dstPath) {
  const info = await promises.stat(srcPath);
  const data = await promises.readFile(srcPath);
  await promises.writeFile(dstPath, data);
  await promises.chmod(dstPath, info.mode);
}

async function loadFile(path, def) {
  try {
    return await promises.readFile(path, 'utf8');
  } catch (err) {
    return def;
  }
}

async function touchFile(path) {
  const now = new Date();
  await promises.utimes(path, now, now);
}

async function deleteFile(path) {
  try {
    await promises.unlink(path);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

async function createDirectory(path$1) {
  const exists = await findDirectory(path$1);
  if (!exists) {
    const { root, dir } = path.parse(path$1);
    await createDirectory(dir);
    try {
      await promises.mkdir(path$1);
    } catch (err) {
      /* c8 ignore next 3 */
      if (err.code != 'EEXIST') {
        throw err;
      }
    }
  }
}

async function findDirectory(path) {
  return findFile(path);
}

async function deleteDirectory(dir) {
  try {
    const list = await promises.readdir(dir);
    for (const name of list) {
      const path$1 = path.join(dir, name);
      const info = await findFile(path$1, false);
      if (info?.isDirectory()) {
        await deleteDirectory(path$1);
      } else if (info) {
        await deleteFile(path$1);
      }
    }
    await promises.rmdir(dir);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

function md5(text) {
  const hash = crypto.createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

async function delay(ms) {
  await new Promise(r => setTimeout(r, ms));
}

function absolute(relpath) {
  return (new URL(relpath, (typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (document.currentScript && document.currentScript.src || new URL('index.cjs', document.baseURI).href)))).pathname;
}

const MEMORY = Symbol('memory');
const SLOTS = Symbol('slots');
const PARENT = Symbol('parent');
const ENUM_NAME = Symbol('enumName');
const ENUM_INDEX = Symbol('enumIndex');
const ENUM_ITEMS = Symbol('enumItems');
const ERROR_INDEX = Symbol('errorIndex');
const ENUM_ITEM = Symbol('enumItem');
const TAG = Symbol('TAG');
const GETTER = Symbol('getter');
const SETTER = Symbol('setter');
const LENGTH = Symbol('length');
const PROXY = Symbol('proxy');
const COMPAT = Symbol('compat');
const SIZE = Symbol('size');
const ALIGN = Symbol('align');
const SELF = Symbol('self');
const MEMORY_COPIER = Symbol('memoryCopier');
const MEMORY_RESETTER = Symbol('memoryResetter');
const CHILD_VIVIFICATOR = Symbol('childVivificator');
const POINTER_SELF = Symbol('pointer');
const POINTER_VISITOR = Symbol('pointerVisitor');
const ADDRESS_GETTER = Symbol('addressGetter');
const ADDRESS_SETTER = Symbol('addressSetter');
const LENGTH_GETTER = Symbol('lengthGetter');
const LENGTH_SETTER = Symbol('lengthSetter');
const SENTINEL = Symbol('sentinel');
const ENVIRONMENT = Symbol('environment');

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

function getMemoryCopier(size, multiple = false) {
  const copy = getCopyFunction(size, multiple);
  return function(target) {
    /* WASM-ONLY */
    restoreMemory.call(this);
    restoreMemory.call(target);
    /* WASM-ONLY-END */
    const src = target[MEMORY];
    const dest = this[MEMORY];
    copy(dest, src);
  };
}

function getCopyFunction(size, multiple = false) {
  if (!multiple) {
    const copier = copiers[size];
    if (copier) {
      return copier;
    }
  }
  if (!(size & 0x07)) return copy8x;
  if (!(size & 0x03)) return copy4x;
  if (!(size & 0x01)) return copy2x;
  return copy1x;
}

const copiers = {
  1: copy1,
  2: copy2,
  4: copy4,
  8: copy8,
  16: copy16,
  32: copy32,
};

function copy1x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i++) {
    dest.setInt8(i, src.getInt8(i));
  }
}

function copy2x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 2) {
    dest.setInt16(i, src.getInt16(i, true), true);
  }
}

function copy4x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 4) {
    dest.setInt32(i, src.getInt32(i, true), true);
  }
}

function copy8x(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 8) {
    dest.setInt32(i, src.getInt32(i, true), true);
    dest.setInt32(i + 4, src.getInt32(i + 4, true), true);
  }
}

function copy1(dest, src) {
  dest.setInt8(0, src.getInt8(0));
}

function copy2(dest, src) {
  dest.setInt16(0, src.getInt16(0, true), true);
}

function copy4(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
}

function copy8(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
  dest.setInt32(4, src.getInt32(4, true), true);
}

function copy16(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
  dest.setInt32(4, src.getInt32(4, true), true);
  dest.setInt32(8, src.getInt32(8, true), true);
  dest.setInt32(12, src.getInt32(12, true), true);
}

function copy32(dest, src) {
  dest.setInt32(0, src.getInt32(0, true), true);
  dest.setInt32(4, src.getInt32(4, true), true);
  dest.setInt32(8, src.getInt32(8, true), true);
  dest.setInt32(12, src.getInt32(12, true), true);
  dest.setInt32(16, src.getInt32(16, true), true);
  dest.setInt32(20, src.getInt32(20, true), true);
  dest.setInt32(24, src.getInt32(24, true), true);
  dest.setInt32(28, src.getInt32(28, true), true);
}

function getMemoryResetter(size) {
  const reset = getResetFunction(size);
  return function() {
    const dest = this[MEMORY];
    reset(dest);
  };
}

function getResetFunction(size) {
  const resetter = resetters[size];
  if (resetter) {
    return resetter;
  }
  if (!(size & 0x07)) return reset8x;
  if (!(size & 0x03)) return reset4x;
  if (!(size & 0x01)) return reset2x;
  return reset1x;
}

const resetters = {
  1: reset1,
  2: reset2,
  4: reset4,
  8: reset8,
  16: reset16,
  32: reset32,
};

function reset1x(dest) {
  for (let i = 0, len = dest.byteLength; i < len; i++) {
    dest.setInt8(i, 0);
  }
}

function reset2x(dest) {
  for (let i = 0, len = dest.byteLength; i < len; i += 2) {
    dest.setInt16(i, 0, true);
  }
}

function reset4x(dest) {
  for (let i = 0, len = dest.byteLength; i < len; i += 4) {
    dest.setInt32(i, 0, true);
  }
}

function reset8x(dest) {
  for (let i = 0, len = dest.byteLength; i < len; i += 8) {
    dest.setInt32(i, 0, true);
    dest.setInt32(i + 4, 0, true);
  }
}

function reset1(dest) {
  dest.setInt8(0, 0);
}

function reset2(dest) {
  dest.setInt16(0, 0, true);
}

function reset4(dest) {
  dest.setInt32(0, 0, true);
}

function reset8(dest) {
  dest.setInt32(0, 0, true);
  dest.setInt32(4, 0, true);
}

function reset16(dest) {
  dest.setInt32(0, 0, true);
  dest.setInt32(4, 0, true);
  dest.setInt32(8, 0, true);
  dest.setInt32(12, 0, true);
}

function reset32(dest) {
  dest.setInt32(0, 0, true);
  dest.setInt32(4, 0, true);
  dest.setInt32(8, 0, true);
  dest.setInt32(12, 0, true);
  dest.setInt32(16, 0, true);
  dest.setInt32(20, 0, true);
  dest.setInt32(24, 0, true);
  dest.setInt32(28, 0, true);
}
/* c8 ignore end */

function restoreMemory() {
  const dv = this[MEMORY];
  const source = dv[MEMORY];
  if (!source || dv.buffer.byteLength !== 0) {
    return false;
  }
  const { memory, address, len } = source;
  const newDV = new DataView(memory.buffer, address, len);
  newDV[MEMORY] = source;
  this[MEMORY] = newDV;
  return true;
}

function throwNoInitializer(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`An initializer must be provided to the constructor of ${name}, even when it's undefined`);
}

function throwBufferSizeMismatch(structure, dv, target = null) {
  const { type, byteSize } = structure;
  const name = getStructureName(structure);
  const actual = dv.byteLength;
  const s = (byteSize > 1) ? 's' : '';
  if (type === StructureType.Slice && !target) {
    throw new TypeError(`${name} has elements that are ${byteSize} byte${s} in length, received ${actual}`);
  } else {
    const total = (type === StructureType.Slice) ? target.length * byteSize : byteSize;
    throw new TypeError(`${name} has ${total} byte${s}, received ${actual}`);
  }
}

function throwBufferExpected(structure) {
  const { type, byteSize, typedArray } = structure;
  const s = (byteSize > 1) ? 's' : '';
  const acceptable = [ 'ArrayBuffer', 'DataView' ].map(addArticle);
  if (typedArray) {
    acceptable.push(addArticle(typedArray.name));
  }
  if (type === StructureType.Slice) {
    throw new TypeError(`Expecting ${formatList(acceptable)} that can accommodate items ${byteSize} byte${s} in length`);
  } else {
    throw new TypeError(`Expecting ${formatList(acceptable)} that is ${byteSize} byte${s} in length`);
  }
}

function throwInvalidEnum(structure, value) {
  const name = getStructureName(structure);
  throw new TypeError(`Value given does not correspond to an item of enum ${name}: ${value}`);
}

function throwEnumExpected(structure, arg) {
  const name = getStructureName(structure);
  throw new TypeError(`Enum item of the type ${name} expected, received ${arg}`);
}

function throwNoNewEnum(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`Cannot create new enum item\nCall ${name} without the use of "new" to obtain an enum object`);
}

function throwNoNewError(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`Cannot create new error\nCall ${name} without the use of "new" to obtain an error object`);
}

function throwNotInErrorSet(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`Error given is not a part of error set ${name}`);
}

function throwUnknownErrorNumber(structure, number) {
  const name = getStructureName(structure);
  throw new TypeError(`Error number does not corresponds to any error in error set ${name}: #${number}`);
}

function throwMultipleUnionInitializers(structure) {
  const name = getStructureName(structure);
  throw new TypeError(`Only one property of ${name} can be given a value`);
}

function throwInactiveUnionProperty(structure, name, currentName) {
  throw new TypeError(`Accessing property ${name} when ${currentName} is active`);
}

function throwMissingUnionInitializer(structure, arg, exclusion) {
  const { instance: { members } } = structure;
  const name = getStructureName(structure);
  const missing = members.slice(0, exclusion ? -1 : undefined).map(m => m.name);
  throw new TypeError(`${name} needs an initializer for one of its union properties: ${missing.join(', ')}`);
}

function throwInvalidInitializer(structure, expected, arg) {
  const name = getStructureName(structure);
  const acceptable = [];
  if (Array.isArray(expected)) {
    for (const type of expected) {
      acceptable.push(addArticle(type));
    }
  } else {
    acceptable.push(addArticle(expected));
  }
  const received = getDescription(arg);
  throw new TypeError(`${name} expects ${formatList(acceptable)} as argument, received ${received}`);
}

function throwInvalidArrayInitializer(structure, arg, shapeless = false) {
  const { instance: { members: [ member ] }, type, typedArray } = structure;
  const acceptable = [];
  const primitive = getPrimitiveType(member);
  if (primitive) {
    acceptable.push(`array of ${primitive}s`);
  } else if (member.type === MemberType.EnumerationItem) {
    acceptable.push(`array of enum items`);
  } else {
    acceptable.push(`array of objects`);
  }
  if (typedArray) {
    acceptable.push(typedArray.name);
  }
  if (type === StructureType.Slice && shapeless) {
    acceptable.push(`length`);
  }
  throwInvalidInitializer(structure, acceptable.join(' or '), arg);
}

function throwArrayLengthMismatch(structure, target, arg) {
  const { length, instance: { members: [ member ] } } = structure;
  const name = getStructureName(structure);
  const { structure: { constructor: elementConstructor} } = member;
  const { length: argLength, constructor: argConstructor } = arg;
  // get length from object whech it's a slice
  const actualLength = target?.length ?? length;
  const s = (actualLength > 1) ? 's' : '';
  let received;
  if (argConstructor === elementConstructor) {
    received = `only a single one`;
  } else if (argConstructor.child === elementConstructor) {
    received = `a slice/array that has ${argLength}`;
  } else {
    received = `${argLength} initializer${argLength > 1 ? 's' : ''}`;
  }
  throw new TypeError(`${name} has ${actualLength} element${s}, received ${received}`);
}

function throwMissingInitializers(structure, arg) {
  const { instance: { members } } = structure;
  const name = getStructureName(structure);
  const missing = [];
  for (const { name, isRequired } of members) {
    if (isRequired) {
      if (arg?.[name] === undefined) {
        missing.push(name);
      }
    }
  }
  throw new TypeError(`Missing initializers for ${name}: ${missing.join(', ')}`);
}

function throwNoProperty$1(structure, propName) {
  const name = getStructureName(structure);
  throw new TypeError(`${name} does not have a property with that name: ${propName}`);
}

function throwArgumentCountMismatch(structure, actual) {
  const { instance: { members } } = structure;
  const name = getStructureName(structure);
  const argCount = members.length - 1;
  const s = (argCount > 1) ? 's' : '';
  throw new Error(`${name} expects ${argCount} argument${s}, received ${actual}`);
}

function rethrowArgumentError(structure, index, err) {
  const { instance: { members } } = structure;
  const name = getStructureName(structure);
  // Zig currently does not provide the argument name
  const argName = `args[${index}]`;
  const argCount = members.length - 1;
  const prefix = (index !== 0) ? '..., ' : '';
  const suffix = (index !== argCount - 1) ? ', ...' : '';
  const argLabel = prefix + argName + suffix;
  const newError = new err.constructor(`${name}(${argLabel}): ${err.message}`);
  newError.stack = err.stack;
  throw newError;
}

function throwNoCastingToPointer(structure) {
  throw new TypeError(`Non-slice pointers can only be created with the help of the new operator`);
}

function throwConstantConstraint(structure, pointer) {
  const name1 = getStructureName(structure);
  const { constructor: { name: name2 } } = pointer;
  throw new TypeError(`Conversion of ${name2} to ${name1} requires an explicit cast`);
}

function throwMisplacedSentinel(structure, value, index, length) {
  const name = getStructureName(structure);
  throw new TypeError(`${name} expects the sentinel value ${value} at ${length - 1}, found at ${index}`);
}

function throwMissingSentinel(structure, value, length) {
  const name = getStructureName(structure);
  throw new TypeError(`${name} expects the sentinel value ${value} at ${length - 1}`);
}

function throwAssigningToConstant(pointer) {
  const { constructor: { name } } = pointer;
  throw new TypeError(`${name} cannot be modified`);
}

function throwTypeMismatch(expected, arg) {
  const received = getDescription(arg);
  throw new TypeError(`Expected ${addArticle(expected)}, received ${received}`)
}

function throwInaccessiblePointer() {
  throw new TypeError(`Pointers within an untagged union are not accessible`);
}

function throwInvalidPointerTarget(structure, arg) {
  const name = getStructureName(structure);
  let target;
  if (arg != null) {
    const type = typeof(arg);
    const noun = (type === 'object' && arg.constructor !== Object) ? `${arg.constructor.name} object`: type;
    const a = article(noun);
    target = `${a} ${noun}`;
  } else {
    target = arg + '';
  }
  throw new TypeError(`${name} cannot point to ${target}`)
}

function throwFixedMemoryTargetRequired(structure, arg) {
  throw new TypeError(`Pointers in fixed memory cannot point to garbage-collected object`);
}


function throwOverflow(member, value) {
  const typeName = getTypeName(member);
  throw new TypeError(`${typeName} cannot represent the value given: ${value}`);
}

function throwOutOfBound(member, index) {
  const { name } = member;
  throw new RangeError(`Index exceeds the size of ${name ?? 'array'}: ${index}`);
}

function rethrowRangeError(member, index, err) {
  if (err instanceof RangeError) {
    throwOutOfBound(member, index);
  } else {
    throw err;
  }
}

function throwNotNull(member) {
  const { name } = member;
  throw new RangeError(`Property ${name} can only be null`);
}

function throwZigError(name) {
  throw new Error(decamelizeErrorName(name));
}

function decamelizeErrorName(name) {
  // use a try block in case Unicode regex fails
  try {
    const lc = name.replace(/(\p{Uppercase}+)(\p{Lowercase}*)/gu, (m0, m1, m2) => {
      if (m1.length === 1) {
        return ` ${m1.toLocaleLowerCase()}${m2}`;
      } else {
        if (m2) {
          const acronym = m1.substring(0, m1.length - 1);
          const letter = m1.charAt(m1.length - 1).toLocaleLowerCase();
          return ` ${acronym} ${letter}${m2}`;
        } else {
          return ` ${m1}`;
        }
      }
    }).trimStart();
    return lc.charAt(0).toLocaleUpperCase() + lc.substring(1);
    /* c8 ignore next 3 */
  } catch (err) {
    return name;
  }
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

function getDataViewBoolAccessor(access, member) {
  return cacheMethod(access, member, () => {
    const { byteSize } = member;
    if (byteSize === undefined) {
      return undefined;
    }
    const typeName = getTypeName({ type: MemberType.Int, bitSize: byteSize * 8 });
    if (access === 'get') {
      const get = DataView.prototype[`get${typeName}`];
      return function(offset, littleEndian) {
        return !!get.call(this, offset, littleEndian);
      };
    } else {
      const set = DataView.prototype[`set${typeName}`];
      const T = (byteSize > 4) ? 1n : 1;
      const F = (byteSize > 4) ? 0n : 0;
      return function(offset, value, littleEndian) {
        set.call(this, offset, value ? T : F, littleEndian);
      };
    }
  });
}

function getDataViewBoolAccessorEx(access, member) {
  return cacheMethod(access, member, () => {
    if (isByteAligned(member)) {
      return getDataViewBoolAccessor(access, member);
    }
    const { bitOffset } = member;
    const bitPos = bitOffset & 0x07;
    const mask = 1 << bitPos;
    const get = DataView.prototype.getInt8;
    if (access === 'get') {
      return function(offset) {
        const n = get.call(this, offset);
        return !!(n & mask);
      };
    } else {
      const set = DataView.prototype.setInt8;
      return function(offset, value) {
        const n = get.call(this, offset);
        const b = (value) ? n | mask : n & ~mask;
        set.call(this, offset, b);
      };
    }
  });
}

function getDataViewIntAccessorEx(access, member) {
  return cacheMethod(access, member, (name) => {
    if (DataView.prototype[name]) {
      return DataView.prototype[name];
    }
    if (isByteAligned(member)) {
      return defineAlignedIntAccessor(access, member)
    } else {
      return defineUnalignedIntAccessor(access, member);
    }
  });
}

function getDataViewUintAccessorEx(access, member) {
  return cacheMethod(access, member, (name) => {
    if (DataView.prototype[name]) {
      return DataView.prototype[name];
    }
    if (isByteAligned(member)) {
      return defineAlignedUintAccessor(access, member)
    } else {
      return defineUnalignedUintAccessor(access, member);
    }
  });
}

function getDataViewFloatAccessorEx(access, member) {
  return cacheMethod(access, member, (name) => {
    if (DataView.prototype[name]) {
      return DataView.prototype[name];
    }
    if (isByteAligned(member)) {
      return defineAlignedFloatAccessor(access, member)
    } else {
      return defineUnalignedFloatAccessor(access, member);
    }
  });
}

function getDataView(structure, arg) {
  const { type, byteSize, typedArray } = structure;
  let dv;
  // not using instanceof just in case we're getting objects created in other contexts
  const tag = arg?.[Symbol.toStringTag];
  if (tag === 'DataView') {
    dv = arg;
  } else if (tag === 'ArrayBuffer' || tag === 'SharedArrayBuffer') {
    dv = new DataView(arg);
  } else if (typedArray && tag === typedArray.name || (tag === 'Uint8ClampedArray' && typedArray === Uint8Array)) {
    dv = new DataView(arg.buffer, arg.byteOffset, arg.byteLength);
  } else if (tag === 'Uint8Array' && typeof(Buffer) === 'function' && arg instanceof Buffer) {
    dv = new DataView(arg.buffer, arg.byteOffset, arg.byteLength);
  } else {
    const memory = arg?.[MEMORY];
    if (memory && (type === StructureType.Array || type === StructureType.Slice || type === StructureType.Vector)) {
      const { instance: { members: [ member ] } } = structure;
      const { byteSize: elementSize, structure: { constructor: Child } } = member;
      const number = findElements(arg, Child);
      if (number !== undefined) {
        if (type === StructureType.Slice || number * elementSize === byteSize) {
          return memory;
        } else {
          throwArrayLengthMismatch(structure, null, arg);
        }
      }
    }
  }
  if (dv) {
    checkDataViewSize(structure, dv);
  }
  return dv;
}

function checkDataViewSize(structure, dv) {
  const { type, byteSize } = structure;
  if (type === StructureType.Slice ? dv.byteLength % byteSize !== 0 : dv.byteLength !== byteSize) {
    throwBufferSizeMismatch(structure, dv);
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

function requireDataView(structure, arg) {
  const dv = getDataView(structure, arg);
  if (!dv) {
    throwBufferExpected(structure);
  }
  return dv;
}

function getTypedArrayClass(structure) {
  const { type, instance: { members } } = structure;
  if (type === StructureType.Primitive) {
    const { type: memberType, byteSize } = members[0];
    if (memberType === MemberType.Int) {
      switch (byteSize) {
        case 1: return Int8Array;
        case 2: return Int16Array;
        case 4: return Int32Array;
        case 8: return BigInt64Array;
      }
    } else if (memberType === MemberType.Uint) {
      switch (byteSize) {
        case 1: return Uint8Array;
        case 2: return Uint16Array;
        case 4: return Uint32Array;
        case 8: return BigUint64Array;
      }
    } else if (memberType === MemberType.Float) {
      switch (byteSize) {
        case 4: return Float32Array;
        case 8: return Float64Array;
      }
    }
  } else if (type === StructureType.Array || type === StructureType.Slice || type === StructureType.Vector) {
    const { structure: { typedArray } } = members[0];
    return typedArray;
  }
  return null;
}

function addTypedArray(structure) {
  return structure.typedArray = getTypedArrayClass(structure);
}

function isTypedArray(arg, TypedArray) {
  const tag = arg?.[Symbol.toStringTag];
  return (!!TypedArray && tag === TypedArray.name);
}

function isCompatible(arg, constructor) {
  const tags = constructor[COMPAT];
  if (tags) {
    const tag = arg?.[Symbol.toStringTag];
    if (tags.includes(tag)) {
      return true;
    }
  }
  if (constructor.child) {
    if (findElements(arg, constructor.child) !== undefined) {
      return true;
    }
  }
  return false;
}

function getCompatibleTags(structure) {
  const { typedArray } = structure;
  const tags = [];
  if (typedArray) {
    tags.push(typedArray.name);
    tags.push('DataView');
    if (typedArray === Uint8Array) {
      tags.push('Uint8ClampedArray');
      tags.push('ArrayBuffer');
      tags.push('SharedArrayBuffer');
    }
  }
  return tags;
}

function isBuffer(arg, typedArray) {
  const tag = arg?.[Symbol.toStringTag];
  if (tag === 'DataView' || tag === 'ArrayBuffer' || tag === 'SharedArrayBuffer') {
    return true;
  } else if (typedArray && tag === typedArray.name) {
    return true;
  } else {
    return false;
  }
}

function getTypeName(member) {
  const { type, bitSize, byteSize, structure } = member;
  if (structure?.name === 'usize') {
    return 'USize';
  } else if (structure?.name === 'isize') {
    return 'ISize';
  } else if (type === MemberType.Int) {
    return `${bitSize <= 32 ? '' : 'Big' }Int${bitSize}`;
  } else if (type === MemberType.Uint) {
    return `${bitSize <= 32 ? '' : 'Big' }Uint${bitSize}`;
  } else if (type === MemberType.Float) {
    return `Float${bitSize}`;
  } else if (type === MemberType.Bool) {
    const boolSize = (byteSize !== undefined) ? byteSize * 8 : 1;
    return `Bool${boolSize}`;
  } else if (type === MemberType.Void) {
    return `Null`;
  }
}

function getBigIntAccessors(bitSize) {
  const getWord = DataView.prototype.getBigUint64;
  const setWord = DataView.prototype.setBigUint64;
  const wordCount = Math.ceil(bitSize / 64);
  return {
    get: function(offset, littleEndian) {
      let n = 0n;
      if (littleEndian) {
        for (let i = 0, j = offset + (wordCount - 1) * 8; i < wordCount; i++, j -= 8) {
          const w = getWord.call(this, j, littleEndian);
          n = (n << 64n) | w;
        }
      } else {
        for (let i = 0, j = offset; i < wordCount; i++, j += 8) {
          const w = getWord.call(this, j, littleEndian);
          n = (n << 64n) | w;
        }
      }
      return n;
    },
    set: function(offset, value, littleEndian) {
      let n = value;
      const mask = 0xFFFFFFFFFFFFFFFFn;
      if (littleEndian) {
        for (let i = 0, j = offset; i < wordCount; i++, j += 8) {
          const w = n & mask;
          setWord.call(this, j, w, littleEndian);
          n >>= 64n;
        }
      } else {
        n <<= BigInt(wordCount * 64 - bitSize);
        for (let i = 0, j = offset + (wordCount - 1) * 8; i < wordCount; i++, j -= 8) {
          const w = n & mask;
          setWord.call(this, j, w, littleEndian);
          n >>= 64n;
        }
      }
      return n;
    },
  };
}

function defineAlignedIntAccessor(access, member) {
  const { bitSize, byteSize } = member;
  if (bitSize < 64) {
    // actual number of bits needed when stored aligned
    const typeName = getTypeName({ ...member, bitSize: byteSize * 8 });
    const get = DataView.prototype[`get${typeName}`];
    const set = DataView.prototype[`set${typeName}`];
    const signMask = (bitSize <= 32) ? 2 ** (bitSize - 1) : 2n ** BigInt(bitSize - 1);
    const valueMask = (bitSize <= 32) ? signMask - 1 : signMask - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        return (n & valueMask) - (n & signMask);
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
        set.call(this, offset, n, littleEndian);
      };
    }
  } else {
    // larger than 64 bits
    const { get, set } = getBigIntAccessors(bitSize);
    const signMask = 2n ** BigInt(bitSize - 1);
    const valueMask = signMask - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        return (n & valueMask) - (n & signMask);
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
        set.call(this, offset, n, littleEndian);
      };
    }
  }
}

function defineAlignedUintAccessor(access, member) {
  const { bitSize, byteSize } = member;
  if (bitSize < 64) {
    // actual number of bits needed when stored aligned
    const typeName = getTypeName({ ...member, bitSize: byteSize * 8 });
    const get = DataView.prototype[`get${typeName}`];
    const set = DataView.prototype[`set${typeName}`];
    const valueMask = (bitSize <= 32) ? (2 ** bitSize) - 1 : (2n ** BigInt(bitSize)) - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        return n & valueMask;
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = value & valueMask;
        set.call(this, offset, n, littleEndian);
      };
    }
  } else {
    // larger than 64 bits
    const { get, set } = getBigIntAccessors(bitSize);
    const valueMask = (2n ** BigInt(bitSize)) - 1n;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        return n & valueMask;
      };
    } else {
      return function(offset, value, littleEndian) {
        const n = value & valueMask;
        set.call(this, offset, n, littleEndian);
      };
    }
  }
}

function defineUnalignedIntAccessor(access, member) {
  const { bitSize, bitOffset } = member;
  const bitPos = bitOffset & 0x07;
  if (bitPos + bitSize <= 8) {
    const set = DataView.prototype.setUint8;
    const get = DataView.prototype.getUint8;
    // sub-8-bit numbers have real use cases
    const signMask = 2 ** (bitSize - 1);
    const valueMask = signMask - 1;
    if (access === 'get') {
      return function(offset) {
        const n = get.call(this, offset);
        const s = n >>> bitPos;
        return (s & valueMask) - (s & signMask);
      };
    } else {
      const outsideMask = 0xFF ^ ((valueMask | signMask) << bitPos);
      return function(offset, value) {
        let b = get.call(this, offset);
        const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
        b = (b & outsideMask) | (n << bitPos);
        set.call(this, offset, b);
      };
    }
  }
  return defineUnalignedAccessorUsing(access, member, getDataViewIntAccessorEx);
}

function defineUnalignedUintAccessor(access, member) {
  const { bitSize, bitOffset } = member;
  const bitPos = bitOffset & 0x07;
  if (bitPos + bitSize <= 8) {
    const set = DataView.prototype.setUint8;
    const get = DataView.prototype.getUint8;
    const valueMask = (2 ** bitSize - 1);
    if (access === 'get') {
      return function(offset) {
        const n = get.call(this, offset);
        const s = n >>> bitPos;
        return s & valueMask;
      };
    } else {
      const outsideMask = 0xFF ^ (valueMask << bitPos);
      return function(offset, value) {
        const n = get.call(this, offset);
        const b = (n & outsideMask) | ((value & valueMask) << bitPos);
        set.call(this, offset, b);
      };
    }
  }
  return defineUnalignedAccessorUsing(access, member, getDataViewUintAccessorEx);
}

function defineAlignedFloatAccessor(access, member) {
  const { bitSize } = member;
  if (bitSize === 16) {
    const buf = new DataView(new ArrayBuffer(4));
    const set = DataView.prototype.setUint16;
    const get = DataView.prototype.getUint16;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >>> 15;
        const exp = (n & 0x7C00) >> 10;
        const frac = n & 0x03FF;
        if (exp === 0) {
          return (sign) ? -0 : 0;
        } else if (exp === 0x1F) {
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
        const exp = (n & 0x7F800000) >> 23;
        const frac = n & 0x007FFFFF;
        const exp16 = (exp - 127 + 15);
        let n16;
        if (exp === 0) {
          n16 = sign << 15;
        } else if (exp === 0xFF) {
          n16 = sign << 15 | 0x1F << 10 | (frac ? 1 : 0);
        } else if (exp16 >= 31) {
          n16 = sign << 15 | 0x1F << 10;
        } else {
          n16 = sign << 15 | exp16 << 10 | (frac >> 13);
        }
        set.call(this, offset, n16, littleEndian);
      }
    }
  } else if (bitSize === 80) {
    const buf = new DataView(new ArrayBuffer(8));
    const setWord = DataView.prototype.setBigUint64;
    const getWord = DataView.prototype.getBigUint64;
    const get = function(offset, littleEndian) {
      const w1 = getWord.call(this, offset, littleEndian);
      const w2 = getWord.call(this, offset + 8, littleEndian);
      return (littleEndian) ? w1 | w2 << 64n : w1 << 64n | w2;
    };
    const set = function(offset, value, littleEndian) {
      const w1 = value & 0xFFFFFFFFFFFFFFFFn;
      const w2 = value >> 64n;
      setWord.call(this, offset + (littleEndian ? 0 : 8), w1, littleEndian);
      setWord.call(this, offset + (littleEndian ? 8 : 0), w2, littleEndian);
    };
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >> 79n;
        const exp = (n & 0x7FFF0000000000000000n) >> 64n;
        const frac = n & 0x00007FFFFFFFFFFFFFFFn;
        if (exp === 0n) {
          return (sign) ? -0 : 0;
        } else if (exp === 0x7FFFn) {
          if (!frac) {
            return (sign) ? -Infinity : Infinity;
          } else {
            return NaN;
          }
        }
        const exp64 = exp - 16383n + 1023n;
        if (exp64 >= 2047n) {
          return (sign) ? -Infinity : Infinity;
        }
        const n64 = (sign << 63n) | (exp64 << 52n) | (frac >> 11n);
        buf.setBigUint64(0, n64, littleEndian);
        return buf.getFloat64(0, littleEndian);
      }
    } else {
      return function(offset, value, littleEndian) {
        buf.setFloat64(0, value, littleEndian);
        const n = buf.getBigUint64(0, littleEndian);
        const sign = n >> 63n;
        const exp = (n & 0x7FF0000000000000n) >> 52n;
        const frac = n & 0x000FFFFFFFFFFFFFn;
        let n80;
        if (exp === 0n) {
          n80 = sign << 79n | (frac << 11n);
        } else if (exp === 0x07FFn) {
          n80 = sign << 79n | 0x7FFFn << 64n | (frac ? 0x00002000000000000000n : 0n) | 0x00008000000000000000n;
          //                                                 ^ bit 61                       ^ bit 63
        } else {
          n80 = sign << 79n | (exp - 1023n + 16383n) << 64n | (frac << 11n) | 0x00008000000000000000n;
        }
        set.call(this, offset, n80, littleEndian);
      }
    }
  } else if (bitSize === 128) {
    const buf = new DataView(new ArrayBuffer(8));
    const getWord = DataView.prototype.getBigUint64;
    const setWord = DataView.prototype.setBigUint64;
    const get = function(offset, littleEndian) {
      const w1 = getWord.call(this, offset, littleEndian);
      const w2 = getWord.call(this, offset + 8, littleEndian);
      return (littleEndian) ? w1 | w2 << 64n : w1 << 64n | w2;
    };
    const set = function(offset, value, littleEndian) {
      const w1 = value & 0xFFFFFFFFFFFFFFFFn;
      const w2 = value >> 64n;
      setWord.call(this, offset + (littleEndian ? 0 : 8), w1, littleEndian);
      setWord.call(this, offset + (littleEndian ? 8 : 0), w2, littleEndian);
    };
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >> 127n;
        const exp = (n & 0x7FFF0000000000000000000000000000n) >> 112n;
        const frac = n & 0x0000FFFFFFFFFFFFFFFFFFFFFFFFFFFFn;
        if (exp === 0n) {
          return (sign) ? -0 : 0;
        } else if (exp === 0x7FFFn) {
          if (!frac) {
            return (sign) ? -Infinity : Infinity;
          } else {
            return NaN;
          }
        }
        const exp64 = exp - 16383n + 1023n;
        if (exp64 >= 2047n) {
          return (sign) ? -Infinity : Infinity;
        }
        const n64 = (sign << 63n) | (exp64 << 52n) | (frac >> 60n);
        buf.setBigUint64(0, n64, littleEndian);
        return buf.getFloat64(0, littleEndian);
      }
    } else {
      return function(offset, value, littleEndian) {
        buf.setFloat64(0, value, littleEndian);
        const n = buf.getBigUint64(0, littleEndian);
        const sign = n >> 63n;
        const exp = (n & 0x7FF0000000000000n) >> 52n;
        const frac = n & 0x000FFFFFFFFFFFFFn;
        let n128;
        if (exp === 0n) {
          n128 = sign << 127n | (frac << 60n);
        } else if (exp === 0x07FFn) {
          n128 = sign << 127n | 0x7FFFn << 112n | (frac ? 1n : 0n);
        } else {
          n128 = sign << 127n | (exp - 1023n + 16383n) << 112n | (frac << 60n);
        }
        set.call(this, offset, n128, littleEndian);
      }
    }
  }
}

function defineUnalignedFloatAccessor(access, member) {
  return defineUnalignedAccessorUsing(access, member, getDataViewFloatAccessorEx);
}

function defineUnalignedAccessorUsing(access, member, getDataViewAccessor) {
  // pathological usage scenario--handle it anyway by copying the bitSize into a
  // temporary buffer, bit-aligning the data
  const { bitSize, bitOffset } = member;
  const bitPos = bitOffset & 0x07;
  const byteSize = [ 1, 2, 4, 8 ].find(b => b * 8 >= bitSize) ?? Math.ceil(bitSize / 64) * 64;
  const buf = new DataView(new ArrayBuffer(byteSize));
  if (access === 'get') {
    const getAligned = getDataViewAccessor('get', { ...member, byteSize });
    const copyBits = getBitAlignFunction(bitPos, bitSize, true);
    return function(offset, littleEndian) {
      copyBits(buf, this, offset);
      return getAligned.call(buf, 0, littleEndian);
    };
  } else {
    const setAligned = getDataViewAccessor('set', { ...member, byteSize });
    const applyBits = getBitAlignFunction(bitPos, bitSize, false);
    return function(offset, value, littleEndian) {
      setAligned.call(buf, 0, value, littleEndian);
      applyBits(this, buf, offset);
    };
  }
}

function cacheMethod(access, member, cb) {
  const { type, bitOffset, bitSize } = member;
  const bitPos = bitOffset & 0x07;
  const typeName = getTypeName(member);
  const suffix = isByteAligned(member) ? `` : `Bit${bitPos}`;
  const name = `${access}${typeName}${suffix}`;
  let fn = methodCache[name];
  if (!fn) {
    // usize and isize can return/accept number or bigint
    if ((type === MemberType.Int && typeName === 'ISize')
     || (type === MemberType.Uint && typeName === 'USize')) {
      if (bitSize === 64) {
        const realTypeName = (type === MemberType.Int) ? 'BigInt64' : 'BigUint64';
        const realName = `${access}${realTypeName}`;
        if (access === 'get') {
          const get = cb(realName);
          const min = BigInt(Number.MIN_SAFE_INTEGER);
          const max = BigInt(Number.MAX_SAFE_INTEGER);
          fn = function(offset, littleEndian) {
            const value = get.call(this, offset, littleEndian);
            if (min <= value && value <= max) {
              return Number(value);
            } else {
              return value;
            }
          };
        } else {
          const set = cb(realName);
          fn = function(offset, value, littleEndian) {
            // automatically convert number to bigint
            if (typeof(value) === 'number') {
              value = BigInt(value);
            }
            set.call(this, offset, value, littleEndian);
          };
        }
      } else if (bitSize === 32) {
        const realTypeName = (type === MemberType.Int) ? 'Int32' : 'Uint32';
        const realName = `${access}${realTypeName}`;
        if (access === 'get') {
          fn = cb(realName);
        } else {
          const set = cb(realName);
          fn = function(offset, value, littleEndian) {
            if (typeof(value) === 'bigint') {
              value = Number(value);
            }
            set.call(this, offset, value, littleEndian);
          };
        }
      }
    } else {
      fn = cb(name);
    }
    if (fn && fn.name !== name) {
      Object.defineProperty(fn, 'name', { value: name, configurable: true, writable: false });
    }
    methodCache[name] = fn;
  }
  return fn;
}

const methodCache = {};

const decoders = {};
const encoders = {};

function decodeText(arrays, encoding = 'utf-8') {
  let decoder = decoders[encoding];
  if (!decoder) {
    decoder = decoders[encoding] = new TextDecoder(encoding);
  }
  let array;
  if (Array.isArray(arrays)) {
    if (arrays.length === 1) {
      array = arrays[0];
    } else {
      let len = 0;
      for (const a of arrays) {
        len += a.length;
      }
      array = new Uint8Array(len);
      let offset = 0;
      for (const a of arrays) {
        array.set(a, offset);
        offset += a.length;
      }
    }
  } else {
    array = arrays;
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
      let encoder = encoders[encoding];
      if (!encoder) {
        encoder = encoders[encoding] = new TextEncoder();
      }
      return encoder.encode(text);
    }
  }
}

function addSpecialAccessors(s) {
  const {
    constructor,
    instance: {
      members,
    },
  } = s;
  Object.defineProperties(constructor.prototype, {
    dataView: { ...getDataViewAccessors(s), configurable: true },
    base64: { ...getBase64Accessors(), configurable: true },
    toJSON: { value: getValueOf, configurable: true, writable: true },
    valueOf: { value: getValueOf, configurable: true, writable: true },
  });
  if (canBeString(s)) {
    Object.defineProperty(constructor.prototype, 'string', {
      ...getStringAccessors(s), configurable: true
    });
  }
  if (canBeTypedArray(s)) {
    Object.defineProperty(constructor.prototype, 'typedArray', {
      ...getTypedArrayAccessors(s), configurable: true
    });
  }
}

function canBeString(s) {
  if (s.type === StructureType.Array || s.type === StructureType.Slice) {
    const { type, bitSize } = s.instance.members[0];
    if (type === MemberType.Uint && (bitSize === 8 || bitSize === 16)) {
      return true;
    }
  }
  return false;
}

function canBeTypedArray(s) {
  return !!s.typedArray;
}

function getSpecialKeys(s) {
  const keys = [ 'dataView', 'base64' ];
  if (canBeString(s)) {
    keys.push('string');
  }
  if (canBeTypedArray(s)) {
    keys.push('typedArray');
  }
  return keys;
}

function getDataViewAccessors(structure) {
  const { sentinel, type, byteSize } = structure;
  return {
    get() {
      /* WASM-ONLY */
      restoreMemory.call(this);
      /* WASM-ONLY-END */
      return this[MEMORY];
    },
    set(dv) {
      checkDataView(dv);
      const byteLength = byteSize * ((type === StructureType.Slice) ? this.length : 1);
      if (dv.byteLength !== byteLength) {
        throwBufferSizeMismatch(structure, dv, this);
      }
      const source = { [MEMORY]: dv };
      sentinel?.validateData(source, this.length);
      this[MEMORY_COPIER](source);
    },
  };
}

function checkDataView(dv) {
  if (dv?.[Symbol.toStringTag] !== 'DataView') {
    throwTypeMismatch('a DataView', dv);
  }
  return dv;
}

function getBase64Accessors() {
  return {
    get() {
      const dv = this.dataView;
      const ta = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const bstr = String.fromCharCode.apply(null, ta);
      return btoa(bstr);
    },
    set(str) {
      this.dataView = getDataViewFromBase64(str);
    }
  }
}

function getDataViewFromBase64(str) {
  if (typeof(str) !== 'string') {
    throwTypeMismatch('a string', str);
  }
  const bstr = atob(str);
  const ta = new Uint8Array(bstr.length);
  for (let i = 0; i < ta.byteLength; i++) {
    ta[i] = bstr.charCodeAt(i);
  }
  return new DataView(ta.buffer);
}

function getStringAccessors(structure) {
  const { sentinel, instance: { members: [ member ] } } = structure;
  const { byteSize } = member;
  return {
    get() {
      const dv = this.dataView;
      const TypedArray = (byteSize === 1) ? Int8Array : Int16Array;
      const ta = new TypedArray(dv.buffer, dv.byteOffset, this.length);
      const s = decodeText(ta, `utf-${byteSize * 8}`);
      return (sentinel?.value === undefined) ? s : s.slice(0, -1);
    },
    set(src) {
      this.dataView = getDataViewFromUTF8(src, byteSize, sentinel?.value);
    },
  };
}

function getDataViewFromUTF8(str, byteSize, sentinelValue) {
  if (typeof(str) !== 'string') {
    throwTypeMismatch('a string', str);
  }
  if (sentinelValue !== undefined) {
    if (str.charCodeAt(str.length - 1) !== sentinelValue) {
      str = str + String.fromCharCode(sentinelValue);
    }
  }
  const ta = encodeText(str, `utf-${byteSize * 8}`);
  return new DataView(ta.buffer);
}

function getTypedArrayAccessors(structure) {
  const { typedArray } = structure;
  return {
    get() {
      const dv = this.dataView;
      const length = dv.byteLength / typedArray.BYTES_PER_ELEMENT;
      return new typedArray(dv.buffer, dv.byteOffset, length);
    },
    set(ta) {
      this.dataView = getDataViewFromTypedArray(ta, typedArray);
    },
  };
}

function getDataViewFromTypedArray(ta, TypedArray) {
  if (!isTypedArray(ta, TypedArray)) {
    throwTypeMismatch(TypedArray.name, ta);
  }
  return new DataView(ta.buffer, ta.byteOffset, ta.byteLength);}

function getValueOf() {
  const map = new WeakMap();
  function extract(object) {
    if (object[Symbol.iterator]) {
      const array = [];
      for (const element of object) {
        array.push(extract(element));
      }
      return array;
    } else if (object && (typeof(object) === 'object' || typeof(object) === 'function')) {
      let result = map.get(object);
      if (!result) {
        result = {};
        map.set(object, result);
        for (const [ name, child ] of Object.entries(object)) {
          const childResult = extract(child);
          if (childResult !== undefined) {
            result[name] = childResult;
          }
        }
        return result;
      }
      return result;
    } else {
      return object;
    }
  }  return extract(this.$);
}

function finalizePrimitive(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  addTypedArray(s);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, align);
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const specialKeys = getSpecialKeys(s);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
    } else {
      if (arg && typeof(arg) === 'object') {
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty$1(s, key);
          }
        }
        let specialFound = 0;
        for (const key of specialKeys) {
          if (key in arg) {
            specialFound++;
          }
        }
        if (specialFound === 0) {
          const type = getPrimitiveType(member);
          throwInvalidInitializer(s, type, arg);
        }
        for (const key of specialKeys) {
          if (key in arg) {
            this[key] = arg[key];
          }
        }
      } else if (arg !== undefined) {
        this.$ = arg;
      }
    }
  };
  const { get, set } = getAccessors(member, options);
  defineProperties(constructor.prototype, {
    $: { get, set, configurable: true },
    [Symbol.toPrimitive]: { value: get, configurable: true, writable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
  });
  defineProperties(constructor, {
    [COMPAT]: { value: getCompatibleTags(s) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  addSpecialAccessors(s);
  return constructor;
}
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

function getPrimitiveClass({ type, bitSize }) {
  if (type === MemberType.Int || type === MemberType.Uint) {
    if (bitSize <= 32) {
      return Number;
    } else {
      return BigInt;
    }
  } else if (type === MemberType.Float) {
    return Number;
  } else if (type === MemberType.Bool) {
    return Boolean;
  }
}

function getPrimitiveType(member) {
  const Primitive = getPrimitiveClass(member);
  if (Primitive) {
    return typeof(Primitive(0));
  }
}

function finalizePointer(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
    isConst,
    options,
  } = s;
  const {
    runtimeSafety = true,
  } = options;
  const { structure: targetStructure } = member;
  const isTargetSlice = (targetStructure.type === StructureType.Slice);
  const isTargetPointer = (targetStructure.type === StructureType.Pointer);
  const hasLength = isTargetSlice && !targetStructure.sentinel;
  const addressSize = (hasLength) ? byteSize / 2 : byteSize;
  const { get: getAddress, set: setAddress } = getAccessors({
    type: MemberType.Uint,
    bitOffset: 0,
    bitSize: addressSize * 8,
    byteSize: addressSize,
    structure: { byteSize: addressSize },
  }, options);
  const { get: getLength, set: setLength } = (hasLength) ? getAccessors({
    type: MemberType.Uint,
    bitOffset: addressSize * 8,
    bitSize: addressSize * 8,
    byteSize: addressSize,
    structure: { name: 'usize', byteSize: addressSize },
  }, options) : {};
  const constructor = s.constructor = function(arg) {
    const calledFromEnviroment = this === ENVIRONMENT;
    const calledFromParent = this === PARENT;
    let creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, align);
    } else {
      self = Object.create(constructor.prototype);
      if (calledFromEnviroment || calledFromParent) {
        dv = requireDataView(s, arg);
      } else {
        const Target = targetStructure.constructor;
        if (isPointerOf(arg, Target)) {
          creating = true;
          arg = arg['*'];
        } else if (isTargetSlice) {
          // allow casting to slice through constructor of its pointer
          creating = true;
          arg = Target(arg);
        } else {
          throwNoCastingToPointer();
        }
        dv = env.createBuffer(byteSize, align);
      }
    }
    self[MEMORY] = dv;
    self[SLOTS] = { 0: null };
    if (creating) {
      initializer.call(self, arg);
    }
    return createProxy$1.call(self, isConst, isTargetPointer);
  };
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      if (env.isFixed(this[MEMORY])) {
        // initialize with the other pointer's target
        initializer.call(this, arg[SLOTS][0]);
      } else {
        // copy the object stored in slots 0, not copying memory of the other object
        // since the value stored there likely isn't valid
        copyPointer.call(this, { source: arg });
      }
    } else {
      const Target = targetStructure.constructor;
      if (isPointerOf(arg, Target)) {
        if (!isConst && arg.constructor.const) {
          throwConstantConstraint(s, arg);
        }
        copyPointer.call(this, { source: arg });
      } else {
        if (!(arg instanceof Target)) {
          if (isCompatible(arg, Target)) {
            // autocast to target type
            const dv = getDataView(targetStructure, arg);
            arg = Target(dv);
          } else if (isTargetSlice) {
            // autovivificate target object
            const autoObj = new Target(arg);
            if (runtimeSafety) {
              // creation of a new slice using a typed array is probably
              // not what the user wants; it's more likely that the intention
              // is to point to the typed array but there's a mismatch (e.g. u32 vs i32)
              if (targetStructure.typedArray && isBuffer(arg?.buffer)) {
                const created = addArticle(targetStructure.typedArray.name);
                const source = addArticle(arg.constructor.name);
                console.warn(`Implicitly creating ${created} from ${source}`);
              }
            }
            arg = autoObj;
          } else {
            throwInvalidPointerTarget(s, arg);
          }
        }
        if (env.isFixed(this[MEMORY])) {
          // the pointer sits in shared memory--apply the change immediately
          if (env.isFixed(arg[MEMORY])) {
            const address = env.getViewAddress(arg[MEMORY]);
            setAddress.call(this, address);
            if (setLength) {
              setLength.call(this, arg.length);
            }
          } else {
            throwFixedMemoryTargetRequired();
          }
        }
        this[SLOTS][0] = arg;
      }
    }
  };
  defineProperties(constructor.prototype, {
    '*': { get: getTarget, set: (isConst) ? undefined : setTarget, configurable: true },
    '$': { get: getProxy, set: initializer, configurable: true, },
    'valueOf': { value: getTargetValue, configurable: true, writable: true },
    [ADDRESS_GETTER]: { value: getAddress },
    [ADDRESS_SETTER]: { value: setAddress },
    [LENGTH_GETTER]: hasLength && { value: getLength },
    [LENGTH_SETTER]: hasLength && { value: setLength },
    [POINTER_VISITOR]: { value: visitPointer },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
  });
  defineProperties(constructor, {
    child: { get: () => targetStructure.constructor },
    const: { value: isConst },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  return constructor;
}

function getProxy() {
  return this[PROXY];
}

function copyPointer({ source, isActive = always }) {
  if (isActive(this)) {
    this[SLOTS][0] = source[SLOTS][0];
  }
}

function resetPointer({ isActive = always }) {
  if (!isActive(this)) {
    this[SLOTS][0] = null;
  }
}

function disablePointer() {
  Object.defineProperty(this[SLOTS], 0, {
    get: throwInaccessiblePointer,
    set: throwInaccessiblePointer,
    configurable: true
  });
}

function getTarget() {
  const object = this[SLOTS][0];
  return object.$;
}

function setTarget(value) {
  const object = this[SLOTS][0];
  object.$ = value;
}

function getTargetValue() {
  const object = this[SLOTS][0];
  return object.$.valueOf();
}

function visitPointer(fn, options = {}) {
  const {
    isActive = always,
    isMutable = always,
  } = options;
  fn.call(this, { isActive, isMutable });
}

function isPointerOf(arg, Target) {
  return (arg?.constructor?.child === Target && arg['*']);
}

function createProxy$1(isConst, isTargetPointer) {
  const handlers = (!isTargetPointer) ? (isConst) ? constProxyHandlers : proxyHandlers$1 : {};
  const proxy = new Proxy(this, handlers);
  // hide the proxy so console wouldn't display a recursive structure
  Object.defineProperty(this, PROXY, { value: proxy });
  return proxy;
}

const isPointerKeys = {
  '$': true,
  '*': true,
  constructor: true,
  valueOf: true,
  [SLOTS]: true,
  [MEMORY]: true,
  [PROXY]: true,
  [ADDRESS_GETTER]: true,
  [ADDRESS_SETTER]: true,
  [LENGTH_GETTER]: true,
  [LENGTH_SETTER]: true,
  [POINTER_VISITOR]: true,
  [Symbol.toStringTag]: true,
  [Symbol.toPrimitive]: true,
};

const proxyHandlers$1 = {
  get(pointer, name) {
    if (name === POINTER_SELF) {
      return pointer;
    } else if (isPointerKeys[name]) {
      return pointer[name];
    } else {
      return pointer[SLOTS][0][name];
    }
  },
  set(pointer, name, value) {
    if (isPointerKeys[name]) {
      pointer[name] = value;
    } else {
      pointer[SLOTS][0][name] = value;
    }
    return true;
  },
  deleteProperty(pointer, name) {
    if (isPointerKeys[name]) {
      delete pointer[name];
    } else {
      delete pointer[SLOTS][0][name];
    }
    return true;
  },
  has(pointer, name) {
    return isPointerKeys[name] || name in pointer[SLOTS][0];
  },
  ownKeys(pointer) {
    const targetKeys = Object.getOwnPropertyNames(pointer[SLOTS][0]);
    return [ ...targetKeys, PROXY, POINTER_VISITOR ];
  },
  getOwnPropertyDescriptor(pointer, name) {
    if (isPointerKeys[name]) {
      return Object.getOwnPropertyDescriptor(pointer, name);
    } else {
      return Object.getOwnPropertyDescriptor(pointer[SLOTS][0], name);
    }
  },
};

const constProxyHandlers = {
  ...proxyHandlers$1,
  set(pointer, name, value) {
    if (isPointerKeys[name]) {
      pointer[name] = value;
    } else {
      throwAssigningToConstant(pointer);
    }
    return true;
  },
  getOwnPropertyDescriptor(pointer, name) {
    if (isPointerKeys[name]) {
      return Object.getOwnPropertyDescriptor(pointer, name);
    } else {
      const descriptor = Object.getOwnPropertyDescriptor(pointer[SLOTS][0], name);
      if (descriptor?.set) {
        descriptor.set = undefined;
      }
      return descriptor;
    }
    /* c8 ignore next -- unreachable */
  },
};

function always() {
  return true;
}

function finalizeArray(s, env) {
  const {
    length,
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
    hasPointer,
    options,
  } = s;
  addTypedArray(s);
  const hasObject = (member.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, align);
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    self[GETTER] = null;
    self[SETTER] = null;
    if (hasObject) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(self, arg);
    }
    return createProxy.call(self);
  };
  const { structure: elementStructure } = member;
  const specialKeys = getSpecialKeys(s);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else {
      if (typeof(arg) === 'string' && specialKeys.includes('string')) {
        arg = { string: arg };
      }
      if (arg?.[Symbol.iterator]) {
        let argLen = arg.length;
        if (typeof(argLen) !== 'number') {
          arg = [ ...arg ];
          argLen = arg.length;
        }
        if (argLen !== length) {
          throwArrayLengthMismatch(s, this, arg);
        }
        let i = 0;
        for (const value of arg) {
          set.call(this, i++, value);
        }
      } else if (arg && typeof(arg) === 'object') {
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty(s, key);
          }
        }
        let specialFound = 0;
        for (const key of specialKeys) {
          if (key in arg) {
            specialFound++;
          }
        }
        if (specialFound === 0) {
          throwInvalidArrayInitializer(s, arg);
        }
        for (const key of specialKeys) {
          if (key in arg) {
            this[key] = arg[key];
          }
        }
      } else if (arg !== undefined) {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  const { get, set } = getAccessors(member, options);
  defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { value: length, configurable: true },
    $: { get: getProxy, set: initializer, configurable: true },
    entries: { value: createArrayEntries, configurable: true, writable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true, writable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(s) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor$1() },
  });
  defineProperties(constructor, {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(s) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  addSpecialAccessors(s);
  return constructor;
}

function getChildVivificator(s) {
  const { instance: { members: [ member ]} } = s;
  const { byteSize, structure } = member;
  return function getChild(index) {
    let object = this[SLOTS][index];
    if (!object) {
      const { constructor } = structure;
      const dv = this[MEMORY];
      const parentOffset = dv.byteOffset;
      const offset = parentOffset + byteSize * index;
      const childDV = new DataView(dv.buffer, offset, byteSize);
      object = this[SLOTS][index] = constructor.call(PARENT, childDV);
    }
    return object;
  };
}

function getPointerVisitor$1(s) {
  return function visitPointers(cb, options = {}) {
    const {
      source,
      vivificate = false,
      isActive = always,
      isMutable = always,
    } = options;
    const childOptions = {
      ...options,
      isActive: () => isActive(this),
      isMutable: () => isMutable(this),
    };
    for (let i = 0, len = this.length; i < len; i++) {
      // no need to check for empty slots, since that isn't possible
      if (source) {
        childOptions.source = source?.[SLOTS][i];
      }
      const child = (vivificate) ? this[CHILD_VIVIFICATOR](i) : this[SLOTS][i];
      if (child) {
        child[POINTER_VISITOR](cb, childOptions);
      }
    }
  };
}

function getArrayIterator() {
  const self = this[SELF] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = self.get(index);
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function getArrayEntriesIterator() {
  const self = this[SELF] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = [ index, self.get(index) ];
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function createArrayEntries() {
  return {
    [Symbol.iterator]: getArrayEntriesIterator.bind(this),
    length: this.length,
  };
}

function createProxy() {
  const proxy = new Proxy(this, proxyHandlers);
  // hide the proxy so console wouldn't display a recursive structure
  Object.defineProperty(this, PROXY, { value: proxy });
  return proxy;
}

const proxyHandlers = {
  get(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return array.get(index);
    } else {
      switch (name) {
        case 'get':
          if (!array[GETTER]) {
            array[GETTER] = array.get.bind(array);
          }
          return array[GETTER];
        case 'set':
          if (!array[SETTER]) {
            array[SETTER] = array.set.bind(array);
          }
          return array[SETTER];
        case SELF:
          return array;
        default:
          return array[name];
      }
    }
  },
  set(array, name, value) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      array.set(index, value);
    } else {
      switch (name) {
        case 'get':
          array[GETTER] = value;
          break;
        case 'set':
          array[SETTER] = value;
          break;
        default:
          array[name] = value;
      }
    }
    return true;
  },
  deleteProperty(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return false;
    } else {
      switch (name) {
        case 'get':
          delete array[GETTER];
          break;
        case 'set':
          delete array[SETTER];
          break;
        default:
          delete array[name];
      }
      return true;
    }
  },
  has(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return (index >= 0 && index < array.length);
    } else {
      return array[name];
    }
  },
  ownKeys(array) {
    const keys = [];
    for (let i = 0, len = array.length; i < len; i++) {
      keys.push(`${i}`);
    }
    keys.push('length', PROXY);
    return keys;
  },
  getOwnPropertyDescriptor(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      if (index >= 0 && index < array.length) {
        return { value: array.get(index), enumerable: true, writable: true, configurable: true };
      }
    } else {
      return Object.getOwnPropertyDescriptor(array, name);
    }
  },
};

function addStaticMembers(s, env) {
  const {
    constructor,
    static: {
      members,
      template,
    },
    options,
  } = s;
  const vivificators = {};
  for (const member of members) {
    // static members are either Pointer or Type
    let { get, set } = getAccessors(member, options);
    const { type, slot, structure: { isConst } } = member;
    if (type === MemberType.Object) {
      const getPtr = get;
      get = function() {
        // dereference pointer
        const ptr = getPtr.call(this);
        return ptr['*'];
      };
      set = (isConst) ? undefined : function(value) {
        const ptr = getPtr.call(this);
        ptr['*'] = value;
      };
      vivificators[slot] = () => template[SLOTS][slot];
    }
    Object.defineProperty(constructor, member.name, { get, set, configurable: true, enumerable: true });
  }
  Object.defineProperty(constructor, CHILD_VIVIFICATOR, { value: vivificators });
}

function addMethods(s, env) {
  const {
    constructor,
    instance: { methods: instanceMembers },
    static: { methods: staticMethods },
  } = s;
  for (const method of staticMethods) {
    const f = env.createCaller(method, false);
    Object.defineProperty(constructor, f.name, { value: f, configurable: true, writable: true });
  }
  for (const method of instanceMembers) {
    const f = env.createCaller(method, true);
    Object.defineProperty(Object.prototype, f.name, { value: f, configurable: true, writable: true });
  }
}

function finalizeStruct(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members,
      template,
    },
    hasPointer,
    options,
  } = s;
  const descriptors = {};
  for (const member of members) {
    if (member.type === MemberType.Comptime) {
      // extract value of comptime field from template
      const { slot } = member;
      const pointer = template[SLOTS][slot];
      const value = pointer['*'];
      descriptors[member.name] = { value, configurable: true, enumerable: true };
      delete template[SLOTS][slot];
    } else {
      const { get, set } = getAccessors(member, options);
      descriptors[member.name] = { get, set, configurable: true, enumerable: true };
    }
  }
  const keys = Object.keys(descriptors);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, align);
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    self[MEMORY] = dv;
    Object.defineProperties(self, descriptors);
    if (hasObject) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const specialKeys = getSpecialKeys(s);
  const requiredKeys = members.filter(m => m.isRequired).map(m => m.name);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else {
      if (arg && typeof(arg) === 'object') {
        // checking each name so that we would see inenumerable initializers as well
        let found = 0;
        for (const key of keys) {
          if (key in arg) {
            found++;
          }
        }
        let requiredFound = 0;
        for (const key of requiredKeys) {
          if (key in arg) {
            requiredFound++;
          }
        }
        let specialFound = 0;
        if (!arg[MEMORY]) {
          // only look for special keys in non-zigar objects
          for (const key of specialKeys) {
            if (key in arg) {
              specialFound++;
            }
          }
        }
        // don't accept unknown enumerable props
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty$1(s, key);
          }
        }
        if (specialFound === 0 && requiredFound < requiredKeys.length) {
          throwMissingInitializers(s, arg);
        }
        // apply default values unless all properties are initialized
        if (template && specialFound === 0 && found < keys.length) {
          if (template[MEMORY]) {
            this[MEMORY_COPIER](template);
          }
          if (hasPointer) {
            this[POINTER_VISITOR](copyPointer, { vivificate: true, source: template });
          }
        }
        if (specialFound > 0) {
          for (const key of specialKeys) {
            if (key in arg) {
              this[key] = arg[key];
            }
          }
        } else if (found > 0) {
          for (const key of keys) {
            if (key in arg) {
              this[key] = arg[key];
            }
          }
        }
      } else if (arg !== undefined) {
        throwInvalidInitializer(s, 'object', arg);
      }
    }
  };
  defineProperties(constructor.prototype, {
    '$': { get: getSelf, set: initializer, configurable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificators(s) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s, always) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  addSpecialAccessors(s);
  addStaticMembers(s);
  addMethods(s, env);
  return constructor;
}

function getChildVivificators(s) {
  const { instance: { members } } = s;
  const objectMembers = members.filter(m => m.type === MemberType.Object);
  const vivificators = {};
  for (const { slot, bitOffset, byteSize, structure } of objectMembers) {
    vivificators[slot] = function getChild() {
      let object = this[SLOTS][slot];
      if (!object) {
        const { constructor } = structure;
        const dv = this[MEMORY];
        const parentOffset = dv.byteOffset;
        const offset = parentOffset + (bitOffset >> 3);
        const childDV = new DataView(dv.buffer, offset, byteSize);
        object = this[SLOTS][slot] = constructor.call(PARENT, childDV);
      }
      return object;
    };
  }
  return vivificators;
}

function getPointerVisitor(s, visitorOptions = {}) {
  const {
    isChildActive = always,
    isChildMutable = always,
  } = visitorOptions;
  const { instance: { members } } = s;
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  return function visitPointers(cb, options = {}) {
    const {
      source,
      vivificate = false,
      isActive = always,
      isMutatable = always,
    } = options;
    const childOptions = {
      ...options,
      isActive: (object) => {
        // make sure parent object is active, then check whether the child is active
        return isActive(this) && isChildActive.call(this, object);
      },
      isMutatable: (object) => {
        return isMutatable(this) && isChildMutable.call(this, object);
      },
    };
    for (const { slot } of pointerMembers) {
      if (source) {
        // when src is a the struct's template, most slots will likely be empty,
        // since pointer fields aren't likely to have default values
        const srcChild = source[SLOTS]?.[slot];
        if (!srcChild) {
          continue;
        }
        childOptions.source = srcChild;
      }
      const child = (vivificate) ? this[CHILD_VIVIFICATOR][slot].call(this) : this[SLOTS][slot];
      if (child) {
        child[POINTER_VISITOR](cb, childOptions);
      }
    }
  };
}

function finalizeUnion(s, env) {
  const {
    type,
    byteSize,
    align,
    instance: {
      members,
      template,
    },
    options,
    hasPointer,
  } = s;
  const {
    runtimeSafety = true,
  } = options;
  const descriptors = {};
  let getEnumItem;
  let valueMembers;
  const isTagged = (type === StructureType.TaggedUnion);
  const exclusion = (isTagged || (type === StructureType.BareUnion && runtimeSafety));
  let getName, setName;
  if (exclusion) {
    valueMembers = members.slice(0, -1);
    const selectorMember = members[members.length - 1];
    const { get: getSelector, set: setSelector } = getAccessors(selectorMember, options);
    if (type === StructureType.TaggedUnion) {
      const { structure: { constructor } } = selectorMember;
      getEnumItem = getSelector;
      getName = function() {
        const item = getSelector.call(this);
        return item[ENUM_NAME];
      };
      setName = function(name) {
        setSelector.call(this, constructor[name]);
      };
    } else {
      const names = valueMembers.map(m => m.name);
      getName = function() {
        const index = getSelector.call(this);
        return names[index];
      };
      setName = function(name) {
        const index = names.indexOf(name);
        setSelector.call(this, index);
      };
    }
    for (const member of valueMembers) {
      const { name, slot, structure: { hasPointer } } = member;
      const { get: getValue, set: setValue } = getAccessors(member, options);
      const update = (isTagged) ? function(name) {
        if (this[TAG]?.name !== name) {
          this[TAG]?.clear?.();
          this[TAG] = { name };
          if (hasPointer) {
            this[TAG].clear = () => {
              const object = this[SLOTS][slot];
              object[POINTER_VISITOR](resetPointer);
            };
          }
        }
      } : null;
      const get = function() {
        const currentName = getName.call(this);
        update?.call(this, currentName);
        if (name !== currentName) {
          if (isTagged) {
            return null;
          } else {
            throwInactiveUnionProperty(s, name, currentName);
          }
        }
        return getValue.call(this);
      };
      const set = function(value) {
        const currentName = getName.call(this);
        update?.call(this, currentName);
        if (name !== currentName) {
          throwInactiveUnionProperty(s, name, currentName);
        }
        setValue.call(this, value);
      };
      const init = function(value) {
        setName.call(this, name);
        setValue.call(this, value);
        update?.call(this, name);
      };
      descriptors[member.name] = { get, set, init, update, configurable: true, enumerable: true };
    }
  } else {
    // extern union
    valueMembers = members;
    for (const member of members) {
      const { get, set } = getAccessors(member, options);
      descriptors[member.name] = { get, set, init: set, configurable: true, enumerable: true };
    }
  }
  if (isTagged) {
    descriptors[TAG] = { value: null, writable: true };
  }
  const keys = Object.keys(descriptors);
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const pointerMembers = members.filter(m => m.structure.hasPointer);
  // non-tagged union as marked as not having pointers--if there're actually
  // members with pointers, we need to disable them
  const hasInaccessiblePointer = !hasPointer && (pointerMembers.length > 0);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, align);
    } else {
      self = Object.create(constructor.prototype);
      dv = getDataView(s, arg);
    }
    self[MEMORY] = dv;
    defineProperties(self, descriptors);
    if (hasObject) {
      self[SLOTS] = {};
      if (hasInaccessiblePointer) {
        // make pointer access throw
        self[POINTER_VISITOR](disablePointer, { vivificate: true });
      }
    }
    if (creating) {
      initializer.call(self, arg);
    }
    if (isTagged) {
      return new Proxy(self, taggedProxyHandlers);
    } else {
      return (creating) ? undefined : self;
    }
  };
  const hasDefaultMember = !!valueMembers.find(m => !m.isRequired);
  const specialKeys = getSpecialKeys(s);
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      /* WASM-ONLY-END */
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
      }
    } else {
      if (arg && typeof(arg) === 'object') {
        // checking each name so that we would see inenumerable initializers as well
        let found = 0;
        for (const key of keys) {
          if (key in arg) {
            found++;
          }
        }
        let specialFound = 0;
        if (!arg[MEMORY]) {
          for (const key of specialKeys) {
            if (key in arg) {
              specialFound++;
            }
          }
        }
        // don't accept unknown enumerable props
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty$1(s, key);
          }
        }
        if (found !== 1) {
          if (found === 0) {
            if (specialFound === 0 && !hasDefaultMember) {
              throwMissingUnionInitializer(s, arg, exclusion);
            }
          } else {
            throwMultipleUnionInitializers(s);
          }
        }
        if (specialFound > 0) {
          for (const key of specialKeys) {
            if (key in arg) {
              this[key] = arg[key];
            }
          }
        } else if (found === 0) {
          if (template) {
            this[MEMORY_COPIER](template);
            if (hasPointer) {
              this[POINTER_VISITOR](copyPointer, { vivificate: true, source: template });
            }
          }
        } else {
          for (const key of keys) {
            if (key in arg) {
              // can't just set the property, since it would throw when a field other than the
              // active one is being set
              const { init } = descriptors[key];
              init.call(this, arg[key]);
            }
          }
        }
      } else if (arg !== undefined) {
        throwInvalidInitializer(s, 'object with a single property', arg);
      }
    }
  };
  const isChildActive = function(child) {
    const name = getName.call(this);
    const active = this[name];
    return child === active;
  };
  const hasAnyPointer = hasPointer || hasInaccessiblePointer;
  defineProperties(constructor.prototype, {
    '$': { get: getSelf, set: initializer, configurable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [ENUM_ITEM]: isTagged && { get: getEnumItem, configurable: true },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificators(s) },
    [POINTER_VISITOR]: hasAnyPointer && { value: getPointerVisitor(s, { isChildActive }) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  addSpecialAccessors(s);
  addStaticMembers(s);
  addMethods(s, env);
  return constructor;
}
const taggedProxyHandlers = {
  ownKeys(union) {
    const item = union[ENUM_ITEM];
    const name = item[ENUM_NAME];
    return [ name, MEMORY, TAG ];
  },
};

function finalizeErrorUnion(s, env) {
  const {
    byteSize,
    align,
    instance: { members },
    options,
    hasPointer,
  } = s;
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getError, set: setError } = getAccessors(members[1], options);
  const { structure: errorStructure } = members[1];
  const { constructor: ErrorSet } = errorStructure;
  const set = function(value) {
    if (value instanceof Error) {
      if (!(value instanceof ErrorSet)) {
        throwNotInErrorSet(errorStructure);
      }
      this[MEMORY_RESETTER]();
      this[POINTER_VISITOR]?.(resetPointer);
      setError.call(this, value.index);
    } else {
      setValue.call(this, value);
      setError.call(this, 0);
    }
  };
  const get = function() {
    const errorNumber = getError.call(this);
    if (errorNumber !== 0) {
      const err = ErrorSet(errorNumber);
      if (!err) {
        throwUnknownErrorNumber(errorStructure, errorNumber);
      }
      throw err;
    } else {
      return getValue.call(this);
    }
  };
  const check = function() {
    const errorNumber = getError.call(this);
    return (errorNumber === 0);
  };
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, align);
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (hasObject) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(this, arg);
    } else {
      return self;
    }
  };
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        if (check.call(this)) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      }
    } else {
      this.$ = arg;
    }
  };
  defineProperties(constructor.prototype, {
    '$': { get, set, configurable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [MEMORY_RESETTER]: { value: getMemoryResetter(byteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificators(s) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s, { isChildActive: check }) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  addSpecialAccessors(s);
  return constructor;
}

let currentErrorSets;

function finalizeErrorSet(s, env) {
  const {
    name,
    instance: {
      members,
    },
  } = s;
  const errors = currentErrorSets;
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    if (creating) {
      throwNoNewError(s);
    }
    const index = Number(arg);
    return errors[index];
  };
  Object.setPrototypeOf(constructor.prototype, Error.prototype);
  let errorIndices;
  const errorDescriptors = {};
  for (const [ index, { name, slot } ] of members.entries()) {
    let error = errors[slot];
    if (error) {
      // error already exists in a previously defined set
      // see if we should make that set a subclass or superclass of this one
      if (!(error instanceof constructor)) {
        if (!errorIndices) {
          errorIndices = members.map(m => m.slot);
        }
        const otherSet = error.constructor;
        const otherErrors = Object.values(otherSet);
        if (otherErrors.every(e => errorIndices.includes(e[ERROR_INDEX]))) {
          // this set contains the all errors of the other one, so it's a superclass
          Object.setPrototypeOf(otherSet.prototype, constructor.prototype);
        } else {
          // make this set a subclass of the other
          Object.setPrototypeOf(constructor.prototype, otherSet.prototype);
          for (const otherError of otherErrors) {
            if (errorIndices.includes(otherError[ERROR_INDEX])) {
              // this set should be this error object's class
              Object.setPrototypeOf(otherError, constructor.prototype);
            }
          }
        }
      }
    } else {
      // need to create the error object--can't use the constructor since it would throw
      error = Object.create(constructor.prototype);
      const message = decamelizeErrorName(name);
      defineProperties(error, {
        message: { value: message, configurable: true, enumerable: true, writable: false },
        [ERROR_INDEX]: { value: slot },
      });
      errors[slot] = error;
    }
    errorDescriptors[name] = { value: error, configurable: true, enumerable: true, writable: true };
  }
  const getIndex = function() { return this[ERROR_INDEX] };
  const toStringTag = function() { return 'Error' };
  defineProperties(constructor.prototype, {
    // provide a way to retrieve the error index
    index: { get: getIndex, configurable: true },
    // ensure that libraries that rely on the string tag for type detection will
    // correctly identify the object as an error
    [Symbol.toStringTag]: { get: toStringTag, configurable: true },
  });
  defineProperties(constructor, errorDescriptors);
  return constructor;
}
function initializeErrorSets() {
  currentErrorSets = {};
}

function finalizeEnumeration(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members,
      template,
    },
    options,
  } = s;
  const Primitive = getPrimitiveClass(members[0]);
  const { get: getValue } = getAccessors(members[0], options);
  const count = members.length;
  const items = {};
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    if (creating) {
      // the "constructor" is only used to convert a number into an enum object
      // new enum items cannot be created
      throwNoNewEnum(s);
    }
    if (typeof(arg) === 'number' || typeof(arg) === 'bigint') {
      let index = -1;
      if (isSequential) {
        // normal enums start at 0 and go up, so the value is the index
        index = Number(arg);
      } else {
        // values aren't sequential, so we need to compare values
        const given = Primitive(arg);
        for (let i = 0; i < count; i++) {
          const value = getValue.call(constructor, i);
          if (value === given) {
            index = i;
            break;
          }
        }
      }
      // return the enum object (created down below)
      return items[index];
    } else if (arg && typeof(arg) === 'object' && arg[ENUM_ITEM]) {
      // a tagged union, return the active tag
      return arg[ENUM_ITEM];
    } else if (typeof(arg)  === 'string') {
      return constructor[arg];
    } else {
      throwInvalidInitializer(s, [ 'number', 'string', 'tagged union' ], arg);
    }
  };
  const valueOf = function() {
    const index = this[ENUM_INDEX] ;
    return getValue.call(constructor, index);
  };
  defineProperties(constructor.prototype, {
    [Symbol.toPrimitive]: { value: valueOf, configurable: true, writable: true },
    $: { get: valueOf, configurable: true },
  });
  // now that the class has the right hidden properties, getValue() will work
  // scan the array to see if the enum's numeric representation is sequential
  const isSequential = (() => {
    // try-block in the event that the enum has bigInt items
    try {
      for (let i = 0; i < count; i++) {
        if (getValue.call(constructor, i) !== i) {
          return false;
        }
      }
      return true;
      /* c8 ignore next 3 */
    } catch (err) {
      return false;
    }
  })();
  // attach the enum items to the constructor
  const itemDescriptors = {};
  for (const [ index, { name } ] of members.entries()) {
    // can't use the constructor since it would throw
    const item = Object.create(constructor.prototype);
    defineProperties(item, {
      [ENUM_INDEX]: { value: index },
      [ENUM_NAME]: { value: name },
    });
    itemDescriptors[name] = { value: item, configurable: true, enumerable: true, writable: true };
    items[index] = item;
  }
  // attach the numeric values to the class as its binary data
  // this allows us to reuse the array getter
  defineProperties(constructor, {
    ...itemDescriptors,
    [MEMORY]: { value: template[MEMORY] },
    [ENUM_ITEMS]: { value: items },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  addSpecialAccessors(s);
  addStaticMembers(s);
  addMethods(s, env);
  return constructor;
}

function finalizeOptional(s, env) {
  const {
    byteSize,
    align,
    instance: { members },
    options,
    hasPointer,
  } = s;
  const { get: getValue, set: setValue } = getAccessors(members[0], options);
  const { get: getPresent, set: setPresent } = getAccessors(members[1], options);
  const get = function() {
    const present = getPresent.call(this);
    if (present) {
      return getValue.call(this);
    } else {
      return null;
    }
  };
  const set = function(value) {
    if (value != null) {
      setPresent.call(this, true);
      setValue.call(this, value);
    } else {
      this[MEMORY_RESETTER]();
      this[POINTER_VISITOR]?.(resetPointer);
    }
  };
  const check = getPresent;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, align);
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (hasObject) {
      self[SLOTS] = {};
    }
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        // don't bother copying pointers when it's empty
        if (check.call(this)) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      }
    } else {
      this.$ = arg;
    }
  };
  defineProperties(constructor.prototype, {
    '$': { get, set, configurable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [MEMORY_RESETTER]: { value: getMemoryResetter(byteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificators(s) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s, { isChildActive: check }) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  addSpecialAccessors(s);
  return constructor;
}

function finalizeSlice(s, env) {
  const {
    align,
    instance: {
      members: [ member ],
    },
    hasPointer,
    options,
  } = s;
  const typedArray = addTypedArray(s);
  const hasObject = (member.type === MemberType.Object);
  const { byteSize: elementSize, structure: elementStructure } = member;
  const sentinel = getSentinel(s, options);
  if (sentinel) {
    // zero-terminated strings aren't expected to be commonly used
    // so we're not putting this prop into the standard structure
    s.sentinel = sentinel;
  }
  // the slices are different from other structures due to variability of their sizes
  // we only know the "shape" of an object after we've processed the initializers
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      initializer.call(self, arg);
    } else {
      self = Object.create(constructor.prototype);
      const dv = requireDataView(s, arg);
      shapeDefiner.call(self, dv, dv.byteLength / elementSize, this);
    }
    return createProxy.call(self);
  };
  const specialKeys = getSpecialKeys(s);
  const shapeDefiner = function(dv, length) {
    if (!dv) {
      dv = env.createBuffer(length * elementSize, align);
    }
    this[MEMORY] = dv;
    this[GETTER] = null;
    this[SETTER] = null;
    this[LENGTH] = length;
    if (hasObject) {
      this[SLOTS] = {};
    }
  };
  const shapeChecker = function(arg, length) {
    if (length !== this[LENGTH]) {
      throwArrayLengthMismatch(s, this, arg);
    }
  };
  // the initializer behave differently depending on whether it's called  by the
  // constructor or by a member setter (i.e. after object's shape has been established)
  const initializer = function(arg) {
    let shapeless = !this.hasOwnProperty(MEMORY);
    if (arg instanceof constructor) {
      if (shapeless) {
        shapeDefiner.call(this, null, arg.length);
      } else {
        shapeChecker.call(this, arg, arg.length);
      }
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        this[POINTER_VISITOR](copyPointer, { source: arg });
      }
    } else {
      if (typeof(arg) === 'string' && specialKeys.includes('string')) {
        arg = { string: arg };
      }
      if (arg?.[Symbol.iterator]) {
        let argLen = arg.length;
        if (typeof(argLen) !== 'number') {
          arg = [ ...arg ];
          argLen = arg.length;
        }
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, argLen);
        } else {
          shapeChecker.call(this, arg, argLen);
        }
        let i = 0;
        for (const value of arg) {
          sentinel?.validateValue(value, i, argLen);
          set.call(this, i++, value);
        }
      } else if (typeof(arg) === 'number') {
        if (shapeless && arg >= 0 && isFinite(arg)) {
          shapeDefiner.call(this, null, arg);
        } else {
          throwInvalidArrayInitializer(s, arg, shapeless);
        }
      } else if (arg && typeof(arg) === 'object') {
        for (const key of Object.keys(arg)) {
          if (!(key in this)) {
            throwNoProperty$1(s, key);
          }
        }
        let specialFound = 0;
        for (const key of specialKeys) {
          if (key in arg) {
            specialFound++;
          }
        }
        if (specialFound === 0) {
          throwInvalidArrayInitializer(s, arg);
        }
        for (const key of specialKeys) {
          if (key in arg) {
            if (shapeless) {
              // can't use accessors since the object has no memory yet
              let dv, dup = true;
              switch (key) {
                case 'dataView':
                  dv = arg[key];
                  checkDataView(dv);
                  break;
                case 'typedArray':
                  dv = getDataViewFromTypedArray(arg[key], typedArray);
                  break;
                case 'string':
                  dv = getDataViewFromUTF8(arg[key], elementSize, sentinel?.value);
                  dup = false;
                  break;
                case 'base64':
                  dv = getDataViewFromBase64(arg[key]);
                  dup = false;
                  break;
              }
              checkDataViewSize(s, dv);
              const len = dv.byteLength / elementSize;
              const source = { [MEMORY]: dv };
              sentinel?.validateData(source, len);
              if (dup) {
                shapeDefiner.call(this, null, len);
                this[MEMORY_COPIER](source);
              } else {
                // reuse memory from string decoding
                shapeDefiner.call(this, dv, len);
              }
              shapeless = false;
            } else {
              this[key] = arg[key];
            }
          }
        }
      } else if (arg !== undefined) {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  const { get, set } = getAccessors(member, options);
  defineProperties(constructor.prototype, {
    get: { value: get, configurable: true, writable: true },
    set: { value: set, configurable: true, writable: true },
    length: { get: getLength, configurable: true },
    $: { get: getSelf, set: initializer, configurable: true },
    entries: { value: createArrayEntries, configurable: true, writable: true },
    [Symbol.iterator]: { value: getArrayIterator, configurable: true, writable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(elementSize, true) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(s) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor$1() }
  });
  defineProperties(constructor, {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(s) },
    [ALIGN]: { value: align },
    [SIZE]: { value: elementSize },
    [SENTINEL]: sentinel && { value: sentinel },
  });
  addSpecialAccessors(s);
  return constructor;
}

function getLength() {
  return this[LENGTH];
}

function getSentinel(structure, options) {
  const {
    runtimeSafety = true,
  } = options;
  const {
    byteSize,
    instance: { members: [ member, sentinel ], template },
  } = structure;
  if (!sentinel) {
    return;
  }
  const { get: getSentinelValue } = getAccessors(sentinel, options);
  const value = getSentinelValue.call(template, 0);
  const { get } = getAccessors(member, options);
  const validateValue = (runtimeSafety) ? function(v, i, l) {
    if (v === value && i !== l - 1) {
      throwMisplacedSentinel(structure, v, i, l);
    } else if (v !== value && i === l - 1) {
      throwMissingSentinel(structure, value, i);
    }
  } : function(v, i, l) {
    if (v !== value && i === l - 1) {
      throwMissingSentinel(structure, value, l);
    }
  };
  const validateData = (runtimeSafety) ? function(source, len) {
    for (let i = 0; i < len; i++) {
      const v = get.call(source, i);
      if (v === value && i !== len - 1) {
        throwMisplacedSentinel(structure, value, i, len);
      } else if (v !== value && i === len - 1) {
        throwMissingSentinel(structure, value, len);
      }
    }
  } : function(source, len) {
    if (len * byteSize === source[MEMORY].byteLength) {
      const i = len - 1;
      const v = get.call(source, i);
      if (v !== value) {
        throwMissingSentinel(structure, value, len);
      }
    }
  };
  const bytes = template[MEMORY];
  return { value, bytes, validateValue, validateData };
}

function finalizeVector(s, env) {
  const {
    length,
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
    options,
  } = s;
  addTypedArray(s);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, align);
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    if (creating) {
      initializer.call(self, arg);
    } else {
      return self;
    }
  };
  const { bitSize: elementBitSize, structure: elementStructure } = member;
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
    } else {
      if (arg?.[Symbol.iterator]) {
        let argLen = arg.length;
        if (typeof(argLen) !== 'number') {
          arg = [ ...arg ];
          argLen = arg.length;
        }
        if (argLen !== length) {
          throwArrayLengthMismatch(s, this, arg);
        }
        let i = 0;
        for (const value of arg) {
          this[i++] = value;
        }
      } else if (arg !== undefined) {
        throwInvalidArrayInitializer(s, arg);
      }
    }
  };
  const elementDescriptors = {};
  for (let i = 0, bitOffset = 0; i < length; i++, bitOffset += elementBitSize) {
    const { get, set } = getAccessors({ ...member, bitOffset }, options);
    elementDescriptors[i] = { get, set, configurable: true };
  }
  defineProperties(constructor.prototype, {
    ...elementDescriptors,
    length: { value: length, configurable: true },
    entries: { value: createVectorEntries, configurable: true, writable: true },
    $: { get: getSelf, set: initializer, configurable: true },
    [Symbol.iterator]: { value: getVectorIterator, configurable: true, writable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
  });
  defineProperties(constructor, {
    child: { get: () => elementStructure.constructor },
    [COMPAT]: { value: getCompatibleTags(s) },
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  addSpecialAccessors(s);
  return constructor;
}

function getVectorIterator() {
  const self = this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        value = self[index];
        done = false;
        index++;
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
        value = [ index, self[index] ];
        done = false;
        index++;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function createVectorEntries() {
  return {
    [Symbol.iterator]: getVectorEntriesIterator.bind(this),
    length: this.length,
  };
}

function finalizeArgStruct(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members,
    },
    hasPointer,
    options,
  } = s;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(args) {
    const dv = env.createBuffer(byteSize, align);
    this[MEMORY] = dv;
    if (hasObject) {
      this[SLOTS] = {};
    }
    initializer.call(this, args);
  };
  const argNames = members.slice(0, -1).map(m => m.name);
  const argCount = argNames.length;
  const initializer = function(args) {
    if (args.length !== argCount) {
      throwArgumentCountMismatch(s, args.length);
    }
    for (const [ index, name ] of argNames.entries()) {
      try {
        this[name] = args[index];
      } catch (err) {
        rethrowArgumentError(s, index, err);
      }
    }
  };
  const memberDescriptors = {};
  for (const member of members) {
    memberDescriptors[member.name] = getAccessors(member, options);
  }
  const isChildMutable = function(object) {
    return (object === this.retval);
  };
  defineProperties(constructor.prototype, {
    ...memberDescriptors,
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificators(s) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s, { isChildMutable }) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  return constructor;
}

const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ArgStruct: 3,
  ExternUnion: 4,
  BareUnion: 5,
  TaggedUnion: 6,
  ErrorUnion: 7,
  ErrorSet: 8,
  Enumeration: 9,
  Optional: 10,
  Pointer: 11,
  Slice: 12,
  Vector: 13,
  Opaque: 14,
  Function: 15,
};

const factories$1 = Array(Object.values(StructureType).length);

function usePrimitive() {
  factories$1[StructureType.Primitive] = finalizePrimitive;
}

function useArray() {
  factories$1[StructureType.Array] = finalizeArray;
}

function useStruct() {
  factories$1[StructureType.Struct] = finalizeStruct;
}

function useExternUnion() {
  factories$1[StructureType.ExternUnion] = finalizeUnion;
}

function useBareUnion() {
  factories$1[StructureType.BareUnion] = finalizeUnion;
}

function useTaggedUnion() {
  factories$1[StructureType.TaggedUnion] = finalizeUnion;
}

function useErrorUnion() {
  factories$1[StructureType.ErrorUnion] = finalizeErrorUnion;
}

function useErrorSet() {
  factories$1[StructureType.ErrorSet] = finalizeErrorSet;
}

function useEnumeration() {
  factories$1[StructureType.Enumeration] = finalizeEnumeration;
}

function useOptional() {
  factories$1[StructureType.Optional] = finalizeOptional;
}

function usePointer() {
  factories$1[StructureType.Pointer] = finalizePointer;
}

function useSlice() {
  factories$1[StructureType.Slice] = finalizeSlice;
}

function useVector() {
  factories$1[StructureType.Vector] = finalizeVector;
}

function useOpaque() {
  factories$1[StructureType.Opaque] = finalizeStruct;
}

function useArgStruct() {
  factories$1[StructureType.ArgStruct] = finalizeArgStruct;
}

function getStructureName(s, full = false) {
  let r = s.name;
  if (!full) {
    r = r.replace(/{.*}/, '');
    r = r.replace(/[^. ]*?\./g, '');
  }
  return r;
}

function getStructureFactory(type) {
  const f = factories$1[type];
  return f;
}

function getStructureFeature(structure) {
  const { type } = structure;
  const [ name ] = Object.entries(StructureType).find(a => a[1] === type);
  return `use${name}`;
}

function defineProperties(object, descriptors) {
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    if (descriptor) {
      Object.defineProperty(object, name, descriptor);
    }
  }
  for (const symbol of Object.getOwnPropertySymbols(descriptors)) {
    const descriptor = descriptors[symbol];
    if (descriptor) {
      Object.defineProperty(object, symbol, descriptor);
    }
  }
}

function getSelf() {
  return this;
}

function useAllStructureTypes() {
  usePrimitive();
  useArray();
  useStruct();
  useArgStruct();
  useExternUnion();
  useBareUnion();
  useTaggedUnion();
  useErrorUnion();
  useErrorSet();
  useEnumeration();
  useOptional();
  usePointer();
  useSlice();
  useVector();
  useOpaque();
}

const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Uint: 3,
  Float: 4,
  EnumerationItem: 5,
  Object: 6,
  Type: 7,
  Comptime: 8,
};

const factories = Array(Object.values(MemberType).length);

function useVoid() {
  factories[MemberType.Void] = getVoidAccessor;
}

function useBoolEx() {
  factories[MemberType.Bool] = getBoolAccessorEx;
}

function useIntEx() {
  factories[MemberType.Int] = getIntAccessorEx;
}

function useUintEx() {
  factories[MemberType.Uint] = getUintAccessorEx;
}

function useFloatEx() {
  factories[MemberType.Float] = getFloatAccessorEx;
}

function useEnumerationItemEx() {
  factories[MemberType.EnumerationItem] = getEnumerationItemAccessorEx;
}

function useObject() {
  factories[MemberType.Object] = getObjectAccessor;
}

function useType() {
  factories[MemberType.Type] = getTypeAccessor;
}

function getMemberFeature(member) {
  const { type, bitSize } = member;
  switch (type) {
    case MemberType.Int:
      if(isByteAligned(member) && (bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64)) {
        return 'useInt';
      } else {
        return 'useIntEx';
      }
    case MemberType.Uint:
      if(isByteAligned(member) && (bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64)) {
        return 'useUint';
      } else {
        return 'useUintEx';
      }
    case MemberType.EnumerationItem:
      if(isByteAligned(member) && bitSize <= 64) {
        return 'useEnumerationItem';
      } else {
        return 'useEnumerationItemEx';
      }
    case MemberType.Float:
      if (isByteAligned(member) && (bitSize === 32 || bitSize === 64)) {
        return 'useFloat';
      } else {
        return 'useFloatEx';
      }
    case MemberType.Bool:
      if (isByteAligned(member)) {
        return 'useBool';
      } else {
        return 'useBoolEx';
      }
    case MemberType.Object:
      return 'useObject';
    case MemberType.Void:
      return 'useVoid';
    case MemberType.Type:
      return 'useType';
  }
}

function isByteAligned({ bitOffset, bitSize, byteSize }) {
  return byteSize !== undefined || (!(bitOffset & 0x07) && !(bitSize & 0x07)) || bitSize === 0;
}

function getAccessors(member, options = {}) {
  const f = factories[member.type];
  return {
    get: f('get', member, options),
    set: f('set', member, options)
  };
}

function getVoidAccessor(type, member, options) {
  const { runtimeSafety } = options;
  if (type === 'get') {
    return function() {
      return null;
    };
  } else {
    if (runtimeSafety) {
      return function(value) {
        if (value != null) {
          throwNotNull(member);
        }
      };
      } else {
      return function() {};
    }
  }
}

function getBoolAccessorEx(access, member, options) {
  return getAccessorUsing(access, member, options, getDataViewBoolAccessorEx)
}

function getIntAccessorEx(access, member, options) {
  const getDataViewAccessor = addRuntimeCheck(options, getDataViewIntAccessorEx);
  return getAccessorUsing(access, member, options, getDataViewAccessor)
}

function getUintAccessorEx(access, member, options) {
  const getDataViewAccessor = addRuntimeCheck(options, getDataViewUintAccessorEx);
  return getAccessorUsing(access, member, options, getDataViewAccessor)
}

function addRuntimeCheck(options, getDataViewAccessor) {
  return function (access, member) {
    const {
      runtimeSafety = true,
    } = options;
    const accessor = getDataViewAccessor(access, member);
    if (runtimeSafety && access === 'set') {
      const { min, max } = getIntRange(member);
      return function(offset, value, littleEndian) {
        if (value < min || value > max) {
          throwOverflow(member, value);
        }
        accessor.call(this, offset, value, littleEndian);
      };
    }
    return accessor;
  };
}

function getFloatAccessorEx(access, member, options) {
  return getAccessorUsing(access, member, options, getDataViewFloatAccessorEx)
}

function getEnumerationItemAccessorEx(access, member, options) {
  const getDataViewAccessor = addEnumerationLookup(getDataViewIntAccessorEx);
  return getAccessorUsing(access, member, options, getDataViewAccessor) ;
}

function addEnumerationLookup(getDataViewIntAccessor) {
  return function(access, member) {
    // no point in using non-standard int accessor to read enum values unless they aren't byte-aligned
    let { bitSize, byteSize } = member;
    if (byteSize) {
      bitSize = byteSize * 8;
    }
    const intMember = { type: MemberType.Int, bitSize, byteSize };
    const accessor = getDataViewIntAccessor(access, intMember);
    const { structure } = member;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const { constructor } = structure;
        const value = accessor.call(this, offset, littleEndian);
        // the enumeration constructor returns the object for the int value
        const object = constructor(value);
        if (!object) {
          throwInvalidEnum(structure, value);
        }
        return object;
      };
    } else {
      return function(offset, value, littleEndian) {
        const { constructor } = structure;
        let item;
        if (value instanceof constructor) {
          item = value;
        } else {
          item = constructor(value);
        }
        if (!item) {
          throwEnumExpected(structure, value);
        }
        accessor.call(this, offset, item.valueOf(), littleEndian);
      };
    }
  };
}

function getObjectAccessor(access, member, options) {
  const { structure, slot } = member;
  let returnValue = false;
  switch (structure.type) {
    case StructureType.ErrorUnion:
    case StructureType.Optional:
      returnValue = true;
      break;
  }
  if (slot !== undefined) {
    if (access === 'get') {
      if (returnValue) {
        return function getValue() {
          const object = this[CHILD_VIVIFICATOR][slot].call(this);
          return object.$;
        };
      } else {
        return function getObject() {
          const object = this[CHILD_VIVIFICATOR][slot].call(this);
          return object;
        };
      }
    } else {
      return function setValue(value) {
        const object = this[CHILD_VIVIFICATOR][slot].call(this);
        object.$ = value;
      };
    }
  } else {
    // array accessors
    if (access === 'get') {
      if (returnValue) {
        return function getValue(index) {
          const object = this[CHILD_VIVIFICATOR](index);
          return object.$;
        };
      } else {
        return function getObject(index) {
          const object = this[CHILD_VIVIFICATOR](index);
          return object;
        };
      }
    } else {
      return function setValue(index, value) {
        const object = this[CHILD_VIVIFICATOR](index);
        object.$ = value;
      };
    }
  }
}

function getTypeAccessor(type, member, options) {
  const { structure } = member;
  if (type === 'get') {
    return function() {
      const { constructor } = structure;
      return constructor;
    };
  }
}

function getAccessorUsing(access, member, options, getDataViewAccessor) {
  const {
    littleEndian = true,
  } = options;
  const { bitOffset, byteSize } = member;
  const accessor = getDataViewAccessor(access, member);
  if (bitOffset !== undefined) {
    const offset = bitOffset >> 3;
    if (access === 'get') {
      return function() {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END*/
          return accessor.call(this[MEMORY], offset, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return accessor.call(this[MEMORY], offset, littleEndian);
          } else {
            throw err;
          }
        }
        /* WASM-ONLY-END*/
      };
    } else {
      return function(value) {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END*/
        return accessor.call(this[MEMORY], offset, value, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return accessor.call(this[MEMORY], offset, value, littleEndian);
          } else {
            throw err;
          }
        }
        /* WASM-ONLY-END*/
      }
    }
  } else {
    if (access === 'get') {
      return function(index) {
        if (this.source) {
          debugger;
        }
        try {
          return accessor.call(this[MEMORY], index * byteSize, littleEndian);
        } catch (err) {
          /* WASM-ONLY */
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return accessor.call(this[MEMORY], index * byteSize, littleEndian);
          } else {
          /* WASM-ONLY-END */
            rethrowRangeError(member, index, err);
          /* WASM-ONLY */
          }
          /* WASM-ONLY-END */
        }
      };
    } else {
      return function(index, value) {
        /* WASM-ONLY */
        try {
        /* WASM-ONLY-END */
          return accessor.call(this[MEMORY], index * byteSize, value, littleEndian);
        /* WASM-ONLY */
        } catch (err) {
          if (err instanceof TypeError && restoreMemory.call(this)) {
            return accessor.call(this[MEMORY], index * byteSize, value, littleEndian);
          } else {
            rethrowRangeError(member, index, err);
          }
        }
        /* WASM-ONLY-END */
      }
    }
  }
}

function useAllMemberTypes() {
  useVoid();
  useBoolEx();
  useIntEx();
  useUintEx();
  useFloatEx();
  useEnumerationItemEx();
  useObject();
  useType();
}

class Environment {
  context;
  contextStack = [];
  consolePending = [];
  consoleTimeout = 0;
  slots = {}

  /*
  Functions to be defined in subclass:

  getBufferAddress(buffer: ArrayBuffer): bigint|number {
    // return a buffer's address
  }
  allocateRelocatableMemory(len: number, align: number): DataView {
    // allocate memory and remember its address
  }
  allocateShadowMemory(len: number, align: number): DataView {
    // allocate memory for shadowing objects
  }
  freeRelocatableMemory(address: bigint|number, len: number, align: number): void {
    // free previously allocated memory
  }
  freeShadowMemory(address: bigint|number, len: number, align: number): void {
    // free memory allocated for shadow
  }
  allocateFixedMemory(len: number, align: number): DataView {
    // allocate fixed memory and keep a reference to it
  }
  freeFixedMemory(address: bigint|number, len: number, align: number): void {
    // free previously allocated fixed memory return the reference
  }
  obtainFixedView(address: bigint|number, len: number): DataView {
    // obtain a data view of memory at given address
  }
  isFixed(dv: DataView): boolean {
    // return true/false depending on whether view is point to fixed memory
  }
  copyBytes(dst: DataView, address: bigint|number, len: number): void {
    // copy memory at given address into destination view
  }
  findSentinel(address, bytes: DataView): number {
    // return offset where sentinel value is found
  }
  getTargetAddress(target: object, cluster: object|undefined) {
    // return the address of target's buffer if correctly aligned
  }
  */

  startContext() {
    if (this.context) {
      this.contextStack.push(this.context);
    }
    this.context = new CallContext();
  }

  endContext() {
    this.context = this.contextStack.pop();
  }

  createBuffer(len, align, fixed = false) {
    if (fixed) {
      return this.createFixedBuffer(len);
    } else {
      return this.createRelocatableBuffer(len, align);
    }
  }

  createRelocatableBuffer(len) {
    const buffer = new ArrayBuffer(len);
    return new DataView(buffer);
  }

  registerMemory(dv, targetDV = null) {
    const { memoryList } = this.context;
    const address = this.getViewAddress(dv);
    const index = findMemoryIndex(memoryList, address);
    memoryList.splice(index, 0, { address, dv, len: dv.byteLength, targetDV });
    return address;
  }

  unregisterMemory(address) {
    const { memoryList } = this.context;
    const index = findMemoryIndex(memoryList, address);
    const prev = memoryList[index - 1];
    if (prev?.address === address) {
      memoryList.splice(index - 1, 1);
    }
  }

  findMemory(address, len) {
    if (this.context) {
      const { memoryList, shadowMap } = this.context;
      const index = findMemoryIndex(memoryList, address);
      const prev = memoryList[index - 1];
      if (prev?.address === address && prev.len === len) {
        return prev.targetDV ?? prev.dv;
      } else if (prev?.address <= address && address < add(prev.address, prev.len)) {
        const offset = Number(address - prev.address) + prev.dv.byteOffset;
        if (prev.targetDV) {
          return new DataView(prev.targetDV.buffer, prev.targetDV.byteOffset + offset, len);
        } else {
          return new DataView(prev.dv.buffer, prev.dv.byteOffset + offset, len);
        }
      }
    }
    // not found in any of the buffers we've seen--assume it's fixed memory
    return this.obtainFixedView(address, len);
  }

  getViewAddress(dv) {
    const address = this.getBufferAddress(dv.buffer);
    return add(address, dv.byteOffset);
  }

  createView(address, len, copy) {
    if (copy) {
      const dv = this.createRelocatableBuffer(len);
      this.copyBytes(dv, address, len);
      return dv;
    } else {
      return this.obtainFixedView(address, len);
    }
  }

  createObject(structure, arg) {
    const { constructor } = structure;
    return new constructor(arg);
  }

  castView(structure, dv) {
    const { constructor, hasPointer } = structure;
    const object = constructor.call(ENVIRONMENT, dv);
    if (hasPointer) {
      // acquire targets of pointers
      this.acquirePointerTargets(object);
    }
    return object;
  }

  readSlot(target, slot) {
    const slots = target ? target[SLOTS] : this.slots;
    return slots?.[slot];
  }

  writeSlot(target, slot, value) {
    const slots = target ? target[SLOTS] : this.slots;
    if (slots) {
      slots[slot] = value;
    }
  }

  /* COMPTIME-ONLY */
  createTemplate(dv) {
    return {
      [MEMORY]: dv,
      [SLOTS]: {}
    };
  }

  beginStructure(def, options = {}) {
    const {
      type,
      name,
      length,
      byteSize,
      align,
      isConst,
      hasPointer,
    } = def;
    return {
      constructor: null,
      typedArray: null,
      type,
      name,
      length,
      byteSize,
      align,
      isConst,
      hasPointer,
      instance: {
        members: [],
        methods: [],
        template: null,
      },
      static: {
        members: [],
        methods: [],
        template: null,
      },
      options,
    };
  }

  attachMember(s, member, isStatic = false) {
    const target = (isStatic) ? s.static : s.instance;
    target.members.push(member);
  }

  attachMethod(s, method, isStaticOnly = false) {
    s.static.methods.push(method);
    if (!isStaticOnly) {
      s.instance.methods.push(method);
    }
  }

  attachTemplate(s, template, isStatic = false) {
    const target = (isStatic) ? s.static : s.instance;
    target.template = template;
  }
  /* COMPTIME-ONLY-END */

  finalizeStructure(s) {
    try {
      const f = getStructureFactory(s.type);
      const constructor = f(s, this);
      if (typeof(constructor) === 'function') {
        defineProperties(constructor, {
          name: { value: getStructureName(s), writable: false }
        });
        if (!constructor.prototype.hasOwnProperty(Symbol.toStringTag)) {
          defineProperties(constructor.prototype, {
            [Symbol.toStringTag]: { value: s.name, configurable: true, writable: false }
          });
        }
      }
      return constructor;
      /* c8 ignore next 4 */
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  createCaller(method, useThis) {
    let { name,  argStruct, thunk } = method;
    const { constructor } = argStruct;
    const self = this;
    let f;
    if (useThis) {
      f = function(...args) {
        return self.invokeThunk(thunk, new constructor([ this, ...args ]));
      };
    } else {
      f = function(...args) {
        return self.invokeThunk(thunk, new constructor(args));
      };
    }
    Object.defineProperty(f, 'name', { value: name });
    return f;
  }


  acquirePointerTargets(args) {
    const env = this;
    const pointerMap = new Map();
    const callback = function({ isActive, isMutatable }) {
      const pointer = this[POINTER_SELF];
      if (isActive(this) === false) {
        pointer[SLOTS][0] = null;
        return;
      }
      if (pointerMap.get(pointer)) {
        return;
      }
      const Target = pointer.constructor.child;
      let target = this[SLOTS][0];
      if (target && !isMutatable(this)) {
        // the target exists and cannot be changed--we're done
        return;
      }

      // obtain address (and possibly length) from memory
      const address = pointer[ADDRESS_GETTER]();
      let len = pointer[LENGTH_GETTER]?.();
      if (len === undefined) {
        const sentinel = Target[SENTINEL];
        if (sentinel) {
          len = env.findSentinel(address, sentinel.bytes) + 1;
        } else {
          len = 1;
        }
      }
      const byteSize = Target[SIZE];
      // get view of memory that pointer points to
      const dv = env.findMemory(address, len * byteSize);
      // create the target
      target = this[SLOTS][0] = Target.call(this, dv);
      if (target[POINTER_VISITOR]) {
        // acquire objects pointed to by pointers in target
        const isMutatable = (pointer.constructor.const) ? () => false : () => true;
        target[POINTER_VISITOR](callback, { vivificate: true, isMutatable });
      }
    };
    args[POINTER_VISITOR](callback, { vivificate: true });
  }
}


/* WASM-ONLY */
class WebAssemblyEnvironment extends Environment {
  imports = {
    defineStructures: { argType: '', returnType: 'v' },
    allocateFixedMemory: { argType: 'ii', returnType: 'v' },
    freeFixedMemory: { argType: 'iii' },
    allocateShadowMemory: { argType: 'cii', returnType: 'v' },
    freeShadowMemory: { argType: 'ciii' },
    runThunk: { argType: 'iv', returnType: 'v' },
    isRuntimeSafetyActive: { argType: '', returnType: 'b' },
  };
  exports = {
    allocateRelocatableMemory: { argType: 'ii', returnType: 'v' },
    freeRelocatableMemory: { argType: 'iii' },
    createString: { argType: 'ii', returnType: 'v' },
    createObject: { argType: 'vv', returnType: 's' },
    createView: { argType: 'iib', returnType: 'v' },
    castView: { argType: 'vv', returnType: 'v' },
    readSlot: { argType: 'vi', returnType: 'v' },
    writeSlot: { argType: 'viv' },
    getViewAddress: { argType: 'v', returnType: 'i' },
    beginDefinition: { returnType: 'v' },
    insertInteger: { argType: 'vsi', alias: 'insertProperty' },
    insertBoolean: { argType: 'vsb', alias: 'insertProperty' },
    insertString: { argType: 'vss', alias: 'insertProperty' },
    insertObject: { argType: 'vsv', alias: 'insertProperty' },
    beginStructure: { argType: 'v', returnType: 'v' },
    attachMember: { argType: 'vvb' },
    attachMethod: { argType: 'vvb' },
    createTemplate: { argType: 'v', returnType: 'v' },
    attachTemplate: { argType: 'vvb' },
    finalizeStructure: { argType: 'v' },
    writeToConsole: { argType: 'v' },
    startCall: { argType: 'iv', returnType: 'i' },
    endCall: { argType: 'iv', returnType: 'i' },
  };
  nextValueIndex = 1;
  valueTable = { 0: null };
  valueIndices = new Map;
  memory = null;
  /* COMPTIME-ONLY */
  structures = [];
  /* COMPTIME-ONLY-END */

  constructor() {
    super();
  }

  allocateRelocatableMemory(len, align) {
    // allocate memory in both JS and WASM space
    const constructor = { [ALIGN]: align };
    const copier = getMemoryCopier(len);
    const dv = this.createBuffer(len);
    const shadowDV = this.allocateShadowMemory(len, align);
    // create a shadow for the relocatable memory
    const object = { constructor, [MEMORY]: dv, [MEMORY_COPIER]: copier };
    const shadow = { constructor, [MEMORY]: shadowDV, [MEMORY_COPIER]: copier };
    this.addShadow(shadow, object);
    return shadowDV;
  }

  freeRelocatableMemory(address, len, align) {
    const dv = this.findMemory(address, len);
    this.removeShadow(dv);
    this.unregisterMemory(address);
    this.freeShadowMemory(address, len, align);
  }

  getBufferAddress(buffer) {
    return 0;
  }

  obtainFixedView(address, len) {
    const { memory } = this;
    const dv = new DataView(memory.buffer, address, len);
    dv[MEMORY] = { memory, address, len };
    return dv;
  }

  isFixed(dv) {
    return dv.buffer === this.memory.buffer;
  }

  copyBytes(dst, address, len) {
    const { memory } = this;
    const src = new DataView(memory.buffer, address, len);
    const copy = getCopyFunction(len);
    copy(dst, src);
  }

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
  }

  createString(address, len) {
    const { buffer } = this.memory;
    const ta = new Uint8Array(buffer, address, len);
    return decodeText(ta);
  }

  getTargetAddress(target, cluster) {
    const dv = target[MEMORY];
    if (this.isFixed(dv)) {
      return this.getViewAddress(dv);
    } else if (dv.byteLength === 0) {
      return 0;
    } else {
      // relocatable buffers always need shadowing
      return false;
    }
  }

  releaseObjects() {
    if (this.nextValueIndex !== 1) {
      this.nextValueIndex = 1;
      this.valueTable = { 0: null };
      this.valueIndices = new Map();
    }
  }

  getObjectIndex(object) {
    if (object) {
      let index = this.valueIndices.get(object);
      if (index === undefined) {
        index = this.nextValueIndex++;
        this.valueIndices.set(object, index);
        this.valueTable[index] = object;
      }
      return index;
    } else {
      return 0;
    }
  }

  fromWebAssembly(type, arg) {
    switch (type) {
      case 'v':
      case 's': return this.valueTable[arg];
      case 'i': return arg;
      case 'b': return !!arg;
    }
  }

  toWebAssembly(type, arg) {
    switch (type) {
      case 'v':
      case 's': return this.getObjectIndex(arg);
      case 'i': return arg;
      case 'b': return arg ? 1 : 0;
    }
  }

  exportFunction(fn, argType = '', returnType = '') {
    if (!fn) {
      return () => {};
    }
    return (...args) => {
      args = args.map((arg, i) => this.fromWebAssembly(argType.charAt(i), arg));
      const retval = fn.apply(this, args);
      return this.toWebAssembly(returnType, retval);
    };
  }

  importFunction(fn, argType = '', returnType = '') {
    let needCallContext = false;
    if (argType.startsWith('c')) {
      needCallContext = true;
      argType = argType.slice(1);
    }
    return (...args) => {
      args = args.map((arg, i) => this.toWebAssembly(argType.charAt(i), arg));
      if (needCallContext) {
        args = [ this.context.call, ...args ];
      }
      const retval = fn.apply(this, args);
      return this.fromWebAssembly(returnType, retval);
    };
  }

  exportFunctions() {
    const imports = {};
    for (const [ name, { argType, returnType, alias } ] of Object.entries(this.exports)) {
      const fn = this[alias ?? name];
      imports[`_${name}`] = this.exportFunction(fn, argType, returnType);
    }
    return imports;
  }

  importFunctions(exports) {
    for (const [ name, fn ] of Object.entries(exports)) {
      const info = this.imports[name];
      if (info) {
        const { argType, returnType } = info;
        this[name] = this.importFunction(fn, argType, returnType);
      }
    }
  }

  releaseFunctions() {
    const throwError = function() {
      throw new Error('WebAssembly instance was abandoned');
    };
    for (const { name } of Object.values(this.imports)) {
      if (this[name]) {
        this[name] = throwError;
      }
    }
  }

  async instantiateWebAssembly(source) {
    const env = this.exportFunctions();
    if (source[Symbol.toStringTag] === 'Response') {
      return WebAssembly.instantiateStreaming(source, { env });
    } else {
      const buffer = await source;
      return WebAssembly.instantiate(buffer, { env });
    }
  }

  async loadWebAssembly(source) {
    const { instance } = await this.instantiateWebAssembly(source);
    this.memory = instance.exports.memory;
    this.importFunctions(instance.exports);
    // create a WeakRef so that we know whether the instance is gc'ed or not
    const weakRef = new WeakRef(instance);
    return {
      abandon: () => {
        this.releaseFunctions();
        this.unlinkVariables();
        this.memory = null;
      },
      released: () => {
        return !weakRef.deref();
      }
    }
  }

  startCall(call, args) {
    this.startContext();
    // call context, use by allocateShadowMemory and freeShadowMemory
    this.context.call = call;
    if (args) {
      if (args[POINTER_VISITOR]) {
        this.updatePointerAddresses(args);
      }
      // return address of shadow for argumnet struct
      const address = this.getShadowAddress(args);
      this.updateShadows();
      return address;
    }
    // can't be 0 since that sets off Zig's runtime safety check
    return 0xaaaaaaaa;
  }

  endCall(call, args) {
    if (args) {
      this.updateShadowTargets();
      if (args[POINTER_VISITOR]) {
        this.acquirePointerTargets(args);
      }
      this.releaseShadows();
    }
    // restore the previous context if there's one
    this.endContext();
  }

  /* COMPTIME-ONLY */
  runFactory(options) {
    const {
      omitFunctions = false
    } = options;
    if (omitFunctions) {
      this.attachMethod = () => {};
    }
    initializeErrorSets();
    const result = this.defineStructures();
    if (typeof(result) === 'string') {
      throwZigError(result);
    }
    this.replaceFixedMemory();
    return {
      structures: this.structures,
      runtimeSafety: this.isRuntimeSafetyActive(),
    };
  }

  beginDefinition() {
    return {};
  }

  insertProperty(def, name, value) {
    def[name] = value;
  }

  replaceFixedMemory() {
    // look for buffers that requires linkage
    const list = [];
    const find = (object) => {
      if (!object) {
        return;
      }
      if (object[MEMORY]) {
        const dv = object[MEMORY];
        if (this.isFixed(dv)) {
          // replace fixed memory
          const address = dv.byteOffset;
          const len = dv.byteLength;
          const relocDV = this.createView(address, len, true);
          relocDV.address = address;
          object[MEMORY] = relocDV;
          list.push({ address, len, owner: object, replaced: false });
        }
      }
      if (object[SLOTS]) {
        for (const child of Object.values(object[SLOTS])) {
          find(child);
        }
      }
    };
    for (const structure of this.structures) {
      find(structure.instance.template);
      find(structure.static.template);
    }
    // larger memory blocks come first
    list.sort((a, b) => b.len - a.len);
    for (const a of list) {
      for (const b of list) {
        if (a !== b && !a.replaced) {
          if (a.address <= b.address && b.address + b.len <= a.address + a.len) {
            // B is inside A--replace it with a view of A's buffer
            const dv = a.owner[MEMORY];
            const offset = b.address - a.address + dv.byteOffset;
            const newDV = new DataView(dv.buffer, offset, b.len);
            newDV.address = b.address;
            b.owner[MEMORY] = newDV;
            b.replaced = true;
          }
        }
      }
    }
  }

  finalizeStructure(s) {
    super.finalizeStructure(s);
    this.structures.push(s);
  }
  /* COMPTIME-ONLY-END */

  /* RUNTIME-ONLY */
  finalizeStructures(structures) {
    const createTemplate = (placeholder) => {
      const template = {};
      if (placeholder.memory) {
        const { array, offset, length } = placeholder.memory;
        template[MEMORY] = new DataView(array.buffer, offset, length);
      }
      if (placeholder.slots) {
        template[SLOTS] = insertObjects({}, placeholder.slots);
      }
      return template;
    };
    const insertObjects = (dest, placeholders) => {
      for (const [ slot, placeholder ] of Object.entries(placeholders)) {
        dest[slot] = createObject(placeholder);
      }
      return dest;
    };
    const createObject = (placeholder) => {
      let dv;
      if (placeholder.memory) {
        const { array, offset, length } = placeholder.memory;
        dv = new DataView(array.buffer, offset, length);
      } else {
        const { byteSize } = placeholder.structure;
        dv = new DataView(new ArrayBuffer(byteSize));
      }
      const { constructor } = placeholder.structure;
      const object = constructor.call(ENVIRONMENT, dv);
      if (placeholder.slots) {
        insertObjects(object[SLOTS], placeholder.slots);
      }
      if (placeholder.address !== undefined) {
        // need to replace dataview with one pointing to WASM memory later,
        // when the VM is up and running
        this.variables.push({ address: placeholder.address, object });
      }
      return object;
    };
    initializeErrorSets();
    for (const structure of structures) {
      for (const target of [ structure.static, structure.instance ]) {
        // first create the actual template using the provided placeholder
        if (target.template) {
          target.template = createTemplate(target.template);
        }
      }
      super.finalizeStructure(structure);
      // place structure into its assigned slot
      this.slots[structure.slot] = structure;
    }

    let resolve, reject;
    const promise = new Promise((r1, r2) => {
      resolve = r1;
      reject = r2;
    });
    this.runThunk = function(index, argStruct) {
      // wait for linking to occur, then call function again
      // this.runThunk should have been replaced
      return promise.then(() => this.runThunk(index, argStruct));
    };
    return { resolve, reject };
  }

  async linkWebAssembly(source, params) {
    const {
      writeBack = true,
    } = params;
    const zigar = await this.loadWebAssembly(source);
    this.linkVariables(writeBack);
    return zigar;
  }

  linkVariables(writeBack) {
    for (const { object, address } of this.variables) {
      this.linkObject(object, address, writeBack);
    }
  }

  linkObject(object, address, writeBack) {
    const dv = object[MEMORY];
    if (dv.byteLength === 0 || this.isFixed(dv)) {
      return;
    }
    const wasmDV = this.obtainFixedView(address, dv.byteLength);
    if (writeBack) {
      const dest = Object.create(object.constructor.prototype);
      dest[MEMORY] = wasmDV;
      dest[MEMORY_COPIER](object);
    }
    object[MEMORY] = wasmDV;
    if (object[ADDRESS_GETTER]) {
      // link target
      const address = object[ADDRESS_GETTER]();
      const target = object[SLOTS][0];
      this.linkObject(target, address, writeBack);
    }
  }

  unlinkVariables() {
    for (const { object } of this.variables) {
      this.unlinkObject(object);
    }
  }

  unlinkObject(object) {
    const dv = object[MEMORY];
    if (dv.byteLength === 0 || !this.isFixed(dv)) {
      return;
    }
    const relocDV = this.createRelocatableBuffer(dv.byteLength);
    const dest = Object.create(object.constructor.prototype);
    dest[MEMORY] = relocDV;
    dest[MEMORY_COPIER](object);
    object[MEMORY] = relocDV;
    if (object[ADDRESS_GETTER]) {
      const target = object[SLOTS][0];
      this.unlinkObject(target);
    }
  }

  invokeThunk(thunk, args) {
    // WASM thunks aren't functions--they're indices into the function table 0
    // wasm-exporter.zig will invoke startCall() with the context address and the args
    // we can't do pointer fix up here since we need the context in order to allocate
    // memory from the WebAssembly allocator; point target acquisition will happen in
    // endCall()
    const err = this.runThunk(thunk, args);

    // errors returned by exported Zig functions are normally written into the
    // argument object and get thrown when we access its retval property (a zig error union)
    // error strings returned by the thunk are due to problems in the thunking process
    // (i.e. bugs in export.zig)
    if (err) {
      throwZigError(err);
    }
    return args.retval;
  }
  /* RUNTIME-ONLY */
}
/* WASM-ONLY-END */

class CallContext {
  pointerProcessed = new Map();
  memoryList = [];
  shadowMap = null;
  /* WASM-ONLY */
  call = 0;
  /* WASM-ONLY-END */
}

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

function findMemoryIndex(array, address) {
  return findSortedIndex(array, address, m => m.address);
}

function add(address, len) {
  return address + ((typeof(address) === 'bigint') ? BigInt(len) : len);
}

/* COMPTIME-ONLY */

useAllMemberTypes();
useAllStructureTypes();

function generateCode(structures, params) {
  const {
    runtimeURL,
    loadWASM,
    topLevelAwait,
    omitExports,
    runtimeSafety,
  } = params;
  const lines = [];
  let indent = 0;
  function add(s) {
    if (/^\s*[\]\}]/.test(s)) {
      indent--;
    }
    lines.push(' '.repeat(indent * 2) + s);
    if (/[\[\{]\s*$/.test(s)) {
      indent++;
    }
  }
  const structureFeatures = {}, memberFeatures = {};
  for (const structure of structures) {
    structureFeatures[ getStructureFeature(structure) ] = true;
    for (const members of [ structure.instance.members, structure.static.members ]) {
      for (const member of members) {
        const feature = getMemberFeature(member);
        if (feature) {
          memberFeatures[feature] = true;
        }
      }
    }
    if (structure.type === StructureType.Pointer) {
      // pointer need uint support
      memberFeatures.useUint = true;
    }
  }
  if (memberFeatures.useIntEx) {
    delete memberFeatures.useInt;
  }
  if (memberFeatures.useUintEx) {
    delete memberFeatures.useUint;
  }
  if (memberFeatures.useEnumerationItemEx) {
    delete memberFeatures.useEnumerationItem;
  }
  if (memberFeatures.useFloatEx) {
    delete memberFeatures.useFloat;
  }
  if (memberFeatures.useBoolEx) {
    delete memberFeatures.useBool;
  }
  const features = [ ...Object.keys(structureFeatures), ...Object.keys(memberFeatures) ];
  const imports = [ 'Environment' ];
  imports.push(...features);
  add(`import {`);
  for (const name of imports) {
    add(`${name},`);
  }
  add(`} from ${JSON.stringify(runtimeURL)};`);

  add(`\n// activate features`);
  for (const feature of features) {
    add(`${feature}();`);
  }

  const defaultStructure = {
    constructor: null,
    typedArray: null,
    type: StructureType.Primitive,
    name: undefined,
    byteSize: 4,
    align: 2,
    isConst: false,
    hasPointer: false,
    instance: {
      members: [],
      methods: [],
      template: null,
    },
    static: {
      members: [],
      methods: [],
      template: null,
    },
    options: { runtimeSafety },
  };

  const defaultMember = {
    type: MemberType.Void,
    isRequired: true,
  };

  add(`\n// define structures`);
  addDefaultStructure();
  addDefaultMember();
  const structureNames = new Map();
  const structureMap = new Map();
  const methodNames = new Map();
  const arrayBufferNames = new Map();
  let arrayBufferCount = 0;
  let methodCount = 0;

  // create empty objects first, to allow structs to reference themselves
  for (const [ index, structure ] of structures.entries()) {
    const varname = `s${index}`;
    structureNames.set(structure, varname);
    structureMap.set(structure.constructor, structure);
  }
  const varnames = [ ...structureNames.values() ];
  const initializations = varnames.map(n => `${n} = {}`);
  for (let i = 0; i < initializations.length; i += 10) {
    const slice = initializations.slice(i, i + 10);
    add(`const ${slice.join(', ')};`);
  }

  for (const [ index, structure ] of structures.entries()) {
    const varname = structureNames.get(structure);
    addStructure(varname, structure);
  }

  add(`\n// finalize structures`);
  if (varnames.length <= 10) {
    add(`const structures = [ ${varnames.join(', ') } ];`);
  } else {
    add(`const structures = [`);
    for (let i = 0; i < varnames.length; i += 10) {
      const slice = varnames.slice(i, i + 10);
      add(`${slice.join(', ')},`);
    }
    add(`];`);
  }
  add(`const env = new Environment();`);
  add(`const { resolve, reject } = env.finalizeStructures(structures);`);

  // the root structure gets finalized last
  const root = structures[structures.length - 1];
  add(`const module = ${structureNames.get(root)}.constructor;`);

  if (loadWASM) {
    add(`\n// initiate loading and compilation of WASM bytecodes`);
    add(`const wasmPromise = ${loadWASM};`);
    add(`const initPromise = env.linkWebAssembly(wasmPromise, { writeBack: ${!topLevelAwait} });`);
    add(`initPromise.then(resolve, reject);`);
  } else {
    add(`\n// no need to use WASM binary`);
    add(`const initPromise = Promise.resolve();`);
  }
  add(`const __zigar = {`);
  add(`init: () => initPromise,`);
  add(`abandon: () => initPromise.then(res => res?.abandon()),`);
  add(`released: () => initPromise.then(res => res?.released() ?? false),`);
  add(`};`);

  add(`\n// export functions, types, and constants`);
  const exportables = [];
  for (const method of root.static.methods) {
    if (/^[$\w]+$/.test(method.name)) {
      exportables.push(method.name);
    }
  }
  for (const member of root.static.members) {
    // only read-only properties are exportable
    let readOnly = false;
    if (member.type === MemberType.Type) {
      readOnly = true;
    } else if (member.type === MemberType.Object && member.structure.type === StructureType.Pointer) {
      if (member.structure.isConst) {
        readOnly = true;
      }
    }
    if (readOnly && /^[$\w]+$/.test(member.name)) {
      exportables.push(member.name);
    }
  }
  add(`const {`);
  for (const name of exportables) {
    add(`${name},`);
  }
  add(`} = module;`);
  if (!omitExports) {
    add(`export {`);
    for (const name of [ 'module as default', ...exportables, '__zigar' ]) {
      add(`${name},`);
    }
    add(`};`);
  }
  if (topLevelAwait && loadWASM) {
    add(`\n// await initialization`);
    add(`await initPromise`);
  }
  add(``);
  const exports = [ 'default', ...exportables, '__zigar' ];
  const code = lines.join('\n');
  return { code, exports, structures };

  function addDefaultStructure() {
    add(`const s = {`);
    for (const [ name, value ] of Object.entries(defaultStructure)) {
      switch (name) {
        case 'instance':
        case 'static':
          addStructureContent(name, value);
          break;
        default:
          add(`${name}: ${JSON.stringify(value)},`);
      }
    }
    add(`};`);
  }

  function addStructure(varname, structure) {
    addBuffers(structure.instance.template);
    addBuffers(structure.static.template);
    // instance methods are also static methods, so no need to add them separately
    addMethods(structure.static.methods);
    add(`Object.assign(${varname}, {`);
    add(`...s,`);
    for (const [ name, value ] of Object.entries(structure)) {
      if (name !== 'options' && isDifferent(value, defaultStructure[name])) {
        switch (name) {
          case 'constructor':
          case 'sentinel':
            break;
          case 'instance':
          case 'static':
            addStructureContent(name, value);
            break;
          default:
            add(`${name}: ${JSON.stringify(value)},`);
        }
      }
    }
    add(`});`);
  }

  function addStructureContent(name, { members, methods, template }) {
    add(`${name}: {`);
    addMembers(members);
    addMethodRefs(methods);
    addTemplate(template);
    add(`},`);
  }

  function addDefaultMember() {
    add(`const m = {`);
    for (const [ name, value ] of Object.entries(defaultMember)) {
      add(`${name}: ${JSON.stringify(value)},`);
    }
    add(`};`);
  }

  function addMembers(members) {
    if (members.length > 0) {
      add(`members: [`);
      for (const member of members) {
        addMember(member);
      }
      add(`],`);
    } else {
      add(`members: [],`);
    }
  }

  function addMember(member) {
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

  function addTemplate(template) {
    addObject('template', template);
  }

  function addObject(name, object) {
    if (object) {
      const structure = structureMap.get(object.constructor);
      const { [MEMORY]: dv, [SLOTS]: slots } = object;
      add(`${name}: {`);
      if (structure) {
        add(`structure: ${structureNames.get(structure)},`);
      }
      if (dv) {
        const buffer = arrayBufferNames.get(dv.buffer);
        const pairs = [ `array: ${buffer}` ];
        if (dv.byteLength < dv.buffer.byteLength) {
          pairs.push(`offset: ${dv.byteOffset}`);
          pairs.push(`length: ${dv.byteLength}`);
        }
        add(`memory: { ${pairs.join(', ')} },`);
        if (dv.hasOwnProperty('address')) {
          add(`address: ${dv.address},`);
        }
      }
      if (slots && Object.keys(slots).length > 0) {
        add(`slots: {`);
        for (const [ slot, child ] of Object.entries(slots)) {
          addObject(slot, child);
        }
        add(`},`);
      }
      add(`},`);
    } else {
      add(`${name}: null`);
    }
  }

  function addBuffers(object) {
    if (object) {
      const { [MEMORY]: dv, [SLOTS]: slots } = object;
      if (dv && !arrayBufferNames.get(dv.buffer)) {
        const varname = `a${arrayBufferCount++}`;
        arrayBufferNames.set(dv.buffer, varname);
        if (dv.byteLength > 0) {
          const ta = new Uint8Array(dv.buffer);
          add(`const ${varname} = new Uint8Array([ ${ta.join(', ')} ]);`);
        } else {
          add(`const ${varname} = new Uint8Array();`);
        }
      }
      if (slots) {
        for (const [ slot, child ] of Object.entries(slots)) {
          addBuffers(child);
        }
      }
    }
  }

  function addMethods(methods) {
    for (const method of methods) {
      const varname = `f${methodCount++}`;
      methodNames.set(method, varname);
      addMethod(varname, method);
    }
  }

  function addMethodRefs(methods) {
    const list = methods.map(m => methodNames.get(m));
    if (list.length > 0) {
      add(`methods: [ ${list.join(', ')} ],`);
    } else {
      add(`methods: [],`);
    }
  }

  function addMethod(varname, method) {
    add(`const ${varname} = {`);
    for (const [ name, value ] of Object.entries(method)) {
      switch (name) {
        case 'argStruct':
          add(`${name}: ${structureNames.get(value)},`);
          break;
        default:
          add(`${name}: ${JSON.stringify(value)},`);
      }
    }
    add(`};`);
  }
  // return occurs higher up, before the definition of addDefaultStructure
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

const MagicNumber = 0x6d736100;
const Version = 1;
const SectionType = {
  Custom: 0,
  Type: 1,
  Import: 2,
  Function: 3,
  Table: 4,
  Memory: 5,
  Global: 6,
  Export: 7,
  Start: 8,
  Element: 9,
  Code: 10,
  Data: 11,
  DataCount: 12
};
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
    /^define$/,
    /^exporter.createRootFactory/,
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
      fn.using = false;
      if (fn.name === 'define' && functionNames.length === 0) {
        // when compiled for ReleaseSmall, we don't get the name section
        // therefore unable to remove the factory function by name
        // we know that define loads its address, however
        // and that a function pointer is just an index into table 0
        const ops = fn.instructions;
        if (ops.length === 4 && ops[1].opcode === 0x41 && ops[2].opcode === 0x10) {
          // 0x10 is call
          // 0x41 is i32.const
          const elemIndex = ops[1].operand;
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
  const newElementSection = { type: SectionType.Element, segments: [] };
  if (elemSection) {
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
  const newExportSection = { type: SectionType.Export, exports: [] };
  if (exportSection) {
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
  const newImportSection = { type: SectionType.Import, imports: [] };
  if (importSection) {
    for (const [ index, object ] of importSection.imports.entries()) {
      if (object.type === ObjectType.Function) {
        const fn = functions[index];
        if (fn.using) {
          newImportSection.imports.push(object);
        }
        /* c8 ignore next 3 */
      } else {
        newImportSection.imports.push(object);
      }
    }
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
            /* c8 ignore next 2 */
            default:
              throw new Error(`Unknown object type: ${type}`);
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
      default: {
        const data = readBytes(len);
        return { type, data };
      }
    }
    /* c8 ignore next -- unreachable */
  }

  function readLimits() {
    const flag = readU8();
    const min = readU32Leb128();
    switch (flag) {
      case 0:
        return { flag, min };
      case 1:
        const max = readU32Leb128();
        return { flag, min, max };
      /* c8 ignore next 4 */
      default:
        throw new Error(`Unknown limit flag: ${flag}`);
    }
  }
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
        default: {
          writeBytes(section.data);
        }
      }
    });
  }

  function writeLimits(limits) {
    writeU8(limits.flag);
    writeU32Leb128(limits.min);
    switch (limits.flag) {
      case 1: {
        writeU32Leb128(limits.max);
      } break;
    }
  }
}

function createReader(dv) {
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  let offset = 0;

  function eof() {
    return (offset >= dv.byteLength);
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
          return value | (~0 << shift);
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

  function readCustom(len) {
    const offsetBefore = offset;
    const name = readString();
    const nameLen = offset - offsetBefore;
    const data = readBytes(len - nameLen);
    return { name, data };
  }

  const self = {
    eof,
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

    0x10: readU32Leb128,
    0x11: readTwo,
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
    0x0E: (op) => [ writeArray(op[0], writeOne), writeU32Leb128(op[1]) ],

    0x10: writeU32Leb128,
    0x11: writeTwo,
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
        return writeOne(op);
      }
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

async function transpile(path, options = {}) {
  const {
    embedWASM = true,
    topLevelAwait = true,
    omitFunctions = false,
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
  const wasmPath = await compile(path, {
    ...compileOptions,
    arch: 'wasm32',
    platform: 'freestanding'
  });
  const content = await promises.readFile(wasmPath);
  const env = new WebAssemblyEnvironment();
  await env.loadWebAssembly(content);
  const { structures, runtimeSafety } = env.runFactory({ omitFunctions });
  // all methods are static, so there's no need to check the instance methods
  const hasMethods = !!structures.find(s => s.static.methods.length > 0);
  const runtimeURL = moduleResolver('zigar-runtime');
  let loadWASM;
  if (hasMethods) {
    let dv = new DataView(content.buffer);
    if (stripWASM) {
      dv = stripUnused(dv, { keepNames });
    }
    if (embedWASM) {
      loadWASM = embed(path, dv);
    } else {
      loadWASM = await wasmLoader(path, dv);
    }
  }
  return generateCode(structures, {
    runtimeURL,
    loadWASM,
    runtimeSafety,
    topLevelAwait,
    omitExports,
  });
}

function embed(path$1, dv) {
  const base64 = Buffer.from(dv.buffer, dv.byteOffset, dv.byteLength).toString('base64');
  return `(async () => {
  // ${path.basename(path$1)}
  const binaryString = atob(${JSON.stringify(base64)});
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
})()`;
}

exports.compile = compile;
exports.transpile = transpile;
