import { MemberType, getTypeName } from './types.js';
import { copyBits, applyBits } from './memory.js';
import { throwSizeMismatch, throwBufferExpected } from './errors.js';
import { DATA } from './symbols.js';

export function obtainDataViewGetter({ type, bits, signed, align, bitOffset }) {
  const bitPos = bitOffset & 0x07;
  const name = getMethodName('get', type, bits, signed, bitPos);
  if (DataView.prototype[name]) {
    return DataView.prototype[name];
  }
  if (methodCache[name]) {
    return methodCache[name];
  }
  var fn;
  if (align !== 0) {
    if (type === MemberType.Int) {
      if (bits < 64) {
        // actual number of bits needed when stored byte-aligned
        const abits = align * 8;
        const typeName = getTypeName(type, abits, signed);
        const get = DataView.prototype[`get${typeName}`];
        if (signed) {
          const signMask = (bits <= 32) ? 2 ** (bits - 1) : 2n ** BigInt(bits - 1);
          const valueMask = (bits <= 32) ? signMask - 1 : signMask - 1n; 
          fn = function(offset, littleEndian) {
            const n = get.call(this, offset, littleEndian);
            return (n & valueMask) - (n & signMask);
          };
        } else {
          const valueMask = (bits <= 32) ? (2 ** bits) - 1: (2n ** BigInt(bits)) - 1n; 
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
        const signMask = (bits - 1) ** 2;
        const valueMask = signMask - 1;
        fn = function(offset) {
          const n = get.call(this, offset);
          const s = n >>> bitPos;
          const v = s & valueMask;
          return (s & signMask) ? -v : v;
        };
      } else {
        const valueMask = (bits ** 2 - 1) << bitPos; 
        fn = function(offset) {
          const n = get.call(this, offset);
          const s = n >>> bitPos;
          return s & valueMask;
        };
      }
    } else {
      // pathological usage--handle it anyway by copying the bits into a 
      // temporary buffer, bit-aligning the data
      const dest = new DataView(new ArrayBuffer(Math.ceil(bits / 8)));
      const getAligned = obtainDataViewGetter({ type, bits, signed, bitOffset: 0 });
      fn = function(offset, littleEndian) {
        copyBits(dest, this, offset, bitPos, bits);
        return getAligned.call(dest, 0, littleEndian);
      };
    }
  }
  Object.defineProperty(fn, 'name', { value: name, writable: false });
  methodCache[name] = fn;
  return fn;
}

export function obtainDataViewSetter({ type, bits, signed, align, bitOffset }) {
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
  if (align !== 0) {
    if (type === MemberType.Int) {
      if (bits < 64) {
        const abits = align * 8;
        const typeName = getTypeName(type, abits, signed);
        const set = DataView.prototype[`set${typeName}`];
        if (signed) {
          const signMask = (bits <= 32) ? 2 ** (bits - 1) : 2n ** BigInt(bits - 1);
          const valueMask = (bits <= 32) ? signMask - 1 : signMask - 1n; 
          fn = function(offset, v, littleEndian) {
            const n = (v < 0) ? signMask | (v & valueMask) : v & valueMask;
            set.call(this, offset, n, littleEndian);
          };
        } else {
          const valueMask = (bits <= 32) ? (2 ** bits) - 1: (2n ** BigInt(bits)) - 1n; 
          fn = function(offset, v, littleEndian) {
            const n = v & valueMask;
            set.call(this, offset, n, littleEndian);
          };
        }
      } else {

      }
    }
  } else {
    const get = DataView.prototype.getInt8;
    const set = DataView.prototype.setInt8;
    if (type === MemberType.Bool && bits === 1) {
      const mask = 1 << bitPos;
      fn = function(offset, value) {
        const n = get.call(this, offset);
        const b = (value) ? n | mask : n & ~mask;
        set.call(this, offset, b);
      };
    } else if (type === MemberType.Int && bitPos + bits <= 8) {
      if (signed) {
        const signMask = 2 ** (bits - 1);
        const valueMask = signMask - 1;
        const outsideMask = 0xFF ^ ((valueMask | signMask) << bitPos);
        fn = function(offset, value) {
          const n = get.call(this, offset);
          const v = (value < 0) ? (-value & valueMask) | signMask : value & valueMask;
          const b = (n & outsideMask) | (v << bitPos);
          set.call(this, offset, b);
        };
      } else {
        const valueMask = (bits ** 2) - 1; 
        const outsideMask = 0xFF ^ (valueMask << bitPos);
        fn = function(offset, value) {
          const n = get.call(this, offset);
          const v = value & valueMask;
          const b = (n & outsideMask) | (v << bitPos);
          set.call(this, offset, b);
        };
      }
    } else {
      const src = new DataView(new ArrayBuffer(Math.ceil(bits / 8)));
      const setAligned = obtainDataViewSetter({ type, bits, signed, bitOffset: 0 });
      fn = function(offset, value, littleEndian) {
        setAligned.call(src, 0, value, littleEndian);
        applyBits(this, src, offset, bitPos, bits);
      };
    }
  }
  Object.defineProperty(fn, 'name', { value: name, writable: false });
  methodCache[name] = fn;
  return fn;
}

export function obtainDataView(arg, size, multiple = false) {
  var dv;
  if (arg instanceof DataView) {
    dv = arg;
  } else if (arg instanceof ArrayBuffer || arg instanceof SharedArrayBuffer) {
    dv = new DataView(arg);
  } else {
    throwBufferExpected(size);
  }
  if (multiple) {
    if (dv.byteLength % size !== 0) {
      throwSizeMismatch(dv.byteLength, size, true);
    }
  } else {
    if (dv.byteLength !== size) {
      throwSizeMismatch(dv.byteLength, size);
    } 
  }
  return dv;
}

export function getDataView() {
  return this[DATA];
}

function getMethodName(prefix, type, bits, signed, bitPos) {
  const typeName = getTypeName(type, bits, signed);
  const suffix = (bitPos > 0) ? `Bit${bitPos}` : ``;
  return `${prefix}${typeName}${suffix}`;
}
  
const methodCache = {};
