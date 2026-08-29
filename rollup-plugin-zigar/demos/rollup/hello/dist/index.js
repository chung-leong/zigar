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
  Comptime: 15,
};
const StructurePurpose = {
  Unknown: 0,
  Promise: 1,
  Generator: 2,
  AbortSignal: 3,
  Allocator: 4,
  Iterator: 5,
  File: 6,
  Directory: 7,
  AnyImage: 8,
  WebImage: 9,
  GdImage: 10,
};
const structureNames = Object.keys(StructureType);
const StructureFlag = {
  HasObject: 1 << 1,
  HasPointer: 1 << 2,
  HasSlot: 1 << 3,
  HasProxy: 1 << 4,
};
const StructFlag = {
  IsTuple: 1 << 7};
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
  IsRequired: 1 << 0,
  IsReadOnly: 1 << 1,
  IsPartOfSet: 1 << 2,
  IsSelector: 1 << 3,
  IsMethod: 1 << 4,
  IsExpectingInstance: 1 << 5,
  IsSentinel: 1 << 6,
  IsBackingInt: 1 << 7,
  IsString: 1 << 8,
  IsPlain: 1 << 9,
  IsTypedArray: 1 << 10,
  IsClampedArray: 1 << 11,
};
const ProxyType = {
  Pointer: 1 << 0,
  Slice: 1 << 1,
  Const: 1 << 2,  
  ReadOnly: 1 << 3,
};
const VisitorFlag = {
  IsInactive: 1 << 0,
  IsImmutable: 1 << 1,
  IgnoreUncreated: 1 << 2,
  IgnoreInactive: 1 << 3,
  IgnoreArguments: 1 << 4,
  IgnoreRetval: 1 << 5,
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
  ENOSPC: 51,
  ENOSYS: 52,
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

const zigGobals = globalThis[Symbol.for('ZIGAR')] ??= {};

function __symbol(name) {
  return zigGobals[name] ??= Symbol(name);
}

function symbol(name) {
  return /*@__PURE__*/ __symbol(name);
}

const MEMORY = symbol('memory');
const SLOTS = symbol('slots');
const ZIG = symbol('zig');
const TYPE = symbol('type');
const FLAGS = symbol('flags');
const PROPS = symbol('props');
const SENTINEL = symbol('sentinel');
const ENTRIES = symbol('entries');
const KEYS = symbol('keys');
const ADDRESS = symbol('address');
const LENGTH = symbol('length');
const CACHE = symbol('cache');
const SIZE = symbol('size');
const BIT_SIZE = symbol('bit size');
const ALIGN = symbol('align');
const ENVIRONMENT = symbol('environment');
const ATTRIBUTES = symbol('attributes');
const PRIMITIVE = symbol('primitive');
const SETTERS = symbol('setters');
const TYPED_ARRAY = symbol('typed array');
const THROWING = symbol('throwing');
const PROMISE = symbol('promise');
const GENERATOR = symbol('generator');
const ALLOCATOR = symbol('allocator');
const SIGNATURE = symbol('signature');
const CONTROLLER = symbol('controller');
const READ_ONLY = symbol('read only');
const NO_CACHE = symbol('no cache');

const UPDATE = symbol('update');
const RESTORE = symbol('restore');
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
  };
  const { prototype } = constructor;
  defineProperty(constructor, 'name', defineValue(name));
  for (const mixin of mixins) {
    for (let [ name, object ] of Object.entries(mixin)) {
      if (name === 'init') {
        initFunctions.push(object);
      } else {
        if (typeof(object) === 'function') ; else {
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

function createEnvironment() {
  // define Environment class, incorporating methods and properties in imported mixins
  const Env = defineEnvironment();
  return new Env();
}

class Unsupported extends TypeError {
  errno = PosixError.ENOTSUP;
  hide = true;

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

class NoCastingToFunction extends TypeError {
  constructor() {
    super(`Casting to function is not allowed`);
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

class ReadOnly extends TypeError {
  constructor() {
    super(`Unable to modify read-only object`);
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
  constructor(name, errno = PosixError.ESPIPE) {
    super(`Missing stream method '${name}'`);
    this.errno = errno;
    this.hide = errno === PosixError.ESPIPE;
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
  hide = true;

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
    super(`Deadlock`);
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

function throwNoSupport(feature) {
  throw new Error(`Current platform does not support ${feature}`);
}

function catchPosixError(canWait = false, defErrorNo, run, resolve, reject) {
  const fail = (err) => {
    let result;
    if (reject) {
      result = reject(err);
    } else {
      if (!err.hide) {
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

function checkStreamMethod(stream, name, errno) {
  if (!hasMethod(stream, name)) {
    throw new MissingStreamMethod(name, errno);
  }
}

function expectBoolean(result, errorCode) {
  if (result === true) return PosixError.NONE; 
  if (result === false) return errorCode;
  throw new TypeMismatch('boolean', result);
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

const events = [ 
  'log', 'mkdir', 'stat', 'utimes', 'open', 'rename', 'readlink', 'rmdir', 'symlink', 'unlink'
];

mixin({
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
          if (handle !== undefined) {
            // need to replace dataview with one pointing to Zig memory later,
            // when the VM is up and running
            this.variables.push({ handle, object });
          } else if (offset === undefined) {
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
            if (handle !== undefined) {
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

mixin({
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
        let generatorAlloc;
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
                    // put allocator from the generator into the options object when there's one
                    generatorAlloc = arg.allocator;
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
          if (generatorAlloc) {
            options.allocator = generatorAlloc;
          }
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

mixin({
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

  constructor(arg) {
    super();
    const reader = (arg instanceof ReadableStream) ? arg.getReader() : arg;
    this.reader = reader;
    attachClose(arg, this);
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

  constructor(arg) {
    super();
    let writer;
    if (arg instanceof WritableStream) {
      writer = arg.getWriter();
      // replace close function with one that closes the writer
      arg.close = async () => {
        delete arg.close;
        await writer.close();
        writer.releaseLock();
      };
    } else {
      writer = arg;
    }
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

mixin({
  convertDirectory(arg) {
    if (arg instanceof Map) {
      return new MapDirectory(arg);
    } else if (hasMethod(arg, 'readdir')) {
      return arg;
    }
  }
});

mixin({
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
    if (isInvalidAddress(count)) {
      count = 0;
    }
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

const WA = WebAssembly;

mixin({
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
      if (!this.memory) {
        this.memory = exports.memory;
      }
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
      const f = WA['compile' + suffix];
      const executable = this.executable = await f(res);
      const functions = this.exportFunctions();
      const env = {}, wasi = {}, wasiPreview = {};
      const exports = this.exportedModules = { env, wasi, wasi_snapshot_preview1: wasiPreview };
      for (const { module, name, kind } of WA.Module.imports(executable)) {
        if (kind === 'function') {
          if (module === 'env') {
            env[name] = functions[name] ?? empty;
          } else if (module === 'wasi_snapshot_preview1') {
            wasiPreview[name] = this.getWASIHandler(name);
            if (name === 'fd_write') {
              wasiPreview[`${name}_stderr`] = this.getWASIHandler(`${name}_stderr`);
            }
          } else if (module === 'wasi') {
            wasi[name] = this.getThreadHandler?.(name) ?? empty;
          }
        }
      }
      debugger;
      if (memoryInitial) {
        this.memory = env.memory = new WA.Memory({
          initial: memoryInitial,
          maximum: memoryMax,
          shared: multithreaded,
        });
      }
      if (tableInitial) {
        this.table = env.__indirect_function_table = new WA.Table({
          initial: tableInitial,
          element: 'anyfunc',
          shared: multithreaded,
        });
      }
      this.initialTableLength = tableInitial;
      return WA.instantiate(executable, exports);
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

mixin({
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

mixin({
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

mixin({
  convertReader(arg) {
    if (arg instanceof ReadableStream || arg instanceof ReadableStreamDefaultReader) {
      return new WebStreamReader(arg);
    } else if(typeof(ReadableStreamBYOBReader) === 'function' && arg instanceof ReadableStreamBYOBReader) {
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

mixin({
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

mixin({
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

mixin({
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

zigGobals.proxyMaps ??= [ 
  0, 
  ProxyType.Const, 
  ProxyType.ReadOnly, 
  ProxyType.Const | ProxyType.ReadOnly 
].reduce((hash, type) => {
  hash[type] = new WeakMap();
  return hash;
}, {});
const proxyTargetMap = zigGobals.proxyTargetMap ??= new WeakMap();

function getProxyTarget(arg) {
  if ((typeof(arg) === 'object' || typeof(arg) === 'function') && arg) {
    return proxyTargetMap.get(arg);
  }
}

function removeProxy(arg) {
  const proxy = getProxyTarget(arg);
  return (proxy) ? [ proxy.target, proxy.type ] : [ arg, 0 ];
}

mixin({
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

mixin({
  convertWriter(arg) {
    if (arg instanceof WritableStream || arg instanceof WritableStreamDefaultWriter) {
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

mixin({
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

mixin({
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

mixin({
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

mixin({
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

mixin({
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

mixin({
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

mixin({
  defineToJSON() {
    return {
      value() {
        return normalizeObject(this, true);
      },
    };
  },
});

mixin({
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

mixin({
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
          const fn = template[SLOTS][slot];
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
          if (flags & MemberFlag.IsMethod) {
            const method = function(...args) {
              try {
                let [ self, proxyType ] = removeProxy(this);
                if (flags & MemberFlag.IsExpectingInstance) {
                  if (proxyType === ProxyType.Pointer) {
                    self = self['*'];
                  }
                }
                return fn(self, ...args);
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
          return globalThis[arrayName] ?? throwNoSupport.bind(null, arrayName);
        }        case StructureType.Array:
        case StructureType.Slice:
        case StructureType.Vector:
          return this.getTypedArray(instance.members[0].structure);
      }
    }
  },
});

mixin({
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
    let lastArgOptional = false;
    if (argMembers.length > 0) {
      const lastArgMember = argMembers[argMembers.length - 1];
      if (lastArgMember.structure?.type == StructureType.Struct) {
        let isOptional = true;
        for (const member of lastArgMember.structure.instance.members) {
          if (member.flags & MemberFlag.IsRequired) {
            isOptional = false;
            break;
          }
        }
        if (isOptional) {
          lastArgOptional = true;
        }
      }
    }
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
          if (args.length === length - 1 && lastArgOptional) {
            args = [ ...args, {} ];
          } else {
            throw new ArgumentCountMismatch(length, args.length);
          }
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
  updateArgStructMembers(structure, memberFlags) {
    const {
      constructor: { prototype },
      instance: { members },
    } = structure;
    for (const [ index, member ] of members.entries()) {
      const newFlags = memberFlags[index];
      if (newFlags !== member.flags) {
        member.flags = newFlags;
        const newDescriptor = this.defineMember(member);
        defineProperty(prototype, member.name, newDescriptor);
      }
    }
  },
});

mixin({
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
    staticDescriptors[CONTROLLER] = {
      get() { return structure.static?.template }
    };
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

mixin({
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

mixin({
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
    const thisEnv = this;
    const initializer = this.createInitializer(function(arg, allocator) {
      if (purpose === StructurePurpose.File) {
        arg = thisEnv.createFile(arg);
      } else if (purpose == StructurePurpose.Directory) {
        arg = thisEnv.createDirectory(arg);
      }
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

mixin({
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

mixin({
  clockResGet(clockId, resAddress) {
    this.copyUint64(resAddress, 1000n);
    return PosixError.NONE;
  },
});

mixin({
  clockTimeGet(clockId, precision, timeAddress) {
    const t = (clockId === 0) ? Date.now() : performance.now();
    this.copyUint64(timeAddress, BigInt(Math.ceil(t * 1000000)));
    return PosixError.NONE;
  },
});

mixin({
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

mixin({
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

mixin({
  fdClose(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      this.setStreamLocation?.(fd); 
      return this.destroyStreamHandle(fd);
    });
  },
});

mixin({
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

mixin({
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

mixin({
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

mixin({
  fdFilestatSetSize(fd, newSize, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const entry = this.getStream(fd);
      const [ stream ] = entry;
      checkStreamMethod(stream, 'truncate', PosixError.EINVAL);
      return stream.truncate(safeInt(newSize));
    });    
  },
});

mixin({
  fdFilestatSetTimesEvent: 'utimes',
  fdFilestatSetTimes(fd, atime, mtime, tFlags, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      const target = stream.valueOf();
      const loc = this.getStreamLocation?.(fd);
      const times = extractTimes(atime, mtime, tFlags);
      const flags = {};
      return this.triggerEvent('utimes', { ...loc, target, times, flags });
    }, (result) => (result === undefined) ? PosixError.ENOTCAPABLE : expectBoolean(result, PosixError.EBADF));
  },
});

mixin({
  fdPread(fd, iovsAddress, iovsCount, offset, readAddress, canWait) {
    const le = this.littleEndian;
    const iovsSize = usizeByteSize * 2;
    const ops = [];
    let total = 0;
    return catchPosixError(canWait, PosixError.EIO, () => {        
      const[ reader, rights ] = this.getStream(fd);
      checkAccessRight(rights, PosixDescriptorRight.fd_read);
      checkStreamMethod(reader, 'pread');
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

mixin({
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

mixin({
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

mixin({
  fdPwrite(fd, iovsAddress, iovsCount, offset, writtenAddress, canWait) {
    const le = this.littleEndian;
    const iovsSize = usizeByteSize * 2;
    let total = 0;
    return catchPosixError(canWait, PosixError.EIO, () => {
      const[ writer, rights ] = this.getStream(fd);
      checkAccessRight(rights, PosixDescriptorRight.fd_write);
      checkStreamMethod(writer, 'pwrite');
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

mixin({
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

mixin({
  fdReaddir(fd, bufAddress, bufLen, cookie, bufusedAddress, canWait) {
    if (bufLen < 24) {
      return PosixError.EINVAL;
    }
    let dir, async;
    return catchPosixError(canWait, PosixError.EBADF, () => {
      [ dir ] = this.getStream(fd);
      {
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

mixin({
  fdSeek(fd, offset, whence, newOffsetAddress, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      checkStreamMethod(stream, 'seek');
      return stream.seek(safeInt(offset), whence);
    }, (pos) => this.copyUint64(newOffsetAddress, pos));
  },
});

mixin({
  fdSync(fd, canWait) {
    return catchPosixError(canWait, PosixError.EBADF, () => {
      const [ stream ] = this.getStream(fd);
      if (hasMethod(stream, 'sync')) {
        return stream.sync?.();
      }
    });
  },
});

mixin({
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
    }, () => { 
      if (writtenAddress) {
        this.copyUint32(writtenAddress, total);
      }
    });
  },
  fdWriteStderr(chunk, canWait) {
    catchPosixError(canWait, PosixError.EBADF, () => {
      const[ writer, rights, flags ] = this.getStream(2);
      checkAccessRight(rights, PosixDescriptorRight.fd_write);
      return writer.write(chunk);
    });
    return 0;
  },
});

mixin({
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

mixin({
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

mixin({
  pathFilestatSetTimesEvent: 'utimes',
  pathFilestatSetTimes(dirFd, lFlags, pathAddress, pathLen, atime, mtime, tFlags, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      const times = extractTimes(atime, mtime, tFlags);
      const flags = decodeFlags(lFlags, PosixLookupFlag) ;
      return this.triggerEvent('utimes', { ...loc, times, flags });
    }, (result) => (result === undefined) ? PosixError.ENOTSUP : expectBoolean(result, PosixError.ENOENT));
  },
});

const Right = {
  read: PosixDescriptorRight.fd_read,
  write: PosixDescriptorRight.fd_write,
  readdir: PosixDescriptorRight.fd_readdir,
};

mixin({
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

mixin({
  pathReadlinkEvent: 'readlink',
  pathReadlink(dirFd, pathAddress, pathLen, bufAddress, bufLen, writtenAddress, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('readlink', loc, PosixError.ENOENT);
    }, (result) => {
      if (result === undefined) return PosixError.ENOTSUP;
      if (result === false) return PosixError.ENOENT;
      if (typeof(result) !== 'string') throw new TypeMismatch('string', result);
      const ta = encodeText(result).slice(0, bufLen);
      this.moveExternBytes(ta, bufAddress, this.littleEndian);
      this.copyUint32(writtenAddress, ta.length);
    });
  },
});

mixin({
  pathRemoveDirectory: 'rmdir',
  pathRemoveDirectory(dirFd, pathAddress, pathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('rmdir', loc, PosixError.ENOENT);
    }, (result) => (result === undefined) ? PosixError.ENOTSUP : expectBoolean(result, PosixError.ENOENT));
  },
});

mixin({
  pathRenameEvent: 'rename',
  pathRename(dirFd, pathAddress, pathLen, newDirFd, newPathAddress, newPathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      const { 
        path: newPath, 
        parent: newParent,
      } = this.obtainStreamLocation(newDirFd, newPathAddress, newPathLen);
      return this.triggerEvent('rename', { ...loc, newParent, newPath }, PosixError.ENOENT);
    }, (result) => (result === undefined) ? PosixError.ENOTSUP : expectBoolean(result, PosixError.ENOENT));
  },
});

mixin({
  pathSymlinkEvent: 'symlink',
  pathSymlink(targetAddress, targetLen, dirFd, pathAddress, pathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const targetDV = this.obtainZigView(targetAddress, targetLen, false);
      const targetArray = new Uint8Array(targetDV.buffer, targetDV.byteOffset, targetDV.byteLength);
      const target = decodeText(targetArray).trim();
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('symlink', { ...loc, target }, PosixError.ENOENT);
    }, (result) => (result === undefined) ? PosixError.ENOTSUP : expectBoolean(result, PosixError.ENOENT));
  },
});

mixin({
  pathUnlinkFileEvent: 'unlink',
  pathUnlinkFile(dirFd, pathAddress, pathLen, canWait) {
    return catchPosixError(canWait, PosixError.ENOENT, () => {
      const loc = this.obtainStreamLocation(dirFd, pathAddress, pathLen);
      return this.triggerEvent('unlink', loc, PosixError.ENOENT);
    }, (result) => (result === undefined) ? PosixError.ENOTSUP : expectBoolean(result, PosixError.ENOENT));
  },
});

mixin({
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

mixin({
  procExit(code) {
    throw new Exit(code);
  }
}) ;

mixin({
  randomGet(bufAddress, bufLen) {
    const dv = createView(bufLen);
    for (let i = 0; i < bufLen; i++) {
      dv.setUint8(i, Math.floor(256 * Math.random()));
    }
    this.moveExternBytes(dv, bufAddress, true);
    return 0;
  }
}) ;

// structure defaults
const s = {
  constructor: null,
  type: 0,
  purpose: 0,
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

// member defaults
const m = {
  type: 0,
  flags: 0,
};

// declare structure objects
const s0 = {}, s1 = {}, s2 = {}, s3 = {};

// declare objects
const o0 = {}, o1 = {}, o2 = {};

// define byte arrays
const U = i => new Uint8Array(i);
const a0 = U(0);

// fill in object properties
const $ = Object.assign;
$(o0, {
  memory: { array: a0 },
  handle: 7,
});
$(o1, {
  slots: {
    0: o2,
  },
});
$(o2, {
  structure: s2,
  memory: { array: a0 },
  handle: 6,
});

// fill in structure properties
$(s0, {
  ...s,
  flags: 1,
  signature: 0xcb1f69cbe6954c96n,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        bitSize: 0,
        byteSize: 0,
        bitOffset: 0,
        structure: s0,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "void",
});
$(s1, {
  ...s,
  type: 12,
  signature: 0x40adc7ecdd97ab0an,
  length: 0,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        flags: 1,
        bitOffset: 0,
        bitSize: 0,
        byteSize: 0,
        slot: 0,
        structure: s0,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "Arg(fn () void)",
});
$(s2, {
  ...s,
  type: 14,
  signature: 0x05c7f70f8b06ca4cn,
  length: 0,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        structure: s1,
      },
    ],
    template: o0
  },
  static: {
    members: [],
  },
  name: "fn () void",
});
$(s3, {
  ...s,
  name: "hello",
  type: 2,
  flags: 256,
  signature: 0xa8a31dac43a38551n,
  byteSize: 0,
  align: 1,
  instance: {
    members: [],
  },
  static: {
    members: [
      {
        ...m,
        name: "hello",
        type: 5,
        flags: 2,
        slot: 0,
        structure: s2,
      },
    ],
    template: o1
  },
});
const structures = [
  s0, s1, s2, s3,
];
const root = s3;
const settings = {
  runtimeSafety: false,
  littleEndian: true,
  ioRedirection: true,
  libc: true,
};

// create runtime environment
const env = createEnvironment();

// recreate structures
env.recreateStructures(structures, settings);

// initiate loading and compilation of WASM bytecodes
const source = (async () => {
  // hello.zig
  const binaryString = atob("AGFzbQEAAAABugInYAN/f38Bf2ADf35/AX5gAX8Bf2AFf39/f38AYAAAYAN/f38AYAZ/f39/f38Bf2AEf39/fwF/YAZ/f39/f38AYAF/AGACf38AYAl/f39/f39/f34AYAN/f34Bf2AIf39/f39/f34AYAd/f39/f39/AGACf38Bf2AAAX9gAn5/AX9gA39+fwF/YAJ/fgF/YAR/fn5/AX9gBX9/f35/AX9gBH9+f38Bf2AFf39/f38Bf2AHf39/f35+fwF/YAd/f39/f39/AX9gCX9/f39/fn5/fwF/YAZ/f39+fn8Bf2AIf39/f35+f38Bf2AEf39/fgF/YAR/f39/AGABfwF+YAABfmAGf39/f39+AGAIf39/f39/f38Bf2AIf39/f39/f38AYAZ/fn5+fn8AYAV/fn5+fgBgBH5+fn8BfgKuCiQDZW52GV9faW5kaXJlY3RfZnVuY3Rpb25fdGFibGUBcACAAQNlbnYNX2Rpc3BsYXlQYW5pYwAKFndhc2lfc25hcHNob3RfcHJldmlldzEKcmFuZG9tX2dldAAPFndhc2lfc25hcHNob3RfcHJldmlldzELZW52aXJvbl9nZXQADxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxEWVudmlyb25fc2l6ZXNfZ2V0AA8Wd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQ1jbG9ja19yZXNfZ2V0AA8Wd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQ5jbG9ja190aW1lX2dldAASFndhc2lfc25hcHNob3RfcHJldmlldzENZmRfZmRzdGF0X2dldAAPFndhc2lfc25hcHNob3RfcHJldmlldzEPZmRfZmlsZXN0YXRfZ2V0AA8Wd2FzaV9zbmFwc2hvdF9wcmV2aWV3MRRmZF9maWxlc3RhdF9zZXRfc2l6ZQATFndhc2lfc25hcHNob3RfcHJldmlldzEVZmRfZmlsZXN0YXRfc2V0X3RpbWVzABQWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF9wcmVhZAAVFndhc2lfc25hcHNob3RfcHJldmlldzEOZmRfcHJlc3RhdF9nZXQADxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxE2ZkX3ByZXN0YXRfZGlyX25hbWUAABZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCWZkX3B3cml0ZQAVFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfcmVhZAAHFndhc2lfc25hcHNob3RfcHJldmlldzEHZmRfc2VlawAWFndhc2lfc25hcHNob3RfcHJldmlldzEIZmRfd3JpdGUABxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxFXBhdGhfY3JlYXRlX2RpcmVjdG9yeQAAFndhc2lfc25hcHNob3RfcHJldmlldzERcGF0aF9maWxlc3RhdF9nZXQAFxZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxF3BhdGhfZmlsZXN0YXRfc2V0X3RpbWVzABgWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQlwYXRoX2xpbmsAGRZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxCXBhdGhfb3BlbgAaFndhc2lfc25hcHNob3RfcHJldmlldzENcGF0aF9yZWFkbGluawAGFndhc2lfc25hcHNob3RfcHJldmlldzEVcGF0aF9yZW1vdmVfZGlyZWN0b3J5AAAWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQtwYXRoX3JlbmFtZQAGFndhc2lfc25hcHNob3RfcHJldmlldzEMcGF0aF9zeW1saW5rABcWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MRBwYXRoX3VubGlua19maWxlAAAWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQlwcm9jX2V4aXQACRZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC3BvbGxfb25lb2ZmAAcWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9zeW5jAAIWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQpmZF9yZWFkZGlyABUDZW52DF9maW5kSnNUaHVuawAPA2VudgxfZnJlZUpzVGh1bmsADwNlbnYQX2FsbG9jYXRlSnNUaHVuawAPFndhc2lfc25hcHNob3RfcHJldmlldzEIZmRfY2xvc2UAAgObApkCBBcEEA8PDxIPDxMUFQ8AFQcWBw8HGxccFw8HAA8JDw8CDx0dDxMCAR0dAA8JBAQPBwAABwcHBw8PDwAXBwAAAgIPDw8PBwAAAAAHBwAABwAHAAcHBxcHDw8AAAQEAgAAARAEAgcHBAoABA8JBwoFCgUOBQUABQkKDwUCBQoJCgUFBR4FAA8AHh4eBQUP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CBCIAUEBcQ0EAkAgByAJQbaPEEEOEIgBQQFxRQ0AIABBAToA/wQMBgsgByAJQaCPEEEMEIgBQQFxRQ0FIABBADsB+AQgC0EBRg0DAkACQCAKQQFqIgwtAABBVWoOAwADAQMLIAFBCGogCkECaiALQX5qEKIBIAEpAwgiDUIgiKchDiANpyEPDAMLQegAIQ5BACEPIAtBfmoiDEUNAiABQQA2AiQgCkECai0AAEHfAEYNAiAHIAtqIAlqQX9qLQAAQd8ARg0CA0ACQAJAAkACQCAMRQ0AIAgtAAAiCUHfAEYNAyABQShqIAlBChCjASABLwEoIg4NByABLQAqIQkCQCABKAIkQf////8HcSILDQACQCAJQf8BcQ0AQQAhCSABQQA2AjAMBAtBASEODAgLIAFBCjYCLCABIAutQgp+Ig2nIgtB/////wdxNgI8IAEgC0EfdiANQiCIp0EAR3IiCzoAOCALDQEgASAJQf8BcSIJNgI0IAEgASgCPEH/////B3EiCzYCJCABIAsgCWsiCUH/////B3EiCzYCPCABIAsgCUc6ADggCyAJRw0BIAEoAjwhCQwCCyABIAEoAiRB/////wdxIg82AhRBACEODAYLQQEhDgwFCyABIAlB/////wdxNgIkCyAMQX9qIQwgCEEBaiEIDAALCyAAQQE6AJIFDAYLIAFBGGogDCALQX9qEKIBIAEpAxgiDUIgiKchDiANpyEPCyAOQf//A3ENACAAQQE6APQEIAAgD0H/////B3E2AvAEDAILIANBCGpBACgC+JsQNgIAIANBACkC8JsQNwIADAELIABBAToA/gQLIAZBAWohBgwACwsgAkEANgIAIAFBwABqJAALAwAAC5cDAgN/AX4jAEEgayIDJAACQAJAIAINACAAQoCAgICADTcCAAwBCyADQQA2AggCQCABLQAAQd8ARg0AIAEgAmpBf2otAABB3wBGDQADQAJAAkACQCACRQ0AIAEtAAAiBEHfAEcNAQwCCyAAQQA7AQQgACADKAIIQf////8HcTYCAAwECyADQQxqIARBChCjAQJAIAMvAQwiBEUNACAAIAQ7AQQMBAsgAy0ADiEEAkACQCADKAIIQf////8HcSIFDQBBACEFDAELIANBCjYCECADIAWtQgp+IganIgVB/////wdxNgIcIAMgBUEfdiAGQiCIp0EA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AgkKDQsgACABNgIAIABBADsBBAwPCyAAQRE7AQQMDgsgAEEROwEEDA0LIABCgICAgOABNwIADAwLIABCgICAgMABNwIADAsLIABBETsBBAwKCyAAQoCAgIAwNwIADAkLIABCgICAgMAANwIADAgLIABCgICAgNAANwIADAcLIABCgICAgJABNwIADAYLIABCgICAgKABNwIADAULIABBETsBBAwECyAAQoCAgIDwADcCAAwDCyADQTNGDQELIABBETsBBAwBCyAAQoCAgIDgADcCAAsgB0GAAWokAAslAAJAA0AgAkUNASABKAIAEM8BIAFBCGohASACQX9qIQIMAAsLCwgAIAAQ0gEaCzwBAX8jAEGAAWsiAyQAIAMgAyACENEBAkAgAy8BcCICDQAgACADKQNQNwMACyAAIAI7AQggA0GAAWokAAuiAgECfyMAQZACayIDJAAgAigCACECAkACQAJAAkACQAJAA0ACQEGQAUUNACADQYABakEAQZAB/AsACyACIANBgAFqEE5Bf0cNAUEAKALkrhAiBEH//wNxQRtGDQALIAQOAwADAQILIANBEGogA0GAAWoQ0wFBACECDAQLAkBB8ABFDQAgA0EQakHgoBBB8AD8CgAACyADQgA3AQYgA0IANwMAQQghAgwDCyAEQTBGDQELQREhAgwBCwJAQfAARQ0AIANBEGpB4J8QQfAA/AoAAAsgA0IANwEGIANCADcDAEELIQILAkBB8ABFDQAgACADQRBqQfAA/AoAAAsgACACOwFwIAAgAykDADcBciAAQfgAaiADKQEGNwEAIANBkAJqJAALGwACQCAAECIiAA0AQQAPC0EAIAA2AuSuEEF/C9YCAgJ/CX4jAEEwayICJAAgAEEBOgAQIAAgASkDCDcDQCAAIAEpAxA3A0ggACABKQMwNwNQIAAgASgCGCIDNgJYIAIgASkDSCIEIARCP4dCgJTr3ANCABC4AiACQRBqIAEpA1giBCAEQj+HQoCU69wDQgAQuAIgAkEgaiABKQNoIgQgBEI/h0KAlOvcA0IAELgCIAAgAikDICIEIAE0AnAiBXwiBjcDMCAAIAIpAxAiByABNAJgIgh8Igk3AyAgACACKQMAIgogATQCUCILfCIMNwMAIAAgAikDKCAFQj+HfCAGIARUrXw+AjggACACKQMYIAhCP4d8IAkg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KQIAIgSnIAJBAEEAIARCIIinKAIAEQcAIgEbIAGthCEEIAFFDQELIAMgAjYCFCADIAQ+AhAgA0EAOwEYIANBEGohAgwBCyADIARCIIg9AQwgA0EEaiECCyAAIAIpAgA3AgAgAEEIaiACQQhqKAIANgIAIANBIGokAAv7AQEEfyMAQRBrIgQkACAEIAJBH3E6AA9BACEFAkBBfyABQQRqIgYgBiABSRsiAUEBIAJ0IgIgASACSxsiAUF/amciAkUNAAJAAkBBICACayICQf//A3FBfWoiBkENTw0AQgEgAq1C//8Dg4anIQcgBkECdCICKALktxAiAUUNASACQeS3EGogByABakF8aigCADYCACABIQUMAgsgAUGDgARqQRB2EJ0CIQUMAQsgAkGwtxBqIQECQCACKAKwtxAiAkH//wNxDQBBARCdAiICRQ0BIAEgAiAHajYCACACIQUMAQsgASACIAdqNgIAIAIhBQsgBEEQaiQAIAULYAECf0IBQSAgAEF/amdrIgCtQv//A4OGpyEBAkAgAEH//wNxQQJ0IgIoApi4ECIARQ0AIAJBmLgQaiABQRB0IABqQXxqKAIANgIAIAAPC0EAIAFAACIAQRB0IABBf0YbCxkAIAFBACAEIAQgAiADIAQgBBCfAkEBcRsL1AEBAn8jAEEQayIGJAAgBiADQR9xOgAPQX8gBEEEaiIHIAcgBEkbIgRBASADdCIDIAQgA0sbIQQCQAJAAkAgAkEEaiICIAMgAiADSxsiA0F/amciAkFvakEMSw0AIARBf2pnIgMNAUEAIQMMAgtCAUEgIANBg4AEakEQdkF/amdrrUL//wODhqdCAUEgIARBg4AEakEQdkF/amdrrUL//wODhqdGIQMMAQtCAUEgIAJrrUL//wODhqdCAUEgIANrrUL//wODhqdGIQMLIAZBEGokACADCz0BAX8jAEEQayIDJAAgA0EIahChAiADKAIIIAAgASACQQEgAkEBSxtoQQAgAygCDCgCDBEDACADQRBqJAALkwECAX8BfiMAQSBrIgEkAAJAQQAtAOC4EA0AIAFBACkDgKgQIgI3AwggAUEUaiABQQhqQYCABBCbAkEAQQE6APy4EEEAIAI3A+i4EEEAQQE6AOC4EEEAQZioEDYC3LgQQQBB6LgQNgLYuBBBACABKQIUNwL0uBBBAEEANgLwuBALIABBACkD2LgQNwIAIAFBIGokAAtYAQF/AkACQCABIAAoAgwiBUkNACAAKAIQIAVqIAFNDQAgASACaiAFIAAoAggiAWpHDQEgACABIAJrNgIIDwsgACgCACABIAIgAyAEIAAoAgQoAgwRAwALC00BAX8CQCABIAAoAgwiBkkNACAAKAIQIAZqIAFNDQAgAEEIaiABIAIgAyAEIAUQpAIPCyAAKAIAIAEgAiADIAQgBSAAKAIEKAIIEQYACxkAIAFBACAAIAEgAiABIAQgARClAkEBcRsLVAACQAJAIAEgAmogACgCBCAAKAIAIgFqRg0AIAQgAk0hAgwBCyABIAQgAmtqIQECQCAEIAJNDQBBACECIAEgACgCCEsNAQsgACABNgIAQQEPCyACC50BAQd/IwBBEGsiBCQAIAQgAkEfcSIFOgALIAAoAgQhBiAAKAIAIQdBACEIQQAhCQJAAkACQCAFRQ0AIARBASACdCIJIAYgB2oiAmpBf2oiCiACSSIFOgAMIAUNASAKQQAgCWtxIAJrIQkLIAkgB2oiAiABaiIHIAAoAghLDQEgACAHNgIAIAYgAmohCAwBC0EAIQgLIARBEGokACAIC00BAX8CQCABIAAoAgwiBkkNACAAKAIQIAZqIAFNDQAgAEEIaiABIAIgACAEIAAQpQIPCyAAKAIAIAEgAiADIAQgBSAAKAIEKAIEEQYACzMBAX8CQCAAQQhqIAEgAiAAEKYCIgQNACAAKAIAIAEgAiADIAAoAgQoAgARBwAhBAsgBAs/AQF/IwBBEGsiAiQAIAJBCGoQoQIgAigCCCAAIAFBASABQQFLG2hBACACKAIMKAIAEQcAIQEgAkEQaiQAIAELCwBBAEEBOgCAuRALVwEDfyMAQRBrIgIkAEEAIQNBAC0AgLkQIQQgAkEIakECIAEgABEFAAJAAkAgAi8BDA0AIAIoAgghAwwBCyAEQQFxRQ0AIAAgARAfIQMLIAJBEGokACADC1cBA38jAEEQayICJABBACEDQQAtAIC5ECEEIAJBCGpBASABIAARBQACQAJAIAIvAQwNACACKAIIIQMMAQsgBEEBcUUNACAAIAEQICEDCyACQRBqJAAgAwtXAQN/IwBBEGsiAiQAQQAhA0EALQCAuRAhBCACQQhqQQAgASAAEQUAAkACQCACLwEMDQAgAigCCCEDDAELIARBAXFFDQAgACABECEhAwsgAkEQaiQAIAMLMwACQCABIAJBASACGyADQQEgAhsgBCAAEQcAQf//A3EiAg0AQQAoAsyQEBCGARoLIAJFCyoAAkAgASACQQEgAhsgABEPAEH//wNxIgINAEEAKALMkBAQhgEaCyACRQs+AQN/AkAgARC1AiICQQFqIgNFDQBBACEEA0AgACAEaiABIARqLQAAOgAAIARBAWoiBCADSQ0ACwsgACACagsMACAAIAEQsAIaIAALOQEBfwJAIAAgAEEQakEEIAAQnAIiAUUNACABIACtQgWGQgSENwMIIAFBEGoPC0EAQTA2AuSuEEEAC1EDAX8BfgJ/IwBBEGsiASQAAkAgAEUNACABIABBeGopAwAiAqciA0EfcToADyAAIABBASADdCIEayAEIAJCBYinaiADIAAQmgILIAFBEGokAAuGAQICfwF+IwBBEGsiAiQAQQAhAyACIACtIAGtfiIEQiCIpyIBQQBHOgAMAkACQAJAIAENACAEpyIBELICIgANAQwCC0EAIQNBAEEwNgLkrhAMAQsCQCABRQ0AQQAhAwNAIAAgA2pBADoAACADQQFqIgMgAUkNAAsLIAAhAwsgAkEQaiQAIAMLJwEDf0EAIQEDQCAAIAFqIQIgAUEBaiIDIQEgAi0AAA0ACyADQX9qC0ABAn8DQAJAIAINAEEADwsgAkF/aiECIAEtAAAhAyAALQAAIQQgAUEBaiEBIABBAWohACAEIANrIgNFDQALIAMLnQECAX8CfiMAQSBrIgYkACAFQQA2AgAgBkEQaiABIAIgAyAEELgCIAYpAxghByAGKQMQIQgCQAJAAkAgAkJ/VQ0AIAMgBEKAgICAgICAgIB/hYRQDQELIAEgAoRQDQEgBiAIIAcgASACELsCIAYpAwAgA4UgBikDCCAEhYRQDQELIAVBATYCAAsgACAINwMAIAAgBzcDCCAGQSBqJAALdQEBfiAAIAQgAX4gAiADfnwgA0IgiCICIAFCIIgiBH58IANC/////w+DIgMgAUL/////D4MiAX4iBUIgiCADIAR+fCIDQiCIfCADQv////8PgyACIAF+fCIBQiCIfDcDCCAAIAFCIIYgBUL/////D4OENwMAC+4DAgF/A34jAEHQAGsiBiQAAkACQAJAAkAgASADWiACIARaIAIgBFEbDQAgBUUNASAFIAE3AwAgBSACNwMIDAELAkAgBFANAAJAIAR5IgdQRQ0AQgAhCEIBIQcgBUUNBCAFIAEgA303AwAgBSACIAR9IAEgA1StfTcDCAwECyAGQRBqIANCACACQgAgB30iCIggASAIiCACIAeGhCADIAiIIAQgB4aEIAZBMGoQugIiB0IAELgCIAYgBEIAIAdCABC4AiAGIAYpAwAiCSAGKQMYfCIIIAlUOgA4IAYpAxAhCQJAAkACQCAGKQMIIAYxADhCAYOEQgBSDQAgCCACVg0AIAggAlINASAJIAFYDQELIAYgCSADfSIDIAlWOgBAIAdCf3whByAIIAQgBjEAQEIBg3x9IQgMAQsgCSEDCyAFRQ0CIAUgASADfSIENwMAIAYgBCABVjoASCAFIAIgCCAGMQBIQgGDfH0iAjcDCCAGIAQ3AyAgBiACNwMoDAILQgAhCCAGQgA3AygCQCACIANUDQAgAiACIAOAIgggA359IQILIAIgASADIAZBIGoQugIhByAFRQ0CIAUgBikDKDcDCCAFIAYpAyA3AwAMAgtCACEHC0IAIQgLIAAgBzcDACAAIAg3AwggBkHQAGokAAuWAgEGfgJAIAJ5IgRCP4MiBUIAUQ0AIAAgBYYgAUIAIAR9iIQhACABIAWGIQEgAiAFhiECCyAAIAAgAkIgiCIGgCIEIAZ+fSEHIAFC/////w+DIQggAUIgiCEBIAJC/////w+DIQkCQANAAkAgBEL/////D1YNACAEIAl+IAdCIIYgAYRYDQILIARCf3whBCAHIAZ8IgdC/////w9YDQALCyAAQiCGIAGEIAQgAn59IgAgACAGgCIHIAZ+fSEBAkADQAJAIAdC/////w9WDQAgByAJfiABQiCGIAiEWA0CCyAHQn98IQcgASAGfCIBQoCAgIAQVA0ACwsgAyAAQiCGIAiEIAcgAn59IAWINwMAIAcgBEIghnwLkAEBAn8jAEEQayIFJAAgBUIAIAF9IAEgAkIAUyIGG0IAIAIgAUIAUq18fSACIAYbQgAgA30gAyAEQgBTIgYbQgAgBCADQgBSrXx9IAQgBhtBABC5AiAFKQMIIQMgACAFKQMAIAQgAoVCP4ciBIUiAiAEfTcDACAAIAMgBIUgBH0gAiAEVK19NwMIIAVBEGokAAsL8S4CAEGAgBALyCh9ACB7AERpck5vdEVtcHR5AFBpcGVCdXN5AEZpbGVCdXN5AERldmljZUJ1c3kAT3V0T2ZNZW1vcnkAUHJvdG9jb2xVbnN1cHBvcnRlZEJ5QWRkcmVzc0ZhbWlseQBPdmVyZmxvdwBJbnB1dE91dHB1dABUaW1lb3V0AHNsb3QATm9TcGFjZUxlZnQAYml0T2Zmc2V0AHN0cnVjdABVbnJlY29nbml6ZWRGb3JtYXQAUGF0aEFscmVhZHlFeGlzdHMATWFwcGluZ0FscmVhZHlFeGlzdHMARmFzdE9wZW5BbHJlYWR5SW5Qcm9ncmVzcwBtZW1iZXJzAGZsYWdzAFN5c3RlbVJlc291cmNlcwBOb3REaXIASXNEaXIASW52YWxpZENoYXJhY3RlcgBDb25uZWN0aW9uUmVzZXRCeVBlZXIAU3ltTGlua0xvb3AAaGVsbG8ATmV0d29ya0Rvd24AVW5zdXBwb3J0ZWRPcGVyYXRpb24ATG9ja1Zpb2xhdGlvbgBhbGlnbgBQcm90b2NvbFVuc3VwcG9ydGVkQnlTeXN0ZW0AUmVhZE9ubHlGaWxlU3lzdGVtAEVuZE9mU3RyZWFtAEJsb2NrZWRCeUZpcmV3YWxsAHJldHZhbABOb3RMaW5rAFdvdWxkQmxvY2sAbGVuZ3RoAEludmFsaWRCYXRjaFNjcmlwdEFyZwBOYW1lVG9vTG9uZwBOb3RPcGVuRm9yV3JpdGluZwBFbnZpcm9ubWVudFZhcmlhYmxlTWlzc2luZwBTb2NrZXROb3RMaXN0ZW5pbmcAU3RyZWFtaW5nAENvbm5lY3Rpb25QZW5kaW5nAE5vdE9wZW5Gb3JSZWFkaW5nAEZpbGVUb29CaWcAMDEyMzQ1Njc4OWFiY2RlZgBTZWN0aW9uT3ZlcnNpemUATWVzc2FnZU92ZXJzaXplAGJpdFNpemUAYnl0ZVNpemUASW52YWxpZEV4ZQB0ZW1wbGF0ZQBwdXJwb3NlAEFkZHJlc3NJblVzZQBzdHJ1Y3R1cmUAVW5hYmxlVG9HZXRTdHJ1Y3R1cmUAc2lnbmF0dXJlAE5hbWVTZXJ2ZXJGYWlsdXJlAFByb3RvY29sRmFpbHVyZQBIYXJkd2FyZUZhaWx1cmUAdHlwZQBVbnN1cHBvcnRlZFJlcGFyc2VQb2ludFR5cGUAQnJva2VuUGlwZQBVbnJlY29nbml6ZWRWb2x1bWUAbmFtZQBVbmtub3duSG9zdE5hbWUAQmFkUGF0aE5hbWUASW52YWxpZE5hbWUAVE9ETyBpbXBsZW1lbnQgbmV0V3JpdGVGaWxlAE5vblJlc2l6YWJsZQBFbnRyb3B5VW5hdmFpbGFibGUAQ29uY3VycmVuY3lVbmF2YWlsYWJsZQBBZGRyZXNzVW5hdmFpbGFibGUAQ2xvY2tVbmF2YWlsYWJsZQBVbnNlZWthYmxlAEhvc3RVbnJlYWNoYWJsZQBQb3J0VW5yZWFjaGFibGUATmV0d29ya1VucmVhY2hhYmxlAEFudGl2aXJ1c0ludGVyZmVyZW5jZQBpbnN0YW5jZQBDcm9zc0RldmljZQBOb0RldmljZQBOb3RUZXJtaW5hbERldmljZQBJbnZhbGlkRG5zQ25hbWVSZWNvcmQASW52YWxpZERuc0FSZWNvcmQASW52YWxpZERuc0FBQUFSZWNvcmQAUHJvY2Vzc05vdEZvdW5kAE5ldHdvcmtOb3RGb3VuZABGaWxlTm90Rm91bmQASW50ZXJmYWNlTm90Rm91bmQAU29ja2V0Tm90Qm91bmQAZm4gKCkgdm9pZABBZGRyZXNzRmFtaWx5VW5zdXBwb3J0ZWQARmlsZUxvY2tzVW5zdXBwb3J0ZWQAT3B0aW9uVW5zdXBwb3J0ZWQAT3BlcmF0aW9uVW5zdXBwb3J0ZWQAU29ja2V0TW9kZVVuc3VwcG9ydGVkAENvbm5lY3Rpb25BYm9ydGVkAFVuaW1wbGVtZW50ZWQAVW5leHBlY3RlZABTb2NrZXRVbmNvbm5lY3RlZABDb25uZWN0aW9uUmVmdXNlZABDbG9zZWQATm9BZGRyZXNzUmV0dXJuZWQARGV0ZWN0aW5nTmV0d29ya0NvbmZpZ3VyYXRpb25GYWlsZWQAV3JpdGVGYWlsZWQAUmVzb2x2Q29uZlBhcnNlRmFpbGVkAFJlYWRGYWlsZWQAQ2FuY2VsZWQAQ3VycmVudERpclVubGlua2VkAEFjY2Vzc0RlbmllZABQZXJtaXNzaW9uRGVuaWVkAFJlc291cmNlTGltaXRSZWFjaGVkAExvY2tlZE1lbW9yeUxpbWl0RXhjZWVkZWQATGlua1F1b3RhRXhjZWVkZWQAUHJvY2Vzc0ZkUXVvdGFFeGNlZWRlZABTeXN0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AAAAAAAAAAAAAAAAADYAAAAAAQEBAAAAAAAAAAAAAAEAAAAAAAAAAAA2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHQAAAAAAAAAAAAAAAAAAAP7///8AAAAAAAAAAAAAAAD/////AAAAAAAAAQAAAAAAAAAAAAAAAAAxAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAMQAAAAAAAAAAAAAACAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAHwAAAAAAAAAAAAAAKgAAAAAAAAAAAAAAIwAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAJAAAAAAAAAAAAAAADwAAAAAAAAAAAAAALAAAAAAAAAAAAAAACwAAAAAAAAAAAAAABgAAAAAAAAAAAAAALQAAAAAAAAAAAAAACQAAAAAAAAAAAAAAKQAAAAAAAAAAAAAABwAAAAAAAAAAAAAANAAAAAAAAAAAAAAADgAAAAAAAAAAAAAAEAAAAAAAAAAAAAAALgAAAP8BAAABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEQAAAAAAAAABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmAAAARXJyb3IgZWNvdW50ZXJlZCBkdXJpbmcgZXhwb3J0IHByb2Nlc3NzOiAKAABIZWxsbyB3b3JsZCERCAQAAAAAAAAAAABwAAAAcQAAAHIAAABzAAAAdAAAAHUAAAB2AAAAdwAAAAAAAAAIFAQAeAAAAHkAAAB6AAAAewAAAHwAAAB9AAAAfgAAAH8AAAADAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAABAAAAAgAAAABByKgQC5gG0QcEAAAAAAAFAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAEAAAAmBcEAAAEAAAAAAAAAAAAAAEAAAAAAAAACgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUBQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAADwEwQAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4BMEAAAAAAAAAAAAAAAAAAAAAAD/////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3BMEAAAAAAAAAAAAAAAAABsAAAAAAAAAAAAAAP////8AAAAAAAAAAAAAAQAAAAAA");
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  await new Promise(r => setTimeout(r, 0));
  return bytes.buffer;
})();
env.loadModule(source, {"delay":false,"tableInitial":128,"multithreaded":false});
env.linkVariables(false);

// export root namespace and its methods and constants
const { constructor: v0 } = root;
const v1 = env.getSpecialExports();
const {
  hello: v2,
} = v0;
await v1.init();

export { v1 as __zigar, v0 as default, v2 as hello };
