import { join, resolve, parse } from 'path';
import { tmpdir } from 'os';
import { writeFile, unlink, stat, lstat, open, rename, readFile, chmod, mkdir, readdir, rmdir } from 'fs/promises';

const cwd = process.cwd();

async function compile(path, options = {}) {
  const { env } = process;
  const {
    buildDir = env.ZIGAR_BUILD_DIR ?? tmpdir(),
    cacheDir = env.ZIGAR_CACHE_DIR ?? join(cwd, 'zig-cache'),
    zigCmd = env.ZIGAR_BUILD_CMD ?? 'zig build',
    cleanUp = env.ZIGAR_CLEAN_UP ?? (env.NODE_ENV === 'production') ? '1' : '',
    target,
    optimization = (env.NODE_ENV === 'production') ? ((target === 'wasm') ? 'ReleaseSmall' : 'ReleaseFast') : 'Debug',
  } = options;
  const fullPath = resolve(path);
  const rootFile = parse(fullPath);
  const wasm = (target === 'wasm');
  const config = {
    target,
    optimization,
    packageName: rootFile.name,
    packagePath: fullPath,
    exporterPath: absolute(`${wasm ? 'wasm-' : 'cpp-'}exporter.zig`),
    stubPath: absolute(`${wasm ? 'wasm-' : 'cpp-'}stub.zig`),
    buildFilePath: absolute(`build.zig`),
    useLibC: false,
  };
  const soName = (wasm) ? `${rootFile.name}.wasm` : `lib${rootFile.name}.so`;
  const soPath = join(cacheDir, soName);
  const soMTime = (await find(soPath))?.mtime;
  if (!buildDir || !cacheDir) {
    // can't build when no command or build directory is set to empty
    if (soMTime) {
      return soPath;
    } else {
      throw new Error(`Cannot find shared library and compilation is disabled: ${soPath}`);
    }
  }
  if (!find(fullPath)) {
    throw new Error(`Source file not found: ${fullPath}`);
  }
  // scan the dir containing the file to see if recompilation is necessary
  // also check if there's a custom build file and for C dependency
  let changed = false;
  await walk(rootFile.dir, /\.(zig|c|cc|cpp|h|hh)$/i, (dir, name, { mtime }) => {
    if (dir === rootFile.dir && name === rootFile.name + '.build.zig') {
      config.buildFilePath = join(dir, name);
    }
    if (!/\.zig$/.test(name)) {
      config.useLibC = true;
    }
    if (!(soMTime > mtime)) {
      changed = true;
    }
  });
  // build in a unique temp dir
  const soBuildDir = join(buildDir, await md5(fullPath), (wasm) ? `wasm` : '');
  const logPath = join(soBuildDir, 'log');
  const cmdPath = join(soBuildDir, 'cmd');
  const pidPath = join(soBuildDir, 'pid');
  // if there's an existing build folder, use it only if the command used to create it is the same
  const prevCmd = await load(cmdPath, '');
  if (prevCmd && prevCmd !== zigCmd) {
    if (await writePID(pidPath)) {
      await rimraf(soBuildDir);
      changed = true;
    }
  }
  if (!changed) {
    return soPath;
  }
  let done = false, errorLog;
  while (!done) {
    await mkdirp(soBuildDir);
    if (await writePID(pidPath)) {
      await createProject(config, soBuildDir);
      const { exec } = await import('child_process');
      const options = {
        cwd: soBuildDir,
        windowsHide: true,
      };
      const success = await new Promise((resolve) => {
        exec(zigCmd, options, (err, stdout, stderr) => {
          if (err) {
            errorLog = stderr || '[NO OUTPUT]';
            resolve(false);
            writeFile(logPath, errorLog).catch(() => {});
          } else {
            resolve(true);
          }
        });
      });
      try {
        if (success) {
          const libPath = join(soBuildDir, 'zig-out', 'lib', soName);
          await mkdirp(cacheDir);
          await move(libPath, soPath);
        }
      } finally {
        if (cleanUp) {
          await rimraf(soBuildDir);
        } else {
          await unlink(pidPath);
          await writeFile(cmdPath, zigCmd);
        }
      }
      done = true;
    } else {
      // perhaps another process is compiling the same file--wait for it to finish
      if (await monitor(soBuildDir)) {
        // pidfile has vanished--see if the shared library has been updated
        const newMTime = (await find(soPath))?.mtime;
        if (!(newMTime && newMTime !== soMTime)) {
          errorLog = await load(logPath, '[ERROR LOG NOT FOUND]');
        }
        done = true;
      } else {
        // remove the stale folder
        await rimraf(soBuildDir);
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
    return await (follow ? stat(path) : lstat(path));
  } catch (err) {
  }
}

async function walk(dir, re, cb) {
  const ino = (await find(dir))?.ino;
  if (!ino) {
    return;
  }
  const scanned = [ ino ];
  const scan = async (dir) => {
    try {
      const list = await readdir(dir);
      for (const name of list) {
        if (name.startsWith('.') || name === 'node_modules' || name === 'zig-cache') {
          continue;
        }
        const path = join(dir, name);
        const info = await find(path);
        if (info?.isDirectory() && !scanned.includes(info.ino)) {
          await scan(path);
        } else if (info?.isFile() && re.test(name)) {
          cb(dir, name, info);
        }
      }
    } catch (err) {
    }
  };
  await scan(dir);
}

async function monitor(path) {
  while (true) {
    const mtime = (await find(path)).mtime;
    if (!mtime) {
      // pidfile has been removed
      return true;
    } else if (new Date() - mtime > 2500) {
      // pidfile's been abandoned
      return false;
    }
    await delay(500);
  }
}

async function writePID(path) {
  try {
    const handle = await open(path, 'wx');
    handle.write(`${process.pid}`);
    handle.close();
    return true;
  } catch (err) {
    if (err.code == 'EEXIST') {
      return false;
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
  lines.push(`pub const optimize_mode: std.builtin.Mode = .${config.optimization};`);
  lines.push(`pub const package_name = ${JSON.stringify(config.packageName)};`);
  lines.push(`pub const package_path = ${JSON.stringify(config.packagePath)};`);
  lines.push(`pub const exporter_path = ${JSON.stringify(config.exporterPath)};`);
  lines.push(`pub const stub_path = ${JSON.stringify(config.stubPath)};`);
  lines.push(`pub const use_libc = ${config.useLibC ? true : false};`);
  lines.push(``);
  const content = lines.join('\n');
  const cfgFilePath = join(dir, 'build-cfg.zig');
  await writeFile(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  await copy(config.buildFilePath, buildFilePath);
}

async function move(srcPath, dstPath) {
  try {
    await rename(srcPath, dstPath);
  } catch (err) {
    if (err.code == 'EXDEV') {
      await copy(srcPath, dstPath);
      await unlink(srcPath);
    } else {
      throw err;
    }
  }
}

async function copy(srcPath, dstPath) {
  const info = await stat(srcPath);
  const data = await readFile(srcPath);
  await writeFile(dstPath, data);
  await chmod(dstPath, info.mode);
}

async function load(path, def) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    return def;
  }
}

async function md5(text) {
  const { createHash } = await import('crypto');
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

async function mkdirp(path) {
  const exists = await find(path);
  if (!exists) {
    const { root, dir } = parse(path);
    await mkdirp(dir);
    await mkdir(path);
  }
}

async function rimraf(dir) {
  const remove = async (dir) => {
    const list = await readdir(dir);
    for (const name of list) {
      const path = join(dir, name);
      const info = await find(path, false);
      if (info?.isDirectory()) {
        await remove(path);
      } else if (info) {
        await unlink(path);
      }
    }
    await rmdir(dir);
  };
  await remove(dir);
}

async function delay(ms) {
  await new Promise(r => setTimeout(r, ms));
}

function absolute(relpath) {
  return (new URL(relpath, import.meta.url)).pathname;
}

const MEMORY = Symbol('memory');
const SLOTS = Symbol('slots');
const ZIG = Symbol('Zig');
const STRUCTURE = Symbol('structure');

function getMemoryCopier(size) {
  switch (size) {
    case 1: return copy1;
    case 2: return copy2;
    case 4: return copy4;
    case 8: return copy8;
    case 16: return copy16;
    case 32: return copy32;
    default:
      if (!(size & 0x07)) return copy8x;
      if (!(size & 0x03)) return copy4x;
      if (!(size & 0x01)) return copy2x;
      return copy1x;
  }
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
  ExternUnion: 3,
  BareUnion: 4,
  TaggedUnion: 5,
  ErrorUnion: 6,
  ErrorSet: 7,
  Enumeration: 8,
  Optional: 9,
  Pointer: 10,
  Slice: 11,
  Opaque: 12,
  ArgStruct: 13,
};

Array(Object.values(StructureType).length);

function beginStructure(def, options = {}) {
  const {
    type,
    name,
    size,
    hasPointer,
  } = def;
  return {
    constructor: null,
    initializer: null,
    pointerCopier: null,
    pointerResetter: null,
    type,
    name,
    size,
    hasPointer,
    instance: {
      members: [],
      template: null,
    },
    static: {
      members: [],
      template: null,
    },
    methods: [],
    options,
  };
}

function attachMember(s, def) {
  const target = (def.isStatic) ? s.static : s.instance;
  target.members.push(def);
}

function attachMethod(s, def) {
  s.methods.push(def);
}

function attachTemplate(s, def) {
  const target = (def.isStatic) ? s.static : s.instance;
  target.template = def.template;
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

async function runWASMBinary(wasmBinary, options = {}) {
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
  const { instance } = await WebAssembly.instantiate(wasmBinary, { env: imports });
  const { memory: wasmMemory, define, run, alloc, free } = instance.exports;
  {
    // call factory function
    const argStructIndex = addObject({ [SLOTS]: {} });
    const errorIndex = define(argStructIndex);
    if (errorIndex !== 0) {
      throwError(errorIndex);
    }
    return structures;
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
      copy(dv, src);
    }
    delete callContexts[ctxAddr];
    if (Object.keys(callContexts) === 0) {
      // clear the value table
      nextValueIndex = 1;
      valueTable = { 0: null };
    }
  }

  function _allocMemory(ctxAddr, len) {
    const address = alloc(ctxAddr, len);
    const ctx = callContexts[ctxAddr];
    const buffer = new ArrayBuffer(len);
    const dv = new DataView(buffer);
    const copy = getMemoryCopier(len);
    ctx.bufferMap.set(buffer, { address, len, dv, copy });
    return address;
  }

  function _freeMemory(ctxAddr, address, len) {
    for (const [ buffer, { address: matching } ] of bufferMap) {
      if (address === matching) {
        bufferMap.delete(buffer);
        free(ctxAddr, address, len);
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
    const dv = valueTable[viewIndex];
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

  function _attachMember(structureIndex, defIndex) {
    if (omitFunctions) {
      return;
    }
    const structure = valueTable[structureIndex];
    const def = valueTable[defIndex];
    attachMember(structure, def);
  }

  function _attachMethod(structureIndex, defIndex) {
    const structure = valueTable[structureIndex];
    const def = valueTable[defIndex];
    attachMethod(structure, def);
  }

  function _attachTemplate(structureIndex, templateIndex) {
    const structure = valueTable[structureIndex];
    const template = valueTable[templateIndex];
    attachTemplate(structure, template);
  }

  function _finalizeStructure(structureIndex) {
    const structure = valueTable[structureIndex];
    structures.push(structure);
  }

  function createCopy(ctx, address, len) {
    const buffer = new ArrayBuffer(len);
    const copy = getMemoryCopier(len);
    const dv = new DataView(buffer);
    ctx.bufferMap.set(buffer, { address, len, dv, copy });
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
    const s = getString(address, len);
    // remove any trailing newline character
    console.log(s.replace(/\r?\n$/, ''));
  }
}

function serializeDefinitions(structures, params) {
  const {
    runtimeURL,
    loadWASM,
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
    structureFeatures[getStructureFeature(structure)] = true;
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
    imports.push('linkWASMBinary');
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

  add(`\n// define structures`);
  const structureNames = new Map();
  const arrayBufferNames = new Map();
  let arrayBufferCount = 0;
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
    add('\n// initialize loading and compilation of WASM bytecodes');
    add(`const binaryPromise = ${loadWASM};`);
    // TODO: figure out how best to load the binary
    add('const __init = linkWASMBinary(binaryPromise, linkage);');
  } else {
    add('\n// no need to initialize WASM binary');
    add('const __init = Promise.resolve(true);');
  }

  add('\n// export functions, types, and constants');
  const exportables = [];
  for (const method of root.methods) {
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
  add(``);

  function addStructure(varname, structure) {
    addBuffers(structure.instance.template);
    addBuffers(structure.static.template);
    add(`const ${varname} = {`);
    for (const [ name, value ] of Object.entries(structure)) {
      switch (name) {
        case 'instance':
        case 'static':
          add(`${name}: {`);
          addMembers(value.members);
          addTemplate(value.template);
          add(`},`);
          break;
        case 'methods':
          addMethods(value);
          break;
        default:
          add(`${name}: ${JSON.stringify(value)},`);
      }
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
    for (const [ name, value ] of Object.entries(member)) {
      switch (name) {
        case 'structure':
          add(`${name}: ${structureNames.get(value)},`);
          break;
        default:
          add(`${name}: ${JSON.stringify(value)},`);
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
    if (methods.length > 0) {
      add(`methods: [`);
      for (const method of methods) {
        addMethod(method);
      }
      add(`],`);
    } else {
      add(`methods: [],`);
    }
  }

  function addMethod(method) {
    add(`{`);
    for (const [ name, value ] of Object.entries(method)) {
      switch (name) {
        case 'argStruct':
          add(`${name}: ${structureNames.get(value)},`);
          break;
        default:
          add(`${name}: ${JSON.stringify(value)},`);
      }
    }
    add(`},`);
  }

  const code = lines.join('\n');
  return code;
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

function stripUnused(binary) {
  const { sections, size } = parseBinary(binary);
  const blacklist = [
    /^define$/,
    /^exporter.createRootFactory/,
  ];

  function getSection(type) {
    return sections.find(s => s.type === type);
  }

  function getNames() {
    let moduleName;
    const functionNames = [];
    for (const section of sections) {
      if (section.type === SectionType.Custom) {
        const {
          eof,
          readString,
          readU8,
          readU32Leb128,
          readArray,
          readBytes,
        } = createReader(section.data);
        const name = readString();
        if (name === 'name') {
          while(!eof()) {
            const id = readU8();
            const size = readU32Leb128();
            switch (id) {
              case 0: {
                moduleName = readString();
              } break;
              case 1: {
                const map = readArray(() => {
                  const index = readU32Leb128();
                  const name = readString();
                  return { index, name };
                });
                for (const { index, name } of map) {
                  functionNames[index] = name;
                }
              } break;
              default: {
                readBytes(size);
              }
            }
          }
          break;
        }
      }
    }
    return { moduleName, functionNames };
  }

  const { moduleName, functionNames } = getNames();
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
    } else {
      newImportSection.imports.push(object);
    }
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
  } = createWriter(module.size * 10);
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
                writeArray.writeExpression(segment.expr);
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
  const decoder = new TextDecoder();
  let offset = 0;

  function eof() {
    return (offset >= dv.byteLength);
  }

  function readBytes(len) {
    const bytes = new DataView(dv.buffer, offset, len);
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
        return value;
      }
    }
  }

  function readU64Leb128() {
    let value = 0n;
    let shift = 0n;
    while (true) {
      const byte = dv.getUint8(offset++);
      value |= BigInt(byte & 0x7f) << shift;
      shift += 7n;
      if ((0x80 & byte) === 0) {
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
    while (readU8() !== 0x0B);
    const len = offset - start;
    return new DataView(dv.buffer, dv.byteOffset + start, len);
  }

  return {
    eof,
    readBytes,
    readU8,
    readU32,
    readF64,
    readString,
    readArray,
    readU32Leb128,
    readU64Leb128,
    readI32Leb128,
    readI64Leb128,
    readExpression,
  };
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
      value >>= 7;
      if (value === 0) {
        writeU8(byte);
        return;
      }
      writeU8(byte | 0x80);
    }
  }

  function writeU64Leb128(value) {
    while (true) {
      const byte = Number(value & 0x7fn);
      value >>= 7n;
      if (value === 0n) {
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

  return {
    finalize,
    writeBytes,
    writeU8,
    writeU32,
    writeF64,
    writeString,
    writeArray,
    writeU32Leb128,
    writeU64Leb128,
    writeI32Leb128,
    writeI64Leb128,
    writeExpression,
    writeLength,
  };
}

function parseFunction(dv) {
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
  } = createReader(dv);
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
  // read locals first
  const locals = readArray(readU8);
  // decode the expression
  const instructions = [];
  while (!eof()) {
    const opcode = readU8();
    const f = operandReaders[opcode];
    const operand = f?.();
    instructions.push({ opcode, operand });
  }
  const size = dv.byteLength;
  return { locals, instructions, size };
}

function repackFunction({ locals, instructions, size }) {
  const {
    finalize,
    writeBytes,
    writeU8,
    writeArray,
    writeU32Leb128,
    writeI32Leb128,
    writeI64Leb128,
    writeU32,
    writeF64,
  } = createWriter(size);
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
    0xFD: () => {
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
  writeArray(locals, writeU8);
  for (const { opcode, operand } of instructions) {
    writeU8(opcode);
    const f = operandWriters[opcode];
    f?.(operand);
  }
  return finalize();
}

async function transpile(path, options = {}) {
  const {
    embedWASM = true,
    moduleResolver = (name) => name,
    wasmLoader,
    omitFunctions,
    ...compileOptions
  } = options;
  const wasmPath = await compile(path, { ...compileOptions, target: 'wasm' });
  const content = await readFile(wasmPath);
  const structures = await runWASMBinary(content, { omitFunctions });
  const hasMethods = !!structures.find(s => s.methods.length > 0);
  const runtimeURL = moduleResolver('zigar-runtime');
  let loadWASM;
  if (hasMethods) {
    if (embedWASM) {
      const binary = new DataView(content.buffer);
      const dv = stripUnused(binary);
      await writeFile(wasmPath.replace('.wasm', '.min.wasm'), dv);
      const base64 = Buffer.from(dv.buffer, dv.byteOffset, dv.byteLength).toString('base64');
      loadWASM = `(async () => {
        const binaryString = atob(${JSON.stringify(base64)});
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      })()`;
    } else {
      if (typeof(wasmLoader) !== 'function') {
        throw new Error(`wasmLoader is a required option when embedWASM is false`);
      }
      loadWASM = wasmLoader(wasmPath);
    }
  }
  return serializeDefinitions(structures, { runtimeURL, loadWASM });
}

export { compile, transpile };
