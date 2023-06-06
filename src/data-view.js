import { MemberType, getTypeName } from './types.js';
import { DATA } from './symbols.js';

export function obtainDataViewGetter({ type, bits, signed, bitOffset }) {
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
      const shift = 8 - bitPos;
      const leadMask = ((2 ** shift) - 1) << bitPos;
      const trailMask = 0xFF ^ leadMask;
      const set = DataView.prototype.setUint8;
      fn = function(offset, littleEndian) {
        var i = offset, j = 0;
        // read leading byte, mask off bits before bit offset, and shift them to the start of the byte
        var n = get.call(this, i++);
        var overhang = (n & leadMask) >>> bitPos;
        var remaining = bits - shift;
        var b;
        while (remaining >= 8) {
          // read next bytes, shift it forward, and combine it with bits that came before
          n = get.call(this, i++);
          b = overhang | ((n & trailMask) << shift);
          set.call(dest, j++, b);
          // new leftover
          overhang = (n & leadMask) >>> bitPos;
          remaining -= 8;
        }
        if (remaining > 0) {
          const finalMask = ((2 ** remaining) - 1) << bitPos;
          n = get.call(this, i);
          b = overhang | ((n & finalMask) << shift);
          set.call(dest, j, b);
        }
        return getAligned.call(dest, 0, littleEndian);
      };
    }
  }
  Object.defineProperty(fn, 'name', { value: name, writable: false });
  methodCache[name] = fn;
  return fn;
}

export function obtainDataViewSetter({ type, bits, signed, bitOffset }) {
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
        const abits = [ 8, 16, 32, 64 ].find(b => b >= bits);
        const typeName = getTypeName(type, abits, signed);
        const set = DataView.prototype[`set${typeName}`];
        if (signed) {

        } else {

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
        const signMask = (bits - 1) ** 2;
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
      const dest = new DataView(new ArrayBuffer(Math.ceil(bits / 8)));
      const setAligned = obtainDataViewSetter({ type, bits, signed, bitOffset: 0 });
      const shift = 8 - bitPos;
      const leadMask = ((2 ** shift) - 1) << bitPos;
      const trailMask = 0xFF ^ leadMask;
      fn = function(offset, value, littleEndian) {
        setAligned.call(dest, 0, value, littleEndian);

      };
    }
  }
  Object.defineProperty(fn, 'name', { value: name, writable: false });
  methodCache[name] = fn;
  return fn;
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
