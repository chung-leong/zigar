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
  File: 6,
  Directory: 7,
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
  IsTuple: 1 << 7};
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
  ENOTSUP: 58,
  EPERM: 63,
  ESPIPE: 70,
  ENOTCAPABLE: 76,
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
  path_open: 1 << 13,
  fd_readdir: 1 << 14,
  path_filestat_get: 1 << 18,
  path_filestat_set_size: 1 << 19,
  path_filestat_set_times: 1 << 20,
  fd_filestat_get: 1 << 21,
  fd_filestat_set_size: 1 << 22,
  fd_filestat_set_times: 1 << 23,
  path_remove_directory: 1 << 25,
  path_unlink_file: 1 << 26};
const PosixDescriptor = {
  stdin: 0,
  stdout: 1,
  stderr: 2,
  root: -1,

  min: 0x00f0_0000,
  max: 0x00ff_ffff, 
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
const PARENT = symbol('parent');
const ZIG = symbol('zig');
const TYPE = symbol('type');
const FLAGS = symbol('flags');
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

BigInt(Number.MAX_SAFE_INTEGER);
BigInt(Number.MIN_SAFE_INTEGER);

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

function isCompatibleType(TypeA, TypeB) {
  return (TypeA === TypeB)
      || ((TypeA?.[SIGNATURE] === TypeB[SIGNATURE]) && (TypeA?.[ENVIRONMENT] !== TypeB?.[ENVIRONMENT]));
}

function isCompatibleInstanceOf(object, Type) {
  return (object instanceof Type) || isCompatibleType(object?.constructor, Type);
}

function isPromise(object) {
  return typeof(object?.then) === 'function';
}

function markAsSpecial({ get, set }) {
  get.special = set.special = true;
  return { get, set };
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

// handle retrieval of accessors

mixin({
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

// handles bools, including implicit ones in optional pointers, where an address
// of zero would be treated as boolean false

mixin({
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

class InvalidIntConversion extends SyntaxError {
  constructor(arg) {
    super(`Cannot convert ${arg} to an Int`);
  }
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

mixin({
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
    importFunctions(exports$1) {
      if (!this.memory) {
        this.memory = exports$1.memory;
      }
      for (const [ name, { argType, returnType } ] of Object.entries(this.imports)) {
        const fn = exports$1[name];
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
      const exports$1 = this.exportedModules = { env, wasi, wasi_snapshot_preview1: wasiPreview };
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
      return WA.instantiate(executable, exports$1);
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

const proxyMaps = zigGobals.proxyMaps ??= [ 
  0, 
  ProxyType.Const, 
  ProxyType.ReadOnly, 
  ProxyType.Const | ProxyType.ReadOnly 
].reduce((hash, type) => {
  hash[type] = new WeakMap();
  return hash;
}, {});
const proxyTargetMap = zigGobals.proxyTargetMap ??= new WeakMap();

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
    if (!object?.[MEMORY] || typeof(object) !== 'object' || object[READ_ONLY]) {
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
  defineMemberBool(member) {
    return this.defineMemberUsing(member, this.getAccessor);
  },
});

mixin({
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

mixin({
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

mixin({
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

mixin({
  defineMemberUint(member) {
    let getAccessor = this.getAccessor;
    if (this.runtimeSafety) {
      getAccessor = this.addRuntimeCheck(getAccessor);
    }
    getAccessor = this.addIntConversion(getAccessor);
    return this.defineMemberUsing(member, getAccessor);
  },
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
          return globalThis[arrayName];
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

mixin({
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

mixin({
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

mixin({
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

mixin({
  definePointer(structure, descriptors) {
    const {
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
        const self = function(...args) {
          const f = self['*'];
          return f.call(this, ...args);
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

mixin({
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

mixin({
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

mixin({
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
const s0 = {}, s1 = {}, s2 = {}, s3 = {}, s4 = {}, s5 = {}, s6 = {}, s7 = {}, s8 = {}, s9 = {};
const s10 = {};

// declare objects
const o0 = {}, o1 = {}, o2 = {}, o3 = {}, o4 = {}, o5 = {}, o6 = {}, o7 = {}, o8 = {}, o9 = {};
const o10 = {}, o11 = {}, o12 = {};

// define byte arrays
const U = i => new Uint8Array(i);
const a0 = U([ 0, 1 ]);
const a1 = U(0);
const a2 = U(3);
const a3 = U(1);

// fill in object properties
const $ = Object.assign;
$(o0, {});
$(o1, {
  memory: { array: a0 },
});
$(o2, {});
$(o3, {
  slots: {
    0: o4, 1: o6, 2: o7,
  },
});
$(o4, {
  structure: s2,
  memory: { array: a1 },
  slots: {
    0: o5,
  },
});
$(o5, {
  structure: s0,
});
$(o6, {
  structure: s5,
  memory: { array: a2 },
});
$(o7, {
  structure: s3,
  memory: { array: a3 },
});
$(o8, {});
$(o9, {});
$(o10, {
  memory: { array: a1 },
  handle: 3,
});
$(o11, {
  slots: {
    0: o12,
  },
});
$(o12, {
  structure: s9,
  memory: { array: a1 },
  handle: 2,
});

// fill in structure properties
$(s0, {
  ...s,
  flags: 1,
  signature: 0x9ddcbac74b6ccec3n,
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        byteSize: 1,
        bitOffset: 0,
        structure: s0,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "u8",
});
$(s1, {
  ...s,
  type: 1,
  flags: 464,
  signature: 0x895cd48551caff55n,
  length: 40,
  byteSize: 40,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        byteSize: 1,
        structure: s0,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "[40]u8",
});
$(s2, {
  ...s,
  flags: 9,
  signature: 0x7fd3df143c9cd14an,
  byteSize: 0,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 6,
        bitSize: 0,
        byteSize: 0,
        bitOffset: 0,
        slot: 0,
        structure: s2,
      },
    ],
    template: o0
  },
  static: {
    members: [],
  },
  name: "type",
});
$(s3, {
  ...s,
  flags: 1,
  signature: 0x31a09f12f6815cbdn,
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 1,
        bitSize: 1,
        byteSize: 1,
        bitOffset: 0,
        structure: s3,
      },
    ],
  },
  static: {
    members: [],
  },
  name: "bool",
});
$(s4, {
  ...s,
  type: 2,
  signature: 0x03fe2ef485ad3365n,
  byteSize: 2,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        name: "value",
        type: 3,
        flags: 1,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
        slot: 0,
        structure: s0,
      },
      {
        ...m,
        name: "is_required",
        type: 1,
        bitOffset: 8,
        bitSize: 1,
        byteSize: 1,
        slot: 1,
        structure: s3,
      },
    ],
    template: o1
  },
  static: {
    members: [],
  },
  name: "S0",
});
$(s5, {
  ...s,
  type: 7,
  flags: 43,
  signature: 0x9547fe6aa04d896dn,
  byteSize: 3,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 16,
        byteSize: 2,
        bitOffset: 0,
        slot: 0,
        structure: s4,
      },
      {
        ...m,
        type: 3,
        flags: 8,
        bitOffset: 16,
        bitSize: 8,
        byteSize: 1,
        structure: s0,
      },
    ],
    template: o2
  },
  static: {
    members: [],
  },
  name: "?S0",
});
$(s6, {
  ...s,
  type: 9,
  flags: 464,
  signature: 0x3ee4c60c00bcc22cn,
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitSize: 8,
        byteSize: 1,
        structure: s0,
      },
    ],
  },
  static: {
    members: [],
    template: o3
  },
  name: "[_]u8",
});
$(s7, {
  ...s,
  type: 8,
  flags: 380,
  signature: 0xe77d2e409417beb5n,
  byteSize: 8,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: s6,
      },
    ],
    template: o8
  },
  static: {
    members: [],
  },
  name: "[]const u8",
});
$(s8, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0x33e78f7e2bb19e92n,
  length: 1,
  byteSize: 48,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        name: "retval",
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 320,
        byteSize: 40,
        slot: 0,
        structure: s1,
      },
      {
        ...m,
        name: "0",
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: s7,
      },
    ],
    template: o9
  },
  static: {
    members: [],
  },
  name: "Arg(fn ([]const u8) [40]u8)",
});
$(s9, {
  ...s,
  type: 14,
  signature: 0x089a7b7af91f7642n,
  length: 1,
  byteSize: 0,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s8,
      },
    ],
    template: o10
  },
  static: {
    members: [],
  },
  name: "fn ([]const u8) [40]u8",
});
$(s10, {
  ...s,
  name: "sha1",
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
        name: "sha1",
        type: 5,
        flags: 258,
        slot: 0,
        structure: s9,
      },
    ],
    template: o11
  },
});
const structures = [
  s0, s1, s2, s3, s4, s5, s6, s7, s8, s9,
  s10,
];
const root = s10;
const settings = {
  runtimeSafety: false,
  littleEndian: true,
  ioRedirection: true,
  libc: false,
};

// create runtime environment
const env = createEnvironment();

// recreate structures
env.recreateStructures(structures, settings);

// initiate loading and compilation of WASM bytecodes
const source = (async () => {
  // sha1.zig
  const binaryString = atob("AGFzbQEAAAABWQ5gA39/fwBgAn9/AX9gBH9/f38Bf2AGf39/f39/AX9gBX9/f39/AGAAAX9gAX8AYAR/f39/AGACf38AYAN/f38Bf2ACfn8Bf2AFf39/f38Bf2AAAGABfwF/AmAEA2VudhlfX2luZGlyZWN0X2Z1bmN0aW9uX3RhYmxlAXAADANlbnYQX2FsbG9jYXRlSnNUaHVuawABA2VudgxfZnJlZUpzVGh1bmsAAQNlbnYMX2ZpbmRKc1RodW5rAAEDGRgACAEJCwEBAQwBBgICAwMDAwQAAg0DAwQFAwEABQYIAX8BQYCAEAsHlAEJBm1lbW9yeQIACHJ1blRodW5rAAYQcnVuVmFyaWFkaWNUaHVuawAHDWNyZWF0ZUpzVGh1bmsACA5kZXN0cm95SnNUaHVuawAJD2lkZW50aWZ5SnNUaHVuawAKCmluaXRpYWxpemUACxVhbGxvY2F0ZVNjcmF0Y2hNZW1vcnkADBFmcmVlU2NyYXRjaE1lbW9yeQAVCREBAEEBCwsAAwUWGBkaDhASFAqzNxirBQIFfwF+IwBBwAFrIgMkAEEAIQQgA0EwakEAKQOwghA3AwAgA0E4akEAKAK4ghA2AgAgA0IANwMgIANBADoAfCADQQApA6iCEDcDKCADQShqIQUCQANAIARBwABqIgYgAksNASADQSBqIAEgBGoQBCAGIQQMAAsLIANBPGohBgJAIAIgBGsiB0UNACAGIAMtAHxqIAEgBGogB/wKAAALIAMgAykDICACrXwiCDcDICADIAMtAHwgB2oiBDoAfAJAQcAAIARB/wFxIgRrIgJFDQAgBiAEakEAIAL8CwALIAYgAy0AfGpBgAE6AAAgAyADLQB8IgRBAWo6AHwCQCAEQTdNDQAgA0EgaiAGEAQCQEHAAEUNACAGQQBBwAD8CwALIAMpAyAhCAsgAyAIp0EDdDoAeyAIQgWIIQhB2gAhBAJAA0AgBEHTAEYNASADQSBqIARqIAg8AAAgBEF/aiEEIAhCCIghCAwACwsgA0EgaiAGEAQgA0GAAWpBEGogBUEQaigCADYCACADQYABakEIaiAFQQhqKQIANwMAIAMgBSkCADcDgAFBACEEAkADQCAEQRRGDQEgA0EMaiAEaiADQYABaiAEaigCACIGQRh0IAZBgP4DcUEIdHIgBkEIdkGA/gNxIAZBGHZycjYAACAEQQRqIQQMAAsLQQAhBCADQShqQQAvALKBEDsBACADQS5qQQAvAMWAEDsBACADQQApAKqBEDcDICADQQAoAMGAEDYBKiADQQxqIQYCQANAIARBKEYNASADQZgBaiAEaiICIANBIGogBi0AACIBQQR2ai0AADoAACACQQFqIANBIGogAUEPcWotAAA6AAAgBkEBaiEGIARBAmohBAwACwsCQEEoRQ0AIAAgA0GYAWpBKPwKAAALIANBwAFqJAALlSIBTn8gACABKAAUIgJBGHQgAkGA/gNxQQh0ciACQQh2QYD+A3EgAkEYdnJyIgMgASgADCICQRh0IAJBgP4DcUEIdHIgAkEIdkGA/gNxIAJBGHZyciIEcyABKAAsIgJBGHQgAkGA/gNxQQh0ciACQQh2QYD+A3EgAkEYdnJyIgVzIAEoAAgiAkEYdCACQYD+A3FBCHRyIAJBCHZBgP4DcSACQRh2cnIiBiABKAAAIgJBGHQgAkGA/gNxQQh0ciACQQh2QYD+A3EgAkEYdnJyIgdzIAEoACAiAkEYdCACQYD+A3FBCHRyIAJBCHZBgP4DcSACQRh2cnIiCHMgASgANCICQRh0IAJBgP4DcUEIdHIgAkEIdkGA/gNxIAJBGHZyciICc0EBdyIJc0EBdyIKIAQgASgABCILQRh0IAtBgP4DcUEIdHIgC0EIdkGA/gNxIAtBGHZyciIMcyABKAAkIgtBGHQgC0GA/gNxQQh0ciALQQh2QYD+A3EgC0EYdnJyIg1zIAEoADgiC0EYdCALQYD+A3FBCHRyIAtBCHZBgP4DcSALQRh2cnIiC3NBAXciDnMgBSANcyAOcyAIIAEoABgiD0EYdCAPQYD+A3FBCHRyIA9BCHZBgP4DcSAPQRh2cnIiEHMgC3MgCnNBAXciD3NBAXciEXMgCSALcyAPcyACIAVzIApzIAEoACgiEkEYdCASQYD+A3FBCHRyIBJBCHZBgP4DcSASQRh2cnIiEyAIcyAJcyABKAAcIhJBGHQgEkGA/gNxQQh0ciASQQh2QYD+A3EgEkEYdnJyIhQgA3MgAnMgASgAECISQRh0IBJBgP4DcUEIdHIgEkEIdkGA/gNxIBJBGHZyciIVIAZzIBNzIAEoADwiEkEYdCASQYD+A3FBCHRyIBJBCHZBgP4DcSASQRh2cnIiEnNBAXciFnNBAXciF3NBAXciGHNBAXciGXNBAXciGnNBAXciGyAOIBJzIA0gFHMgEnMgECAVcyABKAAwIgFBGHQgAUGA/gNxQQh0ciABQQh2QYD+A3EgAUEYdnJyIhxzIA5zQQF3IgFzQQF3Ih1zIAsgHHMgAXMgEXNBAXciHnNBAXciH3MgESAdcyAfcyAPIAFzIB5zIBtzQQF3IiBzQQF3IiFzIBogHnMgIHMgGSARcyAbcyAYIA9zIBpzIBcgCnMgGXMgFiAJcyAYcyASIAJzIBdzIBwgE3MgFnMgHXNBAXciInNBAXciI3NBAXciJHNBAXciJXNBAXciJnNBAXciJ3NBAXciKHNBAXciKSAfICNzIB0gF3MgI3MgASAWcyAicyAfc0EBdyIqc0EBdyIrcyAeICJzICpzICFzQQF3IixzQQF3Ii1zICEgK3MgLXMgICAqcyAscyApc0EBdyIuc0EBdyIvcyAoICxzIC5zICcgIXMgKXMgJiAgcyAocyAlIBtzICdzICQgGnMgJnMgIyAZcyAlcyAiIBhzICRzICtzQQF3IjBzQQF3IjFzQQF3IjJzQQF3IjNzQQF3IjRzQQF3IjVzQQF3IjZzQQF3IjcgLSAxcyArICVzIDFzICogJHMgMHMgLXNBAXciOHNBAXciOXMgLCAwcyA4cyAvc0EBdyI6c0EBdyI7cyAvIDlzIDtzIC4gOHMgOnMgN3NBAXciPHNBAXciPXMgNiA6cyA8cyA1IC9zIDdzIDQgLnMgNnMgMyApcyA1cyAyIChzIDRzIDEgJ3MgM3MgMCAmcyAycyA5c0EBdyI+c0EBdyI/c0EBdyJAc0EBdyJBc0EBdyJCc0EBdyJDc0EBdyJEc0EBdyJFIDogPnMgOCAycyA+cyA7c0EBdyJGcyA9c0EBdyJHIDkgM3MgP3MgRnNBAXciSCBAIDUgLiAtIDAgJSAaIBEgASASIBMgACgCCCJJQQV3IAAoAhgiSmogACgCFCJLIAAoAgwiTEF/c3EgACgCECJNIExxcmogB2pBmfOJ1AVqIgdBHnciTiADaiBMQR53Ik8gBGogSyBPIElxIE0gSUF/c3FyaiAMaiAHQQV3akGZ84nUBWoiAyBOcSBJQR53IgwgA0F/c3FyaiBNIAZqIAcgDHEgTyAHQX9zcXJqIANBBXdqQZnzidQFaiIHQQV3akGZ84nUBWoiBCAHQR53IgZxIANBHnciTyAEQX9zcXJqIAwgFWogByBPcSBOIAdBf3NxcmogBEEFd2pBmfOJ1AVqIgdBBXdqQZnzidQFaiIDQR53IhVqIAggBEEedyITaiAQIE9qIAcgE3EgBiAHQX9zcXJqIANBBXdqQZnzidQFaiIIIBVxIAdBHnciBCAIQX9zcXJqIBQgBmogAyAEcSATIANBf3NxcmogCEEFd2pBmfOJ1AVqIhNBBXdqQZnzidQFaiIHIBNBHnciA3EgCEEedyIGIAdBf3NxcmogDSAEaiATIAZxIBUgE0F/c3FyaiAHQQV3akGZ84nUBWoiCEEFd2pBmfOJ1AVqIg1BHnciE2ogAiAHQR53IhJqIAUgBmogCCAScSADIAhBf3NxcmogDUEFd2pBmfOJ1AVqIgIgE3EgCEEedyIIIAJBf3NxcmogHCADaiANIAhxIBIgDUF/c3FyaiACQQV3akGZ84nUBWoiEkEFd2pBmfOJ1AVqIgUgEkEedyINcSACQR53IhwgBUF/c3FyaiALIAhqIBIgHHEgEyASQX9zcXJqIAVBBXdqQZnzidQFaiICQQV3akGZ84nUBWoiC0EedyISaiAOIA1qIAsgAkEedyIOcSAFQR53IgUgC0F/c3FyaiAJIBxqIAIgBXEgDSACQX9zcXJqIAtBBXdqQZnzidQFaiIBQQV3akGZ84nUBWoiAkEedyIJIAFBHnciC3MgFiAFaiABIBJxIA4gAUF/c3FyaiACQQV3akGZ84nUBWoiAXNqIAogDmogAiALcSASIAJBf3NxcmogAUEFd2pBmfOJ1AVqIgJBBXdqQaHX5/YGaiIKQR53Ig5qIA8gCWogAkEedyIPIAFBHnciAXMgCnNqIBcgC2ogASAJcyACc2ogCkEFd2pBodfn9gZqIgJBBXdqQaHX5/YGaiIJQR53IgogAkEedyILcyAdIAFqIA4gD3MgAnNqIAlBBXdqQaHX5/YGaiIBc2ogGCAPaiALIA5zIAlzaiABQQV3akGh1+f2BmoiAkEFd2pBodfn9gZqIglBHnciDmogGSAKaiACQR53Ig8gAUEedyIBcyAJc2ogIiALaiABIApzIAJzaiAJQQV3akGh1+f2BmoiAkEFd2pBodfn9gZqIglBHnciCiACQR53IgtzIB4gAWogDiAPcyACc2ogCUEFd2pBodfn9gZqIgFzaiAjIA9qIAsgDnMgCXNqIAFBBXdqQaHX5/YGaiICQQV3akGh1+f2BmoiCUEedyIOaiAkIApqIAJBHnciDyABQR53IgFzIAlzaiAfIAtqIAEgCnMgAnNqIAlBBXdqQaHX5/YGaiICQQV3akGh1+f2BmoiCUEedyIKIAJBHnciC3MgGyABaiAOIA9zIAJzaiAJQQV3akGh1+f2BmoiAXNqICogD2ogCyAOcyAJc2ogAUEFd2pBodfn9gZqIgJBBXdqQaHX5/YGaiIJQR53Ig5qICYgAUEedyIBaiAOIAJBHnciD3MgICALaiABIApzIAJzaiAJQQV3akGh1+f2BmoiAnNqICsgCmogDyABcyAJc2ogAkEFd2pBodfn9gZqIglBBXdqQaHX5/YGaiILIAlBHnciASACQR53IgpzcSABIApxc2ogISAPaiAKIA5zIAlzaiALQQV3akGh1+f2BmoiDkEFd2pB3Pnu+HhqIg9BHnciAmogMSALQR53IglqICcgCmogDiAJIAFzcSAJIAFxc2ogD0EFd2pB3Pnu+HhqIgsgAiAOQR53IgpzcSACIApxc2ogLCABaiAPIAogCXNxIAogCXFzaiALQQV3akHc+e74eGoiDkEFd2pB3Pnu+HhqIg8gDkEedyIBIAtBHnciCXNxIAEgCXFzaiAoIApqIA4gCSACc3EgCSACcXNqIA9BBXdqQdz57vh4aiILQQV3akHc+e74eGoiDkEedyICaiA4IA9BHnciCmogMiAJaiALIAogAXNxIAogAXFzaiAOQQV3akHc+e74eGoiDyACIAtBHnciCXNxIAIgCXFzaiApIAFqIA4gCSAKc3EgCSAKcXNqIA9BBXdqQdz57vh4aiILQQV3akHc+e74eGoiDiALQR53IgEgD0EedyIKc3EgASAKcXNqIDMgCWogCyAKIAJzcSAKIAJxc2ogDkEFd2pB3Pnu+HhqIgtBBXdqQdz57vh4aiIPQR53IgJqIC8gDkEedyIJaiA5IApqIAsgCSABc3EgCSABcXNqIA9BBXdqQdz57vh4aiIOIAIgC0EedyIKc3EgAiAKcXNqIDQgAWogDyAKIAlzcSAKIAlxc2ogDkEFd2pB3Pnu+HhqIgtBBXdqQdz57vh4aiIPIAtBHnciASAOQR53IglzcSABIAlxc2ogPiAKaiALIAkgAnNxIAkgAnFzaiAPQQV3akHc+e74eGoiDkEFd2pB3Pnu+HhqIhFBHnciAmogPyABaiARIA5BHnciCiAPQR53IgtzcSAKIAtxc2ogOiAJaiAOIAsgAXNxIAsgAXFzaiARQQV3akHc+e74eGoiCUEFd2pB3Pnu+HhqIg5BHnciDyAJQR53IgFzIDYgC2ogCSACIApzcSACIApxc2ogDkEFd2pB3Pnu+HhqIglzaiA7IApqIA4gASACc3EgASACcXNqIAlBBXdqQdz57vh4aiICQQV3akHWg4vTfGoiCkEedyILaiBGIA9qIAJBHnciDiAJQR53IglzIApzaiA3IAFqIAkgD3MgAnNqIApBBXdqQdaDi9N8aiIBQQV3akHWg4vTfGoiAkEedyIKIAFBHnciD3MgQSAJaiALIA5zIAFzaiACQQV3akHWg4vTfGoiAXNqIDwgDmogDyALcyACc2ogAUEFd2pB1oOL03xqIgJBBXdqQdaDi9N8aiIJQR53IgtqID0gCmogAkEedyIOIAFBHnciAXMgCXNqIEIgD2ogASAKcyACc2ogCUEFd2pB1oOL03xqIgJBBXdqQdaDi9N8aiIJQR53IgogAkEedyIPcyA+IDRzIEBzIEhzQQF3IhEgAWogCyAOcyACc2ogCUEFd2pB1oOL03xqIgFzaiBDIA5qIA8gC3MgCXNqIAFBBXdqQdaDi9N8aiICQQV3akHWg4vTfGoiCUEedyILaiBEIApqIAJBHnciDiABQR53IgFzIAlzaiA/IDVzIEFzIBFzQQF3IhIgD2ogASAKcyACc2ogCUEFd2pB1oOL03xqIgJBBXdqQdaDi9N8aiIJQR53IgogAkEedyIPcyA7ID9zIEhzIEdzQQF3IhYgAWogCyAOcyACc2ogCUEFd2pB1oOL03xqIgFzaiBAIDZzIEJzIBJzQQF3IhcgDmogDyALcyAJc2ogAUEFd2pB1oOL03xqIgJBBXdqQdaDi9N8aiIJQR53IgsgSmo2AhggACBLIEYgQHMgEXMgFnNBAXciESAPaiABQR53IgEgCnMgAnNqIAlBBXdqQdaDi9N8aiIOQR53Ig9qNgIUIAAgTSBBIDdzIENzIBdzQQF3IApqIAJBHnciAiABcyAJc2ogDkEFd2pB1oOL03xqIglBHndqNgIQIAAgTCA8IEZzIEdzIEVzQQF3IAFqIAsgAnMgDnNqIAlBBXdqQdaDi9N8aiIBajYCDCAAIEkgSCBBcyAScyARc0EBd2ogAmogDyALcyAJc2ogAUEFd2pB1oOL03xqNgIIC0IBAX8jAEEwayICJAAgAkEIaiABKAIAIAEoAgQgABEAAAJAQShFDQAgAUEIaiACQQhqQSj8CgAACyACQTBqJABBAAsaACABIAJBqtWq1XogAhsgABEBAEH//wNxRQsnACABIAJBqtWq1XogAhsgA0Gq1arVeiACGyAEIAARAgBB//8DcUULVwEDfyMAQRBrIgIkAEEAIQNBAC0A8IIQIQQgAkEIakEAIAEgABEAAAJAAkAgAi8BDA0AIAIoAgghAwwBCyAEQQFxRQ0AIAAgARAAIQMLIAJBEGokACADC1cBA38jAEEQayICJABBACEDQQAtAPCCECEEIAJBCGpBASABIAARAAACQAJAIAIvAQwNACACKAIIIQMMAQsgBEEBcUUNACAAIAEQASEDCyACQRBqJAAgAwtXAQN/IwBBEGsiAiQAQQAhA0EALQDwghAhBCACQQhqQQIgASAAEQAAAkACQCACLwEMDQAgAigCCCEDDAELIARBAXFFDQAgACABEAIhAwsgAkEQaiQAIAMLCwBBAEEBOgDwghALPgEBfyMAQRBrIgIkACACQQhqEA0gAigCCCAAIAFBASABQQFLG2hBACACKAIMKAIAEQIAIQEgAkEQaiQAIAELngEDAX8BfgF/IwBBEGsiASQAAkBBAC0AgIMQDQBBACkD2IIQIgKnQYCABEEAQQAgAkIgiKcoAgARAgAhA0EAQQE6AJyDEEEAQYCABDYCmIMQQQAgAzYClIMQQQAgAjcDiIMQQQBBAToAgIMQQQBB4IIQNgL8ghBBAEGIgxA2AviCEEEAQQA2ApCDEAsgAEEAKQP4ghA3AgAgAUEQaiQACzIBAX8CQCAAQQhqIAEgAiAAEA8iBA0AIAAoAgAgASACIAMgACgCBCgCABECACEECyAEC50BAQd/IwBBEGsiBCQAIAQgAkEfcSIFOgALIAAoAgQhBiAAKAIAIQdBACEIQQAhCQJAAkACQCAFRQ0AIARBASACdCIJIAYgB2oiAmpBf2oiCiACSSIFOgAMIAUNASAKQQAgCWtxIAJrIQkLIAkgB2oiAiABaiIHIAAoAghLDQEgACAHNgIAIAYgAmohCAwBC0EAIQgLIARBEGokACAIC0wBAX8CQCABIAAoAgwiBkkNACAAKAIQIAZqIAFNDQAgAEEIaiABIAIgACAEIAAQEQ8LIAAoAgAgASACIAMgBCAFIAAoAgQoAgQRAwALVAACQAJAIAEgAmogACgCBCAAKAIAIgFqRg0AIAQgAk0hAgwBCyABIAQgAmtqIQECQCAEIAJNDQBBACECIAEgACgCCEsNAQsgACABNgIAQQEPCyACC0wBAX8CQCABIAAoAgwiBkkNACAAKAIQIAZqIAFNDQAgAEEIaiABIAIgACAEIAAQEw8LIAAoAgAgASACIAMgBCAFIAAoAgQoAggRAwALGAAgAUEAIAAgASACIAEgBCABEBFBAXEbC1gBAX8CQAJAIAEgACgCDCIFSQ0AIAAoAhAgBWogAU0NACABIAJqIAUgACgCCCIBakcNASAAIAEgAms2AggPCyAAKAIAIAEgAiADIAQgACgCBCgCDBEEAAsLPAEBfyMAQRBrIgMkACADQQhqEA0gAygCCCAAIAEgAkEBIAJBAUsbaEEAIAMoAgwoAgwRBAAgA0EQaiQAC/UBAQR/IwBBEGsiBCQAIAQgAkEfcToAD0EAIQUCQEF/IAFBBGoiBiAGIAFJGyIBQQEgAnQiAiABIAJLGyIBQX9qZyICRQ0AAkACQEEgIAJrIgJB//8DcUF9aiIGQQ1PDQBCASACrUL//wODhqchASAGQQJ0IgdBoIMQaiIGKAIAIgJFDQEgBiABIAJqQXxqKAIANgIAIAIhBQwCCyABQYOABGpBEHYQFyEFDAELAkAgB0HUgxBqIgYoAgAiAkH//wNxDQBBARAXIgJFDQEgBiACIAFqNgIAIAIhBQwBCyAGIAIgAWo2AgAgAiEFCyAEQRBqJAAgBQteAQJ/QgFBICAAQX9qZ2siAK1C//8Dg4anIQECQCAAQf//A3FBAnRBiIQQaiICKAIAIgBFDQAgAiABQRB0IABqQXxqKAIANgIAIAAPC0EAIAFAACIAQRB0IABBf0YbC9QBAQJ/IwBBEGsiBiQAIAYgA0EfcToAD0F/IARBBGoiByAHIARJGyIEQQEgA3QiAyAEIANLGyEEAkACQAJAIAJBBGoiAiADIAIgA0sbIgNBf2pnIgJBb2pBDEsNACAEQX9qZyIDDQFBACEDDAILQgFBICADQYOABGpBEHZBf2pna61C//8Dg4anQgFBICAEQYOABGpBEHZBf2pna61C//8Dg4anRiEDDAELQgFBICACa61C//8Dg4anQgFBICADa61C//8Dg4anRiEDCyAGQRBqJAAgAwsYACABQQAgBCAEIAIgAyAEIAQQGEEBcRsLvgEBAn8jAEEQayIFJAAgBSADQR9xOgAPAkACQEEgIAJBBGoiAkEBIAN0IgMgAiADSxsiA0F/amdrIgJB//8DcUF9aiIGQQ1PDQAgAUIBIAKshqdqQXxqIAZBAnRBoIMQaiIDKAIANgIAIAMgATYCAAwBCyABQgFBICADQYOABGpBEHZBf2pnayIDrUL//wODhqdBEHRqQXxqIANB//8DcUECdEGIhBBqIgMoAgA2AgAgAyABNgIACyAFQRBqJAALC/kCAQBBgIAQC/ACAAAAABgAAAAAAAAAAAAAAHNsb3QAYml0T2Zmc2V0AG1lbWJlcnMAZmxhZ3MAYWxpZ24AcmV0dmFsAGxlbmd0aABhYmNkZWYAYml0U2l6ZQBieXRlU2l6ZQB2YWx1ZQB0ZW1wbGF0ZQBwdXJwb3NlAHN0cnVjdHVyZQBzaWduYXR1cmUAdHlwZQBuYW1lAGluc3RhbmNlAGlzX3JlcXVpcmVkAHN0YXRpYwAwMTIzNDU2Nzg5AHNoYTEAMAB0eXBlLnNsaWNlLlNsaWNlKHU4LG51bGwpAHR5cGUuc2xpY2UuU2VudGluZWwoYW55b3BhcXVlKQB0eXBlLmFyZy1zdHJ1Y3QuQXJnU3RydWN0KGZuIChbXWNvbnN0IHU4KSBbNDBddTgpAAABI0VniavN7/7cuph2VDIQ8OHSwwAAAAAAAQAABAAAAAUAAAAGAAAABwAAAAAAAAAAAAAARAEEAAgAAAAJAAAACgAAAAsAAAA=");
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  await new Promise(r => setTimeout(r, 0));
  return bytes.buffer;
})();
env.loadModule(source, {"delay":false,"tableInitial":12,"multithreaded":false});
env.linkVariables(false);

// export root namespace and its methods and constants
const { constructor: v0 } = root;
const v1 = env.getSpecialExports();
const {
  sha1: v2,
} = v0;
await v1.init();

export { v1 as __zigar, v0 as default, v2 as sha1 };
