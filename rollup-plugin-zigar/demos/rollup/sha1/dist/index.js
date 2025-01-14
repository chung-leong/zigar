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
  HasSentinel:      0x0010,
  IsString:         0x0020,
  IsTypedArray:     0x0040,
  IsClampedArray:   0x0080,
};
const StructFlag = {
  IsExtern:         0x0010,
  IsPacked:         0x0020,
  IsIterator:       0x0040,
  IsTuple:          0x0080,

  IsAllocator:      0x0100,
  IsPromise:        0x0200,
  IsGenerator:      0x0400,
  IsAbortSignal:    0x0800,
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
  IsTypedArray:     0x0040,
  IsClampedArray:   0x0080,

  IsOpaque:         0x0100,
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

const VisitorFlag = {
  IsInactive:       0x0001,
  IsImmutable:      0x0002,

  IgnoreUncreated:  0x0004,
  IgnoreInactive:   0x0008,
  IgnoreArguments:  0x0010,
  IgnoreRetval:     0x0020,
};

const dict = globalThis[Symbol.for('ZIGAR')] ??= {};

function __symbol(name) {
  return dict[name] ??= Symbol(name);
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
const POINTER = symbol('pointer');
const SENTINEL = symbol('sentinel');
const ARRAY = symbol('array');
const TARGET = symbol('target');
const ENTRIES = symbol('entries');
const MAX_LENGTH = symbol('max length');
const KEYS = symbol('keys');
const ADDRESS = symbol('address');
const LENGTH = symbol('length');
const LAST_ADDRESS = symbol('last address');
const LAST_LENGTH = symbol('last length');
const PROXY = symbol('proxy');
const CACHE = symbol('cache');
const SIZE = symbol('size');
const BIT_SIZE = symbol('bit size');
const ALIGN = symbol('align');
const CONST_TARGET = symbol('const target');
const CONST_PROXY = symbol('const proxy');
const ENVIRONMENT = symbol('environment');
const ATTRIBUTES = symbol('attributes');
const PRIMITIVE = symbol('primitive');
const SETTERS = symbol('setters');
const TYPED_ARRAY = symbol('typed array');
const THROWING = symbol('throwing');
const PROMISE = symbol('promise');
const GENERATOR = symbol('generator');
const CALLBACK = symbol('callback');
const SIGNATURE = symbol('signature');

const UPDATE = symbol('update');
const RESTORE = symbol('restore');
const VIVIFICATE = symbol('vivificate');
const VISIT = symbol('visit');
const COPY = symbol('copy');
const SHAPE = symbol('shape');
const INITIALIZE = symbol('initialize');
const FINALIZE = symbol('finalize');
const CAST = symbol('cast');
const RETURN = symbol('return');

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
const usizeMax = 0xFFFF_FFFF;
const usizeInvalid = -1;

const isInvalidAddress = function(address) {
    return address === 0xaaaa_aaaa || address === -1431655766;
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

function isCompatibleType(TypeA, TypeB) {
  return (TypeA === TypeB)
      || ((TypeA?.[SIGNATURE] === TypeB[SIGNATURE]) && (TypeA[ENVIRONMENT] !== TypeB[ENVIRONMENT]));
}

function isCompatibleInstanceOf(object, Type) {
  return (object instanceof Type) || isCompatibleType(object?.constructor, Type);
}

function markAsSpecial({ get, set }) {
  get.special = set.special = true;
  return { get, set };
}

function getSelf() {
  return this;
}

function getProxy() {
  return this[PROXY];
}

function empty() {}

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
          defineProperty(prototype, name, defineValue(object));
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

function createEnvironment() {
  // define Environment class, incorporating methods and properties in imported mixins
  const Env = defineEnvironment();
  return new Env();
}

// handle retrieval of accessors

mixin({
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
    if (!accessor) {
      throw new Error(`No accessor available: ${accessorName}`);
    }
    defineProperty(accessor, 'name', defineValue(accessorName));
    this.accessorCache.set(accessorName, accessor);
    return accessor;
  },
});

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
  constructor(expected, actual, variadic = false) {
    super();
    this.fnName = 'fn';
    this.argIndex = expected;
    this.argCount = actual;
    this.variadic = variadic;
  }

  get message() {
    const s = (this.argIndex !== 1) ? 's' : '';
    let count = this.argIndex;
    if (this.variadic) {
      count = `at least ${count}`;
    }
    return `${this.fnName}(): Expecting ${count} argument${s}, received ${this.argCount}`;
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
  constructor(structure, arg) {
    super(`Pointers in Zig memory cannot point to garbage-collected object`);
  }
}

class OutOfBound extends RangeError {
  constructor(member, index) {
    const { name } = member;
    super(`Index exceeds the size of ${name ?? 'array'}: ${index}`);
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
    fnName: defineValue('fn'),
    argIndex: defineValue(argIndex),
    argCount: defineValue(argCount),
    message: {
      get() {
        const { fnName, argIndex, argCount } = this;
        const argName = `args[${argIndex}]`;
        const prefix = (argIndex !== 0) ? '..., ' : '';
        const suffix = (argIndex !== argCount - 1) ? ', ...' : '';
        const argLabel = prefix + argName + suffix;
        return `${fnName}(${argLabel}): ${message}`;
      },
    }
  });
  return this;
}

function replaceRangeError(member, index, err) {
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
      try {
        return thisEnv.invokeThunk(thunk, self, new ArgStruct(args));
      } catch (err) {
        if ('fnName' in err) {
          err.fnName = self.name;
        }
        {
          // do nothing when exit code is 0
          if (err instanceof Exit && err.code === 0) {
            return;
          }
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
      let arg, promise, generator, signal;
      if (structure.type === StructureType.Struct) {
        if (structure.flags & StructFlag.IsAllocator) {
          // use programmer-supplied allocator if found in options object, handling rare scenarios
          // where a function uses multiple allocators
          const allocator = (++allocatorCount === 1)
          ? options?.['allocator'] ?? options?.['allocator1']
          : options?.[`allocator${allocatorCount}`];
          // otherwise use default allocator which allocates relocatable memory from JS engine
          arg = allocator ?? this.createDefaultAllocator(dest, structure);
        } else if (structure.flags & StructFlag.IsPromise) {
          // invoke programmer-supplied callback if there's one, otherwise a function that
          // resolves/rejects a promise attached to the argument struct
          if (!promise) {
            promise = {
              ptr: null,
              callback: this.createPromiseCallback(dest, options?.['callback']),
            };
          }
          arg = promise;
        } else if (structure.flags & StructFlag.IsGenerator) {
          if (!generator) {
            generator = {
              ptr: null,
              callback: this.createGeneratorCallback(dest, options?.['callback']),
            };
          }
          arg = generator;
        } else if (structure.flags & StructFlag.IsAbortSignal) {
          // create an Int32Array with one element, hooking it up to the programmer-supplied
          // AbortSignal object if found
          if (!signal) {
            signal = { ptr: this.createSignalArray(structure, options?.['signal']) };
          }
          arg = signal;
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
    const context = this.startContext();
    const attrs = args[ATTRIBUTES];
    const thunkAddress = this.getViewAddress(thunk[MEMORY]);
    const fnAddress = this.getViewAddress(fn[MEMORY]);
    const hasPointers = VISIT in args;
    if (hasPointers) {
      this.updatePointerAddresses(context, args);
    }
    // return address of shadow for argumnet struct
    const argAddress = this.getShadowAddress(context, args, null, false)
    ;
    // get address of attributes if function variadic
    const attrAddress = (attrs) ? this.getShadowAddress(context, attrs) : 0
    ;
    this.updateShadows(context);
    const success = (attrs)
    ? this.runVariadicThunk(thunkAddress, fnAddress, argAddress, attrAddress, attrs.length)
    : this.runThunk(thunkAddress, fnAddress, argAddress);
    const finalize = () => {
      this.updateShadowTargets(context);
      // create objects that pointers point to
      if (hasPointers) {
        this.updatePointerTargets(context, args);
      }
      if (this.libc) {
        this.flushStdout?.();
      }
      this.flushConsole?.();
      this.endContext();
    };
    if (!success) {
      finalize();
      throw new ZigError();
    }
    {
      // copy retval from shadow view
      args[COPY]?.(this.findShadowView(args[MEMORY]));
    }
    if (FINALIZE in args) {
      args[FINALIZE] = finalize;
    } else {
      finalize();
    }
    const promise = args[PROMISE];
    const generator = args[GENERATOR];
    const callback = args[CALLBACK];
    if (callback) {
      try {
        // ensure the function hasn't return an error
        const { retval } = args;
        if (retval != null) {
          // if a function returns a value, then the promise is fulfilled immediately
          callback(null, retval);
        }
      } catch (err) {
        callback(null, err);
      }
      // this would be undefined if a callback function is used instead
      return promise ?? generator;
    } else {
      return args.retval;
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
  copiers: null,
  resetters: null,

  defineCopier(size, multiple) {
    const copy = this.getCopyFunction(size, multiple);
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
    const reset = this.getResetFunction(size);
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
  getCopyFunction(size, multiple = false) {
    if (!this.copiers) {
      this.copiers = this.defineCopiers();
    }
    const f = !multiple ? this.copiers[size] : undefined;
    return f ?? this.copiers.any;
  },
  getResetFunction(size) {
    if (!this.resetters) {
      this.resetters = this.defineResetters();
    }
    return this.resetters[size] ?? this.resetters.any;
  },
  defineCopiers() {
    const int8 = { type: MemberType.Int, bitSize: 8, byteSize: 1 };
    const int16 = { type: MemberType.Int, bitSize: 16, byteSize: 2 };
    const int32 = { type: MemberType.Int, bitSize: 32, byteSize: 4 };
    const getInt8 = this.getAccessor('get', int8);
    const setInt8 = this.getAccessor('set', int8);
    const getInt16 = this.getAccessor('get', int16);
    const setInt16 = this.getAccessor('set', int16);
    const getInt32 = this.getAccessor('get', int32);
    const setInt32 = this.getAccessor('set', int32);

    return {
      0: empty,
      1: function(dest, src) {
        setInt8.call(dest, 0, getInt8.call(src, 0));
      },
      2: function(dest, src) {
        setInt16.call(dest, 0, getInt16.call(src, 0, true), true);

      },
      4: function(dest, src) {
        setInt32.call(dest, 0, getInt32.call(src, 0, true), true);
      },
      8: function(dest, src) {
        setInt32.call(dest, 0, getInt32.call(src, 0, true), true);
        setInt32.call(dest, 4, getInt32.call(src, 4, true), true);
      },
      16: function(dest, src) {
        setInt32.call(dest, 0, getInt32.call(src, 0, true), true);
        setInt32.call(dest, 4, getInt32.call(src, 4, true), true);
        setInt32.call(dest, 8, getInt32.call(src, 8, true), true);
        setInt32.call(dest, 12, getInt32.call(src, 12, true), true);
      },
      'any': function(dest, src) {
        let i = 0, len = dest.byteLength;
        while (i + 4 <= len) {
          setInt32.call(dest, i, getInt32.call(src, i, true), true);
          i += 4;
        }
        while (i + 1 <= len) {
          setInt8.call(dest, i, getInt8.call(src, i));
          i++;
        }
      },
    }
  },
  defineResetters() {
    const int8 = { type: MemberType.Int, bitSize: 8, byteSize: 1 };
    const int16 = { type: MemberType.Int, bitSize: 16, byteSize: 2 };
    const int32 = { type: MemberType.Int, bitSize: 32, byteSize: 4 };
    const setInt8 = this.getAccessor('set', int8);
    const setInt16 = this.getAccessor('set', int16);
    const setInt32 = this.getAccessor('set', int32);
    return {
      0: empty,
      1: function(dest, offset) {
        setInt8.call(dest, offset, 0);
      },
      2: function(dest, offset) {
        setInt16.call(dest, offset, 0, true);

      },
      4: function(dest, offset) {
        setInt32.call(dest, offset, 0, true);
      },
      8: function(dest, offset) {
        setInt32.call(dest, offset + 0, 0, true);
        setInt32.call(dest, offset + 4, 0, true);
      },
      16: function(dest, offset) {
        setInt32.call(dest, offset + 0, 0, true);
        setInt32.call(dest, offset + 4, 0, true);
        setInt32.call(dest, offset + 8, 0, true);
        setInt32.call(dest, offset + 12, 0, true);
      },
      any: function(dest, offset, len) {
        let i = offset;
        while (i + 4 <= len) {
          setInt32.call(dest, i, 0, true);
          i += 4;
        }
        while (i + 1 <= len) {
          setInt8.call(dest, i, 0);
          i++;
        }
      },
    };
  },
  ...({
    defineRetvalCopier({ byteSize, bitOffset }) {
      if (byteSize > 0) {
        const thisEnv = this;
        const offset = bitOffset >> 3;
        const copy = this.getCopyFunction(byteSize);
        return {
          value(shadowDV) {
            const dv = this[MEMORY];
            const { address } = shadowDV[ZIG];
            const src = new DataView(thisEnv.memory.buffer, address + offset, byteSize);
            const dest = new DataView(dv.buffer, dv.byteOffset + offset, byteSize);
            copy(dest, src);
          }
        };
      }
    }
  } )
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
  memoryList: [],
  contextCount: 0,

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
    const copy = this.getCopyFunction();
    for (let { targetDV, shadowDV } of context.shadowList) {
      {
        shadowDV = this.restoreView(shadowDV);
      }
      copy(shadowDV, targetDV);
    }
  },
  updateShadowTargets(context) {
    const copy = this.getCopyFunction();
    for (let { targetDV, shadowDV, writable } of context.shadowList) {
      if (writable) {
        {
          shadowDV = this.restoreView(shadowDV);
        }
        copy(targetDV, shadowDV);
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
    } else if (entry?.address <= address && adjustAddress(address, len) < adjustAddress(entry.address, entry.len)) {
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
        const copy = this.getCopyFunction();
        copy(targetDV, shadowDV);
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
  allocateZigMemory(len, align, type = MemoryType.Normal) {
    const address = (len) ? this.allocateExternMemory(type, len, align) : 0;
    if (!address && len) {
      throw new Error('Out of memory');
    }
    const dv = this.obtainZigView(address, len);
    const zig = dv?.[ZIG];
    if (zig) {
      zig.align = align;
      zig.type = type;
    }
    return dv;
  },
  freeZigMemory(dv) {
    const { address, unalignedAddress, len, align, type } = dv[ZIG];
    if (len) {
      this.freeExternMemory(type, unalignedAddress ?? address, len, align);
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
      allocateExternMemory: { argType: 'iii', returnType: 'i' },
      freeExternMemory: { argType: 'iiii' },
    },
    exports: {
      getViewAddress: { argType: 'v', returnType: 'i' },
    },
    usizeMaxBuffer: new ArrayBuffer(0),

    allocateShadowMemory(len, align) {
      return this.allocateZigMemory(len, align, MemoryType.Scratch);
    },
    freeShadowMemory(dv) {
      return this.freeZigMemory(dv);
    },
    obtainZigView(address, len) {
      if (isInvalidAddress(address)) {
        address = (len > 0) ? 0 : usizeMax;
      }
      if (!address && len) {
        return null;
      }
      if (address === usizeMax) {
        return this.obtainView(this.usizeMaxBuffer, 0, 0);
      } else {
        return this.obtainView(this.memory.buffer, address, len);
      }
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

mixin({
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
  abandonModule() {
    if (!this.abandoned) {
      this.releaseFunctions();
      this.unlinkVariables?.();
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
    nextValueIndex: 1,
    valueMap: new Map(),
    valueIndices: new Map(),
    options: null,
    executable: null,
    memory: null,
    table: null,
    initialTableLength: 0,
    exportedFunctions: null,

    async initialize(wasi) {
      this.setCustomWASI?.(wasi);
      await this.initPromise;
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
          defineProperty(this, name, { value: this.importFunction(fn, argType, returnType) });
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
      const suffix = (res[Symbol.toStringTag] === 'Response') ? /* c8 ignore next */ 'Streaming' : '';
      const w = WebAssembly;
      const f = w['compile' + suffix];
      const executable = this.executable = await f(res);
      const functions = this.exportFunctions();
      const env = {}, wasi = {}, wasiPreview = {};
      const exports = this.exportedModules = { env, wasi, wasi_snapshot_preview1: wasiPreview };
      for (const { module, name, kind } of w.Module.imports(executable)) {
        if (kind === 'function') {
          if (module === 'env') {
            env[name] = functions[name] ?? /* c8 ignore next */ empty;
          } else if (module === 'wasi_snapshot_preview1') {
            wasiPreview[name] = this.getWASIHandler(name);
          } else if (module === 'wasi') {
            wasi[name] = this.getThreadHandler?.(name) ?? /* c8 ignore next */ empty;
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
      return new w.Instance(executable, exports);
    },
    loadModule(source, options) {
      return this.initPromise = (async () => {
        const instance = await this.instantiateWebAssembly(source, options);
        const { exports } = instance;
        this.importFunctions(exports);
        this.trackInstance(instance);
        if (this.customWASI) {
          // use a proxy to attach the memory object to the list of exports
          const exportsPlusMemory = { ...exports, memory: this.memory };
          const instanceProxy = new Proxy(instance, {
            get(inst, name) {
              return (name === 'exports') ? exportsPlusMemory : /* c8 ignore next */ inst[name];
            }
          });
          this.customWASI.initialize?.(instanceProxy);
        }
        this.initialize();
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
  } ),
});

mixin({
  linkVariables(writeBack) {
    {
      // linkage occurs when WASM compilation is complete and functions have been imported
      if (!this.memory) {
        this.initPromise = this.initPromise.then(() => this.linkVariables(writeBack));
        return;
      }
    }
    const copy = this.getCopyFunction();
    for (const { object, handle } of this.variables) {
      const jsDV = object[MEMORY];
      // objects in WebAssembly have fixed addresses so the handle is the address
      // for native code module, locations of objects in memory can change depending on
      // where the shared library is loaded
      const address = handle ;
      const zigDV = object[MEMORY] = this.obtainZigView(address, jsDV.byteLength);
      if (writeBack) {
        copy(zigDV, jsDV);
      }
      object.constructor[CACHE]?.save?.(zigDV, object);
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
      object[VISIT]?.(function() { this[UPDATE](); });
    }
  },
  unlinkVariables() {
    const copy = this.getCopyFunction();
    for (const { object } of this.variables) {
      const zigDV = this.restoreView(object[MEMORY]) ;
      const zig = zigDV[ZIG];
      if (zig) {
        const jsDV = object[MEMORY] = this.allocateMemory(zig.len);
        copy(jsDV, zigDV);
      }
    }
  },
  ...({
    imports: {
      recreateAddress: { argType: 'i', returnType: 'i' },
    },
  } ),
  });

mixin({
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
      return true;
      /* c8 ignore next 4 */
    } catch (err) {
      console.error(err);
      return false;
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

mixin({
  viewMap: null,

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
    if (!target[MEMORY]) {
      if (byteSize !== undefined) {
        checkDataViewSize(dv, structure);
      }
      const len = dv.byteLength / elementSize;
      const source = { [MEMORY]: dv };
      target.constructor[SENTINEL]?.validateData?.(source, len);
      if (allocator) {
        // need to copy when target object is in Zig memory
        copy = true;
      }
      target[SHAPE](copy ? null : dv, len, allocator);
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
    let entry = (this.viewMap ??= new WeakMap()).get(buffer);
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
    {
      if (existing?.[ZIG]?.address === usizeInvalid) {
        // view was of previously freed memory
        existing = null;
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
      if (zig?.len > 0 && dv.buffer.byteLength === 0) {
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
            return true;
          } else {
            return false;
          }
        },
      }
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
        {
          this[RESTORE]?.();
        }
        const dv = this[MEMORY];
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

function setValue(slot, value, allocator) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATE](slot);
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
                throw replaceRangeError(member, index, err);
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
                throw replaceRangeError(member, index, err);
              }
            }
          },
        }
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
      [CONST_TARGET]: { value: null },
      [SETTERS]: defineValue(setters),
      [KEYS]: defineValue(keys),
      // add memory copier (from mixin "memory/copying")
      [COPY]: this.defineCopier(byteSize),
      ...({
        // add method for recoverng from array detachment
        [RESTORE]: this.defineRestorer(),
      } ),
    };
    const constructor = structure.constructor = f.call(this, structure, descriptors);
    for (const [ name, descriptor ] of Object.entries(descriptors)) {
      const s = descriptor?.set;
      if (s && !setters[name]) {
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
      [Symbol.iterator]: defineValue(getStructIterator),
      [ENTRIES]: { get: getStructEntries },
      [PROPS]: defineValue(props),
    };
    const descriptors = {
      [Symbol.toStringTag]: defineValue(name),
    };
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
      if (creating) {
        // initialize object unless that's done already
        if (!(SHAPE in self)) {
          self[INITIALIZE](arg, allocator);
        }
      }
      if (FINALIZE in self) {
        self = self[FINALIZE]();
      }
      return cache.save(dv, self);
    };
    defineProperty(constructor, CACHE, defineValue(cache));
    {
      if (template?.[MEMORY]) {
        defineProperty(template, RESTORE, this.defineRestorer());
      }
    }
    return constructor;
  },
  createApplier(structure) {
    const { instance: { template } } = structure;
    return function(arg, allocator) {
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
        }
      }
      for (const key of argKeys) {
        const set = setters[key];
        set.call(this, arg[key], allocator);
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
    descriptors.length = defineValue(argMembers.length);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArgStruct(members);
    descriptors[RETURN] = defineValue(descriptors.retval.set);
    descriptors[Symbol.iterator] = this.defineArgIterator?.(argMembers);
    {
      descriptors[COPY] = this.defineRetvalCopier(members[0]);
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
    const initializer = function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        this[COPY](arg);
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
    };
    descriptors.$ = { get: getProxy, set: initializer };
    descriptors.length = defineValue(length);
    descriptors.entries = defineValue(getArrayEntries);
    if (flags & ArrayFlag.IsTypedArray) {
      descriptors.typedArray = this.defineTypedArray(structure);
      if (flags & ArrayFlag.IsString) {
        descriptors.string = this.defineString(structure);
      }
      if (flags & ArrayFlag.IsClampedArray) {
        descriptors.clampedArray = this.defineClampedArray(structure);
      }
    }
    descriptors[Symbol.iterator] = defineValue(getArrayIterator);
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = this.defineFinalizerArray(descriptor);
    descriptors[ENTRIES] = { get: getArrayEntries };
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorArray(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArray();
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
      {
        this[RESTORE]?.();
      }
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

mixin({
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
        if (ArgStruct[TYPE] === StructureType.VariadicStruct) {
          throw new Unsupported();
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
      return self;
    };
    // make function type a superclass of Function
    Object.setPrototypeOf(constructor.prototype, Function.prototype);
    descriptors.valueOf = descriptors.toJSON = defineValue(getSelf);
    return constructor;
  },
  finalizeFunction(structure, staticDescriptors, descriptors) {
    // don't change the tag of functions
    descriptors[Symbol.toStringTag] = undefined;
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
    const getTargetObject = function() {
      const pointer = this[POINTER] ?? this;
      const empty = !pointer[SLOTS][0];
      const target = updateTarget.call(pointer, null, empty);
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
          if (pointer[MEMORY][ZIG]) {
            throw new ZigMemoryTargetRequired(structure, arg);
          }
        }
      } else if (pointer[MEMORY][ZIG]) {
        setAddress.call(this, 0);
        setLength?.call?.(this, 0);
      }
      pointer[SLOTS][0] = arg ?? null;
      if (flags & PointerFlag.HasLength) {
        pointer[MAX_LENGTH] = null;
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
      const dv = target[MEMORY];
      const zig = dv[ZIG];
      const bytesAvailable = dv.buffer.byteLength - dv.byteOffset;
      // determine the maximum length
      let max;
      if (!zig) {
        if (flags & PointerFlag.HasLength) {
          max = this[MAX_LENGTH] ??= target.length;
        } else {
          max = (bytesAvailable / targetSize) | 0;
        }
      }
      if (len < 0 || len > max) {
        throw new InvalidSliceLength(len, max);
      }
      const byteLength = len * targetSize;
      const newDV = (byteLength <= bytesAvailable)
      // can use the same buffer
      ? thisEnv.obtainView(dv.buffer, dv.byteOffset, byteLength)
      // need to ask V8 for a larger external buffer
      : thisEnv.obtainZigView(zig.address, byteLength);
      const Target = targetStructure.constructor;
      this[SLOTS][0] = Target.call(ENVIRONMENT, newDV);
      setLength?.call?.(this, len);
    };
    const thisEnv = this;
    const initializer = function(arg, allocator) {
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
          arg[RESTORE]?.();
        }
        const constTarget = arg[CONST_TARGET];
        if (constTarget) {
          if (flags & PointerFlag.IsConst) {
            arg = constTarget;
          } else {
            throw new ReadOnlyTarget(structure);
          }
        }
      } else if (isCompatibleInstanceOf(arg, Target)) {
        // compatible object from a different module
        arg = Target.call(ENVIRONMENT, arg[MEMORY]);
      } else if (flags & PointerFlag.IsSingle && flags & PointerFlag.IsMultiple && arg instanceof Target.child) {
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
        const autoObj = new Target(arg, { allocator });
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
      const zig = arg?.[MEMORY]?.[ZIG];
      if (zig?.address === usizeInvalid) {
        throw new PreviouslyFreed(arg);
      }
      this[TARGET] = arg;
    };
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
    descriptors[Symbol.toPrimitive] = (targetType === StructureType.Primitive) && {
      value(hint) {
        return this[TARGET][Symbol.toPrimitive](hint);
      }
    };
    descriptors[INITIALIZE] = defineValue(initializer);
    descriptors[FINALIZE] = {
      value() {
        const handlers = (targetType !== StructureType.Pointer) ? proxyHandlers : {};
        let self;
        if (targetType === StructureType.Function) {
          // use an empty function as object so the proxy's apply() method is triggered
          self = function() {};
          self[MEMORY] = this[MEMORY];
          self[SLOTS] = this[SLOTS];
          Object.setPrototypeOf(self, constructor.prototype);
        } else {
          self = this;
        }
        const proxy = new Proxy(self, handlers);
        // hide the proxy so console wouldn't display a recursive structure
        Object.defineProperty(self, PROXY, { value: proxy });
        return proxy;
      }
    };
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
  apply(pointer, thisArg, args) {
    const f = pointer['*'];
    return f.apply(thisArg, args);
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
  },
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

mixin({
  definePrimitive(structure, descriptors) {
    const {
      instance: { members: [ member ] },
    } = structure;
    const propApplier = this.createApplier(structure);
    const { get, set } = this.defineMember(member);
    const initializer = function(arg) {
      if (isCompatibleInstanceOf(arg, constructor)) {
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

mixin({
  defineSlice(structure, descriptors) {
    const {
      align,
      flags,
      byteSize,
      name,
      instance: {
        members: [ member ],
      },
    } = structure;
    const { byteSize: elementSize, structure: elementStructure } = member;
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
    const initializer = function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        if (!this[MEMORY]) {
          shapeDefiner.call(this, null, arg.length, allocator);
        } else {
          shapeChecker.call(this, arg, arg.length);
        }
        this[COPY](arg);
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
    if (flags & SliceFlag.IsTypedArray) {
      descriptors.typedArray = this.defineTypedArray(structure);
      if (flags & SliceFlag.IsString) {
        descriptors.string = this.defineString(structure);
      }
      if (flags & SliceFlag.IsClampedArray) {
        descriptors.clampedArray = this.defineClampedArray(structure);
      }
    }
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
          zig = false
        } = options;
        const dv1 = getSubArrayView.call(this, begin, end);
        const dv2 = thisEnv.allocateMemory(dv1.byteLength, align, zig);
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
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArray();
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
      flags,
      length,
      instance: { members },
    } = structure;
    const backingIntMember = members.find(m => m.flags & MemberFlag.IsBackingInt);
    const backingInt = backingIntMember && this.defineMember(backingIntMember);
    const propApplier = this.createApplier(structure);
    const initializer = function(arg, allocator) {
      if (isCompatibleInstanceOf(arg, constructor)) {
        this[COPY](arg);
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
    descriptors.length = defineValue(length);
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
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(members);
    descriptors[ENTRIES] = { get: (flags & StructFlag.IsTuple) ? getVectorEntries : getStructEntries };
    descriptors[PROPS] = defineValue(props);
    if (flags & StructFlag.IsAllocator) {
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
        {
          this[RESTORE]?.();
        }
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
    this[SLOTS][0] = src[SLOTS][0];
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
  recreateStructures(structures, settings) {
    Object.assign(this, settings);
    const insertObjects = (dest, placeholders) => {
      for (const [ slot, placeholder ] of Object.entries(placeholders)) {
        dest[slot] = createObject(placeholder);
      }
      return dest;
    };
    // empty arrays aren't replicated
    const getBuffer = a => (a.length) ? a.buffer : new ArrayBuffer(0);
    const createObject = (placeholder) => {
      const { memory, structure, actual } = placeholder;
      if (memory) {
        if (actual) {
          return actual;
        } else {
          const { array, offset, length } = memory;
          const dv = this.obtainView(getBuffer(array), offset, length);
          const { handle, const: isConst } = placeholder;
          const constructor = structure?.constructor;
          const object = placeholder.actual = constructor.call(ENVIRONMENT, dv);
          if (isConst) {
            this.makeReadOnly(object);
          }
          if (placeholder.slots) {
            insertObjects(object[SLOTS], placeholder.slots);
          }
          if (handle) {
            // need to replace dataview with one pointing to Zig memory later,
            // when the VM is up and running
            this.variables.push({ handle, object });
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
  },
});

mixin({
  updatePointerAddresses(context, object) {
    // first, collect all the pointers
    const pointerMap = new Map();
    const bufferMap = new Map();
    const potentialClusters = [];
    const callback = function(flags) {
      // bypass proxy
      const pointer = this[POINTER];
      if (pointerMap.get(pointer) === undefined) {
        const target = pointer[SLOTS][0];
        if (target) {
          const writable = !pointer.constructor.const;
          const entry = { target, writable };
          // only targets in JS memory need updating
          const dv = target[MEMORY];
          if (!dv[ZIG]) {
            pointerMap.set(pointer, target);
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
            pointerMap.set(pointer, null);
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
      const pointer = this[POINTER];
      if (!pointerMap.get(pointer)) {
        pointerMap.set(pointer, true);
        const currentTarget = pointer[SLOTS][0];
        const newTarget = (!currentTarget || !(flags & VisitorFlag.IsImmutable))
        ? pointer[UPDATE](context, true, !(flags & VisitorFlag.IsInactive))
        : currentTarget;
        const targetFlags = (pointer.constructor.const) ? VisitorFlag.IsImmutable : 0;
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

// structure defaults
const s = {
  constructor: null,
  type: 0,
  flags: 0,
  signature: undefined,
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

// member defaults
const m = {
  type: 0,
  flags: 0,
};

// declare structure objects
const s0 = {}, s1 = {}, s2 = {}, s3 = {}, s4 = {}, s5 = {}, s6 = {};

// declare objects
const o0 = {}, o1 = {}, o2 = {};

// define byte arrays
const U = i => new Uint8Array(i);
const a0 = U(0);

// fill in object properties
const $ = Object.assign;
$(o0, {
  memory: { array: a0 },
  handle: 3,
});
$(o1, {
  slots: {
    0: o2,
  },
});
$(o2, {
  structure: s5,
  memory: { array: a0 },
  handle: 2,
});

// fill in structure properties
$(s0, {
  ...s,
  flags: 1,
  signature: 0x370ee22b85937307n,
  name: "u8",
  byteSize: 1,
  align: 1,
  instance: {
    members: [
      {
        ...m,
        type: 3,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
        structure: s0,
      },
    ],
  },
});
$(s1, {
  ...s,
  type: 1,
  flags: 224,
  signature: 0xb2507358c7aae5f2n,
  name: "[40]u8",
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
});
$(s2, {
  ...s,
  type: 9,
  flags: 224,
  signature: 0x9b3f78f92307ba61n,
  name: "[_]u8",
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
});
$(s3, {
  ...s,
  type: 8,
  flags: 188,
  signature: 0x7e2f0adf211d515en,
  name: "[]const u8",
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
        structure: s2,
      },
    ],
  },
});
$(s4, {
  ...s,
  type: 12,
  flags: 14,
  signature: 0x3f613966254660c5n,
  name: "Arg(fn ([]const u8) [40]u8)",
  length: 1,
  byteSize: 48,
  align: 4,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        flags: 1,
        bitOffset: 64,
        bitSize: 320,
        byteSize: 40,
        slot: 0,
        name: "retval",
        structure: s1,
      },
      {
        ...m,
        type: 5,
        flags: 1,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        name: "0",
        structure: s3,
      },
    ],
  },
});
$(s5, {
  ...s,
  type: 14,
  signature: 0x22ebba2cbb1239a5n,
  name: "fn ([]const u8) [40]u8",
  length: 1,
  instance: {
    members: [
      {
        ...m,
        type: 5,
        bitSize: 384,
        byteSize: 48,
        structure: s4,
      },
    ],
    template: o0
  },
});
$(s6, {
  ...s,
  type: 2,
  signature: 0x239ab4f327f6ac1bn,
  name: "sha1",
  align: 1,
  static: {
    members: [
      {
        ...m,
        type: 5,
        flags: 2,
        slot: 0,
        name: "sha1",
        structure: s5,
      },
    ],
    template: o1
  },
});
const structures = [
  s0, s1, s2, s3, s4, s5, s6,
];
const root = s6;
const settings = {
  runtimeSafety: false,
  littleEndian: true,
  libc: false,
};

// create runtime environment
const env = createEnvironment();

// recreate structures
env.recreateStructures(structures, settings);

// initiate loading and compilation of WASM bytecodes
const source = (async () => {
  // sha1.zig
  const binaryString = atob("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");
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  await new Promise(r => setTimeout(r, 0));
  return bytes.buffer;
})();
env.loadModule(source, {"memoryInitial":257,"tableInitial":10,"multithreaded":false});
env.linkVariables(false);

// export root namespace and its methods and constants
const { constructor: v0 } = root;
const v1 = env.getSpecialExports();
const {
  sha1: v2,
} = v0;
await v1.init();

export { v1 as __zigar, v0 as default, v2 as sha1 };
