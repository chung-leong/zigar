(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Def = {}));
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

  const dict = globalThis[Symbol.for('ZIGAR')] ??= {};

  function __symbol(name) {
    return dict[name] ??= Symbol(name);
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
  const CACHE = symbol('cache');
  const SIZE = symbol('size');
  const BIT_SIZE = symbol('bit size');
  const ALIGN = symbol('align');
  const CONST_TARGET = symbol('const target');
  const ENVIRONMENT = symbol('environment');
  const PRIMITIVE = symbol('primitive');
  const SETTERS = symbol('setters');
  const TYPED_ARRAY = symbol('typed array');
  const SIGNATURE = symbol('signature');
  const RESTORE = symbol('restore');
  const VIVIFICATE = symbol('vivificate');
  const VISIT = symbol('visit');
  const COPY = symbol('copy');
  const SHAPE = symbol('shape');
  const INITIALIZE = symbol('initialize');
  const RESTRICT = symbol('restrict');
  const FINALIZE = symbol('finalize');
  const CAST = symbol('cast');

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

  function markAsSpecial({ get, set }) {
    get.special = set.special = true;
    return { get, set };
  }

  function getSelf() {
    return this;
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

  class InvalidIntConversion extends SyntaxError {
    constructor(arg) {
      super(`Cannot convert ${arg} to an Int`);
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

  class OutOfBound extends RangeError {
    constructor(member, index) {
      const { name } = member;
      super(`Index exceeds the size of ${name ?? 'array'}: ${index}`);
    }
  }

  class ReadOnly extends TypeError {
    constructor() {
      super(`Unable to modify read-only object`);
    }
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
      this.releaseZigView(dv);
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
    defineMemberInt(member) {
      let getAccessor = this.getAccessor;
      if (this.runtimeSafety) {
        getAccessor = this.addRuntimeCheck(getAccessor);
      }
      getAccessor = this.addIntConversion(getAccessor);
      return this.defineMemberUsing(member, getAccessor);
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
  const s0 = {}, s1 = {}, s2 = {}, s3 = {};

  // declare objects
  const o0 = {}, o1 = {}, o2 = {}, o3 = {};

  // define byte arrays
  const U = i => new Uint8Array(i);
  const a0 = U(8);
  const a1 = U(0);

  // fill in object properties
  const $ = Object.assign;
  $(o0, {
    memory: { array: a0 },
  });
  $(o1, {
    slots: {
      0: o2,
    },
  });
  $(o2, {
    structure: s0,
    memory: { array: a1 },
    slots: {
      0: o3,
    },
  });
  $(o3, {
    structure: s2,
  });

  // fill in structure properties
  $(s0, {
    ...s,
    flags: 9,
    signature: 0x406b8a99e2cc9d59n,
    name: "type",
    align: 1,
    instance: {
      members: [
        {
          ...m,
          type: 6,
          bitOffset: 0,
          bitSize: 0,
          byteSize: 0,
          slot: 0,
          structure: s0,
        },
      ],
    },
  });
  $(s1, {
    ...s,
    flags: 1,
    signature: 0xbdb875b052db9ef8n,
    name: "i32",
    byteSize: 4,
    align: 4,
    instance: {
      members: [
        {
          ...m,
          type: 2,
          bitOffset: 0,
          bitSize: 32,
          byteSize: 4,
          structure: s1,
        },
      ],
    },
  });
  $(s2, {
    ...s,
    type: 2,
    flags: 16,
    signature: 0x3332ef94e8102bf2n,
    name: "Struct",
    byteSize: 8,
    align: 4,
    instance: {
      members: [
        {
          ...m,
          type: 2,
          bitOffset: 0,
          bitSize: 32,
          byteSize: 4,
          slot: 0,
          name: "number1",
          structure: s1,
        },
        {
          ...m,
          type: 2,
          bitOffset: 32,
          bitSize: 32,
          byteSize: 4,
          slot: 1,
          name: "number2",
          structure: s1,
        },
      ],
      template: o0
    },
  });
  $(s3, {
    ...s,
    type: 2,
    signature: 0x239ab4f327f6ac1bn,
    name: "def",
    align: 1,
    static: {
      members: [
        {
          ...m,
          type: 5,
          flags: 2,
          slot: 0,
          name: "Struct",
          structure: s0,
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
    libc: false,
  };

  // create runtime environment
  const env = createEnvironment();

  // recreate structures
  env.recreateStructures(structures, settings);

  // export root namespace and its methods and constants
  const { constructor: v0 } = root;
  const v1 = env.getSpecialExports();
  const {
    Struct: v2,
  } = v0;

  exports.Struct = v2;
  exports.__zigar = v1;
  exports.default = v0;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
