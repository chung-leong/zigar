export const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Float: 3,
  Compound: 4,
  Pointer: 5,
};

export const StructureType = {
  Singleton: 0,
  Array: 1,
  Struct: 2,
  Union: 3,
  Enumeration: 4,
};

export const DATA = Symbol('data');
export const RELOCATABLE = Symbol('relocatable');

const COPY = Symbol('copy');
const TYPED_ARRAY = Symbol('typedArray');

function getTypeName(type, bits, signed) {
  if (type === MemberType.Int) {
    return `${bits <= 32 ? '' : 'Big' }${signed ? 'Int' : 'Uint'}${bits}`;
  } else if (type === MemberType.Float) {
    return `Float${bits}`;
  } else if (type === MemberType.Bool) {
    return `Bool${bits}`;
  } else if (type === MemberType.Void) {
    return `Null`;
  }
}

function getMethodName(prefix, type, bits, signed, bitPos) {
  const typeName = getTypeName(type, bits, signed);
  const suffix = (bitPos > 0) ? `Bit${bitPos}` : ``;
  return `${prefix}${typeName}${suffix}`;
}
  
const methodCache = {};

function obtainDataViewGetter({ type, bits, signed, bitOffset }) {
  const bitPos = bitOffset & 0x07;
  const name = getMethodName('get', type, bits, signed, bitPos);
  if (DataView.prototype[name]) {
    return DataView.prototype[name];
  }
  if (methodCache[name]) {
    return methodCache[name];
  }
  var fn;
  if (bitPos === 0 && bits >= 8) {
    if (type === MemberType.Int) {
      if (bits < 64) {
        // actual number of bits needed when stored byte-aligned
        const abits = [ 8, 16, 32, 64 ].find(b => b >= bits);
        const typeName = getTypeName(type, abits, signed);
        const get = DataView.prototype[`get${typeName}`];
        if (signed) {
          const signMask = (bits <= 32) ? (abits - 1) ** 2 : BigInt((abits - 1) ** 2);
          const valueMask = signMask - 1; 
          fn = function(offset, littleEndian) {
            const n = get.call(this, offset, littleEndian);
            const v = n & valueMask;
            return (n & signMask) ? -v : v;
          };
        } else {
          const valueMask = (bits <= 32) ? abits ** 2  - 1: BigInt(abits ** 2 - 1); 
          fn = function(offset, littleEndian) {
            const n = get.call(this, offset, littleEndian);
            return n & valueMask;
          };
        }
      } else {
        // TODO
      }
    } else if (type === MemberType.Float) {
      // TODO
    } if (type === MemberType.Bool) {
      const typeName = `Int${bits}`;
      const get = DataView.prototype[`get${typeName}`];
      fn = function(offset, littleEndian) {
        return !!get.call(this, offset, littleEndian);
      };
    }     
  } else {
    const get = DataView.prototype.getUint8;
    if (type === MemberType.Bool && bits === 1) {
      // bitfield--common enough to warrant special handle
      const mask = 1 << bitPos;
      fn = function(offset) {
        const n = get.call(this, offset);
        return !!(n & mask);
      };
    } else if (type === MemberType.Int && bitPos + bits <= 8) {
      // sub-8-bit numbers also have real use cases
      if (signed) {
        const signMask = ((bits - 1) ** 2) << bitPos;
        const valueMask = signMask - 1; 
        fn = function(offset) {
          const n = get.call(this, offset);
          const v = (n & valueMask) >>> bitPos;
          return (n & signMask) ? -v : v;
        };
      } else {
        const valueMask = (bits ** 2 - 1) << bitPos; 
        fn = function(offset) {
          const n = get.call(this, offset);
          return (n & valueMask) >>> bitPos;
        };
      }
    } else {
      // pathological usage--handle it anyway by copying the bits into a 
      // temporary buffer, bit-aligning the data
      const dest = new DataView(new ArrayBuffer(Math.ceil(bits / 8)));
      const typeName = getTypeName(type, bits, signed);
      const getter = `get${typeName}`;
      const getAligned = dest[getter] ?? createGetter(getter, type, bits, signed, 0);
      const shift = 8 - bitPos;
      const leadMask = ((2 ** shift) - 1) << bitPos;
      const trailMask = 0xFF ^ leadMask;
      const set = DataView.prototype.setUint8;
      fn = function(offset, littleEndian) {
        var i = offset, j = 0;
        // read leading byte, mask off bits before bit offset, and shift them to the start of the byte
        var n = get.call(this, i++);
        var overhang = (byte & leadMask) >>> bitPos;
        var remaining = bits - shift;
        var byte;
        while (remaining >= 8) {
          // read next bytes, shift it forward, and combine it with bits that came before
          n = get.call(this, i++);
          byte = overhang | ((n & trailMask) << shift);
          set.call(dest, j++, b);
          // new leftover
          overhang = (n & leadMask) >>> bitPos;
          remaining -= 8;
        }
        if (remaining > 0) {
          const finalMask = ((2 ** remaining) - 1) << bitPos;
          n = get.call(this, i);
          byte = overhang | ((n & finalMask) << shift);
          set.call(dest, j, b);
        }
        return getAligned(dest, 0, littleEndian);
      };
    }
  }
  Object.defineProperty(fn, 'name', { value: name, writable: false });
  methodCache[name] = fn;
  return fn;
}

function obtainDataViewSetter({ type, bits, signed, bitOffset }) {
  const bitPos = bitOffset & 0x07;
  const name = getMethodName('set', type, bits, signed, bitPos);
  if (DataView.prototype[name]) {
    return DataView.prototype[name];
  }
  if (methodCache[name]) {
    return methodCache[name];
  }
  // TODO remove empty function once all code paths are covered
  var fn = function() {};
  if (bitPos === 0 && bits >= 8) {
    if (type === Int) {
      if (bits < 64) {
      }
    }
  } else {
    const get = DataView.prototype.getInt8;
    const set = DataView.prototype.setInt8;
    if (type === MemberType.Bool && bits === 1) {
      const mask = 1 << bitPos;
      fn = function(offset, value) {
        const n = get.call(this, offset);
        const byte = (value) ? n | mask : n & ~mask;
        set.call(this, offset, byte);
      };
    }
  }
  Object.defineProperty(fn, 'name', { value: name, writable: false });
  methodCache[name] = fn;
  return fn;
}

function obtainGetter(member, options) {
  const {
    littleEndian = true,
  } = options;
  switch (member.type) {
    case MemberType.Compound:
    case MemberType.Pointer: {
      // get object from slot
      const { slot } = member;
      return function() { return this[RELOCATABLE][slot] };
    } 
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Float: {
      // get value from buffer through DataView
      const get = obtainDataViewGetter(member);
      const { bitOffset } = member;
      const offset = bitOffset >> 3;
      return function() { return get.call(this[DATA], offset, littleEndian) };
    }
    case MemberType.Void: {
      return function() { return null }; 
    }
  }
}

function getIntRange(bits, signed) {
  if (bits <= 32) {
    const max = 2 ** (signed ? bits - 1 : bits) - 1;
    const min = (signed) ? -(2 ** (bits - 1)) : 0;
    return { min, max };
  } else {
    bits = BigInt(bits);
    const max = 2n ** (signed ? bits - 1n : bits) - 1n;
    const min = (signed) ? -(2n ** (bits - 1n)) : 0n;
    return { min, max };
  }
}

function throwOverflow(bits, signed, v) {
  const typeName = getTypeName(MemberType.Int, bits, signed);
  throw new TypeError(`${typeName} cannot represent value '${v}'`);
}

function obtainSetter(member, options) {
  const {
    littleEndian = true,
    runtimeSafety = true,
  } = options;
  var fn;
  switch (member.type) {
    case MemberType.Compound: {
      const { slot, struct } = member;
      fn = function(v) {
        if (!(v instanceof struct)) {
          v = new struct(v);
        }
        const reloc = this[RELOCATABLE][slot];
        const copy = reloc[COPY];
        copy.call(reloc, v);
      };  
    } break;
    case MemberType.Pointer: {
      const { slot, struct, mutable } = member;
      if (!mutable) {
        return;
      } 
      return function(v) {
        if (!(v instanceof struct)) {
          v = new struct(v);
        }
        this[RELOCATABLE][slot] = v;
      };    
    }
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Float: {
      // change buffer through DataView
      const set = obtainDataViewSetter(member);
      const { type, bitOffset } = member;
      const offset = bitOffset >> 3;
      if (runtimeSafety && type === MemberType.Int) {
        const { bits, signed } = member;
        const { min, max } = getIntRange(bits, signed);
        fn = function(v) { 
          if (v < min || v > max) {
            throwOverflow(bits, signed, v);
          }
          set.call(this[DATA], offset, v, littleEndian);
        };
      } else {
        fn = function(v) { set.call(this[DATA], offset, v, littleEndian) };
      }
    } break;
    case MemberType.Void: {
      fn = function() {};
    } break;
  }
  return fn;
}

function getDataView() {
  return this[DATA];
}

const typedArrays = {
  Int8: Int8Array,
  Uint8: Uint8Array,
  Int16: Int16Array,
  Uint16: Uint16Array,
  Int32: Int32Array,
  Uint32: Uint32Array,
  Int64: BigInt64Array,
  Uint64: BigUint64Array,
  Float32: Float32Array,
  Float64: Float64Array,
};

const typedArrayGetters = {};

function obtainTypedArrayGetter(members) {
  const hash = {};
  for (const { type, bits, bitOffset, signed } of members) {
    if (type === MemberType.Int || type === MemberType.Float) {
      const typeName = getTypeName(type, bits, signed);
      const constructor = typedArrays[typeName];
      if (!constructor) {
        return;
      }
      hash[typeName] = constructor;
    } else {
      return;
    }
  }
  const entries = Object.entries(hash);
  if (entries.length !== 1) {
    return;
  }
  const [ typeName, constructor ] = entries[0];
  if (typedArrayGetters[typeName]) {
    return typedArrayGetters[typeName];
  }
  const size = members[0].bits >> 3;
  const fn = function() {
    if (!this[TYPED_ARRAY]) {
      const dv = this[DATA];
      this[TYPED_ARRAY] = new constructor(dv.buffer, dv.byteOffset, dv.byteLength / size);
    }
    return this[TYPED_ARRAY];
  };
  typedArrayGetters[typeName] = fn;
  return fn;
}

function copy1(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i++) {
    dest.setInt8(i, src.getInt8(i));
  }
}

function copy4(dest, src) {
  for (let i = 0, len = dest.byteLength; i < len; i += 4) {
    dest.setInt32(i, src.getInt32(i));
  }
}

export function defineStructure(def, options = {}) {
  const { 
    size,
    type,
    members,
    staticStruct,
    defaultData,
    defaultPointers,
    exposeDataView = false,
  } = def;
  // create prototype
  const proto = {};
  switch (type) {
    case StructureType.Singleton: {
      const [ member ] = members;
      proto.get = obtainGetter(member, options);
      proto.set = obtainSetter(member, options);
    } break;
    case StructureType.Array: {

    } break;
    case StructureType.Struct: {
      for (const member of members) {
        const get = obtainGetter(member, options);
        const set = obtainSetter(member, options);
        Object.defineProperty(proto, member.name, { get, set, configurable: true, enumerable: true });
      } 
    } break;     
  }
  if (exposeDataView && !members.find(m => m.name === 'dataView')) {
    Object.defineProperty(proto, 'dataView', { get: getDataView, configurable: true, enumerable: true });
    const getTypedArray = obtainTypedArrayGetter(members);
    if (getTypedArray) {
      Object.defineProperty(proto, 'typedArray', { get: getTypedArray, configurable: true, enumerable: true });
    }
  }
  // create constructor
  const copy = (size & 0x03) ? copy1 : copy4;
  const hasRelocatable = !!members.find(m => m.type === MemberType.Compound || m.type === MemberType.Pointer);
  const compoundMembers = members.filter(m => m.type === MemberType.Compound);
  const internalPointers = (compoundMembers.length > 0) && compoundMembers.map(({ struct, bitOffset, bits, slot }) => {
    return { struct, slot, offset: bitOffset >> 3, size: bits >> 3 };
  });
  const struct = function(arg) {
    var dv;
    if (arg instanceof ArrayBuffer || arg instanceof SharedArrayBuffer) {
      dv = new DataView(arg);
    } else if (arg instanceof DataView) {
      dv = arg;
    }
    if (dv) {
      if (dv.byteLength !== size) {
        throw new Error(`Struct size mismatch: ${dv.byteLength} != ${size}`);
      }
    } else if (size > 0) {
      dv = new DataView(new ArrayBuffer(size));
      copy(dv, defaultData);
    }   
    if (dv) {
      this[DATA] = dv;
    }
    if (hasRelocatable) {
      const relocs = this[RELOCATABLE] = {};
      if (defaultPointers) {
        for (const [ slot, value ] of Object.entries(defaultPointers)) {
          relocs[slot] = value;
        }
      }
      if (internalPointers) {
        // initialize compound members (array, struct, etc.), storing them 
        // in relocatables even through they aren't actually relocatable
        const buffer = dv.buffer;
        for (const { struct, slot, offset, size } of internalPointers) {
          const mdv = new DataView(buffer, offset, size);
          const obj = new struct(mdv);
          relocs[slot] = obj;
        }
      } 
    } 
  };  
  if (staticStruct) {
    Object.setPrototypeOf(struct, staticStruct.prototype);
  }
  Object.defineProperty(struct, 'prototype', { value: proto });
  return struct;
}