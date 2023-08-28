'use strict';

var crypto = require('crypto');
var child_process = require('child_process');
var path = require('path');
var os = require('os');
var promises = require('fs/promises');

const cwd = process.cwd();

function getLibraryExt(platform) {
  switch (platform) {
    case 'darwin': return 'dylib';
    case 'windows': return 'dll';
    default: return 'so';
  }
}

async function compile(path$1, options = {}) {
  const {
    optimize = 'Debug',
    clean = false,
    target = '',
    buildDir = os.tmpdir(),
    cacheDir = path.join(cwd, 'zig-cache'),
    zigCmd = `zig build -Doptimize=${optimize}`,
    staleTime = 60000,
  } = options;
  const fullPath = path.resolve(path$1);
  const rootFile = path.parse(fullPath);
  const prefix = (target === 'wasm') ? 'wasm' : 'cpp';
  const config = {
    target,
    packageName: rootFile.name,
    packagePath: fullPath,
    packageRoot: rootFile.dir,
    exporterPath: absolute(`../zig/${prefix}-exporter.zig`),
    stubPath: absolute(`../zig/${prefix}-stub.zig`),
    buildFilePath: absolute(`../zig/build.zig`),
    useLibC: false,
  };
  const soName = (target === 'wasm') ? `${rootFile.name}.wasm` : `lib${rootFile.name}.${getLibraryExt(os.platform())}`;
  const soPath = path.join(cacheDir, soName);
  const soMTime = (await find(soPath))?.mtime;
  if (!buildDir || !cacheDir || !zigCmd) {
    // can't build when no command or build directory is set to empty
    if (soMTime) {
      return soPath;
    } else {
      throw new Error(`Cannot find shared library and compilation is disabled: ${soPath}`);
    }
  }
  if (!await find(fullPath)) {
    throw new Error(`Source file not found: ${fullPath}`);
  }
  // scan the dir containing the file to see if recompilation is necessary
  // also check if there's a custom build file and for C dependency
  let changed = false;
  await walk(rootFile.dir, /\.zig$/i, async (dir, name, { mtime }) => {
    if (dir === rootFile.dir && name === 'build.zig') {
      config.buildFilePath = path.join(dir, name);
    }
    if (!config.useLibC) {
      const content = await load(path.join(dir, name));
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
    await walk(pathname, /\.zig$/i, (dir, name, { mtime }) => {
      if (!(soMTime > mtime)) {
        changed = true;
      }
    });
  }
  // recompile if options are different
  const optPath = soPath + '.json';
  const optString = JSON.stringify({ zigCmd }, undefined, 2);
  const prevOptString = await load(optPath, '');
  if (prevOptString !== optString) {
    changed = true;
  }

  // build in a unique temp dir
  const soBuildDir = path.join(buildDir, await md5(fullPath), target);
  const logPath = path.join(soBuildDir, 'log');
  const pidPath = path.join(soBuildDir, 'pid');
  if (!changed) {
    return soPath;
  }
  let done = false, errorLog;
  while (!done) {
    await mkdirp(soBuildDir);
    if (await writePID(pidPath)) {
      try {
        await createProject(config, soBuildDir);
        const options = {
          cwd: soBuildDir,
          windowsHide: true,
        };
        const success = await new Promise((resolve) => {
          child_process.exec(zigCmd, options, (err, stdout, stderr) => {
            if (err) {
              errorLog = stderr /* c8 ignore next */ || '[NO OUTPUT]';
              resolve(false);
              promises.writeFile(logPath, errorLog).catch(() => {});
            } else {
              resolve(true);
            }
          });
        });
        if (success) {
          // move library to cache directory
          const libPath = path.join(soBuildDir, 'zig-out', 'lib', soName);
          await mkdirp(cacheDir);
          await move(libPath, soPath);
          await touch(soPath);
          await promises.writeFile(optPath, optString);
        }
      } finally {
        try {
          if (clean) {
            await rimraf(soBuildDir);
          } else {
            await promises.unlink(pidPath);
          }
          /* c8 ignore next 2 */
        } catch (err) {
          if (await find(pidPath)) {
            throw err;
          }
        }
      }
      done = true;
    } else {
      // perhaps another process is compiling the same file--wait for it to finish
      if (await monitor(pidPath, staleTime)) {
        // pidfile has vanished--see if the shared library has been updated
        const newMTime = (await find(soPath))?.mtime;
        const success = (newMTime && newMTime !== soMTime);
        if (!success) {
          errorLog = await load(logPath, '[ERROR LOG NOT FOUND]');
        }
        done = true;
      } else {
        // ignore the pid file if it's stale
        try {
          await promises.unlink(pidPath);
          /* c8 ignore next 2 */
        } catch (err) {
          if (await find(pidPath)) {
            throw err;
          }
        }
      }
    }
  }
  if (errorLog) {
    throw new Error(`Zig compilation failed\n\n${errorLog}`);
  }
  return soPath;
}

async function find(path, follow = true) {
  try {
    return await (follow ? promises.stat(path) : promises.lstat(path));
  } catch (err) {
  }
}

async function walk(dir, re, cb) {
  const ino = (await find(dir))?.ino;
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
        const info = await find(path$1);
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

async function monitor(path, staleTime) {
  while (true) {
    const mtime = (await find(path))?.mtime;
    if (!mtime) {
      // pidfile has been removed
      return true;
    } else {
      const now = new Date();
      const diff = now - mtime;
      if(diff > staleTime) {
        // pidfile's been abandoned
        return false;
      }
    }
    await delay(500);
  }
}

async function writePID(path) {
  try {
    const handle = await promises.open(path, 'wx');
    handle.write(`${process.pid}`);
    handle.close();
    return true;
  } catch (err) {
    if (err.code == 'EEXIST') {
      return false;
      /* c8 ignore next 3 */
    } else {
      throw err;
    }
  }
}

async function createProject(config, dir) {
  let target = '.{}';
  switch (config.target) {
    case 'wasm':
      target = '.{ .cpu_arch = .wasm32, .os_tag = .freestanding }';
      break;
  }
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
  await copy(config.buildFilePath, buildFilePath);
}

async function move(srcPath, dstPath) {
  try {
    await promises.rename(srcPath, dstPath);
    /* c8 ignore next 8 -- hard to test */
  } catch (err) {
    if (err.code == 'EXDEV') {
      await copy(srcPath, dstPath);
      await promises.unlink(srcPath);
    } else {
      throw err;
    }
  }
}

async function copy(srcPath, dstPath) {
  const info = await promises.stat(srcPath);
  const data = await promises.readFile(srcPath);
  await promises.writeFile(dstPath, data);
  await promises.chmod(dstPath, info.mode);
}

async function load(path, def) {
  try {
    return await promises.readFile(path, 'utf8');
  } catch (err) {
    return def;
  }
}

async function touch(path) {
  try {
    const now = new Date();
    await promises.utimes(path, now, now);
    /* c8 ignore next 2 */
  } catch (err) {
  }
}

async function md5(text) {
  const hash = crypto.createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

async function mkdirp(path$1) {
  const exists = await find(path$1);
  if (!exists) {
    const { root, dir } = path.parse(path$1);
    await mkdirp(dir);
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

async function rimraf(dir) {
  const remove = async (dir) => {
    const list = await promises.readdir(dir);
    for (const name of list) {
      const path$1 = path.join(dir, name);
      const info = await find(path$1, false);
      if (info?.isDirectory()) {
        await remove(path$1);
      } else if (info) {
        await promises.unlink(path$1);
      }
    }
    await promises.rmdir(dir);
  };
  await remove(dir);
}

async function delay(ms) {
  await new Promise(r => setTimeout(r, ms));
}

function absolute(relpath) {
  return (new URL(relpath, (typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (document.currentScript && document.currentScript.src || new URL('index.cjs', document.baseURI).href)))).pathname;
}

const MEMORY = Symbol('memory');
const SLOTS = Symbol('slots');
const ZIG = Symbol('zig');
const STRUCTURE = Symbol('structure');

function getMemoryCopier(size, multiple = false) {
  if (!multiple) {
    switch (size) {
      case 1: return copy1;
      case 2: return copy2;
      case 4: return copy4;
      case 8: return copy8;
      case 16: return copy16;
      case 32: return copy32;
    }
  }
  if (!(size & 0x07)) return copy8x;
  if (!(size & 0x03)) return copy4x;
  if (!(size & 0x01)) return copy2x;
  return copy1x;
}

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
/* c8 ignore end */

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

const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Float: 3,
  EnumerationItem: 4,
  Object: 5,
  Type: 6,
};

Array(Object.values(MemberType).length);

function getMemberFeature(member) {
  const { type, bitSize } = member;
  switch (type) {
    case MemberType.Int:
      if(isByteAligned(member) && (bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64)) {
        return 'useInt';
      } else {
        return 'useIntEx';
      }
    case MemberType.EnumerationItem:
      if(isByteAligned(member) && (bitSize === 8 || bitSize === 16 || bitSize === 32 || bitSize === 64)) {
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

Array(Object.values(StructureType).length);

function beginStructure(def, options = {}) {
  const {
    type,
    name,
    size,
    isConst,
    hasPointer,
  } = def;
  return {
    constructor: null,
    initializer: null,
    pointerCopier: null,
    pointerResetter: null,
    pointerDisabler: null,
    typedArray: null,
    type,
    name,
    size,
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

function attachMember(s, member, isStatic = false) {
  const target = (isStatic) ? s.static : s.instance;
  target.members.push(member);
}

function attachMethod(s, method, isStaticOnly = false) {
  s.static.methods.push(method);
  if (!isStaticOnly) {
    s.instance.methods.push(method);
  }
}

function attachTemplate(s, template, isStatic = false) {
  const target = (isStatic) ? s.static : s.instance;
  target.template = template;
}

function getStructureFeature(structure) {
  const { type } = structure;
  const [ name ] = Object.entries(StructureType).find(a => a[1] === type);
  return `use${name}`;
}

const MemoryDisposition = {
  Auto: 0,
  Copy: 1,
  Link: 2,
};

async function runModule(module, options = {}) {
  const {
    omitFunctions = false,
    slots = {},
    variables,
    methodRunner,
  } = options;
  let nextValueIndex = 1;
  let valueTable = { 0: null };
  const valueIndices = new WeakMap();
  let nextStringIndex = 1;
  const stringTable = { 0: null };
  const stringIndices = {};
  const decoder = new TextDecoder();
  const callContexts = {};
  const globalSlots = slots;
  const structures = [];
  const imports = {
    _startCall,
    _endCall,
    _allocMemory,
    _freeMemory,
    _getMemory,
    _getMemoryOffset,
    _getMemoryLength,
    _wrapMemory,
    _createString,
    _getPointerStatus,
    _setPointerStatus,
    _readGlobalSlot,
    _readObjectSlot,
    _writeObjectSlot,
    _createDataView,
    _writeToConsole,

    // these functions will only be called at comptime
    _writeGlobalSlot: _writeGlobalSlot ,
    _setObjectPropertyString: _setObjectPropertyString ,
    _setObjectPropertyInteger: _setObjectPropertyInteger ,
    _setObjectPropertyBoolean: _setObjectPropertyBoolean ,
    _setObjectPropertyObject: _setObjectPropertyObject ,
    _beginStructure: _beginStructure ,
    _attachMember: _attachMember ,
    _attachMethod: _attachMethod ,
    _attachTemplate: _attachTemplate ,
    _finalizeStructure: _finalizeStructure ,
    _createObject: _createObject ,
    _createTemplate: _createTemplate ,
  };
  const { instance } = await WebAssembly.instantiate(module, { env: imports });
  const { memory: wasmMemory, define, run, alloc, free, safe } = instance.exports;
  let consolePending = '', consoleTimeout = 0;

  {
    // call factory function
    const runtimeSafety = !!safe();
    const argStructIndex = addObject({ [SLOTS]: {} });
    const errorIndex = define(argStructIndex);
    if (errorIndex !== 0) {
      throwError(errorIndex);
    }
    return { structures, runtimeSafety };
  }

  function getString(address, len) {
    const ta = new Uint8Array(wasmMemory.buffer, address, len);
    return decoder.decode(ta);
  }

  function addString(address, len) {
    const s = getString(address, len);
    let index = stringIndices[s];
    if (index === undefined) {
      index = stringIndices[s] = nextStringIndex++;
      stringTable[index] = s;
    }
    return index;
  }

  function addObject(object) {
    const index = nextValueIndex++;
    valueTable[index] = object;
    valueIndices.set(object, index);
    return index;
  }

  function getObjectIndex(object) {
    const index = valueIndices.get(object);
    return (index !== undefined) ? index : addObject(object);
  }

  function throwError(errorIndex) {
    const errorName = stringTable[errorIndex];
    const errorMsg = decamelizeErrorName(errorName);
    throw new Error(errorMsg);
  }

  function _startCall(ctxAddr) {
    callContexts[ctxAddr] = { bufferMap: new Map() };
  }


  function _endCall(ctxAddr) {
    // move data from WASM memory into buffers
    const ctx = callContexts[ctxAddr];
    for (const [ buffer, { address, len, dv, copy } ] of ctx.bufferMap) {
      const src = new DataView(wasmMemory.buffer, address, len);
      if (copy) {
        copy(dv, src);
      }
    }
    delete callContexts[ctxAddr];
    if (Object.keys(callContexts).length === 0) {
      // TODO: clear the value table
      // nextValueIndex = 1;
      // valueTable = { 0: null };
      // output pending text to console
      if (consolePending) {
        console.log(consolePending);
        consolePending = '';
        clearTimeout(consoleTimeout);
      }
    }
  }

  function _allocMemory(ctxAddr, len, ptrAlign) {
    const address = alloc(ctxAddr, len, ptrAlign);
    const { bufferMap } = callContexts[ctxAddr];
    const buffer = new ArrayBuffer(len);
    const dv = new DataView(buffer);
    const copy = getMemoryCopier(len);
    bufferMap.set(buffer, { address, len, dv, copy });
    return address;
  }

  function _freeMemory(ctxAddr, address, len, ptrAlign) {
    const { bufferMap } = callContexts[ctxAddr];
    for (const [ buffer, { address: matching } ] of bufferMap) {
      if (address === matching) {
        bufferMap.delete(buffer);
        free(ctxAddr, address, len, ptrAlign);
      }
    }
  }

  function _getMemory(ctxAddr, objectIndex) {
    const object = valueTable[objectIndex];
    let dv = object[MEMORY];
    if (!dv) {
      return 0;
    }
    const ctx = callContexts[ctxAddr];
    let memory = ctx.bufferMap.get(dv.buffer);
    if (!memory) {
      const len = dv.buffer.byteLength;
      const address = alloc(ctxAddr, len);
      const dest = new DataView(wasmMemory.buffer, address, len);
      // create new dataview if the one given only covers a portion of it
      const src = (dv.byteLength === len) ? dv : new DataView(dv.buffer);
      const copy = getMemoryCopier(len);
      copy(dest, src);
      memory = { address, len, dv: src, copy };
      ctx.bufferMap.set(dv.buffer, memory);
    }
    return addObject({
      address: memory.address + dv.byteOffset,
      len: dv.byteLength
    });
  }

  function _getMemoryOffset(objectIndex) {
    const object = valueTable[objectIndex];
    return object.address;
  }

  function _getMemoryLength(objectIndex) {
    const object = valueTable[objectIndex];
    return object.len;
  }

  function _wrapMemory(structureIndex, viewIndex) {
    const structure = valueTable[structureIndex];
    let dv = valueTable[viewIndex];
    let object;
    {
      object = {
        [STRUCTURE]: structure,
        [MEMORY]: dv,
        [SLOTS]: {},
      };
      if (structure.type === StructureType.Pointer) {
        object[ZIG] = true;
      }
    }
    return addObject(object);
  }

  function _createString(address, len) {
    return addString(address, len);
  }

  function _createObject() {
    return addObject({});
  }

  function _setObjectPropertyString(containerIndex, keyIndex, valueIndex) {
    const container = valueTable[containerIndex];
    const key = stringTable[keyIndex];
    const value = stringTable[valueIndex];
    container[key] = value;
  }

  function _setObjectPropertyInteger(containerIndex, keyIndex, value) {
    const container = valueTable[containerIndex];
    const key = stringTable[keyIndex];
    container[key] = value;
  }

  function _setObjectPropertyBoolean(containerIndex, keyIndex, value) {
    const container = valueTable[containerIndex];
    const key = stringTable[keyIndex];
    container[key] = !!value;
  }

  function _setObjectPropertyObject(containerIndex, keyIndex, valueIndex) {
    const container = valueTable[containerIndex];
    const key = stringTable[keyIndex];
    container[key] = valueTable[valueIndex];
  }

  function _getPointerStatus(objectIndex) {
    const pointer = valueTable[objectIndex];
    const status = pointer[ZIG];
    if (typeof(status) !== 'boolean') {
      return -1;
    }
    return status ? 1 : 0;
  }

  function _setPointerStatus(objectIndex, status) {
    const pointer = valueTable[objectIndex];
    pointer[ZIG] = !!status;
  }

  function _readGlobalSlot(slot) {
    const object = globalSlots[slot];
    return object ? getObjectIndex(object) : 0;
  }

  function _writeGlobalSlot(slot, valueIndex) {
    const value = valueTable[valueIndex];
    globalSlots[slot] = value;
    // remember the slot number of each structure defined
    value.slot = slot;
  }

  function _readObjectSlot(objectIndex, slot) {
    const object = valueTable[objectIndex];
    const value = object[SLOTS][slot];
    return value ? getObjectIndex(value) : 0;
  }

  function _writeObjectSlot(objectIndex, slot, valueIndex) {
    const object = valueTable[objectIndex];
    object[SLOTS][slot] = valueTable[valueIndex];
  }

  function _beginStructure(defIndex) {
    const def = valueTable[defIndex];
    return addObject(beginStructure(def));
  }

  function _attachMember(structureIndex, defIndex, isStatic) {
    if (omitFunctions) {
      return;
    }
    const structure = valueTable[structureIndex];
    const def = valueTable[defIndex];
    attachMember(structure, def, !!isStatic);
  }

  function _attachMethod(structureIndex, defIndex, isStaticOnly) {
    const structure = valueTable[structureIndex];
    const def = valueTable[defIndex];
    attachMethod(structure, def, !!isStaticOnly);
  }

  function _attachTemplate(structureIndex, templateIndex, isStatic) {
    const structure = valueTable[structureIndex];
    const template = valueTable[templateIndex];
    attachTemplate(structure, template, !!isStatic);
  }

  function _finalizeStructure(structureIndex) {
    const structure = valueTable[structureIndex];
    structures.push(structure);
  }

  function createCopy(ctx, address, len) {
    const buffer = new ArrayBuffer(len);
    const copy = getMemoryCopier(len);
    const dv = new DataView(buffer);
    // copy content immediately, since address is likely pointing to a stack location
    const src = new DataView(wasmMemory.buffer, address, len);
    copy(dv, src);
    ctx.bufferMap.set(buffer, { address, len, dv, copy: null });
    return dv;
  }

  function obtainDataView(ctx, address, len, disposition) {
    if (disposition === MemoryDisposition.Copy) {
      return createCopy(ctx, address, len);
    } else if (disposition === MemoryDisposition.Auto) {
      // look for address among existing buffers
      for (const [ buffer, { address: start, len: count } ] of ctx.bufferMap) {
        if (start <= address && address + len <= start + count) {
          const offset = address - start;
          return new DataView(buffer, offset, len);
        }
      }
    }
    {
      const dv = createCopy(ctx, address, len);
      if (disposition !== MemoryDisposition.Copy) {
        // need linkage to wasm memory at runtime
        dv.address = address;
      }
      return dv;
    }
  }

  function _createDataView(ctxAddr, address, len, disposition) {
    const ctx = callContexts[ctxAddr];
    return addObject(obtainDataView(ctx, address, len, disposition));
  }

  function _createTemplate(memoryIndex) {
    const memory = valueTable[memoryIndex];
    return addObject({
      [MEMORY]: memory,
      [SLOTS]: {},
    });
  }

  function _writeToConsole(address, len) {
    // send text up to the last newline character
    const s = getString(address, len);
    const index = s.lastIndexOf('\n');
    if (index === -1) {
      consolePending += s;
    } else {
      console.log(consolePending + s.substring(0, index));
      consolePending = s.substring(index + 1);
    }
    clearTimeout(consoleTimeout);
    if (consolePending) {
      consoleTimeout = setTimeout(() => {
        console.log(consolePending);
        consolePending = '';
      }, 250);
    }
  }
}

function generateCode(structures, params) {
  const {
    runtimeURL,
    loadWASM,
    topLevelAwait,
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
        memberFeatures[ getMemberFeature(member) ] = true;
      }
    }
  }
  if (memberFeatures.useIntEx) {
    delete memberFeatures.useInt;
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
  const imports = [ 'finalizeStructures' ];
  if (loadWASM) {
    imports.push('linkModule');
  }
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
    initializer: null,
    pointerCopier: null,
    pointerResetter: null,
    pointerDisabler: null,
    typedArray: null,
    type: StructureType.Primitive,
    name: undefined,
    size: 4,
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
    isRequired: false,
    bitSize: 32,
    byteSize: 4,
  };

  add(`\n// define structures`);
  addDefaultStructure();
  addDefaultMember();
  const structureNames = new Map();
  const methodNames = new Map();
  const arrayBufferNames = new Map();
  let arrayBufferCount = 0;
  let methodCount = 0;
  for (const [ index, structure ] of structures.entries()) {
    const varname = `s${index}`;
    addStructure(varname, structure);
    structureNames.set(structure, varname);
  }

  add(`\n// finalize structures`);
  const varnames = [ ...structureNames.values() ];
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
  add(`const linkage = finalizeStructures(structures);`);

  // the root structure gets finalized last
  const root = structures[structures.length - 1];
  add(`const module = ${structureNames.get(root)}.constructor;`);

  if (loadWASM) {
    add('\n// initiate loading and compilation of WASM bytecodes');
    add(`const wasmPromise = ${loadWASM};`);
    add('const __init = linkModule(wasmPromise, linkage);');
  } else {
    add('\n// no need to use WASM binary');
    add('const __init = Promise.resolve(true);');
  }

  add('\n// export functions, types, and constants');
  const exportables = [];
  for (const method of root.static.methods) {
    exportables.push(method.name);
  }
  for (const member of root.static.members) {
    // only read-only properties are exportable
    let readOnly = false;
    if (member.type === MemberType.Type) {
      readOnly = true;
    } else if (member.type === MemberType.Object && member.structure.type === StructureType.Pointer) {
      if (member.isConst) {
        readOnly = true;
      }
    }
    if (readOnly) {
      exportables.push(member.name);
    }
  }
  add(`const {`);
  for (const name of exportables) {
    add(`${name},`);
  }
  add(`} = module;`);
  add(`export {`);
  for (const name of [ 'module as default', ...exportables, '__init' ]) {
    add(`${name},`);
  }
  add(`};`);
  if (topLevelAwait && loadWASM) {
    add(`\n// await initialization`);
    add(`await __init`);
  }
  add(``);

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
    add(`const ${varname} = {`);
    add(`...s,`);
    for (const [ name, value ] of Object.entries(structure)) {
      if (name !== 'options' && isDifferent(value, defaultStructure[name])) {
        switch (name) {
          case 'instance':
          case 'static':
            addStructureContent(name, value);
            break;
          default:
            add(`${name}: ${JSON.stringify(value)},`);
        }
      }
    }
    add(`};`);
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
      const { [STRUCTURE]: structure, [MEMORY]: dv, [SLOTS]: slots } = object;
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
        const ta = new Uint8Array(dv.buffer);
        add(`const ${varname} = new Uint8Array([ ${ta.join(', ')} ]);`);
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

  const code = lines.join('\n');
  return code;
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
  // allocate indices for internal functions
  const funcSection = getSection(SectionType.Function);
  const codeSection = getSection(SectionType.Code);
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

  if (functionNames.length === 0) {
    // get the names from the export and import section if they're missing
    const exportSection = getSection(SectionType.Export);
    for (const object of exportSection.exports) {
      if (object.type === ObjectType.Function) {
        const fn = functions[object.index];
        fn.name = object.name;
      }
    }
    const importSection = getSection(SectionType.Import);
    for (const object of importSection.imports) {
      if (object.type === ObjectType.Function) {
        const fn = functions[object.index];
        fn.name = object.name;
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
  for (const segment of elemSection.segments) {
    if (segment.indices) {
      for (const index of segment.indices) {
        useFunction(index);
      }
    }
  }

  // mark exported functions as being in-use
  const exportSection = getSection(SectionType.Export);
  for (const object of exportSection.exports) {
    if (object.type === ObjectType.Function) {
      useFunction(object.index);
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
  // create new export section
  const newExportSection = { type: SectionType.Export, exports: [] };
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
  // create new import section
  const newImportSection = { type: SectionType.Import, imports: [] };
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
  // create new name section
  let newNameSection = null;
  if (nameSection && keepNames) {
    const newFunctionNames = [];
    const newLocalNames = [];
    for (const fn of newFunctions) {
      newFunctionNames.push(fn.name);
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

async function transpile(path$1, options = {}) {
  const { env } = process;
  const {
    embedWASM = true,
    topLevelAwait = true,
    omitFunctions = false,
    optimize = (env.NODE_ENV === 'production') ? 'ReleaseSmall' : 'Debug',
    clean = (env.NODE_ENV === 'production'),
    stripWASM = (optimize !== 'Debug'),
    keepNames = false,
    moduleResolver = (name) => name,
    wasmLoader,
    ...otherOptions
  } = options;
  if (process.env.NODE_ENV !== 'production') {
    if (typeof(wasmLoader) !== 'function') {
      if (embedWASM !== true) {
        throw new Error(`wasmLoader is a required option when embedWASM is false`);
      }
    }
  }
  const wasmPath = await compile(path$1, { ...otherOptions, optimize, target: 'wasm' });
  const content = await promises.readFile(wasmPath);
  const { structures, runtimeSafety } = await runModule(content, { omitFunctions });
  // all methods are static, so there's no need to check the instance methods
  const hasMethods = !!structures.find(s => s.static.methods.length > 0);
  const runtimeURL = moduleResolver('zigar-runtime');
  const name = path.basename(wasmPath);
  let loadWASM;
  if (hasMethods) {
    let dv = new DataView(content.buffer);
    if (stripWASM) {
      dv = stripUnused(dv, { keepNames });
      //await writeFile(wasmPath.replace('.wasm', '.min.wasm'), dv);
    }
    if (embedWASM) {
      loadWASM = embed(name, dv);
    } else {
      loadWASM = await wasmLoader(name, dv);
    }
  }
  return generateCode(structures, { runtimeURL, loadWASM, runtimeSafety, topLevelAwait });
}

function embed(name, dv) {
  const base64 = Buffer.from(dv.buffer, dv.byteOffset, dv.byteLength).toString('base64');
  return `(async () => {
  // ${name}
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
