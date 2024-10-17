import childProcess from 'child_process';
import { openSync, readSync, closeSync, writeFileSync } from 'fs';
import { open, stat, readFile, writeFile, chmod, unlink, mkdir, readdir, lstat, rmdir } from 'fs/promises';
import os from 'os';
import { sep, dirname, join, parse, basename, isAbsolute, resolve } from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { createHash } from 'crypto';

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
const structureNames = Object.keys(StructureType);
const StructureFlag = {
  HasValue:         0x0001,
  HasObject:        0x0002,
  HasPointer:       0x0004,
  HasSlot:          0x0008,
};
const PrimitiveFlag = {
  IsSize:           0x0010,
};
const ArrayFlag = {
  IsString:         0x0010,
};
const StructFlag = {
  IsExtern:         0x0010,
  IsPacked:         0x0020,
  IsIterator:       0x0040,
  IsTuple:          0x0080,

  IsAllocator:      0x0100,
  IsPromise:        0x0200,
  IsAbortSignal:    0x0400,
};
const UnionFlag = {
  HasSelector:      0x0010,
  HasTag:           0x0020,
  HasInaccessible:  0x0040,
  IsExtern:         0x0080,

  IsPacked:         0x0100,
  IsIterator:       0x0200,
};
const EnumFlag = {
  IsOpenEnded:      0x0010,
  IsIterator:       0x0020,
};
const OptionalFlag = {
  HasSelector:      0x0010,
};
const PointerFlag = {
  HasLength:        0x0010,
  IsMultiple:       0x0020,
  IsSingle:         0x0040,
  IsConst:          0x0080,

  IsNullable:       0x0100,
};
const SliceFlag = {
  HasSentinel:      0x0010,
  IsString:         0x0020,
};
const OpaqueFlag = {
  IsIterator:       0x0010,
};
const ArgStructFlag = {
  HasOptions:       0x0010,
  IsThrowing:       0x0020,
  IsAsync:          0x0040,
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
  IsSelector:       0x0008,
  IsMethod:         0x0010,
  IsSentinel:       0x0020,
  IsBackingInt:     0x0040,
};

const ExportFlag = {
  OmitMethods:      0x0001,
  OmitVariables:    0x0002,
};

const MEMORY = Symbol('memory');
const SLOTS = Symbol('slots');
const PARENT = Symbol('parent');
const FIXED = Symbol('fixed');
const NAME = Symbol('name');
const TYPE = Symbol('type');
const FLAGS = Symbol('flags');
const CLASS = Symbol('class');
const TAG = Symbol('tag');
const PROPS = Symbol('props');
const POINTER = Symbol('pointer');
const SENTINEL = Symbol('sentinel');
const ARRAY = Symbol('array');
const TARGET = Symbol('target');
const ENTRIES = Symbol('entries');
const MAX_LENGTH = Symbol('maxLength');
const KEYS = Symbol('keys');
const ADDRESS = Symbol('address');
const LENGTH = Symbol('length');
const LAST_ADDRESS = Symbol('lastAddress');
const LAST_LENGTH = Symbol('lastLength');
const PROXY = Symbol('proxy');
const CACHE = Symbol('cache');
const SIZE = Symbol('size');
const BIT_SIZE = Symbol('bitSize');
const ALIGN = Symbol('align');
const CONST_TARGET = Symbol('constTarget');
const CONST_PROXY = Symbol('constProxy');
const ENVIRONMENT = Symbol('environment');
const ATTRIBUTES = Symbol('attributes');
const PRIMITIVE = Symbol('primitive');
const GETTERS = Symbol('getters');
const SETTERS = Symbol('setters');
const TYPED_ARRAY = Symbol('typedArray');
const THROWING = Symbol('throwing');
const PROMISE = Symbol('promise');
const CONTEXT = Symbol('context');

const UPDATE = Symbol('update');
const RESTORE = Symbol('restore');
const RESET = Symbol('resetter');
const VIVIFICATE = Symbol('vivificate');
const VISIT = Symbol('visit');
const COPY = Symbol('copy');
const SHAPE = Symbol('shape');
const MODIFY = Symbol('modify');
const INITIALIZE = Symbol('initialize');
const FINALIZE = Symbol('finalize');
const CAST = Symbol('cast');

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
  const decoder = decoders[encoding] ??= new TextDecoder(encoding);
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
      const encoder = encoders[encoding] ??= new TextEncoder();
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

const isMisaligned = function(address, align) {
    return (align) ? !!(address & (align - 1)) : false;
  }
  /* c8 ignore next */
;

const alignForward = function(address, align) {
    return (address + (align - 1)) & ~(align - 1);
  }
  /* c8 ignore next */
;

const usizeMin = 0;
const usizeMax = 0xFFFF_FFFF;

const isInvalidAddress = function(address) {
    return address === 0xaaaaaaaa;
  }
  /* c8 ignore next */
;

const adjustAddress = function(address, addend) {
    return address + addend;
  }
  /* c8 ignore next */
;

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

function getSelf() {
  return this;
}

function getProxy() {
  return this[PROXY];
}

function toString() {
  return String(this);
}

function always() {
  return true;
}

function never() {
  return false;
}

class ObjectCache {
  map = new WeakMap();

  find(dv) {
    return this.map.get(dv);
  }

  save(dv, object) {
    this.map.set(dv, object);
    return object;
  }
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
  } = params;
  const exports = getExports(structures);
  const lines = [];
  const add = manageIndentation(lines);
  add(`import { createEnvironment } from ${JSON.stringify(runtimeURL)};`);
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
  add(`env.recreateStructures(structures, options);`);
  if (binarySource) {
    if (moduleOptions) {
      add(`\n// initiate loading and compilation of WASM bytecodes`);
    } else {
      add(`\n// load shared library`);
    }
    add(`const source = ${binarySource};`);
    add(`env.loadModule(source, ${moduleOptions ? JSON.stringify(moduleOptions) : null})`);
    // if top level await is used, we don't need to write changes into fixed memory buffers
    add(`env.linkVariables(${!topLevelAwait});`);
  }
  add(`\n// export root namespace and its methods and constants`);
  if (omitExports) {
    add(`const { constructor } = root;`);
    add(`const __zigar = env.getSpecialExports();`);
  } else {
    // the first two exports are default and __zigar
    add(`const { constructor: v0 } = root;`);
    add(`const v1 = env.getSpecialExports();`);
    if (exports.length > 2) {
      add(`const {`);
      for (const [ index, name ] of exports.entries()) {
        if (index >= 2) {
          add(`${name}: v${index},`);
        }
      }
      add(`} = v0;`);
    }
    add(`export {`);
    for (const [ index, name ] of exports.entries()) {
      add(`v${index} as ${name},`);
    }
    add(`};`);
  }
  if (topLevelAwait && binarySource) {
    add(`await v1.init();`);
  }
  const code = lines.join('\n');
  return { code, exports, structures };
}

function addStructureDefinitions(lines, definition) {
  const { structures, options, keys } = definition;
  const { MEMORY, SLOTS, CONST_TARGET } = keys;
  const add = manageIndentation(lines);
  const defaultStructure = {
    constructor: null,
    type: StructureType.Primitive,
    flags: 0,
    name: undefined,
    byteSize: 0,
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
  for (const [ index, dv ] of views.entries()) {
    if (!arrayBufferNames.get(dv.buffer)) {
      const varname = `a${index}`;
      arrayBufferNames.set(dv.buffer, varname);
      let initializers = '';
      if (dv.buffer.byteLength > 0) {
        const ta = new Uint8Array(dv.buffer);
        let allZeros = true;
        for (const byte of ta) {
          if (byte !== 0) {
            allZeros = false;
            break;
          }
        }
        if (allZeros) {
          initializers = `${ta.length}`;
        } else {
          initializers = `[ ${ta.join(', ')} ]`;
        }
      }
      addU();
      add(`const ${varname} = U(${initializers});`);
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
        const buffer = arrayBufferNames.get(dv.buffer);
        const pairs = [ `array: ${buffer}` ];
        if (dv.byteLength < dv.buffer.byteLength) {
          pairs.push(`offset: ${dv.byteOffset}`);
          pairs.push(`length: ${dv.byteLength}`);
        }
        add(`memory: { ${pairs.join(', ')} },`);
        if (dv.hasOwnProperty('reloc')) {
          add(`reloc: ${dv.reloc},`);
        }
        if (object[CONST_TARGET]) {
          add(`const: true,`);
        }
      }
      const entries = (slots) ? Object.entries(slots).filter(a => a[1]) : [];
      if (entries.length > 0) {
        add(`slots: {`);
        const pairs = entries.map(([slot, child]) => `${slot}: ${objectNames.get(child)}`);
        for (const slice of chunk(pairs, 10)) {
          add(slice.join(', ') + ',');
        }
        add(`},`);
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
            case 'instance':
            case 'static': {
              const { members, template } = value;
              add(`${name}: {`);
              add(`members: [`);
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
  add(`const options = {`);
  for (const [ name, value ] of Object.entries(options)) {
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
      /* c8 ignore start */
      const win32 = os.platform() === 'win32';
      const program = (win32) ? 'tasklist' : 'ps';
      const args = (win32) ? [ '/nh', '/fi', `pid eq ${pid}` ] : [ '-p', pid ];
      const { stdout } = await execFile$1(program, args, { windowsHide: true });
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

async function copyFile(srcPath, dstPath) {
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

function md5(text) {
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
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
      const sectionType = shdr.getUint32(Shdr.sh_type, le);
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

function getArch() {
  return os.arch();
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

const execFile = promisify(childProcess.execFile);

async function compile(srcPath, modPath, options) {
  const srcInfo = (srcPath) ? await stat(srcPath) : null;
  if (srcInfo?.isDirectory()) {
    srcPath = join(srcPath, '?');
  }
  const config = createConfig(srcPath, modPath, options);
  const { moduleDir, outputPath } = config;
  let changed = false;
  let sourcePaths = [];
  if (srcPath) {
    // add custom build file
    try {
      const path = join(moduleDir, 'build.zig');
      await stat(path);
      config.buildFilePath = path;
    } catch (err) {
    }
    // add custom package manager manifest
    try {
      const path = join(moduleDir, 'build.zig.zon');
      await stat(path);
      config.packageConfigPath = path;
    } catch (err) {
    }
    const { zigPath, zigArgs, moduleBuildDir } = config;
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
      const { onStart, onEnd } = options;
      // create config file
      await createProject(config, moduleBuildDir);
      // then run the compiler
      await runCompiler(zigPath, zigArgs, { cwd: moduleBuildDir, onStart, onEnd });
      // get list of files involved in build
      sourcePaths = await findSourcePaths(moduleBuildDir);
    } catch(err) {
      if (err.code === 'ENOENT') {
        if (!outputMTimeBefore) {
          throw new MissingModule(outputPath);
        }
      } else {
        throw err;
      }
    } finally {
      if (config.clean) {
        await deleteDirectory(moduleBuildDir);
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

async function runCompiler(path, args, options) {
  const {
    cwd,
    onStart,
    onEnd,
  } = options;
  try {
    onStart?.();
    return await execFile(path, args, { cwd, windowsHide: true });
  } catch (err) {
    throw new CompilationError(path, args, cwd, err);
    /* c8 ignore next */
  } finally {
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
    'moduleName', 'modulePath', 'moduleDir', 'outputPath', 'zigarSrcPath', 'useLibc', 'isWASM',
    'multithreaded', 'maxMemory',
  ];
  for (const [ name, value ] of Object.entries(config)) {
    if (fields.includes(name)) {
      const snakeCase = name.replace(/[A-Z]+/g, m => '_' + m.toLowerCase());
      lines.push(`pub const ${snakeCase} = ${JSON.stringify(value ?? null)};`);
    }
  }
  return lines.join('\n');
}

async function createProject(config, dir) {
  await createDirectory(dir);
  const content = formatProjectConfig(config);
  const cfgFilePath = join(dir, 'build-cfg.zig');
  await writeFile(cfgFilePath, content);
  const buildFilePath = join(dir, 'build.zig');
  await copyFile(config.buildFilePath, buildFilePath);
  if (config.packageConfigPath) {
    const packageConfigPath = join(dir, 'build.zig.zon');
    await copyFile(config.packageConfigPath, packageConfigPath);
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
  const folder = basename(src.dir).slice(0, 16).trim() + '-' + md5(src.dir).slice(0, 8);
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
    clean = false,
    buildDir = join(os.tmpdir(), 'zigar-build'),
    buildDirSize = 1000000000,
    zigPath = 'zig',
    zigArgs: zigArgsStr = '',
    multithreaded = (isWASM) ? false : true,
    maxMemory = (isWASM && multithreaded) ? 1024 * 65536 : undefined,
  } = options;
  const src = parse(srcPath ?? '');
  const mod = parse(modPath ?? '');
  const moduleName = mod.name || src.name;
  const modulePath = (src.name !== '?') ? srcPath : undefined;
  const moduleDir = src.dir;
  const modulePrefix = basename(moduleName).slice(0, 16);
  const moduleHash = md5(`${moduleDir}/${moduleName}`).slice(0, 8);
  const moduleBuildDir = join(buildDir, modulePrefix + '-' + moduleHash);
  const outputPath = (() => {
    if (!modPath && isWASM) {
      // save output in build folder
      return join(moduleBuildDir, optimize, `${src.name}.wasm`);
    } else {
      const extensions = {
        darwin: 'dylib',
        win32: 'dll',
      };
      const ext = extensions[platform] || 'so';
      return join(modPath, `${platform}.${arch}.${ext}`);
    }
  })();
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
      // we need support for atomic operations
      zigArgs.push(`-Dcpu=bleeding_edge`);
    }
  }
  const zigarSrcPath = fileURLToPath(new URL('../zig/', import.meta.url));
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
    clean,
    zigPath,
    zigArgs,
    useLibc,
    isWASM,
    multithreaded,
    maxMemory,
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
  const manifestPaths = await getManifestLists(buildPath);
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
            if(isAbsolute(srcPath) && !srcPath.startsWith(buildPath) && !srcPath.includes('/.cache/zig/')) {
              involved[srcPath] = true;
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
    for (const { path, size } of list) {
      if (!(total > buildDirSize)) {
        break;
      }
      try {
        const pidPath = `${path}.pid`;
        await acquireLock(pidPath, false);
        try {
          await deleteDirectory(path);
          total -= size;
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
  useLibc: {
    type: 'boolean',
    title: 'Link in C standard library',
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
  zigCmd: {
    type: 'string',
    title: 'Zig command used to build libraries',
  },
  sourceFiles: {
    type: 'object',
    title: 'Map of modules to source files/directories',
  },
  quiet: {
    type: 'boolean',
    title: 'Disable compilation indicator',
  },
  clean: {
    type: 'boolean',
    title: 'Remove temporary build directory after compilation finishes',
  },
  targets: {
    type: 'object',
    title: 'List of cross-compilation targets',
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
  return processConfigFile(text, cfgPath, availableOptions);
}

function processConfigFile(text, cfgPath, availableOptions) {
  const options = JSON.parse(text);
  for (const [ key, value ] of Object.entries(options)) {
    const option = availableOptions[key];
    if (!option) {
      throw new UnknownOption(key);
    }
    if (typeof(value) !== option.type) {
      throw new Error(`${key} is expected to be a ${option.type}, received: ${value}`);
    }
  }
  options.sourceFiles = getAbsoluteMapping(options.sourceFiles, dirname(cfgPath));
  return options;
}

function getAbsoluteMapping(sourceFiles, cfgDir) {
  const map = {};
  if (sourceFiles) {
    for (const [ module, source ] of Object.entries(sourceFiles)) {
      const modulePath = resolve(cfgDir, module);
      const sourcePath = resolve(cfgDir, source);
      map[modulePath] = sourcePath;
    }
  }
  return map;
}

function findSourceFile(modulePath, options) {
  const { sourceFiles } = options;
  return sourceFiles?.[modulePath];
}

const cls = {
  name: '',
  mixins: [],
  constructor: null,
};

function mixin(object) {
  if (!cls.constructor) {
    cls.mixins.push(object);
  }
  return object;
}

function defineEnvironment() {
  if (!cls.constructor) {
    cls.constructor = defineClass(cls.name, cls.mixins);
    cls.name = '';
    cls.mixins = [];
  }
  return cls.constructor;
}

function defineClass(name, mixins) {
  const props = {};
  const constructor = function() {
    for (const [ name, object ] of Object.entries(props)) {
      this[name] = structuredClone(object);
    }
  };
  const { prototype } = constructor;
  defineProperty(constructor, 'name', defineValue(name));
  for (const mixin of mixins) {
    for (let [ name, object ] of Object.entries(mixin)) {
      if (typeof(object) === 'function') {
        {
          props.mixinUsage = new Map();
          const f = function(...args) {
            this.mixinUsage.set(mixin, true);
            return object.call(this, ...args);
          };
          defineProperty(prototype, name, defineValue(f));
        }
      } else {
        let current = props[name];
        if (current !== undefined) {
          if (current?.constructor === Object) {
            object = Object.assign({ ...current }, object);
          } else if (current !== object) {
            throw new Error(`Duplicate property: ${name}`);
          }
        }
        props[name] = object;
      }
    }
  }
  return constructor;
}

// handle retrieval of accessors

var all$2 = mixin({
  accessorCache: new Map(),

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
    names.push(name, `${(type === MemberType.Bool && byteSize) ? byteSize * 8 : bitSize}`);
    if (unaligned) {
      names.push(`@${bitOffset}`);
    }
    const accessorName = access + names.join('');
    // see if it's a built-in method of DataView
    let accessor = DataView.prototype[accessorName];
    if (accessor) {
      return accessor;
    }
    // check cache
    accessor = this.accessorCache.get(accessorName);
    if (accessor) {
      return accessor;
    }
    while (names.length > 0) {
      const handlerName = `getAccessor${names.join('')}`;
      if (accessor = this[handlerName]?.(access, member)) {
        break;
      }
      names.pop();
    }
    /* c8 ignore start */
    if (!accessor) {
      throw new Error(`No accessor available: ${accessorName}`);
    }
    /* c8 ignore end */
    defineProperty(accessor, 'name', defineValue(accessorName));
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
    const buf = new DataView(new ArrayBuffer(8));
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
    const buf = new DataView(new ArrayBuffer(4));
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
    const buf = new DataView(new ArrayBuffer(8));
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
    const buf = new DataView(new ArrayBuffer(byteSize));
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

var abortSignal = mixin({
  createSignalArray(signal) {
    const array = new Int32Array(1);
    if (signal) {
      if (signal.aborted) {
        array[0] = 1;
      } else {
        signal.addEventListener('abort', () => {
          Atomics.store(array, 0, 1);
        }, { once: true });
      }
    }
    return array;
  },
});

var baseline = mixin({
  littleEndian: true,
  variables: [],

  getSpecialExports() {
    const check = (v) => {
      if (v === undefined) throw new Error('Not a Zig type');
      return v;
    };
    return {
      init: (...args) => this.initialize?.(...args),
      abandon: () => this.abandonModule?.(),
      released: () => this.released,
      connect: (console) => this.consoleObject = console,
      sizeOf: (T) => check(T?.[SIZE]),
      alignOf: (T) => check(T?.[ALIGN]),
      typeOf: (T) => structureNames[check(T?.[TYPE])]?.toLowerCase(),
    };
  },
  recreateStructures(structures, options) {
    Object.assign(this, options);
    const insertObjects = (dest, placeholders) => {
      for (const [ slot, placeholder ] of Object.entries(placeholders)) {
        dest[slot] = createObject(placeholder);
      }
      return dest;
    };
    const createObject = (placeholder) => {
      const { memory, structure, actual } = placeholder;
      if (memory) {
        if (actual) {
          return actual;
        } else {
          const { array, offset, length } = memory;
          const dv = this.obtainView(array.buffer, offset, length);
          const { reloc, const: isConst } = placeholder;
          const constructor = structure?.constructor;
          const object = placeholder.actual = constructor.call(ENVIRONMENT, dv);
          if (isConst) {
            this.makeReadOnly(object);
          }
          if (placeholder.slots) {
            insertObjects(object[SLOTS], placeholder.slots);
          }
          if (reloc !== undefined) {
            // need to replace dataview with one pointing to fixed memory later,
            // when the VM is up and running
            this.variables.push({ reloc, object });
          }
          return object;
        }
      } else {
        return structure;
      }
    };
    this.resetGlobalErrorSet?.();
    const objectPlaceholders = new Map();
    for (const structure of structures) {
      // recreate the actual template using the provided placeholder
      for (const scope of [ structure.instance, structure.static ]) {
        if (scope.template) {
          const { slots, memory, reloc } = scope.template;
          const object = scope.template = {};
          if (memory) {
            const { array, offset, length } = memory;
            object[MEMORY] = this.obtainView(array.buffer, offset, length);
            if (reloc) {
              this.variables.push({ reloc, object });
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
  },
});

var callMarshalingInbound = mixin({
  jsFunctionThunkMap: new Map(),
  jsFunctionCallerMap: new Map(),
  jsFunctionIdMap: null,
  jsFunctionNextId: 8888,

  getFunctionId(fn) {
    if (!this.jsFunctionIdMap) {
      this.jsFunctionIdMap = new WeakMap();
    }
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
      const controllerAddr = this.getViewAddress(jsThunkController[MEMORY]);
      const thunkAddr = this.createJsThunk(controllerAddr, id);
      if (!thunkAddr) {
        throw new Error('Unable to create function thunk');
      }
      dv = this.obtainFixedView(thunkAddr, 0);
      this.jsFunctionThunkMap.set(id, dv);
    }
    return dv;
  },
  freeFunctionThunk(thunk, jsThunkController) {
    const controllerAddr = this.getViewAddress(jsThunkController[MEMORY]);
    const thunkAddr = this.getViewAddress(thunk);
    const id = this.destroyJsThunk(controllerAddr, thunkAddr);
    if (id) {
      this.jsFunctionThunkMap.delete(id);
      this.jsFunctionCallerMap.delete(id);
    }
  },
  createInboundCaller(fn, ArgStruct) {
    const handler = (dv, futexHandle) => {
      let result = CallResult.OK;
      let awaiting = false;
      try {
        const argStruct = ArgStruct(dv);
        const hasPointers = VISIT in argStruct;
        if (hasPointers) {
          this.updatePointerTargets(null, argStruct);
        }
        const args = [];
        for (let i = 0; i < argStruct.length; i++) {
          // error unions will throw on access, in which case we pass the error as the argument
          try {
            args.push(argStruct[i]);
          } catch (err) {
            args.push(err);
          }
        }
        const onError = (err) => {
          if (ArgStruct[THROWING] && err instanceof Error) {
            // see if the error is part of the error set of the error union returned by function
            try {
              argStruct.retval = err;
              return;
            } catch (_) {
            }
          }
          console.error(err);
          result = CallResult.Failure;
        };
        const onReturn = (value) => {
          argStruct.retval = value;
          if (hasPointers) {
            this.updatePointerAddresses(null, argStruct);
          }
        };
        try {
          const retval = fn(...args);
          if (retval?.[Symbol.toStringTag] === 'Promise') {
            if (futexHandle) {
              retval.then(onReturn, onError).then(() => {
                this.finalizeAsyncCall(futexHandle, result);
              });
              awaiting = true;
              result = CallResult.OK;
            } else {
              result = CallResult.Deadlock;
            }
          } else {
            onReturn(retval);
          }
        } catch (err) {
          onError(err);
        }
      } catch(err) {
        console.error(err);
        result = CallResult.Failure;
      }
      if (futexHandle && !awaiting) {
        this.finalizeAsyncCall(futexHandle, result);
      }
      return result;
    };
    const id = this.getFunctionId(fn);
    this.jsFunctionCallerMap.set(id, handler);
    return function(...args) {
      return fn(...args);
    };
  },
  performJsAction(action, id, argAddress, argSize, futexHandle = 0) {
    if (action === Action.Call) {
      const dv = this.obtainFixedView(argAddress, argSize);
      const result = this.runFunction(id, dv, futexHandle);
      return result;
    } else if (action === Action.Release) {
      return this.releaseFunction(id);
    }
  },
  runFunction(id, dv, futexHandle) {
    const caller = this.jsFunctionCallerMap.get(id);
    if (!caller) {
      return CallResult.Failure;
    }
    return caller(dv, futexHandle);
  },
  releaseFunction(id) {
    const thunk = this.jsFunctionThunkMap.get(id);
    if (thunk) {
      this.releaseFixedView(thunk);
    }
    this.jsFunctionThunkMap.delete(id);
    this.jsFunctionCallerMap.delete(id);
  },
  ...({
    exports: {
      performJsAction: { argType: 'iiii', returnType: 'i' },
      queueJsAction: { argType: 'iiiii' },
    },
    imports: {
      createJsThunk: { argType: 'ii', returnType: 'i' },
      destroyJsThunk: { argType: 'ii', returnType: 'i' },
      finalizeAsyncCall: { argType: 'ii' },
    },
    queueJsAction(action, id, argAddress, argSize, futexHandle) {
      // in the main thread, this method is never called from WASM;
      // the implementation of queueJsAction() in worker.js, call this
      // through postMessage() when it is called the worker's WASM instance
      this.performJsAction(action, id, argAddress, argSize, futexHandle);
    },
  } ),
});

const CallResult = {
  OK: 0,
  Failure: 1,
  Deadlock: 2,
  Disabled: 3,
};

const Action = {
  Call: 2,
  Release: 3,
};

class InvalidIntConversion extends SyntaxError {
  constructor(arg) {
    super(`Cannot convert ${arg} to an Int`);
  }
}

class Unsupported extends TypeError {
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
  constructor(structure) {
    const { name } = structure;
    super(`Error given is not a part of error set ${name}`);
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
  constructor(expected, actual) {
    super();
    this.fnName = '';
    this.argIndex = expected;
    this.argCount = actual;
  }

  get message() {
    const s = (this.argIndex !== 1) ? 's' : '';
    return `${this.fnName}(): Expecting ${this.argIndex} argument${s}, received ${this.argCount}`;
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

class InvalidPointerTarget extends TypeError {
  constructor(structure, arg) {
    const { name } = structure;
    let target;
    if (arg != null) {
      const type = typeof(arg);
      const noun = (type === 'object' && arg.constructor !== Object) ? `${arg.constructor.name} object`: type;
      const a = article(noun);
      target = `${a} ${noun}`;
    } else {
      target = arg + '';
    }
    super(`${name} cannot point to ${target}`);
  }
}

class FixedMemoryTargetRequired extends TypeError {
  constructor(structure, arg) {
    super(`Pointers in fixed memory cannot point to garbage-collected object`);
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

class ZigError extends Error {
  constructor(message) {
    super(message ?? 'Error encountered in Zig code');
  }
}

class Exit extends ZigError {
  constructor(code) {
    super('Program exited');
    this.code = code;
  }
}

function adjustArgumentError(argIndex, argCount) {
  const { message } = this;
  defineProperties(this, {
    fnName: defineValue(''),
    argIndex: defineValue(argIndex),
    argCount: defineValue(argCount),
    message: {
      get() {
        let msg = message;
        const { fnName, argIndex, argCount } = this;
        if (fnName) {
          const argName = `args[${argIndex}]`;
          const prefix = (argIndex !== 0) ? '..., ' : '';
          const suffix = (argIndex !== argCount - 1) ? ', ...' : '';
          const argLabel = prefix + argName + suffix;
          msg = `${fnName}(${argLabel}): ${msg}`;
        }
        return msg;
      },
    }
  });
  return this;
}

function adjustRangeError(member, index, err) {
  if (err instanceof RangeError && !(err instanceof OutOfBound)) {
    err = new OutOfBound(member, index);
  }
  return err;
}

function throwReadOnly() {
  throw new ReadOnly();
}

function warnImplicitArrayCreation(structure, arg) {
  const created = addArticle(structure.constructor[TYPED_ARRAY].name);
  const source = addArticle(arg.constructor.name);
  console.warn(`Implicitly creating ${created} from ${source}`);
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
    /* c8 ignore next 2 */
  } catch (err) {
  }
  return s.charAt(0).toLocaleUpperCase() + s.substring(1);
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

var callMarshalingOutbound = mixin({
  createOutboundCaller(thunk, ArgStruct) {
    const thisEnv = this;
    const self = function (...args) {
      try {
        const argStruct = new ArgStruct(args);
        thisEnv.invokeThunk(thunk, self, argStruct);
        return argStruct[PROMISE] ?? argStruct.retval;
      } catch (err) {
        if ('fnName' in err) {
          err.fnName = self.name;
        }
        throw err;
      }
    };
    return self;
  },
  copyArguments(dest, src, members, options) {
    let srcIndex = 0;
    let allocatorCount = 0;
    for (const [ destIndex, { type, structure } ] of members.entries()) {
      let arg;
      if (structure.type === StructureType.Struct) {
        if (structure.flags & StructFlag.IsAllocator) {
          // use programmer-supplied allocator if found in options object, handling rare scenarios
          // where a function uses multiple allocators
          allocatorCount++;
          const allocator = (allocatorCount === 1)
          ? options?.['allocator'] ?? options?.['allocator1']
          : options?.[`allocator${allocatorCount}`];
          // otherwise use default allocator which allocates relocatable memory from JS engine
          arg = allocator ?? this.createDefaultAllocator(structure, dest[CONTEXT]);
        } else if (structure.flags & StructFlag.IsPromise) {
          // invoke programmer-supplied callback if there's one, otherwise a function that
          // resolves/rejects a promise attached to the argument struct
          arg = { callback: this.createCallback(dest, options?.['callback']) };
          debugger;
        } else if (structure.flags & StructFlag.IsAbortSignal) {
          // create an Int32Array with one element, hooking it up to the programmer-supplied
          // AbortSignal object if found
          arg = { ptr: this.createSignalArray(options?.['signal']) };
        }
      }
      if (arg === undefined) {
        // just a regular argument
        arg = src[srcIndex++];
        // only void has the value of undefined
        if (arg === undefined && type !== MemberType.Void) {
          throw new UndefinedArgument();
        }
      }
      try {
        dest[destIndex] = arg;
      } catch (err) {
        throw adjustArgumentError.call(err, destIndex, src.length);
      }
    }
  },
  invokeThunk(thunk, fn, args) {
    {
      if (!this.runThunk) {
        return this.initPromise.then(() => {
          return this.invokeThunk(thunk, fn, args);
        });
      }
    }
    try {
      const context = args[CONTEXT];
      const attrs = args[ATTRIBUTES];
      const thunkAddress = this.getViewAddress(thunk[MEMORY]);
      const fnAddress = this.getViewAddress(fn[MEMORY]);
      const hasPointers = VISIT in args;
      if (hasPointers) {
        this.updatePointerAddresses(context, args);
      }
      // return address of shadow for argumnet struct
      const argAddress = ("wasm" === 'wasm')
      ? this.getShadowAddress(context, args[MEMORY])
      : this.getViewAddress(args[MEMORY]);
      // get address of attributes if function variadic
      const attrAddress = ("wasm" === 'wasm')
      ? (attrs) ? this.getShadowAddress(context, attrs) : 0
      : (attrs) ? this.getViewAddress(attrs) : 0;
      this.updateShadows(context);
      const success = (attrs)
      ? this.runVariadicThunk(thunkAddress, fnAddress, argAddress, attrAddress, attrs.length)
      : this.runThunk(thunkAddress, fnAddress, argAddress);
      if (!success) {
        throw new ZigError();
      }
      const finalize = () => {
        // create objects that pointers point to
        this.updateShadowTargets(context);
        if (hasPointers) {
          this.updatePointerTargets(context, args);
        }
        this.releaseShadows(context);
        this.flushConsole?.();
      };
      if (FINALIZE in args) {
        // async function--finalization happens when callback is invoked
        args[FINALIZE] = finalize;
      } else {
        finalize();
      }
    } catch (err) {
      {
        // do nothing when exit code is 0
        if (err instanceof Exit && err.code === 0) {
          return;
        }
      }
      throw err;
    }
  },
  ...({
    imports: {
      runThunk: { argType: 'iii', returnType: 'b' },
      runVariadicThunk: { argType: 'iiiii', returnType: 'b' },
    },
  } ),
});

var dataCopying = mixin({
  defineCopier(size, multiple) {
    const copy = getCopyFunction(size, multiple);
    return {
      value(target) {
        {
          this[RESTORE]?.();
          target[RESTORE]?.();
        }
        const src = target[MEMORY];
        const dest = this[MEMORY];
        copy(dest, src);
      },
    };
  },
  defineResetter(offset, size) {
    const reset = getResetFunction(size);
    return {
      value() {
        {
          this[RESTORE]?.();
        }
        const dest = this[MEMORY];
        reset(dest, offset, size);
      }
    };
  },
  getCopyFunction,
});

function getCopyFunction(size, multiple = false) {
  if (size !== undefined) {
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
  } else {
    return copyAny;
  }
}

function copyAny(dest, src) {
  const copy = getCopyFunction(dest.byteLength);
  copy(dest, src);
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

function reset1x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i++) {
    dest.setInt8(i, 0);
  }
}

function reset2x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i += 2) {
    dest.setInt16(i, 0, true);
  }
}

function reset4x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i += 4) {
    dest.setInt32(i, 0, true);
  }
}

function reset8x(dest, offset, size) {
  for (let i = offset, limit = offset + size; i < limit; i += 8) {
    dest.setInt32(i, 0, true);
    dest.setInt32(i + 4, 0, true);
  }
}

function reset1(dest, offset) {
  dest.setInt8(offset, 0);
}

function reset2(dest, offset) {
  dest.setInt16(offset, 0, true);
}

function reset4(dest, offset) {
  dest.setInt32(offset, 0, true);
}

function reset8(dest, offset) {
  dest.setInt32(offset + 0, 0, true);
  dest.setInt32(offset + 4, 0, true);
}

function reset16(dest, offset) {
  dest.setInt32(offset + 0, 0, true);
  dest.setInt32(offset + 4, 0, true);
  dest.setInt32(offset + 8, 0, true);
  dest.setInt32(offset + 12, 0, true);
}

function reset32(dest, offset) {
  dest.setInt32(offset + 0, 0, true);
  dest.setInt32(offset + 4, 0, true);
  dest.setInt32(offset + 8, 0, true);
  dest.setInt32(offset + 12, 0, true);
  dest.setInt32(offset + 16, 0, true);
  dest.setInt32(offset + 20, 0, true);
  dest.setInt32(offset + 24, 0, true);
  dest.setInt32(offset + 28, 0, true);
}

var defaultAllocator = mixin({
  nextContextId: usizeMax,
  contextMap: new Map(),
  defaultAllocatorVTable: null,

  createDefaultAllocator(structure, context) {
    const { constructor: Allocator } = structure;
    let vtable = this.defaultAllocatorVTable;
    if (!vtable) {
      // create vtable in fixed memory
      const { VTable, noResize } = Allocator;
      const dv = this.allocateFixedMemory(VTable[SIZE], VTable[ALIGN]);
      vtable = this.defaultAllocatorVTable = VTable(dv);
      vtable.alloc = (ptr, len, ptrAlign) => {
        const contextId = this.getViewAddress(ptr['*'][MEMORY]);
        const context = this.contextMap.get(contextId);
        if (context) {
          return this.allocateHostMemory(context, len, 1 << ptrAlign);
        } else {
          return null;
        }
      };
      vtable.resize = noResize;
      vtable.free = (ptr, buf, ptrAlign) => {
        const contextId = this.getViewAddress(ptr['*'][MEMORY]);
        const context = this.contextMap.get(contextId);
        if (context) {
          const address = this.getViewAddress(buf['*'][MEMORY]);
          const len = buf.length;
          this.freeHostMemory(context, address, len, 1 << ptrAlign);
        }
      };
    }
    const contextId = this.nextContextId--;
    // storing context id in a fake pointer
    const ptr = this.obtainFixedView(contextId, 0);
    this.contextMap.set(contextId, context);
    return new Allocator({ ptr, vtable });
  },
  allocateHostMemory(context, len, align) {
    const dv = this.allocateRelocMemory(len, align);
    // for WebAssembly, we need to allocate fixed memory that backs the relocatable memory
    // for Node, we create another DataView on the same buffer and pretend that it's fixed
    // memory
    const shadowDV = this.allocateShadowMemory(len, align)
    ;
    const copier = this.defineCopier(len).value
    ;
    const constructor = { [ALIGN]: align };
    const object = { constructor, [MEMORY]: dv, [COPY]: copier };
    const shadow = { constructor, [MEMORY]: shadowDV, [COPY]: copier };
    this.addShadow(context, shadow, object, align);
    return shadowDV;
  },
  freeHostMemory(context, address, len, align) {
    const shadowDV = this.unregisterMemory(context, address);
    if (shadowDV) {
      this.removeShadow(context, shadowDV);
      this.freeShadowMemory(shadowDV);
    }
  },
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
  emptyBuffer: new ArrayBuffer(0),

  getShadowAddress(context, target, cluster) {
    if (cluster) {
      const dv = target[MEMORY];
      if (cluster.address === undefined) {
        const shadow = this.createClusterShadow(context, cluster);
        cluster.address = this.getViewAddress(shadow[MEMORY]);
      }
      return adjustAddress(cluster.address, dv.byteOffset - cluster.start);
    } else {
      const shadow = this.createShadow(context, target);
      return this.getViewAddress(shadow[MEMORY]);
    }
  },
  createShadow(context, object) {
    const dv = object[MEMORY];
    // use the alignment of the structure; in the case of an opaque pointer's target,
    // try to the alignment specified when the memory was allocated
    const align = object.constructor[ALIGN] ?? dv[ALIGN];
    const shadow = Object.create(object.constructor.prototype);
    shadow[MEMORY] = this.allocateShadowMemory(dv.byteLength, align);
    return this.addShadow(context, shadow, object, align);
  },
  addShadow(context, shadow, object, align) {
    const shadowMap = context.shadowMap ??= new Map();
    {
      defineProperty(shadow, RESTORE, this.defineRestorer(false));
    }
    shadowMap.set(shadow, object);
    this.registerMemory(context, shadow[MEMORY], object[MEMORY], align);
    return shadow;
  },
  removeShadow(context, dv) {
    const { shadowMap } = context;
    if (shadowMap) {
      for (const [ shadow ] of shadowMap) {
        if (shadow[MEMORY] === dv) {
          shadowMap.delete(shadow);
          break;
        }
      }
    }
  },
  createClusterShadow(context, cluster) {
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
    const unalignedShadowDV = this.allocateShadowMemory(len + maxAlign, 1);
    const unalignedAddress = this.getViewAddress(unalignedShadowDV);
    const maxAlignAddress = alignForward(adjustAddress(unalignedAddress, maxAlignOffset - start), maxAlign);
    const shadowAddress = adjustAddress(maxAlignAddress, start - maxAlignOffset);
    const shadowOffset = unalignedShadowDV.byteOffset + Number(shadowAddress - unalignedAddress);
    const shadowDV = new DataView(unalignedShadowDV.buffer, shadowOffset, len);
    // make sure that other pointers are correctly aligned also
    for (const target of targets) {
      const dv = target[MEMORY];
      const offset = dv.byteOffset;
      if (offset !== maxAlignOffset) {
        const align = target.constructor[ALIGN] ?? dv[ALIGN];
        if (isMisaligned(adjustAddress(shadowAddress, offset - start), align)) {
          throw new AlignmentConflict(align, maxAlign);
        }
      }
    }
    // placeholder object type
    const prototype = defineProperty({}, COPY, this.defineCopier(len, false));
    const source = Object.create(prototype);
    const shadow = Object.create(prototype);
    source[MEMORY] = new DataView(targets[0][MEMORY].buffer, Number(start), len);
    shadow[MEMORY] = shadowDV;
    {
      // attach fixed memory info to aligned data view so it gets freed correctly
      shadowDV[FIXED] = { address: shadowAddress, len, align: 1, unalignedAddress, type: MemoryType.Scratch };
    }
    return this.addShadow(context, shadow, source, 1);
  },
  updateShadows(context) {
    const { shadowMap } = context;
    if (shadowMap) {
      for (const [ shadow, object ] of shadowMap) {
        shadow[COPY](object);
      }
    }
  },
  updateShadowTargets(context) {
    const { shadowMap } = context;
    if (shadowMap) {
      for (const [ shadow, object ] of shadowMap) {
        object[COPY](shadow);
      }
    }
  },
  releaseShadows(context) {
    const { shadowMap } = context;
    if (!shadowMap) {
      return;
    }
    for (const [ shadow ] of shadowMap) {
      this.freeShadowMemory(shadow[MEMORY]);
    }
  },
  registerMemory(context, dv, targetDV = null, targetAlign = undefined) {
    const { memoryList } = context;
    const address = this.getViewAddress(dv);
    const index = findMemoryIndex(memoryList, address);
    memoryList.splice(index, 0, { address, dv, len: dv.byteLength, targetDV, targetAlign });
    return address;
  },
  unregisterMemory(context, address) {
    const { memoryList } = context;
    const index = findMemoryIndex(memoryList, address);
    const entry = memoryList[index - 1];
    if (entry?.address === address) {
      memoryList.splice(index - 1, 1);
      return entry.dv;
    }
  },
  findMemory(context, address, count, size) {
    if (isInvalidAddress(address)) {
      if (!count) {
        address = 0;
      } else {
        return null;
      }
    } else if (!address && count) {
      return null;
    }
    let len = count * (size ?? 0);
    // check for null address (=== can't be used since address can be both number and bigint)
    if (context) {
      const { memoryList } = context;
      const index = findMemoryIndex(memoryList, address);
      const entry = memoryList[index - 1];
      if (entry?.address === address && entry.len === len) {
        return entry.targetDV ?? entry.dv;
      } else if (entry?.address <= address && address < adjustAddress(entry.address, entry.len)) {
        const offset = Number(address - entry.address);
        const targetDV = entry.targetDV ?? entry.dv;
        const isOpaque = size === undefined;
        if (isOpaque) {
          len = targetDV.byteLength - offset;
        }
        const dv = this.obtainView(targetDV.buffer, targetDV.byteOffset + offset, len);
        if (isOpaque) {
          // opaque structure--need to save the alignment
          dv[ALIGN] = entry.targetAlign;
        }
        return dv;
      }
    }
    // not found in any of the buffers we've seen--assume it's fixed memory
    return this.obtainFixedView(address, len);
  },
  allocateFixedMemory(len, align, type = MemoryType.Normal) {
    const address = (len) ? this.allocateExternMemory(type, len, align) : 0;
    const dv = this.obtainFixedView(address, len);
    dv[FIXED].align = align;
    dv[FIXED].type = type;
    return dv;
  },
  freeFixedMemory(dv) {
    const { address, unalignedAddress, len, align, type } = dv[FIXED];
    if (len) {
      this.freeExternMemory(type, unalignedAddress ?? address, len, align);
    }
  },
  obtainFixedView(address, len) {
    let dv;
    if (address && len) {
      dv = this.obtainExternView(address, len);
    } else {
      // pointer to nothing
      let entry = this.viewMap.get(this.emptyBuffer);
      if (!entry) {
        this.viewMap.set(this.emptyBuffer, entry = new Map());
      }
      const key = `${address}:0`;
      dv = entry.get(key);
      if (!dv) {
        dv = new DataView(this.emptyBuffer);
        dv[FIXED] = { address, len: 0 };
        entry.set(key, dv);
      }
    }
    return dv;
  },
  releaseFixedView(dv) {
    const fixed = dv[FIXED];
    const address = fixed?.address;
    if (address) {
      // only allocated memory would have type attached
      if (fixed.type !== undefined) {
        this.freeFixedMemory(dv);
      }
      // set address to zero so data view won't get reused
      fixed.address = usizeMin;
      if (fixed.len === 0) {
        let entry = this.viewMap.get(this.emptyBuffer);
        if (entry) {
          const key = `${address}:0`;
          entry.delete(key);
        }
      }
    }
  },
  getViewAddress(dv) {
    const fixed = dv[FIXED];
    if (fixed) {
      if (fixed.freed) {
        throw new NullPointer();
      }
      return fixed.address;
    } else {
      const address = this.getBufferAddress(dv.buffer);
      return adjustAddress(address, dv.byteOffset);
    }
  },
  ...({
    imports: {
      allocateExternMemory: { argType: 'iii', returnType: 'i' },
      freeExternMemory: { argType: 'iiii' },
    },
    exports: {
      getViewAddress: { argType: 'v', returnType: 'i' },
    },

    allocateShadowMemory(len, align) {
      return this.allocateFixedMemory(len, align, MemoryType.Scratch);
    },
    freeShadowMemory(dv) {
      return this.freeFixedMemory(dv);
    },
    obtainExternView(address, len) {
      const { buffer } = this.memory;
      return this.obtainView(buffer, address, len);
    },
    getTargetAddress(context, target, cluster) {
      const dv = target[MEMORY];
      if (dv[FIXED]) {
        return this.getViewAddress(dv);
      } else if (dv.byteLength === 0) {
        // it's a null pointer/empty slice
        return 0;
      }
      // relocatable buffers always need shadowing
    },
    getBufferAddress(buffer) {
      return 0;
    },
    defineRestorer(updateCache = true) {
      const thisEnv = this;
      return {
        value() {
          const dv = this[MEMORY];
          const fixed = dv?.[FIXED];
          if (fixed && fixed.len > 0 && dv.buffer.byteLength === 0) {
            const newDV = thisEnv.obtainFixedView(fixed.address, fixed.len);
            if (fixed.align) {
              newDV[FIXED].align = fixed.align;
            }
            this[MEMORY] = newDV;
            if (updateCache) {
              this.constructor[CACHE]?.save?.(newDV, this);
            }
            return true;
          } else {
            return false;
          }
        },
      }
    },
    copyExternBytes(dst, address, len) {
      const { memory } = this;
      const src = new DataView(memory.buffer, address, len);
      const copy = this.getCopyFunction(len);
      copy(dst, src);
    },
  } ),
});

function findMemoryIndex(array, address) {
  return findSortedIndex(array, address, m => m.address);
}

const MemoryType = {
  Normal: 0,
  Scratch: 1,
};

var moduleLoading = mixin({
  released: false,
  abandoned: false,

  releaseFunctions() {
    const throwError = () => { throw new Error(`Module was abandoned`) };
    for (const name of Object.keys(this.imports)) {
      if (this[name]) {
        this[name] = throwError;
      }
    }
  },
  isReleased() {
    return this.released;
  },
  abandonModule() {
    if (!this.abandoned) {
      this.setMultithread?.(false);
      this.releaseFunctions();
      this.unlinkVariables?.();
      this.abandoned = true;
    }
  },
  ...({
    imports: {
      initialize: { argType: '' },
      getModuleAttributes: { argType: '', returnType: 'i' },
    },
    exports: {
      displayPanic: { argType: 'ii' },
    },
    nextValueIndex: 1,
    valueMap: new Map(),
    valueIndices: new Map(),
    options: null,
    executable: null,
    memory: null,
    table: null,
    exportedFunctions: null,

    async initialize(wasi) {
      this.setCustomWASI?.(wasi);
      await this.initPromise;
    },
    clearExchangeTable() {
      if (this.nextValueIndex !== 1) {
        this.nextValueIndex = 1;
        this.valueMap = new Map();
        this.valueIndices = new Map();
      }
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
        imports[`_${name}`] = this.exportFunction(fn, argType, returnType, name);
      }
      return imports;
    },
    importFunctions(exports) {
      for (const [ name, { argType, returnType } ] of Object.entries(this.imports)) {
        const fn = exports[name];
        this[name] = this.importFunction(fn, argType, returnType);
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
      const empty = function() {};
      for (const { module, name, kind } of w.Module.imports(executable)) {
        if (kind === 'function') {
          if (module === 'env') {
            env[name] = functions[name] ?? empty;
          } else if (module === 'wasi_snapshot_preview1') {
            wasiPreview[name] = this.getWASIHandler(name);
          } else if (module === 'wasi' && name === 'thread-spawn') {
            wasi[name] = this.getThreadHandler?.() ?? empty;
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
      return new w.Instance(executable, exports);
    },
    loadModule(source, options) {
      return this.initPromise = (async () => {
        const instance = await this.instantiateWebAssembly(source, options);
        const { exports } = instance;
        this.importFunctions(exports);
        this.trackInstance(instance);
        this.customWASI?.initialize?.(instance);
        this.initialize();
        // this.runtimeSafety = ;
      })();
    },
    displayPanic(address, len) {
      const array = new Uint8Array(this.memory.buffer, address, len);
      const msg = decodeText(array);
      console.error(`Zig panic: ${msg}`);
    },
    trackInstance(instance) {
      // use WeakRef to detect whether web-assembly instance has been gc'ed
      const ref = new WeakRef(instance);
      Object.defineProperty(this, 'released', { get: () => !ref.deref(), enumerable: true });
    },
  } )
});

var objectLinkage = mixin({
  linkVariables(writeBack) {
    {
      // linkage occurs when WASM compilation is complete and functions have been imported
      if (!this.memory) {
        this.initPromise = this.initPromise.then(() => this.linkVariables(writeBack));
        return;
      }
    }
    const pointers = [];
    for (const { object, reloc } of this.variables) {
      this.linkObject(object, reloc, writeBack);
      if (TARGET in object && object[SLOTS][0]) {
        pointers.push(object);
      }
    }
    // save locations of pointer targets
    for (const pointer of pointers) {
      const target = pointer[TARGET];
      const address = this.getViewAddress(target[MEMORY]);
      pointer[ADDRESS] = address;
      if (LENGTH in pointer) {
        pointer[LENGTH] = target.length;
      }
    }
  },
  linkObject(object, reloc, writeBack) {
    if (object[MEMORY][FIXED]) {
      return;
    }
    const dv = object[MEMORY];
    const address = this.recreateAddress(reloc);
    const fixedDV = this.obtainFixedView(address, dv.byteLength);
    if (writeBack) {
      const dest = Object.create(object.constructor.prototype);
      dest[MEMORY] = fixedDV;
      dest[COPY](object);
    }
    object[MEMORY] = fixedDV;
    const linkChildren = (object) => {
      if (object[SLOTS]) {
        for (const child of Object.values(object[SLOTS])) {
          if (child) {
            const childDV = child[MEMORY];
            if (childDV.buffer === dv.buffer) {
              const offset = childDV.byteOffset - dv.byteOffset;
              child[MEMORY] = this.obtainView(fixedDV.buffer, offset, childDV.byteLength);
              linkChildren(child);
            }
          }
        }
      }
    };
    linkChildren(object);
  },
  unlinkVariables() {
    for (const { object } of this.variables) {
      this.unlinkObject(object);
    }
  },
  unlinkObject(object) {
    if (!object[MEMORY][FIXED]) {
      return;
    }
    {
      object[RESTORE]?.();
    }
    const dv = object[MEMORY];
    const relocDV = this.allocateMemory(dv.byteLength);
    if (object[COPY]) {
      const dest = Object.create(object.constructor.prototype);
      dest[MEMORY] = relocDV;
      dest[COPY](object);
    }
    object[MEMORY] = relocDV;
  },
  ...({
    recreateAddress(reloc) {
      return reloc;
    },
  } ),
  ...({
    useObjectLinkage() {
      // empty function used for mixin tracking
    },
  } ),
});

var pointerSynchronization = mixin({
  updatePointerAddresses(context, args) {
    // first, collect all the pointers
    const pointerMap = new Map();
    const bufferMap = new Map();
    const potentialClusters = [];
    const callback = function({ isActive }) {
      if (isActive(this)) {
        // bypass proxy
        const pointer = this[POINTER];
        if (!pointerMap.get(pointer)) {
          const target = pointer[SLOTS][0];
          if (target) {
            pointerMap.set(pointer, target);
            // only relocatable targets need updating
            const dv = target[MEMORY];
            if (!dv[FIXED]) {
              // see if the buffer is shared with other objects
              const other = bufferMap.get(dv.buffer);
              if (other) {
                const array = Array.isArray(other) ? other : [ other ];
                const index = findSortedIndex(array, dv.byteOffset, t => t[MEMORY].byteOffset);
                array.splice(index, 0, target);
                if (!Array.isArray(other)) {
                  bufferMap.set(dv.buffer, array);
                  potentialClusters.push(array);
                }
              } else {
                bufferMap.set(dv.buffer, target);
              }
              // scan pointers in target
              target[VISIT]?.(callback);
            }
          }
        }
      }
    };
    args[VISIT](callback);
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
      if (!pointer[MEMORY][FIXED]) {
        const cluster = clusterMap.get(target);
        const address = this.getTargetAddress(context, target, cluster)
                     ?? this.getShadowAddress(context, target, cluster);
        // update the pointer
        pointer[ADDRESS] = address;
        if (LENGTH in pointer) {
          pointer[LENGTH] = target.length;
        }
      }
    }
  },
  updatePointerTargets(context, args) {
    const pointerMap = new Map();
    const callback = function({ isActive, isMutable }) {
      // bypass proxy
      const pointer = this[POINTER] ?? this;
      if (!pointerMap.get(pointer)) {
        pointerMap.set(pointer, true);
        const writable = !pointer.constructor.const;
        const currentTarget = pointer[SLOTS][0];
        const newTarget = (!currentTarget || isMutable(this))
        ? pointer[UPDATE](context, true, isActive(this))
        : currentTarget;
        // update targets of pointers in original target (which could have been altered)
        currentTarget?.[VISIT]?.(callback, { vivificate: true, isMutable: () => writable });
        if (newTarget !== currentTarget) {
          // acquire targets of pointers in new target
          newTarget?.[VISIT]?.(callback, { vivificate: true, isMutable: () => writable });
        }
      }
    };
    args[VISIT](callback, { vivificate: true });
  },
  findTargetClusters(potentialClusters) {
    const clusters = [];
    for (const targets of potentialClusters) {
      let prevTarget = null, prevStart = 0, prevEnd = 0;
      let currentCluster = null;
      for (const target of targets) {
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
              };
              clusters.push(currentCluster);
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

var promiseCallback = mixin({
  createCallback(args, callback) {
    if (!callback) {
      let resolve, reject;
      args[PROMISE] = new Promise((...args) => {
        resolve = args[0];
        reject = args[1];
      });
      callback = (result) => {
        if (result?.[MEMORY]?.[FIXED]) {
          // the memory in the result object is stack memory, which will go bad after the function
          // returns; we need to copy the content into JavaScript memory
          result = new result.constructor(result);
        }
        const f = (result instanceof Error) ? reject : resolve;
        f(result);
      };
    }
    return (result) => {
      if (!(result instanceof Error)) {
        args[FINALIZE]();
      }
      return callback(result);
    };
  },
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

var streamRedirection = mixin({
  consoleObject: null,
  consolePending: [],
  consoleTimeout: 0,

  writeToConsole(dv) {
    try {
      // make copy of array, in case incoming buffer is pointing to stack memory
      const array = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength).slice();
      // send text up to the last newline character
      const index = array.lastIndexOf(0x0a);
      if (index === -1) {
        this.consolePending.push(array);
      } else {
        const beginning = array.subarray(0, index);
        const remaining = array.subarray(index + 1);
        this.writeToConsoleNow([ ...this.consolePending, beginning ]);
        this.consolePending.splice(0);
        if (remaining.length > 0) {
          this.consolePending.push(remaining);
        }
      }
      clearTimeout(this.consoleTimeout);
      this.consoleTimeout = 0;
      if (this.consolePending.length > 0) {
        this.consoleTimeout = setTimeout(() => {
          this.writeToConsoleNow(this.consolePending);
          this.consolePending.splice(0);
        }, 250);
      }
      /* c8 ignore next 3 */
    } catch (err) {
      console.error(err);
    }
  },
  writeToConsoleNow(array) {
    const c = this.consoleObject ?? globalThis.console;
    c.log?.call?.(c, decodeText(array));
  },
  flushConsole() {
    if (this.consolePending.length > 0) {
      this.writeToConsoleNow(this.consolePending);
      this.consolePending.splice(0);
      clearTimeout(this.consoleTimeout);
    }
  },
  ...({
    imports: {
      flushStdout: { argType: '', returnType: '' },
    },
  } ),
});

var structureAcquisition = mixin({
  comptime: false,
  slots: {},
  structures: [],

  readSlot(target, slot) {
    const slots = target ? target[SLOTS] : this.slots;
    return slots?.[slot];
  },
  writeSlot(target, slot, value) {
    const slots = target ? target[SLOTS] : this.slots;
    if (slots) {
      slots[slot] = value;
    }
  },
  createTemplate(dv) {
    return {
      [MEMORY]: dv,
      [SLOTS]: {}
    };
  },
  beginStructure(def) {
    const {
      type,
      name,
      length,
      byteSize,
      align,
      flags,
    } = def;
    return {
      constructor: null,
      type,
      flags,
      name,
      length,
      byteSize,
      align,
      instance: {
        members: [],
        template: null,
      },
      static: {
        members: [],
        template: null,
      },
    };
  },
  attachMember(structure, member, isStatic = false) {
    const target = (isStatic) ? structure.static : structure.instance;
    target.members.push(member);
  },
  attachTemplate(structure, template, isStatic = false) {
    const target = (isStatic) ? structure.static : structure.instance;
    target.template = template;
  },
  endStructure(structure) {
    this.structures.push(structure);
    this.finalizeStructure(structure);
  },
  captureView(address, len, copy) {
    if (copy) {
      // copy content into reloctable memory
      const dv = this.allocateRelocMemory(len, 0);
      if (len > 0) {
        this.copyExternBytes(dv, address, len);
      }
      return dv;
    } else {
      // link into fixed memory
      return this.obtainFixedView(address, len);
    }
  },
  castView(address, len, copy, structure) {
    const { constructor, flags } = structure;
    const dv = this.captureView(address, len, copy);
    const object = constructor.call(ENVIRONMENT, dv);
    if (flags & StructureFlag.HasPointer) {
      // acquire targets of pointers
      this.updatePointerTargets(null, object);
    }
    if (copy && len > 0) {
      this.makeReadOnly?.(object);
    }
    return object;
  },
  acquireDefaultPointers() {
    for (const structure of this.structures) {
      const { constructor, flags, instance: { template } } = structure;
      if (flags & StructureFlag.HasPointer && template && template[MEMORY]) {
        // create a placeholder for retrieving default pointers
        const placeholder = Object.create(constructor.prototype);
        placeholder[MEMORY] = template[MEMORY];
        placeholder[SLOTS] = template[SLOTS];
        this.updatePointerTargets(null, placeholder);
      }
    }
  },
  acquireStructures(options) {
    this.resetGlobalErrorSet?.();
    const thunkAddress = this.getFactoryThunk();
    const thunk = { [MEMORY]: this.obtainFixedView(thunkAddress, 0) };
    const { littleEndian } = this;
    const FactoryArg = function(options) {
      const {
        omitFunctions = false,
        omitVariables = isElectron(),
      } = options;
      const dv = new DataView(new ArrayBuffer(4));
      let flags = 0;
      if (omitFunctions) {
        flags |= ExportFlag.OmitMethods;
      }
      if (omitVariables) {
        flags |= ExportFlag.OmitVariables;
      }
      dv.setUint32(0, flags, littleEndian);
      this[MEMORY] = dv;
      this[CONTEXT] = { memoryList: [], shadowMap: null };
    };
    defineProperty(FactoryArg.prototype, COPY, this.defineCopier(4));
    const args = new FactoryArg(options);
    this.comptime = true;
    this.invokeThunk(thunk, thunk, args);
    this.comptime = false;
  },
  getRootModule() {
    const root = this.structures[this.structures.length - 1];
    return root.constructor;
  },
  hasMethods() {
    return !!this.structures.find(s => s.type === StructureType.Function);
  },
  exportStructures() {
    this.acquireDefaultPointers();
    this.prepareObjectsForExport();
    const { structures, runtimeSafety, littleEndian } = this;
    return {
      structures,
      options: { runtimeSafety, littleEndian },
      keys: { MEMORY, SLOTS, CONST_TARGET },
    };
  },
  prepareObjectsForExport() {
    const objects = findObjects(this.structures, SLOTS);
    const list = [];
    for (const object of objects) {
      if (object[MEMORY]?.[FIXED]) {
        // replace fixed memory
        const dv = object[MEMORY];
        const address = this.getViewAddress(dv);
        const offset = this.getMemoryOffset(address);
        const len = dv.byteLength;
        const relocDV = this.captureView(address, len, true);
        relocDV.reloc = offset;
        object[MEMORY] = relocDV;
        list.push({ offset, len, owner: object, replaced: false });
      }
    }
    // larger memory blocks come first
    list.sort((a, b) => b.len - a.len);
    for (const a of list) {
      if (!a.replaced) {
        for (const b of list) {
          if (a !== b && !b.replaced) {
            if (a.offset <= b.offset && b.offset < a.offset + a.len) {
              // B is inside A--replace it with a view of A's buffer
              const dv = a.owner[MEMORY];
              const pos = b.offset - a.offset + dv.byteOffset;
              const newDV = this.obtainView(dv.buffer, pos, b.len);
              newDV.reloc = b.offset;
              b.owner[MEMORY] = newDV;
              b.replaced = true;
            }
          }
        }
      }
    }
    {
      if (list.length > 0) {
        // mixin "features/object-linkage" is used when there are objects linked to fixed memory
        this.useObjectLinkage();
      }
    }
  },
  useStructures() {
    const module = this.getRootModule();
    // add fixed memory object to list so they can be unlinked
    const objects = findObjects(this.structures, SLOTS);
    for (const object of objects) {
      if (object[MEMORY]?.[FIXED]) {
        this.variables.push({ object });
      }
    }
    // clear comptime-only variables
    this.slots = {};
    this.structures = [];
    module.__zigar = this.getSpecialExports();
    return module;
  },
  ...({
    exports: {
      captureString: { argType: 'ii', returnType: 'v' },
      captureView: { argType: 'iib', returnType: 'v' },
      castView: { argType: 'iibv', returnType: 'v' },
      readSlot: { argType: 'vi', returnType: 'v' },
      writeSlot: { argType: 'viv' },
      beginDefinition: { returnType: 'v' },
      insertInteger: { argType: 'vsi', alias: 'insertProperty' },
      insertBoolean: { argType: 'vsb', alias: 'insertProperty' },
      insertString: { argType: 'vss', alias: 'insertProperty' },
      insertObject: { argType: 'vsv', alias: 'insertProperty' },
      beginStructure: { argType: 'v', returnType: 'v' },
      attachMember: { argType: 'vvb' },
      createTemplate: { argType: 'v', returnType: 'v' },
      attachTemplate: { argType: 'vvb' },
      defineStructure: { argType: 'v', returnType: 'v' },
      endStructure: { argType: 'v' },
    },
    imports: {
      getFactoryThunk: { argType: '', returnType: 'i' },
    },

    beginDefinition() {
      return {};
    },
    insertProperty(def, name, value) {
      def[name] = value;
    },
    captureString(address, len) {
      const { buffer } = this.memory;
      const ta = new Uint8Array(buffer, address, len);
      return decodeText(ta);
    },
    getMemoryOffset(address) {
      // WASM address space starts at 0
      return address;
    },
  } ),
});

function isElectron() {
  return typeof(process) === 'object'
      && typeof(process?.versions) === 'object'
      && !!process.versions?.electron;
}

var thunkAllocation = mixin({
  ...({
    exports: {
      allocateJsThunk: { argType: 'ii', returnType: 'i' },
      freeJsThunk: { argType: 'ii', returnType: 'i' },
    },
    thunkSources: [],
    thunkMap: new Map(),
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
      const empty = function() {};
      for (const { module, name, kind } of w.Module.imports(this.executable)) {
        if (kind === 'function') {
          if (module === 'env') {
            env[name] = empty;
          } else if (module === 'wasi_snapshot_preview1') {
            wasiPreview[name] = empty;
          } else if (module === 'wasi') {
            wasi[name] = empty;
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
      const { createJsThunk, destroyJsThunk } = exports;
      const source = {
        thunkCount: 0,
        createJsThunk,
        destroyJsThunk,
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
      if (!source) {
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
      try {
        const thunkObject = this.table.get(thunkAddress);
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
        } catch (err) {
      }
      return fnId;
    },
  } ),
});

var viewManagement = mixin({
  viewMap: new Map(),

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
        if (arg instanceof constructor) {
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
  assignView(target, dv, structure, copy, fixed) {
    const { byteSize, type } = structure;
    const elementSize = byteSize ?? 1;
    if (!target[MEMORY]) {
      if (byteSize !== undefined) {
        checkDataViewSize(dv, structure);
      }
      const len = dv.byteLength / elementSize;
      const source = { [MEMORY]: dv };
      target.constructor[SENTINEL]?.validateData?.(source, len);
      if (fixed) {
        // need to copy when target object is in fixed memory
        copy = true;
      }
      target[SHAPE](copy ? null : dv, len, fixed);
      if (copy) {
        target[COPY](source);
      }
    } else {
      const byteLength = (type === StructureType.Slice) ? elementSize * target.length : elementSize;
      if (dv.byteLength !== byteLength) {
        throw new BufferSizeMismatch(structure, dv, target);
      }
      const source = { [MEMORY]: dv };
      target.constructor[SENTINEL]?.validateData?.(source, target.length);
      target[COPY](source);
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
    return { existing, entry };
  },
  obtainView(buffer, offset, len) {
    const { existing, entry } = this.findViewAt(buffer, offset, len);
    let dv;
    if (existing) {
      return existing;
    } else if (entry) {
      dv = new DataView(buffer, offset, len);
      entry.set(`${offset}:${len}`, dv);
    } else {
      // just one view of this buffer for now
      this.viewMap.set(buffer, dv = new DataView(buffer, offset, len));
    }
    {
      if (buffer === this.memory?.buffer) {
        dv[FIXED] = { address: offset, len };
      }
      return dv;
    }
  },
  registerView(dv) {
    if (!dv[FIXED]) {
      const { buffer, byteOffset, byteLength } = dv;
      const { existing, entry } = this.findViewAt(buffer, byteOffset, byteLength);
      if (existing) {
        // return existing view instead of this one
        return existing;
      } else if (entry) {
        entry[`${byteOffset}:${byteLength}`] = dv;
      } else {
        this.viewMap.set(buffer, dv);
      }
    }
    return dv;
  },
  allocateMemory(len, align = 0, fixed = false) {
    if (fixed) {
      return this.allocateFixedMemory(len, align);
    } else {
      return this.allocateRelocMemory(len, align);
    }
  },
  ...({
    allocateRelocMemory(len, align) {
      // alignment doesn't matter since memory always needs to be shadowed
      return this.obtainView(new ArrayBuffer(len), 0, len);
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

var wasiSupport = mixin({
  ...({
    customWASI: null,

    setCustomWASI(wasi) {
      if (wasi && this.executable) {
        throw new Error('Cannot set WASI interface after compilation has already begun');
      }
      this.customWASI = wasi;
    },
    getWASIHandler(name) {
      const custom = this.customWASI?.wasiImport?.[name];
      if (custom) {
        return custom;
      }
      const ENOSYS = 38;
      const ENOBADF = 8;
      switch (name) {
        case 'fd_write':
          return (fd, iovs_ptr, iovs_count, written_ptr) => {
            if (fd === 1 || fd === 2) {
              const dv = new DataView(this.memory.buffer);
              let written = 0;
              for (let i = 0, p = iovs_ptr; i < iovs_count; i++, p += 8) {
                const buf_ptr = dv.getUint32(p, true);
                const buf_len = dv.getUint32(p + 4, true);
                if (buf_len > 0) {
                  const buf = new DataView(this.memory.buffer, buf_ptr, buf_len);
                  this.writeToConsole(buf);
                  written += buf_len;
                }
              }
              dv.setUint32(written_ptr, written, true);
              return 0;
            } else {
              return ENOSYS;
            }
          };
        case 'fd_prestat_get':
          return () => ENOBADF;
        case 'proc_exit':
          return (code) => {
            throw new Exit(code);
          };
        case 'random_get':
          return (buf, buf_len) => {
            const dv = new DataView(this.memory.buffer, buf, buf_len);
            for (let i = 0; i < buf_len; i++) {
              dv.setUint8(i, Math.floor(256 * Math.random()));
            }
            return 0;
          };
        default:
          return () => ENOSYS;
      }
    },
  } ),
});

var writeProtection = mixin({
  makeReadOnly(object) {
    protect(object);
  }
});

const gp = Object.getOwnPropertyDescriptors;
const df = Object.defineProperty;

function protect(object) {
  const pointer = object[POINTER];
  if (pointer) {
    protectProperties(pointer, [ 'length' ]);
  } else {
    const array = object[ARRAY];
    if (array) {
      protectProperties(array);
      protectElements(array);
    } else {
      protectProperties(object);
    }
  }
}

function protectProperties(object, exclude = []) {
  const descriptors = gp(object.constructor.prototype);
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    if (descriptor.set && !exclude.includes(name)) {
      descriptor.set = throwReadOnly;
      df(object, name, descriptor);
    }
  }
  df(object, CONST_TARGET, { value: object });
}

function protectElements(array) {
  df(array, 'set', { value: throwReadOnly });
  const get = array.get;
  const getReadOnly = function(index) {
    const element = get.call(this, index);
    if (element?.[CONST_TARGET] === null) {
      protect(element);
    }
    return element;
  };
  df(array, 'get', { value: getReadOnly });
}

var all$1 = mixin({
  defineMember(member, applyTransform = true) {
    if (!member) {
      return {};
    }
    const { type, structure } = member;
    const handleName = `defineMember${memberNames[type]}`;
    const f = this[handleName];
    /* c8 ignore end */
    const descriptor = f.call(this, member);
    if (applyTransform) {
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
      ? function(arg) {
          return set.call(this, slot, arg);
        }
      : undefined,
    };
  } else {
    // array accessors
    return { get, set };
  }
}

var bool = mixin({
  defineMemberBool(member) {
    return this.defineMemberUsing(member, this.getAccessor);
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
    return bindSlot(member.slot, {
      get: (member.structure.flags & StructureFlag.HasValue) ? getValue : getObject,
      set: (member.flags & MemberFlag.IsReadOnly) ? throwReadOnly : setValue,
    });
  }
});

function getValue(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATE](slot);
  return object.$;
}

function getObject(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATE](slot);
  return object;
}

function setValue(slot, value) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATE](slot);
  object.$ = value;
}

var pointerInArray = mixin({
  defineVisitorArray(structure) {
    const value = function visitPointers(cb, options = {}) {
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
        const child = this[SLOTS][i] ?? (vivificate ? this[VIVIFICATE](i) : null);
        if (child) {
          child[VISIT](cb, childOptions);
        }
      }
    };
    return { value };
  },
});

var pointerInStruct = mixin({
  defineVisitorStruct(structure, visitorOptions = {}) {
    const {
      isChildActive = always,
      isChildMutable = always,
    } = visitorOptions;
    const { instance: { members } } = structure;
    const pointerMembers = members.filter(m => m.structure?.flags & StructureFlag.HasPointer);
    const value = function visitPointers(cb, options = {}) {
      const {
        source,
        vivificate = false,
        isActive = always,
        isMutable = always,
      } = options;
      const childOptions = {
        ...options,
        isActive: (object) => {
          // make sure parent object is active, then check whether the child is active
          return isActive(this) && isChildActive.call(this, object);
        },
        isMutable: (object) => {
          return isMutable(this) && isChildMutable.call(this, object);
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
        const child = this[SLOTS][slot] ?? (vivificate ? this[VIVIFICATE](slot) : null);
        if (child) {
          child[VISIT](cb, childOptions);
        }
      }
    };
    return { value };
  }
});

var primitive$1 = mixin({
  ...({
    defineMemberUsing(member, getAccessor) {
      const { littleEndian } = this;
      const { bitOffset, byteSize } = member;
      const getter = getAccessor.call(this, 'get', member);
      const setter = getAccessor.call(this, 'set', member);
      /* c8 ignore end */
      if (bitOffset !== undefined) {
        const offset = bitOffset >> 3;
        return {
          get: function getValue() {
            try {
              return getter.call(this[MEMORY], offset, littleEndian);
            } catch (err) {
              if (err instanceof TypeError && this[RESTORE]?.()) {
                return getter.call(this[MEMORY], offset, littleEndian);
              } else {
                throw err;
              }
            }
          },
          set: function setValue(value) {
            try {
              return setter.call(this[MEMORY], offset, value, littleEndian);
            } catch (err) {
              if (err instanceof TypeError && this[RESTORE]?.()) {
                return setter.call(this[MEMORY], offset, value, littleEndian);
              } else {
                throw err;
              }
            }
          }
        }
      } else {
        return {
          get: function getElement(index) {
            try {
              return getter.call(this[MEMORY], index * byteSize, littleEndian);
            } catch (err) {
              if (err instanceof TypeError && this[RESTORE]?.()) {
                return getter.call(this[MEMORY], index * byteSize, littleEndian);
              } else {
                throw adjustRangeError(member, index, err);
              }
            }
          },
          set: function setElement(index, value) {
            try {
              return setter.call(this[MEMORY], index * byteSize, value, littleEndian);
            } catch (err) {
              if (err instanceof TypeError && this[RESTORE]?.()) {
                return setter.call(this[MEMORY], index * byteSize, value, littleEndian);
              } else {
                throw adjustRangeError(member, index, err);
              }
            }
          },
        }
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
    /* c8 ignore end */
    const { get: getSentinelValue } = this.defineMember(sentinel);
    const { get } = this.defineMember(member);
    const value = getSentinelValue.call(template, 0);
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

var specialMethods = mixin({
  defineSpecialMethods() {
    return {
      toJSON: defineValue(convertToJSON),
      valueOf: defineValue(convertToJS),
    };
  },
});

function convertToJS() {
  return normalizeObject(this, false);
}

function convertToJSON() {
  return normalizeObject(this, true);
}

const INT_MAX = BigInt(Number.MAX_SAFE_INTEGER);
const INT_MIN = BigInt(Number.MIN_SAFE_INTEGER);

function normalizeObject(object, forJSON) {
  const handleError = (forJSON)
  ? (cb) => {
      try {
        return cb();
      } catch (err) {
        return err;
      }
    }
  : (cb) => cb();
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
          entries = value[ENTRIES];
          result = (value.constructor[FLAGS] & StructFlag.IsTuple) ? [] : {};
          break;
        case StructureType.Union:
          entries = value[ENTRIES];
          result = {};
          break;
        case StructureType.Array:
        case StructureType.Vector:
        case StructureType.Slice:
          entries = value[ENTRIES];
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

var specialProps = mixin({
  defineSpecialProperties(structure) {
    const descriptors = {};
    const thisEnv = this;
    descriptors.dataView = markAsSpecial({
      get() {
        {
          this[RESTORE]?.();
        }
        return this[MEMORY];
      },
      set(dv, fixed) {
        checkDataView(dv);
        thisEnv.assignView(this, dv, structure, true, fixed);
      },
    });
    descriptors.base64 = markAsSpecial({
      get() {
        return encodeBase64(this.dataView);
      },
      set(str, fixed) {
        if (typeof(str) !== 'string') {
          throw new TypeMismatch('string', str);
        }
        const dv = decodeBase64(str);
        thisEnv.assignView(this, dv, structure, false, fixed);
      }
    });
    const TypedArray = this.getTypedArray(structure); // (from mixin "structures/all")
    if (TypedArray) {
      descriptors.typedArray = markAsSpecial({
        get() {
          const dv = this.dataView;
          const length = dv.byteLength / TypedArray.BYTES_PER_ELEMENT;
          return new TypedArray(dv.buffer, dv.byteOffset, length);
        },
        set(ta, fixed) {
          if (!isTypedArray(ta, TypedArray)) {
            throw new TypeMismatch(TypedArray.name, ta);
          }
          const dv = new DataView(ta.buffer, ta.byteOffset, ta.byteLength);
          thisEnv.assignView(this, dv, structure, true, fixed);
        },
      });
      const { type, flags } = structure;
      if ((type === StructureType.Array || flags & ArrayFlag.IsString)
       || (type === StructureType.Slice || flags & SliceFlag.IsString)) {
        const { byteSize } = structure.instance.members[0];
        const encoding = `utf-${byteSize * 8}`;
        descriptors.string = markAsSpecial({
          get() {
            const dv = this.dataView;
            const ta = new TypedArray(dv.buffer, dv.byteOffset, this.length);
            let str = decodeText(ta, encoding);
            const sentinelValue = this.constructor[SENTINEL]?.value;
            if (sentinelValue !== undefined && str.charCodeAt(str.length - 1) === sentinelValue) {
              str = str.slice(0, -1);
            }
            return str;
          },
          set(str, fixed) {
            if (typeof(str) !== 'string') {
              throw new TypeMismatch('a string', str);
            }
            const sentinelValue = this.constructor[SENTINEL]?.value;
            if (sentinelValue !== undefined && str.charCodeAt(str.length - 1) !== sentinelValue) {
              str += String.fromCharCode(sentinelValue);
            }
            const ta = encodeText(str, encoding);
            const dv = new DataView(ta.buffer);
            thisEnv.assignView(this, dv, structure, false, fixed);
          },
        });
      }
    }
    return descriptors;
  },
});

function isTypedArray(arg, TypedArray) {
  const tag = arg?.[Symbol.toStringTag];
  return (!!TypedArray && tag === TypedArray.name);
}

function checkDataView(dv) {
  if (dv?.[Symbol.toStringTag] !== 'DataView') {
    throw new TypeMismatch('a DataView', dv);
  }
  return dv;
}

function markAsSpecial({ get, set }) {
  get.special = set.special = true;
  return { get, set };
}

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

function getZigIterator() {
  const self = this;
  return {
    next() {
      const value = self.next();
      const done = value === null;
      return { value, done };
    },
  };
}

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

function getArrayIterator() {
  const self = this[ARRAY] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = self.get(current);
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
  const self = this[ARRAY] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = [ current, handleError(() => self.get(current)) ];
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

var all = mixin({
  defineStructure(structure) {
    const {
      type,
      name,
      byteSize,
    } = structure;
    const handlerName = `define${structureNames[type]}`;
    const f = this[handlerName];
    // default discriptors
    const keys = [];
    const setters = {};
    const descriptors = {
      delete: this.defineDestructor(),
      [Symbol.toStringTag]: defineValue(name),
      [CONST_TARGET]: { value: null },
      [SETTERS]: defineValue(setters),
      [KEYS]: defineValue(keys),
      // add memory copier (from mixin "memory/copying")
      [COPY]: this.defineCopier(byteSize),
      // add special methods like toJSON() (from mixin "members/special-method")
      ...this.defineSpecialMethods?.(),
      // add special properties like dataView (from mixin "members/special-props")
      ...this.defineSpecialProperties?.(structure),
      ...({
        // add method for recoverng from array detachment
        [RESTORE]: this.defineRestorer?.(),
      }),
    };
    for (const [ name, descriptor ] of Object.entries(descriptors)) {
      let s;
      if (s = descriptor?.set) {
        setters[name] = s;
        keys.push(name);
      }
    }
    const constructor = f.call(this, structure, descriptors);
    defineProperties(constructor.prototype, descriptors);
    structure.constructor = constructor;
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
      static: { members, template },
    } = structure;
    const props = [];
    const staticDescriptors = {
      name: defineValue(name),
      [ALIGN]: defineValue(align),
      [SIZE]: defineValue(byteSize),
      [TYPE]: defineValue(type),
      [FLAGS]: defineValue(flags),
      [PROPS]: defineValue(props),
      [TYPED_ARRAY]: defineValue(this.getTypedArray(structure)),
      [Symbol.iterator]: defineValue(getStructIterator),
      [ENTRIES]: { get: getStructEntries },
      [PROPS]: defineValue(props),
      ...this.defineSpecialMethods?.(),
    };
    const descriptors = {};
    for (const member of members) {
      const { name, slot } = member;
      if (member.structure.type === StructureType.Function) {
        const fn = template[SLOTS][slot];
        staticDescriptors[name] = defineValue(fn);
        // provide a name if one isn't assigned yet
        if (!fn.name) {
          defineProperty(fn, 'name', defineValue(name));
        }
        // see if it's a getter or setter
        const [ accessorType, propName ] = /^(get|set)\s+([\s\S]+)/.exec(name)?.slice(1) ?? [];
        const argRequired = (accessorType === 'get') ? 0 : 1;
        if (accessorType && fn.length  === argRequired) {
          const descriptor = staticDescriptors[propName] ??= {};
          descriptor[accessorType] = fn;
        }
        // see if it's a method
        if (member.flags & MemberFlag.IsMethod) {
          const method = function(...args) {
            try {
              return fn(this, ...args);
            } catch (err) {
              if ('argCount' in err) {
                err.argIndex--;
                err.argCount--;
              }
              throw err;
            }
          };
          defineProperties(method, {
            name: defineValue(name),
            length: defineValue(fn.length - 1),
          });
          descriptors[name] = defineValue(method);
          if (accessorType && method.length === argRequired) {
            const descriptor = descriptors[propName] ??= {};
            descriptor[accessorType] = method;
          }
        }
      } else {
        staticDescriptors[name] = this.defineMember(member);
        props.push(name);
      }
    }
    // static variable/constants are stored in slots
    staticDescriptors[SLOTS] = (props.length > 0) && defineValue(template[SLOTS]);
    const handlerName = `finalize${structureNames[type]}`;
    const f = this[handlerName];
    if (f?.call(this, structure, staticDescriptors) !== false) {
      defineProperties(constructor.prototype, descriptors);
      defineProperties(constructor, staticDescriptors);
    }
  },
  createConstructor(structure, handlers = {}) {
    const {
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
        fixed = false,
      } = options;
      const creating = this instanceof constructor;
      let self, dv;
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
          // as it does not have a fixed size; memory is allocated by the slice initializer
          // based on the argument given
          self[INITIALIZE](arg, fixed);
          dv = self[MEMORY];
        } else {
          self[MEMORY] = dv = thisEnv.allocateMemory(byteSize, align, fixed);
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
          return self;
        }
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
      if (comptimeFieldSlots) {
        for (const slot of comptimeFieldSlots) {
          self[SLOTS][slot] = template[SLOTS][slot];
        }
      }
      if (MODIFY in self) {
        self[MODIFY]();
      }
      if (creating) {
        // initialize object unless that's done already
        if (!(SHAPE in self)) {
          self[INITIALIZE](arg);
        }
      }
      if (FINALIZE in self) {
        self = self[FINALIZE]();
      }
      return cache.save(dv, self);
    };
    defineProperty(constructor, CACHE, defineValue(cache));
    return constructor;
  },
  defineDestructor() {
    const thisEnv = this;
    return {
      value() {
        const dv = this[MEMORY];
        this[MEMORY] = null;
        if (this[SLOTS]) {
          this[SLOTS] = {};
        }
        thisEnv.releaseFixedView(dv);
      }
    };
  },
  createApplier(structure) {
    const { instance: { template } } = structure;
    return function(arg, fixed) {
      const argKeys = Object.keys(arg);
      const keys = this[KEYS];
      const setters = this[SETTERS];
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
          if (key in arg) {
            specialFound++;
          }
        } else {
          normalCount++;
          if (key in arg) {
            normalFound++;
          } else if (set.required) {
            normalMissing++;
          }
        }
      }
      if (normalMissing !== 0 && specialFound === 0) {
        const missing = keys.filter(k => setters[k].required && !(k in arg));
        throw new MissingInitializers(structure, missing);
      }
      if (specialFound + normalFound > argKeys.length) {
        // some props aren't enumerable
        for (const key of keys) {
          if (key in arg) {
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
            this[COPY](template);
          }
          this[VISIT]?.('copy', { vivificate: true, source: template });
        }
      }
      for (const key of argKeys) {
        const set = setters[key];
        set.call(this, arg[key], fixed);
      }
      return argKeys.length;
    };
  },
  getTypedArray(structure) {
    const { type, instance } = structure;
    if (type !== undefined && instance) {
      const [ member ] = instance.members;
      switch (type) {
        case StructureType.Enum:
        case StructureType.ErrorSet:
        case StructureType.Primitive: {
          const { byteSize, type } = member;
          const intType = (type === MemberType.Float)
                        ? 'Float'
                        : (type === MemberType.Int) ? 'Int' : 'Uint';
          const prefix = (byteSize > 4 && type !== MemberType.Float) ? 'Big' : '';
          const arrayName = prefix + intType + (byteSize * 8) + 'Array';
          return globalThis[arrayName];
        }        case StructureType.Array:
        case StructureType.Slice:
        case StructureType.Vector:
          return this.getTypedArray(member.structure);
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
    const constructor = function(args) {
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
        self[CONTEXT] = { memoryList: [], shadowMap: null };
        if (flags & ArgStructFlag.IsAsync) {
          self[FINALIZE] = null;
        }
        thisEnv.copyArguments(self, args, argMembers, options);
      } else {
        return self;
      }
    };
    for (const member of members) {
      descriptors[member.name] = this.defineMember(member);
    }
    const { slot: rvSlot, type: rvType } = members[0];
    const isChildMutable = (rvType === MemberType.Object)
    ? function(object) {
        const child = this[VIVIFICATE](rvSlot);
        return object === child;
      }
    : never;
    descriptors.length = defineValue(argMembers.length);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(structure, { isChildMutable });
    {
      this.detectArgumentFeatures(argMembers);
    }
    return constructor;
  },
  finalizeArgStruct(structure, staticDescriptors) {
    const { flags } = structure;
    staticDescriptors[THROWING] = defineValue(!!(flags & ArgStructFlag.IsThrowing));
  },
  ...({
    usingPromise: false,
    usingAbortSignal: false,
    usingAllocator: false,

    detectArgumentFeatures(argMembers) {
      for (const { structure: flags } of argMembers) {
        if (flags & StructFlag.IsAllocator) {
          this.usingAllocator = true;
        } else if (flags & StructFlag.IsPromise) {
          this.usingPromise = true;
        } else if (flags & StructFlag.IsAbortSignal) {
          this.usingAbortSignal = true;
        }
      }
    }
  } ),
});

var arrayLike = mixin({
  defineFinalizerArray({ get, set }) {
    return {
      value() {
        const value = new Proxy(this, proxyHandlers$1);
        defineProperties(this, {
          [PROXY]: { value },
          get: { value: get.bind(this) },
          set: set && { value: set.bind(this) },
        });
        return value;
      },
    };
  },
  defineVivificatorArray(structure) {
    const { instance: { members: [ member ]} } = structure;
    const { byteSize, structure: elementStructure } = member;
    const thisEnv = this;
    const value = function getChild(index) {
      const { constructor } = elementStructure;
      const dv = this[MEMORY];
      const parentOffset = dv.byteOffset;
      const offset = parentOffset + byteSize * index;
      const childDV = thisEnv.obtainView(dv.buffer, offset, byteSize);
      const object = this[SLOTS][index] = constructor.call(PARENT, childDV);
      return object;
    };
    return { value };
  },
});

const proxyHandlers$1 = {
  get(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return array.get(index);
    } else if (name === ARRAY) {
      return array;
    } else {
      return array[name];
    }
  },
  set(array, name, value) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      array.set(index, value);
    } else {
      array[name] = value;
    }
    return true;
  },
  deleteProperty(array, name) {
    const index = (typeof(name) === 'symbol') ? 0 : name|0;
    if (index !== 0 || index == name) {
      return false;
    } else {
      delete array[name];
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
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', { vivificate: true, source: arg });
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
            set.call(this, i++, value);
          }
        } else if (arg && typeof(arg) === 'object') {
          if (propApplier.call(this, arg) === 0) {
            throw new InvalidArrayInitializer(structure, arg);
          }
        } else if (arg !== undefined) {
          throw new InvalidArrayInitializer(structure, arg);
        }
      }
    };
    descriptors.$ = { get: getProxy, set: initializer };
    descriptors.length = defineValue(length);
    descriptors.entries = defineValue(getArrayEntries);
    descriptors[Symbol.iterator] = defineValue(getArrayIterator);
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = this.defineFinalizerArray(descriptor);
    descriptors[ENTRIES] = { get: getArrayEntries };
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorArray(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArray(structure);
    return constructor;
  },
  finalizeArray(structure, staticDescriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors.child = defineValue(member.structure.constructor);
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
    for (const { name, flags, slot } of members) {
      if (flags & MemberFlag.IsPartOfSet) {
        const item = items[slot];
        // attach name to item so tagged union code can quickly find it
        defineProperty(item, NAME, defineValue(name));
        const index = get.call(item);
        // make item available by name and by index
        staticDescriptors[name] = staticDescriptors[index] = { value: item, writable: false };
      }
    }
    // add cast handler allowing strings, numbers, and tagged union to be casted into enums
    staticDescriptors[CAST] = {
      value(arg) {
        if (typeof(arg)  === 'string' || typeof(arg) === 'number' || typeof(arg) === 'bigint') {
          let item = constructor[arg];
          if (!item) {
            if (flags & EnumFlag.IsOpenEnded && typeof(arg) !== 'string') {
              // create the item on-the-fly when enum is non-exhaustive
              item = new constructor(undefined);
              // write the value into memory
              set.call(item, arg);
              // attach the new item to the enum set
              defineProperty(item, NAME, defineValue(arg));
              defineProperty(constructor, arg, defineValue(item));
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
  currentGlobalSet: undefined,
  currentErrorClass: undefined,

  defineErrorSet(structure, descriptors) {
    const {
      name,
      instance: { members: [ member ] },
    } = structure;
    if (!this.currentErrorClass) {
      // create anyerror set
      this.currentErrorClass = class Error extends ZigErrorBase {};
      const ae = {
        type: StructureType.ErrorSet,
        name: 'anyerror',
        instance: { members: [ member ] },
        static: { members: [], template: { SLOTS: {} } },
      };
      this.defineStructure(ae);
      this.finalizeStructure(ae);
      this.currentGlobalSet = ae.constructor;
    }
    if (this.currentGlobalSet && name === 'anyerror') {
      return this.currentGlobalSet;
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
      name,
      instance: { members: [ member ] },
      static: { members, template },
    } = structure;
    if (this.currentGlobalSet && name === 'anyerror') {
      // already finalized
      return false;
    }
    const items = template?.[SLOTS] ?? {};
    // obtain getter/setter for accessing int values directly
    const { get } = this.defineMember(member, false);
    for (const { name, slot } of members) {
      const item = items[slot];
      // unlike enums, error objects in an error-set aren't instances of the error-set class
      // they're instance of a superclass of JavaScript's Error; here we need to extract the
      // error number from the error-set instance and create the error object, if hasn't been
      // created already for an earlier set
      const number = get.call(item);
      let error = this.currentGlobalSet[number], inGlobalSet = true;
      if (!error) {
        error = new this.currentErrorClass(name, number);
        inGlobalSet = false;
      }
      // make the error object available by errno, by name, and by error message
      const descriptor = defineValue(error);
      const string = String(error);
      staticDescriptors[name] =
      staticDescriptors[string] =
      staticDescriptors[number] = descriptor;
      if (!inGlobalSet) {
        // add to global error set as well
        defineProperties(this.currentGlobalSet, {
          [number]: descriptor,
          [string]: descriptor,
          [name]: descriptor,
        });
        this.currentGlobalSet[PROPS].push(name);
      }
    }
    // add cast handler allowing strings, numbers, and JSON object to be casted into error set
    staticDescriptors[CAST] = {
      value(arg) {
        if (typeof(arg) === 'number' || typeof(arg) === 'string') {
          return constructor[arg];
        } else if (arg instanceof constructor[CLASS]) {
          return constructor[Number(arg)];
        } else if (isErrorJSON(arg)) {
          return constructor[`Error: ${arg.error}`];
        } else if (arg instanceof Error) {
          return undefined;
        } else {
          return false;
        }
      }
    };
    staticDescriptors[CLASS] = defineValue(this.currentErrorClass);
  },
  transformDescriptorErrorSet(descriptor, member) {
    const { type, structure } = member;
    if (type === MemberType.Object) {
      return descriptor;
    }
    const findError = function(value) {
      const { constructor } = structure;
      const item = constructor(value);
      if (!item) {
        if (value instanceof Error) {
          throw new NotInErrorSet(structure);
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
  resetGlobalErrorSet() {
    this.currentErrorClass = this.currentGlobalSet = undefined;
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
      instance: { members },
      flags,
    } = structure;
    const { get: getValue, set: setValue } = this.defineMember(members[0]);
    const { get: getError, set: setError } = this.defineMember(members[1]);
    const { get: getErrorNumber, set: setErrorNumber } = this.defineMember(members[1], false);
    const get = function() {
      const errNum = getErrorNumber.call(this);
      if (errNum) {
        throw getError.call(this);
      } else {
        return getValue.call(this);
      }
    };
    const isValueVoid = members[0].type === MemberType.Void;
    const errorSet = members[1].structure.constructor;
    const isChildActive = function() {
      return !getErrorNumber.call(this);
    };
    const clearValue = function() {
      this[RESET]();
      this[VISIT]?.('reset');
    };
    const propApplier = this.createApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          if (isChildActive.call(this)) {
            this[VISIT]('copy', { vivificate: true, source: arg });
          }
        }
      } else if (arg instanceof errorSet[CLASS] && errorSet(arg)) {
        setError.call(this, arg);
        clearValue.call(this);
      } else if (arg !== undefined || isValueVoid) {
        try {
          // call setValue() first, in case it throws
          setValue.call(this, arg);
          setErrorNumber.call(this, 0);
        } catch (err) {
          if (arg instanceof Error) {
            // we gave setValue a chance to see if the error is actually an acceptable value
            // now is time to throw an error
            throw new NotInErrorSet(structure);
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
    };
    const { bitOffset, byteSize } = members[0];
    const constructor = this.createConstructor(structure);
    descriptors.$ = { get, set: initializer };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    // for clear value after error union is set to an an error (from mixin "features/data-copying")
    descriptors[RESET] = this.defineResetter(bitOffset / 8, byteSize);
    // for operating on pointers contained in the error union
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(structure, { isChildActive });
    return constructor;
  },
});

var _function = mixin({
  defineFunction(structure, descriptors) {
    const {
      instance: { members: [ member ], template: thunk },
      static: { template: jsThunkController },
    } = structure;
    const cache = new ObjectCache();
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
        // create an inbound thunk for function (from mixin "features/call-marshaling-inbound")
        dv = thisEnv.getFunctionThunk(arg, jsThunkController);
      } else {
        if (this !== ENVIRONMENT) {
          // casting from buffer to function is allowed only if request comes from the runtime
          throw new NoCastingToFunction();
        }
        // casting a memory pointing to Zig binary
        dv = arg;
      }
      let existing;
      if (existing = cache.find(dv)) {
        return existing;
      }
      const argCount = ArgStruct.prototype.length;
      const self = (creating)
      ? thisEnv.createInboundCaller(arg, ArgStruct)
      : thisEnv.createOutboundCaller(thunk, ArgStruct);
      defineProperties(self, {
        length: defineValue(argCount),
        name: defineValue(''),
      });
      // make self an instance of this function type
      Object.setPrototypeOf(self, constructor.prototype);
      self[MEMORY] = dv;
      cache.save(dv, self);
      {
        if (!creating) {
          thisEnv.usingFunction = true;
        }
      }
      return self;
    };
    // make function type a superclass of Function
    Object.setPrototypeOf(constructor.prototype, Function.prototype);
    // don't change the tag of functions
    descriptors[Symbol.toStringTag] = undefined;
    descriptors.valueOf = descriptors.toJSON = defineValue(getSelf);
    // destructor needs to free the JS thunk on Zig side as well
    const { delete: { value: defaultDelete } } = descriptors;
    descriptors.delete = defineValue(function() {
      if (jsThunkController) {
        thisEnv.freeFunctionThunk(this[MEMORY], jsThunkController);
      }
      defaultDelete.call(this);
    });
    {
      if (jsThunkController) {
        this.usingFunctionPointer = true;
      }
    }
    return constructor;
  },
  ...({
    usingFunction: false,
    usingFunctionPointer: false,
  } ),
});

var opaque = mixin({
  defineOpaque(structure, descriptors) {
    const {
      flags,
    } = structure;
    const initializer = () => { throw new CreatingOpaque(structure) };
    const valueAccessor = () => { throw new AccessingOpaque(structure) };
    const constructor = this.createConstructor(structure);
    descriptors.$ = { get: valueAccessor, set: valueAccessor };
    descriptors[Symbol.iterator] = (flags & OpaqueFlag.IsIterator) && {
      value: getZigIterator
    };
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
      instance: { members },
      flags,
    } = structure;
    const { get: getValue, set: setValue } = this.defineMember(members[0]);
    const { get: getPresent, set: setPresent } = this.defineMember(members[1]);
    const get = function() {
      const present = getPresent.call(this);
      if (present) {
        return getValue.call(this);
      } else {
        this[VISIT]?.('reset');
        return null;
      }
    };
    const isValueVoid = members[0].type === MemberType.Void;
    const isChildPointer = members[0].structure.type === StructureType.Pointer;
    const isChildActive = function () {
      return !!getPresent.call(this);
    };
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          // don't bother copying pointers when it's empty
          if (isChildActive.call(arg)) {
            this[VISIT]('copy', { vivificate: true, source: arg });
          }
        }
      } else if (arg === null) {
        setPresent.call(this, 0);
        this[RESET]?.();
        // clear references so objects can be garbage-collected
        this[VISIT]?.('reset');
      } else if (arg !== undefined || isValueVoid) {
        // call setValue() first, in case it throws
        setValue.call(this, arg);
        if (flags & OptionalFlag.HasSelector || (isChildPointer && !this[MEMORY][FIXED])) {
          // since setValue() wouldn't write address into memory when the pointer is in
          // relocatable memory, we need to use setPresent() in order to write something
          // non-zero there so that we know the field is populated
          setPresent.call(this, 1);
        }
      }
    };
    const constructor = structure.constructor = this.createConstructor(structure);
    const { bitOffset, byteSize } = members[0];
    descriptors.$ = { get, set: initializer };
    // we need to clear the value portion when there's a separate bool indicating whether a value
    // is present; for optional pointers, the bool overlaps the usize holding the address; setting
    // it to false automatically clears the address
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[RESET] = (flags & OptionalFlag.HasSelector) && this.defineResetter(bitOffset / 8, byteSize);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(structure, { isChildActive });
    return constructor;
  },
});

var pointer = mixin({
  definePointer(structure, descriptors) {
    const {
      name,
      flags,
      byteSize,
      instance: { members: [ member ] },
    } = structure;
    const { structure: targetStructure } = member;
    const {
      type: targetType,
      flags: targetFlags,
      byteSize: targetSuze = 1
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
      if (all || this[MEMORY][FIXED]) {
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
              this[MAX_LENGTH] = undefined;
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
    const setLength = (flags & PointerFlag.HasLength || targetFlags & SliceFlag.HasSentinel)
    ? function(length) {
        writeLength?.call?.(this, length);
        this[LAST_LENGTH] = length;
      }
    : null;
    const getTargetObject = function() {
      const pointer = this[POINTER] ?? this;
      const target = updateTarget.call(pointer, null, false);
      if (!target) {
        if (flags & PointerFlag.IsNullable) {
          return null;
        }
        throw new NullPointer();
      }
      return (flags & PointerFlag.IsConst) ? getConstProxy(target) : target;
    };
    const setTargetObject = function(arg) {
      if (arg === undefined) {
        return;
      }
      const pointer = this[POINTER] ?? this;
      // the target sits in fixed memory--apply the change immediately
      if (arg) {
        if (arg[MEMORY][FIXED]) {
          const address = thisEnv.getViewAddress(arg[MEMORY]);
          setAddress.call(this, address);
          setLength?.call?.(this, arg.length);
        } else {
          if (pointer[MEMORY][FIXED]) {
            throw new FixedMemoryTargetRequired(structure, arg);
          }
        }
      } else if (pointer[MEMORY][FIXED]) {
        setAddress.call(this, 0);
        setLength?.call?.(this, 0);
      }
      pointer[SLOTS][0] = arg ?? null;
      if (flags & PointerFlag.HasLength) {
        pointer[MAX_LENGTH] = undefined;
      }
    };
    const getTarget = (targetFlags & StructureFlag.HasValue)
    ? function() {
        const target = getTargetObject.call(this);
        return target.$;
      }
    : getTargetObject;
    const setTarget = (flags & PointerFlag.IsConst)
    ? throwReadOnly
    : function(value) {
        const target = getTargetObject.call(this);
        return target.$ = value;
      };
    const getTargetLength = function() {
      const target = getTargetObject.call(this);
      return (target) ? target.length : 0;
    };
    const setTargetLength = function(len) {
      len = len | 0;
      const target = getTargetObject.call(this);
      if (!target) {
        if (len !== 0) {
          throw new InvalidSliceLength(len, 0);
        }
        return;
      }
      const dv = target[MEMORY];
      const fixed = dv[FIXED];
      const bytesAvailable = dv.buffer.byteLength - dv.byteOffset;
      // determine the maximum length
      let max;
      if (!fixed) {
        if (flags & PointerFlag.HasLength) {
          max = this[MAX_LENGTH] ??= target.length;
        } else {
          max = (bytesAvailable / targetSuze) | 0;
        }
      }
      if (len < 0 || len > max) {
        throw new InvalidSliceLength(len, max);
      }
      const byteLength = len * targetSuze;
      const newDV = (byteLength <= bytesAvailable)
      // can use the same buffer
      ? thisEnv.obtainView(dv.buffer, dv.byteOffset, byteLength)
      // need to ask V8 for a larger external buffer
      : thisEnv.obtainFixedView(fixed.address, byteLength);
      const Target = targetStructure.constructor;
      this[SLOTS][0] = Target.call(ENVIRONMENT, newDV);
      setLength?.call?.(this, len);
    };
    const thisEnv = this;
    const initializer = function(arg) {
      const Target = targetStructure.constructor;
      if (isPointerOf(arg, Target)) {
        // initialize with the other pointer'structure target
        if (!(flags & PointerFlag.IsConst) && arg.constructor.const) {
          throw new ConstantConstraint(structure, arg);
        }
        arg = arg[SLOTS][0];
      } else if (flags & PointerFlag.IsMultiple) {
        if (isCompatiblePointer(arg, Target, flags)) {
          arg = Target(arg[SLOTS][0][MEMORY]);
        }
      } else if (name === '*anyopaque' && arg) {
        if (arg.constructor[TYPE] === StructureType.Pointer) {
          arg = arg['*']?.[MEMORY];
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
          arg[RESTORE]?.();
        }
        const constTarget = arg[CONST_TARGET];
        if (constTarget) {
          if (flags & PointerFlag.IsConst) {
            arg = constTarget;
          } else {
            throw new ReadOnlyTarget(structure);
          }
        }      } else if (flags & PointerFlag.IsSingle && flags & PointerFlag.IsMultiple && arg instanceof Target.child) {
        // C pointer
        arg = Target(arg[MEMORY]);
      } else if (isCompatibleBuffer(arg, Target)) {
        // autocast to target type
        const dv = thisEnv.extractView(targetStructure, arg);
        arg = Target(dv);
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
        // autovivificate target object
        const autoObj = new Target(arg, { fixed: !!this[MEMORY][FIXED] });
        if (thisEnv.runtimeSafety) {
          // creation of a new slice using a typed array is probably
          // not what the user wants; it's more likely that the intention
          // is to point to the typed array but there's a mismatch (e.g. u32 vs i32)
          if (TYPED_ARRAY in Target) {
            const tag = arg?.buffer?.[Symbol.toStringTag];
            if (tag === 'ArrayBuffer') {
              warnImplicitArrayCreation(targetStructure, arg);
            }
          }
        }
        arg = autoObj;
      } else if (arg !== undefined) {
        if (!(flags & PointerFlag.IsNullable) || arg !== null) {
          throw new InvalidPointerTarget(structure, arg);
        }
      }
      this[TARGET] = arg;
    };
    const destructor = descriptors.delete.value;
    const constructor = this.createConstructor(structure);
    descriptors['*'] = { get: getTarget, set: setTarget };
    descriptors.$ = { get: getProxy, set: initializer };
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
    descriptors.delete = {
      value() {
        this[TARGET]?.delete();
        destructor.call(this);
      }
    },
    descriptors[Symbol.toPrimitive] = (targetType === StructureType.Primitive) && {
      value(hint) {
        return this[TARGET][Symbol.toPrimitive](hint);
      }
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = {
      value() {
        const handlers = (targetType === StructureType.Pointer) ? {} : proxyHandlers;
        const proxy = new Proxy(this, handlers);
        // hide the proxy so console wouldn't display a recursive structure
        Object.defineProperty(this, PROXY, { value: proxy });
        return proxy;
      }
    };
    descriptors[TARGET] = { get: getTargetObject, set: setTargetObject };
    descriptors[UPDATE] = defineValue(updateTarget);
    descriptors[ADDRESS] = { set: setAddress };
    descriptors[LENGTH] = { set: setLength };
    descriptors[VISIT] = defineValue(visitPointer);
    descriptors[LAST_ADDRESS] = defineValue(0);
    descriptors[LAST_LENGTH] = defineValue(0);
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
    staticDescriptors.child = (Target) ? defineValue(Target) : {
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

function throwInaccessible() {
  throw new InaccessiblePointer();
}
const builtinVisitors = {
  copy({ source }) {
    const target = source[SLOTS][0];
    if (target) {
      this[TARGET] = target;
    }
  },
  reset({ isActive }) {
    if (this[SLOTS][0] && !isActive(this)) {
      this[SLOTS][0] = undefined;
    }
  },
  disable() {
    const disabledProp = { get: throwInaccessible, set: throwInaccessible };
    defineProperties(this[POINTER], {
      '*': disabledProp,
      '$': disabledProp,
      [POINTER]: disabledProp,
      [TARGET]: disabledProp,
    });
  },
};

function visitPointer(visitor, options = {}) {
  const {
    source,
    isActive = always,
    isMutable = always,
  } = options;
  let fn;
  if (typeof(visitor) === 'string') {
    fn = builtinVisitors[visitor];
  } else {
    fn = visitor;
  }
  fn.call(this, { source, isActive, isMutable });
}

function isPointerOf(arg, Target) {
  return (arg?.constructor?.child === Target && arg['*']);
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

function getConstProxy(target) {
  let proxy = target[CONST_PROXY];
  if (!proxy) {
    Object.defineProperty(target, CONST_PROXY, { value: undefined, configurable: true });
    proxy = new Proxy(target, constTargetHandlers);
    Object.defineProperty(target, CONST_PROXY, { value: proxy });
  }
  return proxy;
}

const proxyHandlers = {
  get(pointer, name) {
    if (name === POINTER) {
      return pointer;
    } else if (name in pointer) {
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
};

const constTargetHandlers = {
  get(target, name) {
    if (name === CONST_TARGET) {
      return target;
    } else {
      const value = target[name];
      if (value?.[CONST_TARGET] === null) {
        return getConstProxy(value);
      }
      return value;
    }
  },
  set(target, name, value) {
    const ptr = target[POINTER];
    if (ptr && !(name in ptr)) {
      target[name] = value;
    } else {
      throwReadOnly();
    }
    return true;
  }
};

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
      if (arg instanceof constructor) {
        this[COPY](arg);
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
      byteSize,
      instance: {
        members: [ member ],
      },
    } = structure;
    /* c8 ignore end */
    const { byteSize: elementSize, structure: elementStructure } = member;
    const thisEnv = this;
    const shapeDefiner = function(dv, length, fixed = false) {
      if (!dv) {
        dv = thisEnv.allocateMemory(length * elementSize, align, fixed);
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
    const initializer = function(arg, fixed = false) {
      if (arg instanceof constructor) {
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, arg.length, fixed);
        } else {
          shapeChecker.call(this, arg, arg.length);
        }
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', { vivificate: true, source: arg });
        }
      } else if (typeof(arg) === 'string' && flags & SliceFlag.IsString) {
        initializer.call(this, { string: arg }, fixed);
      } else if (arg?.[Symbol.iterator]) {
        arg = transformIterable(arg);
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, arg.length, fixed);
        } else {
          shapeChecker.call(this, arg, arg.length);
        }
        let i = 0;
        for (const value of arg) {
          constructor[SENTINEL]?.validateValue(value, i, arg.length);
          set.call(this, i++, value);
        }
      } else if (typeof(arg) === 'number') {
        if (!this[MEMORY] && arg >= 0 && isFinite(arg)) {
          shapeDefiner.call(this, null, arg, fixed);
        } else {
          throw new InvalidArrayInitializer(structure, arg, !this[MEMORY]);
        }
      } else if (arg && typeof(arg) === 'object') {
        if (propApplier.call(this, arg, fixed) === 0) {
          throw new InvalidArrayInitializer(structure, arg);
        }
      } else if (arg !== undefined) {
        throw new InvalidArrayInitializer(structure, arg);
      }
    };
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
    descriptors.$ = { get: getProxy, set: initializer };
    descriptors.length = { get: getLength };
    descriptors.entries = defineValue(getArrayEntries);
    descriptors.subarray = {
      value(begin, end) {
        const dv = getSubArrayView.call(this, begin, end);
        return constructor(dv);
      },
    };
    descriptors.slice = {
      value(begin, end, options = {}) {
        const {
          fixed = false
        } = options;
        const dv1 = getSubArrayView.call(this, begin, end);
        const dv2 = thisEnv.allocateMemory(dv1.byteLength, align, fixed);
        const slice = constructor(dv2);
        slice[COPY]({ [MEMORY]: dv1 });
        return slice;
      },
    };
    descriptors[Symbol.iterator] = defineValue(getArrayIterator);
    descriptors[SHAPE] = defineValue(shapeDefiner);
    descriptors[COPY] = this.defineCopier(byteSize, true);
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = this.defineFinalizerArray(descriptor);
    descriptors[ENTRIES] = { get: getArrayEntries };
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorArray(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArray(structure);
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
        const dv = this[MEMORY];
        const parentOffset = dv.byteOffset;
        const offset = parentOffset + (bitOffset >> 3);
        let len = byteSize;
        if (len === undefined) {
          if (bitOffset & 7) {
            throw new NotOnByteBoundary(member);
          }
          len = member.bitSize >> 3;
        }
        const childDV = thisEnv.obtainView(dv.buffer, offset, len);
        const object = this[SLOTS][slot] = constructor.call(PARENT, childDV);
        return object;
      }
    };
  },
});

var struct = mixin({
  defineStruct(structure, descriptors) {
    const {
      instance: { members },
      flags,
    } = structure;
    const backingIntMember = members.find(m => m.flags & MemberFlag.IsBackingInt);
    const backingInt = backingIntMember && this.defineMember(backingIntMember);
    const propApplier = this.createApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', { vivificate: true, source: arg });
        }
      } else if (arg && typeof(arg) === 'object') {
        propApplier.call(this, arg);
      } else if ((typeof(arg) === 'number' || typeof(arg) === 'bigint') && backingInt) {
        backingInt.set.call(this, arg);
      } else if (arg !== undefined) {
        throw new InvalidInitializer(structure, 'object', arg);
      }
    };
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
    descriptors.length = (flags & StructFlag.IsTuple) && {
      value: (members.length > 0) ? parseInt(members[members.length - 1].name) + 1 : 0,
    };
    descriptors.entries = (flags & StructFlag.IsTuple) && {
      value: getVectorEntries,
    };
    // allow conversion of packed struct to number when there's a backing int
    descriptors[Symbol.toPrimitive] = backingInt && {
      value(hint) {
        return (hint === 'string')
          ? Object.prototype.toString.call(this)
          : backingInt.get.call(this);
      }
    };
    // add iterator
    descriptors[Symbol.iterator] = defineValue(
      (flags & StructFlag.IsIterator)
      ? getZigIterator
      : (flags & StructFlag.IsTuple)
        ? getVectorIterator
        : getStructIterator
    );
    descriptors[INITIALIZE] = defineValue(initializer);
    // for creating complex fields on access
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    // for operating on pointers contained in the struct
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(structure);
    descriptors[ENTRIES] = { get: (flags & StructFlag.IsTuple) ? getVectorEntries : getStructEntries };
    descriptors[PROPS] = defineValue(props);
    return constructor;
  }
});

var union = mixin({
  defineUnion(structure, descriptors) {
    const {
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
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
        if (flags & StructureFlag.HasPointer) {
          this[VISIT]('copy', { vivificate: true, source: arg });
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
        if (propApplier.call(this, arg) === 0) {
          throw new MissingUnionInitializer(structure, arg, exclusion);
        }
      } else if (arg !== undefined) {
        throw new InvalidInitializer(structure, 'object with a single property', arg);
      }
    };
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
          this[VISIT]?.('reset');
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
          setValue.call(this, value);
          this[VISIT]?.('reset');
        }
      : setValue;
      descriptors[name] = { get, set };
      setters[name] = init;
      getters[name] = getValue;
      keys.push(name);
      props.push(name);
    }
    descriptors.$ = { get: function() { return this }, set: initializer };
    descriptors[Symbol.iterator] = {
      value: (flags & UnionFlag.IsIterator) ? getZigIterator : getUnionIterator,
    };
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
    descriptors[MODIFY] = (flags & UnionFlag.HasInaccessible && !this.comptime) && {
      value() {
        // pointers in non-tagged union are not accessible--we need to disable them
        this[VISIT]('disable', { vivificate: true });
      }
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[TAG] = (flags & UnionFlag.HasTag) && { get: getSelector, set : setSelector };
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] =  (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(structure, {
      isChildActive: (flags & UnionFlag.HasTag)
      ? function(child) {
          const name = getActiveField.call(this);
          const active = getters[name].call(this);
          return child === active;
        }
      : () => false,
    });
    descriptors[ENTRIES] = { get: getUnionEntries };
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

var variadicStruct = mixin({
  defineVariadicStruct(structure, descriptors) {
    const {
      byteSize,
      align,
      flags,
      instance: { members },
    } = structure;
    const argMembers = members.slice(1);
    const argCount = argMembers.length;
    const maxSlot = members.map(m => m.slot).sort().pop();
    const thisEnv = this;
    const constructor = function(args, name, offset) {
      if (args.length < argCount) {
        throw new ArgumentCountMismatch(name, `at least ${argCount - offset}`, args.length - offset);
      }
      // calculate the actual size of the struct based on arguments given
      let totalByteSize = byteSize;
      let maxAlign = align;
      const varArgs = args.slice(argCount);
      const offsets = {};
      for (const [ index, arg ] of varArgs.entries()) {
        const dv = arg[MEMORY];
        let argAlign = arg.constructor[ALIGN];
        if (!dv || !argAlign) {
          new InvalidVariadicArgument();
          throw adjustArgumentError(name, argCount + index - offset, args.length - offset);
        }
        {
          // the arg struct is passed to the function in WebAssembly and fields are
          // expected to aligned to at least 4
          argAlign = Math.max(4, argAlign);
        }
        if (argAlign > maxAlign) {
          maxAlign = argAlign;
        }
        // can't use alignForward here, since that uses bigint when platform is 64-bit
        const byteOffset = offsets[index] = (totalByteSize + (argAlign - 1)) & ~(argAlign - 1);
        totalByteSize = byteOffset + dv.byteLength;
      }
      const attrs = new ArgAttributes(args.length);
      const dv = thisEnv.allocateMemory(totalByteSize, maxAlign);
      // attach the alignment so we can correctly shadow the struct
      dv[ALIGN] = maxAlign;
      this[MEMORY] = dv;
      this[SLOTS] = {};
      for (let i = 0; i < argCount; i++) {
        try {
          const arg = args[i];
          if (arg === undefined) {
            const { type } = argMembers[i];
            if (type !== MemberType.Void) {
              throw new UndefinedArgument();
            }
          }
          this[i] = arg;
        } catch (err) {
          throw adjustArgumentError(name, i - offset);
        }
      }
      // set attributes of retval and fixed args
      for (const [ index, { bitOffset, bitSize, type, structure: { align } } ] of argMembers.entries()) {
        attrs.set(index, bitOffset / 8, bitSize, align, type);
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
        attrs.set(argCount + index, offset, bitSize, align, type);
      }
      this[ATTRIBUTES] = attrs;
    };
    for (const member of members) {
      descriptors[member.name] = this.defineMember(member);
    }
    const { slot: retvalSlot, type: retvalType } = members[0];
    const isChildMutable = (retvalType === MemberType.Object)
    ? function(object) {
        const child = this[VIVIFICATE](retvalSlot);
        return object === child;
      }
    : function() { return false };
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
      [COPY]: this.defineCopier(4, true),
      ...({
        [RESTORE]: this.defineRestorer(),
      } ),
    });
    descriptors[COPY] = this.defineCopier(undefined, true);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = {
      value(cb, options = {}) {
        const {
          vivificate = false,
          isActive = always,
          isMutable = always,
        } = options;
        const childOptions = {
          ...options,
          isActive,
          isMutable: (object) => isMutable(this) && isChildMutable.call(this, object),
        };
        if (vivificate && retvalType === MemberType.Object) {
          this[VIVIFICATE](retvalSlot);
        }
        for (const child of Object.values(this[SLOTS])) {
          child?.[VISIT]?.(cb, childOptions);
        }
      },
    };
    return constructor;
  },
  finalizeVariadicStruct(structure, staticDescriptors) {
    const { flags } = structure;
    staticDescriptors[THROWING] = defineValue(!!(flags & ArgStructFlag.IsThrowing));
  },
});

var vector = mixin({
  defineVector(structure, descriptors) {
    const {
      length,
      instance: { members: [ member ] },
    } = structure;
    const propApplier = this.createApplier(structure);
    const initializer = function(arg) {
      if (arg instanceof constructor) {
        this[COPY](arg);
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
    };
    const constructor = this.createConstructor(structure, { initializer });
    const { bitSize: elementBitSize } = member;
    for (let i = 0, bitOffset = 0; i < length; i++, bitOffset += elementBitSize) {
      descriptors[i] = this.defineMember({ ...member, bitOffset });
    }
    descriptors.$ = { get: getSelf, set: initializer };
    descriptors.length = defineValue(length);
    descriptors.entries = defineValue(getVectorEntries);
    descriptors[Symbol.iterator] = defineValue(getVectorIterator);
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[ENTRIES] = { get: getVectorEntries };
    return constructor;
  },
  finalizeVector(structure, staticDescriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    staticDescriptors.child = defineValue(member.structure.constructor);
  },
});

// generated by rollup.config.js

var mixins = /*#__PURE__*/Object.freeze({
  __proto__: null,
  AccessorAll: all$2,
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
  FeatureAbortSignal: abortSignal,
  FeatureBaseline: baseline,
  FeatureCallMarshalingInbound: callMarshalingInbound,
  FeatureCallMarshalingOutbound: callMarshalingOutbound,
  FeatureDataCopying: dataCopying,
  FeatureDefaultAllocator: defaultAllocator,
  FeatureIntConversion: intConversion,
  FeatureMemoryMapping: memoryMapping,
  FeatureModuleLoading: moduleLoading,
  FeatureObjectLinkage: objectLinkage,
  FeaturePointerSynchronization: pointerSynchronization,
  FeaturePromiseCallback: promiseCallback,
  FeatureRuntimeSafety: runtimeSafety,
  FeatureStreamRedirection: streamRedirection,
  FeatureStructureAcquisition: structureAcquisition,
  FeatureThunkAllocation: thunkAllocation,
  FeatureViewManagement: viewManagement,
  FeatureWasiSupport: wasiSupport,
  FeatureWriteProtection: writeProtection,
  MemberAll: all$1,
  MemberBool: bool,
  MemberFloat: float,
  MemberInt: int,
  MemberLiteral: literal,
  MemberNull: _null,
  MemberObject: object,
  MemberPointerInArray: pointerInArray,
  MemberPointerInStruct: pointerInStruct,
  MemberPrimitive: primitive$1,
  MemberSentinel: sentinel,
  MemberSpecialMethods: specialMethods,
  MemberSpecialProps: specialProps,
  MemberType: type,
  MemberUint: uint,
  MemberUndefined: _undefined,
  MemberUnsupported: unsupported,
  MemberVoid: _void,
  StructureAll: all,
  StructureArgStruct: argStruct,
  StructureArray: array,
  StructureArrayLike: arrayLike,
  StructureEnum: _enum,
  StructureErrorSet: errorSet,
  StructureErrorUnion: errorUnion,
  StructureFunction: _function,
  StructureOpaque: opaque,
  StructureOptional: optional,
  StructurePointer: pointer,
  StructurePrimitive: primitive,
  StructureSlice: slice,
  StructureStruct: struct,
  StructureStructLike: structLike,
  StructureUnion: union,
  StructureVariadicStruct: variadicStruct,
  StructureVector: vector
});

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
    /^getFactoryThunk$/,
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
            /* c8 ignore next 2 */
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
  if (magic !== MagicNumber) {
    throw new Error(`Incorrect magic number: ${magic.toString(16)}`);
  }
  const version = readU32();
  if (version !== Version) {
    throw new Error(`Incorrect version: ${version}`);
  }
  let memoryInitial, memoryMax, tableInitial;
  loop:
  while(!eof()) {
    const type = readU8();
    const len = readU32Leb128();
    if (type === SectionType.Import) {
      const count = readU32Leb128();
      for (let i = 0; i < count; i++) {
        const module = readString();
        const name = readString();
        const type = readU8();
        switch (type) {
          case ObjectType.Function: {
            readU32Leb128();
          } break;
          case ObjectType.Table: {
            readU8();
            const { min } = readLimits();
            if (module === 'env' && name === '__indirect_function_table') {
              tableInitial = min;
              if (memoryInitial !== undefined) break loop;
            }
          } break;
          case ObjectType.Memory: {
            const { min, max } = readLimits();
            if (module === 'env' && name === 'memory') {
              memoryInitial = min;
              memoryMax = max;
              if (tableInitial !== undefined) break loop;
            }
          } break;
          case ObjectType.Global: {
            readU8();
            readU8();
          } break;
          /* c8 ignore next 2 */
          default: {
            throw new Error(`Unknown object type: ${type}`);
          }
        }
      }
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

async function transpile(path, options) {
  const {
    nodeCompat = false,
    embedWASM = true,
    topLevelAwait = true,
    omitExports = false,
    stripWASM = (options.optimize && options.optimize !== 'Debug'),
    keepNames = false,
    moduleResolver = (name) => name,
    wasmLoader,
    sourceFiles,
    ...compileOptions
  } = options;
  if (typeof(wasmLoader) !== 'function') {
    if (embedWASM !== true) {
      throw new Error(`wasmLoader is a required option when embedWASM is false`);
    }
  }
  Object.assign(compileOptions, { arch: 'wasm32', platform: 'wasi', isWASM: true });
  const srcPath = path.endsWith('.zig') ? path : findSourceFile(path, {
    sourceFiles: getAbsoluteMapping(sourceFiles, process.cwd()),
  });
  const { outputPath, sourcePaths } = await compile(srcPath, null, compileOptions);
  const content = await readFile(outputPath);
  const { memoryMax, memoryInitial, tableInitial } = extractLimits(new DataView(content.buffer));
  const multithreaded = compileOptions.multithreaded ?? false;
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
  env.acquireStructures(compileOptions);
  const definition = env.exportStructures();
  const usage = {};
  for (const [ name, mixin ] of Object.entries(mixins)) {
    if (env.mixinUsage.get(mixin)) {
      usage[name] = true;
    }
  }
  usage.FeatureBaseline = true;
  usage.FeatureStructureAcquisition = false;
  usage.FeatureCallMarshalingInbound = env.usingFunctionPointer;
  usage.FeatureCallMarshalingOutbound = env.usingFunction;
  usage.FeatureThunkAllocation = env.usingFunctionPointer && !multithreaded;
  usage.FeaturePointerSynchronization = env.usingFunction || env.usingFunctionPointer;
  if (nodeCompat) {
    usage.FeatureWorkerSupportCompat = multithreaded;
  } else {
    usage.FeatureWorkerSupport = multithreaded;
  }
  const mixinPaths = [];
  for (const [ name, inUse ] of Object.entries(usage)) {
    if (inUse) {
      // change name to snake_case
      const parts = name.replace(/\B([A-Z])/g, ' $1').toLowerCase().split(' ');
      const dir = parts.shift() + 's';
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
    declareFeatures: true,
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
