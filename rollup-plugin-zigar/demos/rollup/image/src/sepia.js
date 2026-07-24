(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Sepia = {}));
})(this, (function (exports) { 'use strict';

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
    FD_READ: 1};

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
  const NAME = symbol('name');
  const TYPE = symbol('type');
  const FLAGS = symbol('flags');
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

  function hasMethod(object, name) {
    return typeof(object?.[name]) === 'function';
  }

  function isPromise(object) {
    return typeof(object?.then) === 'function';
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

  // handle non-standard uints 32-bit or smaller

  mixin({
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
    defineMemberFloat(member) {
      return this.defineMemberUsing(member, this.getAccessor);
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
    defineStringArray(structure) {
      return markAsSpecial({
        get() {
          const array = [];
          for (const child of this) {
            array.push(child.string);
          }
          return array;
        },
        set(array, allocator) {
          this[INITIALIZE](array, allocator);
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
      if (!(flags & ArrayFlag.IsString) && this.hasStringProperty(structure)) {
        descriptors.string = this.defineStringArray(structure);
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
    hasStringProperty(structure) {
      switch (structure.type) {
        case StructureType.Array:
          if (structure.flags & ArrayFlag.IsString) {
            return true;
          }
        case StructureType.Slice:
          if (structure.flags & SliceFlag.IsString) {
            return true;
          }
      }
      switch (structure.type) {
        case StructureType.Array:
        case StructureType.Slice:
        case StructureType.Optional:
        case StructureType.ErrorUnion:
        case StructureType.Pointer:
          return this.hasStringProperty(structure.instance.members[0].structure);
      }  
      return false;
    }  
  });

  mixin({
    defineComptime(structure, descriptors) {
      const {
        instance: { members: [ member ] },
      } = structure;
      const { get } = this.defineMember(member);
      const constructor = this.createConstructor(structure);
      descriptors.$ = { get, set: throwReadOnly };
      descriptors[INITIALIZE] = defineValue(throwReadOnly);
      descriptors[Symbol.toPrimitive] = defineValue(get);
      return constructor;
    },
    finalizeComptime(structure, staticDescriptors) {
      const {
        instance: { members: [ member ] },
      } = structure;
      staticDescriptors[BIT_SIZE] = defineValue(member.bitSize);
    },
  });

  mixin({
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
                const name = `@enumFromInt(${arg})`;
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
        instance: { members },
      } = structure;
      const { structure: targetStructure } = members[0];
      const {
        type: targetType,
        flags: targetFlags,
        byteSize: targetSize = 1
      } = targetStructure;
      const { get: readAddress, set: writeAddress } = this.defineMember(members[1]);
      const { get: readLength, set: writeLength } = (flags & PointerFlag.HasLength) ? this.defineMember(members[2]) : {};
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
          const self = (() => (
            function(...args) {
              const f = self['*'];
              return f.call(this, ...args);
            }
          ))();
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
      if (!(flags & SliceFlag.IsString) && this.hasStringProperty(structure)) {
        descriptors.string = this.defineStringArray(structure);
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
        if (purpose === StructurePurpose.File) {
          arg = this.createFile(arg);
        } else if (purpose == StructurePurpose.Directory) {
          arg = this.createDirectory(arg);
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
        if (purpose == StructurePurpose.AnyImage && typeof(arg) === 'object') {
          if (arg.data instanceof Uint8Array || arg.data instanceof Uint8ClampedArray) {
            arg = { web: arg };
          } else if (typeof(Float16Array) === 'function' && arg.data instanceof Float16Array) {
            arg = { web_hdr: arg };
          } 
        }      
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
    fdSeek(fd, offset, whence, newOffsetAddress, canWait) {
      return catchPosixError(canWait, PosixError.EBADF, () => {
        const [ stream ] = this.getStream(fd);
        checkStreamMethod(stream, 'seek');
        return stream.seek(safeInt(offset), whence);
      }, (pos) => this.copyUint64(newOffsetAddress, pos));
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
    procExit(code) {
      throw new Exit(code);
    }
  }) ;

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

  mixin({
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

  mixin({
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
  const s10 = {}, s11 = {}, s12 = {}, s13 = {}, s14 = {}, s15 = {}, s16 = {}, s17 = {}, s18 = {}, s19 = {};
  const s20 = {}, s21 = {};

  // declare objects
  const o0 = {}, o1 = {}, o2 = {}, o3 = {}, o4 = {}, o5 = {}, o6 = {}, o7 = {}, o8 = {}, o9 = {};
  const o10 = {}, o11 = {}, o12 = {}, o13 = {}, o14 = {}, o15 = {}, o16 = {}, o17 = {}, o18 = {}, o19 = {};
  const o20 = {}, o21 = {}, o22 = {}, o23 = {}, o24 = {}, o25 = {}, o26 = {};

  // define byte arrays
  const U = i => new Uint8Array(i);
  const a0 = U([ 0, 0, 0, 0, 1 ]);
  const a1 = U(0);
  const a2 = U(6);
  const a3 = U(1);
  const a4 = U(1);
  const a5 = U([ 1 ]);
  const a6 = U(20);
  const a7 = U(1);
  const a8 = U(a5);
  const a9 = U(20);

  // fill in object properties
  const $ = Object.assign;
  $(o0, {});
  $(o1, {
    memory: { array: a0 },
  });
  $(o2, {});
  $(o3, {});
  $(o4, {
    slots: {
      0: o5, 1: o7, 2: o8,
    },
  });
  $(o5, {
    structure: s3,
    memory: { array: a1 },
    slots: {
      0: o6,
    },
  });
  $(o6, {
    structure: s2,
  });
  $(o7, {
    structure: s6,
    memory: { array: a2 },
  });
  $(o8, {
    structure: s4,
    memory: { array: a3 },
  });
  $(o9, {});
  $(o10, {
    slots: {
      0: o11, 1: o12,
    },
  });
  $(o11, {
    structure: s11,
    memory: { array: a4 },
  });
  $(o12, {
    structure: s11,
    memory: { array: a5 },
  });
  $(o13, {
    memory: { array: a6 },
    handle: 263692,
    slots: {
      0: o14,
    },
  });
  $(o14, {
    structure: s10,
    memory: { array: a6, offset: 0, length: 8 },
  });
  $(o15, {
    slots: {
      1: o16, 2: o17,
    },
  });
  $(o16, {
    structure: s13,
    memory: { array: a7 },
  });
  $(o17, {
    structure: s13,
    memory: { array: a8 },
  });
  $(o18, {});
  $(o19, {});
  $(o20, {
    memory: { array: a9 },
    handle: 263712,
    slots: {
      0: o21,
    },
  });
  $(o21, {
    structure: s15,
    memory: { array: a9, offset: 0, length: 8 },
  });
  $(o22, {});
  $(o23, {});
  $(o24, {
    memory: { array: a1 },
    handle: 7,
  });
  $(o25, {
    slots: {
      0: o26,
    },
  });
  $(o26, {
    structure: s20,
    memory: { array: a1 },
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
          structure: s1,
        },
      ],
    },
    static: {
      members: [],
    },
    name: "u8",
  });
  $(s2, {
    ...s,
    type: 1,
    flags: 464,
    signature: 0x01bbbac96c660ad0n,
    length: 4,
    byteSize: 4,
    align: 1,
    instance: {
      members: [
        {
          ...m,
          type: 3,
          bitSize: 8,
          byteSize: 1,
          structure: s1,
        },
      ],
    },
    static: {
      members: [],
    },
    name: "[4]u8",
  });
  $(s3, {
    ...s,
    type: 15,
    flags: 9,
    signature: 0x7fd3df143c9cd14an,
    byteSize: 0,
    align: 1,
    instance: {
      members: [
        {
          ...m,
          type: 6,
          slot: 0,
          structure: s3,
        },
      ],
      template: o0
    },
    static: {
      members: [],
    },
    name: "type",
  });
  $(s4, {
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
          structure: s4,
        },
      ],
    },
    static: {
      members: [],
    },
    name: "bool",
  });
  $(s5, {
    ...s,
    type: 2,
    flags: 10,
    signature: 0xebe67331912c712an,
    byteSize: 5,
    align: 1,
    instance: {
      members: [
        {
          ...m,
          name: "value",
          type: 5,
          flags: 1,
          bitOffset: 0,
          bitSize: 32,
          byteSize: 4,
          slot: 0,
          structure: s2,
        },
        {
          ...m,
          name: "is_required",
          type: 1,
          bitOffset: 32,
          bitSize: 1,
          byteSize: 1,
          slot: 1,
          structure: s4,
        },
      ],
      template: o1
    },
    static: {
      members: [],
    },
    name: "S0",
  });
  $(s6, {
    ...s,
    type: 7,
    flags: 43,
    signature: 0x7efb3eebc51718e6n,
    byteSize: 6,
    align: 1,
    instance: {
      members: [
        {
          ...m,
          type: 5,
          bitSize: 40,
          byteSize: 5,
          bitOffset: 0,
          slot: 0,
          structure: s5,
        },
        {
          ...m,
          type: 3,
          flags: 8,
          bitOffset: 40,
          bitSize: 8,
          byteSize: 1,
          structure: s1,
        },
      ],
      template: o2
    },
    static: {
      members: [],
    },
    name: "?S0",
  });
  $(s7, {
    ...s,
    type: 9,
    flags: 410,
    signature: 0x5f7d4e08c57793e9n,
    byteSize: 4,
    align: 1,
    instance: {
      members: [
        {
          ...m,
          type: 5,
          bitSize: 32,
          byteSize: 4,
          structure: s2,
        },
      ],
      template: o3
    },
    static: {
      members: [],
      template: o4
    },
    name: "[_][4]u8",
  });
  $(s8, {
    ...s,
    flags: 1,
    signature: 0xa0953051ee32940an,
    byteSize: 4,
    align: 4,
    instance: {
      members: [
        {
          ...m,
          type: 3,
          bitSize: 32,
          byteSize: 4,
          bitOffset: 0,
          structure: s8,
        },
      ],
    },
    static: {
      members: [],
    },
    name: "u32",
  });
  $(s9, {
    ...s,
    flags: 33,
    signature: 0x2ee9c2d7fc6b1e44n,
    byteSize: 4,
    align: 4,
    instance: {
      members: [
        {
          ...m,
          type: 3,
          bitSize: 32,
          byteSize: 4,
          bitOffset: 0,
          structure: s9,
        },
      ],
    },
    static: {
      members: [],
    },
    name: "usize",
  });
  $(s10, {
    ...s,
    type: 8,
    flags: 380,
    signature: 0xc82aea63f0206cd4n,
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
          structure: s7,
        },
        {
          ...m,
          type: 3,
          bitOffset: 0,
          bitSize: 32,
          byteSize: 4,
          structure: s8,
        },
        {
          ...m,
          type: 3,
          bitOffset: 32,
          bitSize: 32,
          byteSize: 4,
          structure: s9,
        },
      ],
      template: o9
    },
    static: {
      members: [],
    },
    name: "[]const [4]u8",
  });
  $(s11, {
    ...s,
    type: 6,
    flags: 1,
    signature: 0x60115b587acd2e50n,
    byteSize: 1,
    align: 1,
    instance: {
      members: [
        {
          ...m,
          type: 3,
          bitSize: 1,
          byteSize: 1,
          bitOffset: 0,
          structure: s11,
        },
      ],
    },
    static: {
      members: [
        {
          ...m,
          name: "srgb",
          type: 5,
          flags: 4,
          slot: 0,
          structure: s11,
        },
        {
          ...m,
          name: "display-p3",
          type: 5,
          flags: 4,
          slot: 1,
          structure: s11,
        },
      ],
      template: o10
    },
    name: "EN0",
  });
  $(s12, {
    ...s,
    type: 2,
    purpose: 9,
    flags: 14,
    signature: 0x692721bf75747964n,
    byteSize: 20,
    align: 4,
    instance: {
      members: [
        {
          ...m,
          name: "data",
          type: 5,
          flags: 1,
          bitOffset: 0,
          bitSize: 64,
          byteSize: 8,
          slot: 0,
          structure: s10,
        },
        {
          ...m,
          name: "width",
          type: 3,
          flags: 1,
          bitOffset: 64,
          bitSize: 32,
          byteSize: 4,
          slot: 1,
          structure: s8,
        },
        {
          ...m,
          name: "height",
          type: 3,
          flags: 1,
          bitOffset: 96,
          bitSize: 32,
          byteSize: 4,
          slot: 2,
          structure: s8,
        },
        {
          ...m,
          name: "colorSpace",
          type: 3,
          bitOffset: 128,
          bitSize: 1,
          byteSize: 1,
          slot: 3,
          structure: s11,
        },
      ],
      template: o13
    },
    static: {
      members: [],
    },
    name: "S1",
  });
  $(s13, {
    ...s,
    name: "Format",
    type: 6,
    flags: 1,
    signature: 0x62603de91bd3d3abn,
    byteSize: 1,
    align: 1,
    instance: {
      members: [
        {
          ...m,
          type: 3,
          bitSize: 1,
          byteSize: 1,
          bitOffset: 0,
          structure: s13,
        },
      ],
    },
    static: {
      members: [
        {
          ...m,
          name: "web",
          type: 5,
          flags: 4,
          slot: 1,
          structure: s13,
        },
        {
          ...m,
          name: "gd",
          type: 5,
          flags: 4,
          slot: 2,
          structure: s13,
        },
      ],
      template: o15
    },
  });
  $(s14, {
    ...s,
    type: 3,
    purpose: 8,
    flags: 110,
    signature: 0xd6bb11b993b22dfdn,
    byteSize: 24,
    align: 4,
    instance: {
      members: [
        {
          ...m,
          name: "web",
          type: 5,
          bitOffset: 0,
          bitSize: 160,
          byteSize: 20,
          slot: 0,
          structure: s12,
        },
        {
          ...m,
          name: "gd",
          bitOffset: 0,
          bitSize: 0,
          byteSize: 0,
          slot: 1,
          structure: s0,
        },
        {
          ...m,
          type: 3,
          flags: 8,
          bitOffset: 160,
          bitSize: 1,
          byteSize: 1,
          structure: s13,
        },
      ],
      template: o18
    },
    static: {
      members: [],
    },
    name: "U0",
  });
  $(s15, {
    ...s,
    type: 8,
    flags: 124,
    signature: 0x92f6aef4878be491n,
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
          structure: s7,
        },
        {
          ...m,
          type: 3,
          bitOffset: 0,
          bitSize: 32,
          byteSize: 4,
          structure: s8,
        },
        {
          ...m,
          type: 3,
          bitOffset: 32,
          bitSize: 32,
          byteSize: 4,
          structure: s9,
        },
      ],
      template: o19
    },
    static: {
      members: [],
    },
    name: "[][4]u8",
  });
  $(s16, {
    ...s,
    type: 2,
    purpose: 9,
    flags: 14,
    signature: 0xcb4b783ed4405190n,
    byteSize: 20,
    align: 4,
    instance: {
      members: [
        {
          ...m,
          name: "data",
          type: 5,
          flags: 1,
          bitOffset: 0,
          bitSize: 64,
          byteSize: 8,
          slot: 0,
          structure: s15,
        },
        {
          ...m,
          name: "width",
          type: 3,
          flags: 1,
          bitOffset: 64,
          bitSize: 32,
          byteSize: 4,
          slot: 1,
          structure: s8,
        },
        {
          ...m,
          name: "height",
          type: 3,
          flags: 1,
          bitOffset: 96,
          bitSize: 32,
          byteSize: 4,
          slot: 2,
          structure: s8,
        },
        {
          ...m,
          name: "colorSpace",
          type: 3,
          bitOffset: 128,
          bitSize: 1,
          byteSize: 1,
          slot: 3,
          structure: s11,
        },
      ],
      template: o20
    },
    static: {
      members: [],
    },
    name: "S2",
  });
  $(s17, {
    ...s,
    type: 3,
    purpose: 8,
    flags: 110,
    signature: 0x40def2bb6df4b9a1n,
    byteSize: 24,
    align: 4,
    instance: {
      members: [
        {
          ...m,
          name: "web",
          type: 5,
          bitOffset: 0,
          bitSize: 160,
          byteSize: 20,
          slot: 0,
          structure: s16,
        },
        {
          ...m,
          name: "gd",
          bitOffset: 0,
          bitSize: 0,
          byteSize: 0,
          slot: 1,
          structure: s0,
        },
        {
          ...m,
          type: 3,
          flags: 8,
          bitOffset: 160,
          bitSize: 1,
          byteSize: 1,
          structure: s13,
        },
      ],
      template: o22
    },
    static: {
      members: [],
    },
    name: "U1",
  });
  $(s18, {
    ...s,
    flags: 1,
    signature: 0xb964b9ada17bde2cn,
    byteSize: 4,
    align: 4,
    instance: {
      members: [
        {
          ...m,
          type: 4,
          bitSize: 32,
          byteSize: 4,
          bitOffset: 0,
          structure: s18,
        },
      ],
    },
    static: {
      members: [],
    },
    name: "f32",
  });
  $(s19, {
    ...s,
    type: 12,
    flags: 14,
    signature: 0xf30bffdccc42de90n,
    length: 3,
    byteSize: 52,
    align: 4,
    instance: {
      members: [
        {
          ...m,
          name: "retval",
          flags: 1,
          bitOffset: 416,
          bitSize: 0,
          byteSize: 0,
          slot: 0,
          structure: s0,
        },
        {
          ...m,
          name: "0",
          type: 5,
          flags: 1,
          bitOffset: 0,
          bitSize: 192,
          byteSize: 24,
          slot: 1,
          structure: s14,
        },
        {
          ...m,
          name: "1",
          type: 5,
          flags: 1,
          bitOffset: 192,
          bitSize: 192,
          byteSize: 24,
          slot: 2,
          structure: s17,
        },
        {
          ...m,
          name: "2",
          type: 4,
          flags: 1,
          bitOffset: 384,
          bitSize: 32,
          byteSize: 4,
          slot: 3,
          structure: s18,
        },
      ],
      template: o23
    },
    static: {
      members: [],
    },
    name: "Arg(fn (U0, U1, f32) void)",
  });
  $(s20, {
    ...s,
    type: 14,
    signature: 0xc36ec0b7c6909d21n,
    length: 3,
    byteSize: 0,
    align: 1,
    instance: {
      members: [
        {
          ...m,
          type: 5,
          structure: s19,
        },
      ],
      template: o24
    },
    static: {
      members: [],
    },
    name: "fn (U0, U1, f32) void",
  });
  $(s21, {
    ...s,
    name: "sepia",
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
          name: "apply",
          type: 5,
          flags: 2,
          slot: 0,
          structure: s20,
        },
      ],
      template: o25
    },
  });
  const structures = [
    s0, s1, s2, s3, s4, s5, s6, s7, s8, s9,
    s10, s11, s12, s13, s14, s15, s16, s17, s18, s19,
    s20, s21,
  ];
  const root = s21;
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
    // sepia.zig
    const binaryString = atob("AGFzbQEAAAABnAEYYAN/f38Bf2ADf35/AX5gAX8Bf2AFf39/f38AYAN/f30AYAJ/fwF/YAR/f39/AX9gA39/fwBgBn9/f39/fwF/YAABf2ABfwBgAn9/AGACfn8Bf2AFf39/fn8Bf2AEf35/fwF/YAAAYAR/f39+AX9gAX8BfmAEf39/fwBgAAF+YAZ/f319fX0AYAJ/fgBgAn9+AX9gBX9/f39/AX8CzAMOA2VudhlfX2luZGlyZWN0X2Z1bmN0aW9uX3RhYmxlAXAAFBZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxC2Vudmlyb25fZ2V0AAUWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MRFlbnZpcm9uX3NpemVzX2dldAAFFndhc2lfc25hcHNob3RfcHJldmlldzEIZmRfY2xvc2UAAhZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxDWZkX2Zkc3RhdF9nZXQABRZ3YXNpX3NuYXBzaG90X3ByZXZpZXcxD2ZkX2ZpbGVzdGF0X2dldAAFFndhc2lfc25hcHNob3RfcHJldmlldzEJZmRfcHdyaXRlAA0Wd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9yZWFkAAYWd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQdmZF9zZWVrAA4Wd2FzaV9zbmFwc2hvdF9wcmV2aWV3MQhmZF93cml0ZQAGFndhc2lfc25hcHNob3RfcHJldmlldzEJcHJvY19leGl0AAoDZW52EF9hbGxvY2F0ZUpzVGh1bmsABQNlbnYMX2ZyZWVKc1RodW5rAAUDZW52DF9maW5kSnNUaHVuawAFA05NDw8FAAAGBQUCBQUNBg4GCgUBDwICAAACAAEJDwIPAgUAAgoFCg8PABAEBRQCAAsCFRYAFwUFBQ8FCgcGBggICAgDBw8DEgMDBQYCCAgFAwEABQYIAX8BQYCAEAsH0gENBm1lbW9yeQIAC19pbml0aWFsaXplAA4Mc3RyY2FzZWNtcF9sABENc3RybmNhc2VjbXBfbAASCHJ1blRodW5rAD8QcnVuVmFyaWFkaWNUaHVuawBADWNyZWF0ZUpzVGh1bmsAQQ5kZXN0cm95SnNUaHVuawBCD2lkZW50aWZ5SnNUaHVuawBDCmluaXRpYWxpemUARBVhbGxvY2F0ZVNjcmF0Y2hNZW1vcnkA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QR0gBGt2QQRzIARBAnRrQe4AaiEDDAELIANBHiAEa3ZBAnMgBEEBdGtBxwBqIgNBPyADQT9JGyEDCyABIANBBHQiBEHQkBBqNgIEIAEgBEHYkBBqIgQoAgA2AgggBCABNgIAIAEoAgggATYCBEEAQQApA6ChEEIBIAOthoQ3A6ChECAAIAJBCGoiATYCACAAIAFBfHFqIQIMAQsgACABaiECCyACQXxqIAE2AgAgAEEEaiEDCyADCwgAQRAgABAsC/YCAQR/AkAgAEUNACAAQXxqIgEoAgAhAgJAAkAgAEF4aigCACIAIABBfnEiA0cNACACIQMgASEADAELIAEgA2siACgCBCAAKAIIIgQ2AgggBCAAKAIENgIEIAMgAmohAyABKAIAIQILAkAgASACaiIBKAIAIgIgASACakF8aigCAEYNACABKAIEIAEoAggiAjYCCCACIAEoAgQ2AgQgASgCACADaiEDCyAAIAM2AgAgACADQXxxakF8aiADQQFyNgIAAkACQCAAKAIAQXhqIgNB/wBLDQAgA0EDdkF/aiEDDAELIANnIQECQCADQf8fSw0AIANBHSABa3ZBBHMgAUECdGtB7gBqIQMMAQsgA0EeIAFrdkECcyABQQF0a0HHAGoiA0E/IANBP0kbIQMLIAAgA0EEdCIBQdCQEGo2AgQgACABQdiQEGoiASgCADYCCCABIAA2AgAgACgCCCAANgIEQQBBACkDoKEQQgEgA62GhDcDoKEQCwslAAJAQRAgASAAbCIBECwiAEUNACABRQ0AIABBACAB/AsACyAACwcAIAAQHAALjAEBA38jAEEQayIAJAACQAJAIABBDGogAEEIahAUDQACQCAAKAIMIgENAEGsoRAhAQwCCwJAAkAgAUEBaiIBRQ0AIAAoAggQLiICRQ0AIAFBBBAwIgENASACEC8LQcYAEDEACyABIAIQE0UNASACEC8gARAvC0HHABAxAAtBACABNgKwoRAgAEEQaiQACwQAEDILXQECfyMAQRBrIgMkAEF/IQQCQAJAIAJBf0oNAEEAQRw2AoSZEAwBCwJAIAAgASACIANBDGoQGSICRQ0AQQAgAjYChJkQQX8hBAwBCyADKAIMIQQLIANBEGokACAEC2kBAX8jAEEQayIEJAACQAJAAkAgAkEASA0AIANCf1UNAQtBAEEcNgKEmRBB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BiAHaiICakF/aiIKIAJJIgU6AAwgBQ0BIApBACAJa3EgAmshCQsgCSAHaiICIAFqIgcgACgCCEsNASAAIAc2AgAgBiACaiEIDAELQQAhCAsgBEEQaiQAIAgLTAEBfwJAIAEgACgCDCIGSQ0AIAAoAhAgBmogAU0NACAAQQhqIAEgAiAAIAQgABBLDwsgACgCACABIAIgAyAEIAUgACgCBCgCBBEIAAtUAAJAAkAgASACaiAAKAIEIAAoAgAiAWpGDQAgBCACTSECDAELIAEgBCACa2ohAQJAIAQgAk0NAEEAIQIgASAAKAIISw0BCyAAIAE2AgBBAQ8LIAILTAEBfwJAIAEgACgCDCIGSQ0AIAAoAhAgBmogAU0NACAAQQhqIAEgAiAAIAQgABBNDwsgACgCACABIAIgAyAEIAUgACgCBCgCCBEIAAsYACABQQAgACABIAIgASAEIAEQS0EBcRsLWAEBfwJAAkAgASAAKAIMIgVJDQAgACgCECAFaiABTQ0AIAEgAmogBSAAKAIIIgFqRw0BIAAgASACazYCCA8LIAAoAgAgASACIAMgBCAAKAIEKAIMEQMACws8AQF/IwBBEGsiAyQAIANBCGoQRiADKAIIIAAgASACQQEgAkEBSxtoQQAgAygCDCgCDBEDACADQRBqJAALvgMDBX8BfgF/IwBBIGsiACQAAkBBACgC6KEQIgFFDQACQEEAKALsoRAiAkECdCIDRQ0AIAAgAUGq1arVeiACGyADQQIgABBRC0EAQQA2AuyhEEEAQQA2AuihEAsCQEEAKALwoRAiAUUNAAJAQQAoAvShECICRQ0AIAAgASACQQAgABBRC0EAQQA2AvShEEEAQQA2AvChEAsCQAJAIABBCGogAEEMahABQf//A3ENACAAKAIIIQEMAQsgAEEANgIMQQEhASAAQQE2AggLIAAgAUH+////A0s6ABwCQAJAIAFB/////wNPDQACQAJAIAFBAWoiBEECdCIBDQBC/P///w8hBQwBC0EAKQPojBAiBacgAUECQQAgBUIgiKcoAgARBgAiAUUNAUIAQoCAgIDgBCABGyABrYQhBQsgBachAQwBCwsgAEEQakHojBAgACgCDBBHIAAoAhQhBiAAKAIQIQJBACEDAkAgACgCCEUNACABIAIQABogACgCCCEDCyABIANBAnRqQQA2AgBBACABNgLooRBBACABNgKwoRBBACAENgLsoRBBACACNgLwoRBBACAGNgL0oRAgAEEgaiQAC74BAQJ/IwBBEGsiBSQAIAUgA0EfcToADwJAAkBBICACQQRqIgJBASADdCIDIAIgA0sbIgNBf2pnayICQf//A3FBfWoiBkENTw0AIAFCASACrIanakF8aiAGQQJ0QfihEGoiAygCADYCACADIAE2AgAMAQsgAUIBQSAgA0GDgARqQRB2QX9qZ2siA61C//8Dg4anQRB0akF8aiADQf//A3FBAnRB4KIQaiIDKAIANgIAIAMgATYCAAsgBUEQaiQAC5wBAgV/AX4jAEEQayIEJAAgAigCICACKAIoIgVqIQYCQAJAIAIoAiwiByAFayIIIANJDQAgBCABIAIgBiADEFMgBCkDACEJDAELQoCAgIDgACEJIAItABBFDQAgAikDCCACKQMAUg0AQoCAgIDQACEJIAcgBUYNACAEQQhqIAEgAiAGIAgQUyAEKQMIIQkLIAAgCTcCACAEQRBqJAAL5wYFAn8DfgF/AX4BfyMAQbACayIFJAAgBSAENgIEIAUgAzYCACAFQQhqIAEgBUEBQQEQVAJAAkAgBS8BDCIERQ0AIAAgBDsBBAwBCyAFKAIIIgatIQcCQAJAAkACQAJAAkACQCACLQA2QQdxDgUBAAEAAgELIAIgAikDACACKAIsIAIoAihrrX0gB3wQPQwCCwJAIAIvATQNAAJAIAIoAhggBxA+IgRB//8DcQ0AIAIgAikDACACKAIsIAIoAihrrX0gB3wQPQwDCyACIAQ7ATQLA0ACQAJAAkACQAJAAkAgB1ANACAHQv////8PIAdC/////w9UGyEIIAIpAwAhCQJAAkACQCACLQA2QQdxDgUAAQABBgALIAIoAhghCiACLwEyRQ0BDAQLIAVBEGogAhA7IAUvARhFDQIgAiACLQA2EDxBB3E6ADZBACEEDAYLIAIvATQNAiAFQaACaiACEDtBACEEIAUvAagCDQUCQCAKIAUpA6ACIAl9IgsgCCALIAhUGyIIED4iA0H//wNxDQAgAiAIIAl8NwMAIAinIQQMBgsgAiADOwE0DAULIAJCADcDKAwHCyACIAggBSkDECAJfSILIAggC1QbIgggCXw3AwAgCKchBAwDCyAIpyEEQQAhASAFQaABaiEDAkADQCAE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YWdzAEJhZEZpbGVGbGFncwBTeXN0ZW1SZXNvdXJjZXMASXNEaXIAQ29ubmVjdGlvblJlc2V0QnlQZWVyAFVuc3VwcG9ydGVkT3BlcmF0aW9uAExvY2tWaW9sYXRpb24AdW5pb24AYWxpZ24ATm90U2FtZUZpbGVTeXN0ZW0ARW5kT2ZTdHJlYW0AYm9vbAByZXR2YWwAV291bGRCbG9jawBsZW5ndGgAd2lkdGgATm90T3BlbkZvcldyaXRpbmcAU3RyZWFtaW5nAE5vdE9wZW5Gb3JSZWFkaW5nAEZpbGVUb29CaWcATWVzc2FnZVRvb0JpZwB1c2l6ZQBiaXRTaXplAGJ5dGVTaXplAHZhbHVlAHRlbXBsYXRlAHB1cnBvc2UAc3RydWN0dXJlAFVuYWJsZVRvR2V0U3RydWN0dXJlAHNpZ25hdHVyZQB0eXBlAEJyb2tlblBpcGUAbmFtZQBTd2FwRmlsZQBVbnNlZWthYmxlAGluc3RhbmNlAE5vRGV2aWNlAGNvbG9yU3BhY2UAUHJvY2Vzc05vdEZvdW5kAGZuICh0eXBlLmltYWdlLkFueUltYWdlKC5ybyksIHR5cGUuaW1hZ2UuQW55SW1hZ2UoLnJ3KSwgZjMyKSB2b2lkAGdkAE9wZXJhdGlvbk5vdFN1cHBvcnRlZABPcGVyYXRpb25BYm9ydGVkAEludGVycnVwdGVkAFVuaW1wbGVtZW50ZWQAVW5leHBlY3RlZABTb2NrZXROb3RDb25uZWN0ZWQAaXNfcmVxdWlyZWQAV3JpdGVGYWlsZWQAUmVhZEZhaWxlZABDYW5jZWxlZABBY2Nlc3NEZW5pZWQAUGVybWlzc2lvbkRlbmllZABzdGF0aWMAc3JnYgB3ZWIARGlza1F1b3RhAGRhdGEAQ29ycnVwdGVkRGF0YQBzZXBpYQBbNF0AWwA/AFtdWzRddTgAW11jb25zdCBbNF11OABkaXNwbGF5LXAzAHUzMgBmMzIAdHlwZS5pbWFnZS5XZWJJbWFnZSgucm8sLnJnYmEtdW5vcm04KV9fZW51bV8yMzgxADAAdHlwZS5pbWFnZS5BbnlJbWFnZSgucncpAHR5cGUuaW1hZ2UuQW55SW1hZ2UoLnJvKQB0eXBlLnNsaWNlLlNsaWNlKFs0XXU4LG51bGwpAHR5cGUuYXJnLXN0cnVjdC5BcmcoLm5vcm1hbCxmbiAodHlwZS5pbWFnZS5BbnlJbWFnZSgucm8pLCB0eXBlLmltYWdlLkFueUltYWdlKC5ydyksIGYzMikgdm9pZCkAP3R5cGUuc2xpY2UuU2VudGluZWwoWzRddTgpAHR5cGUuaW1hZ2UuV2ViSW1hZ2UoLnJ3LC5yZ2JhLXVub3JtOCkAdHlwZS5pbWFnZS5XZWJJbWFnZSgucm8sLnJnYmEtdW5vcm04KQAuQXJnKABmbiAoAGNvbnN0IAA6IAAsIAApIACHFpk+dZMYP4cWWT4AAAAAokUWP83MjL5U4wW/AAAAANV46T0dWqS+ZDufPgAAAAAAAAAAAAAAAAAAAAAAAIA/AACAPwAAgD8AAIA/AAAAAGq8dD+WQ4u+zcyMvwAAAADb+R4/y6Elv5qZ2T8AAAAAAAAAAAAAAAAAAAAAAACAP0Vycm9yIGVjb3VudGVyZWQgZHVyaW5nIGV4cG9ydCBwcm9jZXNzczogCgAAPwUEAAAAAAAAAAAAAAAAAAAAAAAXAAAAAAAAAAABAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwEBAAAAAAAAAAQBAAAAAAEAAAAIAAAACQAAAAoAAAALAAAADAAAAA0AAAAOAAAADwAAAAAAAABIBgQAEAAAABEAAAASAAAAEwAAAAAAAAAAAAAAFQIEABQAAABSAAQACAAAADoDBAALAAAARgMEAAoAAABmAQQACwAAAAIDBAANAAAAWwAEAAsAAAD5AAQADwAAAAkBBAAFAAAA5QIEABAAAAA5AgQACgAAAA8BBAAVAAAAZwAEABIAAACyAQQAEQAAABsDBAASAAAAfgEEAAoAAABRAwQACAAAAFoDBAAMAAAAegIEAA8AAAA6AQQADQAAABADBAAKAAAAZwMEABAAAACoAQQACQAAAFICBAAKAAAAngAEAAsAAACIAwQACQAAAMQBBAAKAAAANQAEAAoAAAB/AAQADwAAAJYBBAARAAAAZgIEAAgAAADPAQQADQAAACUBBAAUAAAA7AAEAAwAAAD2AgQACwAAAM0ABAAQAAAAlwMEAA0AAABAAAQACwAAAM8CBAAVAAAASQIEAAgAAABUAQQAEQAAAABB0I8QC7AJBQAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAADAAAABAAAAJgMBAAABAAAAAAAAAAAAAABAAAAAAAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANAHBAAAAAAAAAAAAAAAAAAAAAAAUAgEAFAIBAAAAAAAAAAAAGAIBABgCAQAAAAAAAAAAABwCAQAcAgEAAAAAAAAAAAAgAgEAIAIBAAAAAAAAAAAAJAIBACQCAQAAAAAAAAAAACgCAQAoAgEAAAAAAAAAAAAsAgEALAIBAAAAAAAAAAAAMAIBADACAQAAAAAAAAAAADQCAQA0AgEAAAAAAAAAAAA4AgEAOAIBAAAAAAAAAAAAPAIBADwCAQAAAAAAAAAAAAACQQAAAkEAAAAAAAAAAAAEAkEABAJBAAAAAAAAAAAACAJBAAgCQQAAAAAAAAAAAAwCQQAMAkEAAAAAAAAAAAAQAkEAEAJBAAAAAAAAAAAAFAJBABQCQQAAAAAAAAAAABgCQQAYAkEAAAAAAAAAAAAcAkEAHAJBAAAAAAAAAAAAIAJBACACQQAAAAAAAAAAACQCQQAkAkEAAAAAAAAAAAAoAkEAKAJBAAAAAAAAAAAALAJBACwCQQAAAAAAAAAAADACQQAwAkEAAAAAAAAAAAA0AkEANAJBAAAAAAAAAAAAOAJBADgCQQAAAAAAAAAAADwCQQA8AkEAAAAAAAAAAAAAAoEAAAKBAAAAAAAAAAAABAKBAAQCgQAAAAAAAAAAAAgCgQAIAoEAAAAAAAAAAAAMAoEADAKBAAAAAAAAAAAAEAKBABACgQAAAAAAAAAAABQCgQAUAoEAAAAAAAAAAAAYAoEAGAKBAAAAAAAAAAAAHAKBABwCgQAAAAAAAAAAACACgQAgAoEAAAAAAAAAAAAkAoEAJAKBAAAAAAAAAAAAKAKBACgCgQAAAAAAAAAAACwCgQAsAoEAAAAAAAAAAAAwAoEAMAKBAAAAAAAAAAAANAKBADQCgQAAAAAAAAAAADgCgQA4AoEAAAAAAAAAAAA8AoEAPAKBAAAAAAAAAAAAAALBAAACwQAAAAAAAAAAAAQCwQAEAsEAAAAAAAAAAAAIAsEACALBAAAAAAAAAAAADALBAAwCwQAAAAAAAAAAABACwQAQAsEAAAAAAAAAAAAUAsEAFALBAAAAAAAAAAAAGALBABgCwQAAAAAAAAAAABwCwQAcAsEAAAAAAAAAAAAgAsEAIALBAAAAAAAAAAAAJALBACQCwQAAAAAAAAAAACgCwQAoAsEAAAAAAAAAAAAsAsEALALBAAAAAAAAAAAAMALBADACwQAAAAAAAAAAADQCwQA0AsEAAAAAAAAAAAA4AsEAOALBAAAAAAAAAAAAPALBADwCwQAAAAAAAAAAAAADAQAAAwEAAAAAAAAAAAAEAwEABAMBAAAAAAAAAAAACAMBAAgDAQAAAAAAAAAAAAwDAQAMAwEAAAAAAAAAAAAQAwEAEAMBAAAAAAA/////wAAAAAAAAAAAAAAAAIAAABwBgQAqqqqqgAAAAAAAAAAAAAAAAAAAAAAAAAA");
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    await new Promise(r => setTimeout(r, 0));
    return bytes.buffer;
  })();
  env.loadModule(source, {"delay":true,"tableInitial":20,"multithreaded":false});
  env.linkVariables(true);

  // export root namespace and its methods and constants
  const { constructor: v0 } = root;
  const v1 = env.getSpecialExports();
  const {
    apply: v2,
  } = v0;

  exports.__zigar = v1;
  exports.apply = v2;
  exports.default = v0;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
