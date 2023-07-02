import { MemberType } from './member.js';
import { getBitAlignFunction } from './memory.js';
import { throwSizeMismatch, throwBufferExpected } from './error.js';

export function getDataViewBoolAccessor(access, member) {
  return cacheMethod(access, member, () => {
    const { byteSize } = member;
    const typeName = getTypeName({ type: MemberType.Int, isSigned: true, bitSize: byteSize * 8 });
    const f = DataView.prototype[typeName];
    if (access === 'get') {
      const get = DataView.prototype[`get${typeName}`];
      return function(offset, littleEndian) {
        return !!get.call(this, offset, littleEndian);
      };
    } else {
      const set = DataView.prototype[`set${typeName}`];
      return function(offset, value, littleEndian) {
        set.call(this, offset, value ? 1 : 0, littleEndian);
      };
    }
  });
}

export function getDataViewBoolAccessorEx(access, member) {
  return cacheMethod(access, member, () => {
    const { byteSize, bitOffset } = member;
    if (byteSize !== 0) {
      return getAlignedBoolAccessor(access, member, options);
    }
    const bitPos = bitOffset & 0x07;
    const mask = 1 << bitPos;
    if (access === 'get') {
      const get = DataView.prototype.getInt8;
      return function(offset) {
        const n = get.call(this, offset);
        return !!(n & mask);
      };
    } else {
      const set = DataView.prototype.setInt8;
      return function(offset, value) {
        const n = get.call(this, offset);
        const b = (value) ? n | mask : n & ~mask;
        set.call(this, offset, b);
      };
    }
  });
}

export function getDataViewIntAccessor(access, member) {
  const typeName = getTypeName(member);
  return DataView.prototype[`${access}${typeName}`];
}

export function getDataViewIntAccessorEx(access, member) {
  return cacheMethod(access, member, (name) => {
    if (DataView.prototype[name]) {
      return DataView.prototype[name];
    }
    if (member.byteSize !== 0) {
      return defineAlignedIntAccessor(access, member)
    } else {
      return defineUnalignedIntAccessor(access, member);
    }
  });
}

export function getDataViewFloatAccessor(access, member) {
  const typeName = getTypeName(member);
  return DataView.prototype[`${access}${typeName}`];
}

export function getDataViewFloatAccessorEx(access, member) {
  return cacheMethod(access, member, (name) => {
    if (DataView.prototype[name]) {
      return DataView.prototype[name];
    }
    if (member.byteSize !== 0) {
      return defineAlignedFloatAccessor(access, member)
    } else {
      return defineUnalignedFloatAccessor(access, member);
    }
  });
}

export function getDataView(arg, name, size, multiple = false) {
  let dv;
  if (arg instanceof DataView) {
    dv = arg;
  } else if (arg instanceof ArrayBuffer || arg instanceof SharedArrayBuffer) {
    dv = new DataView(arg);
  } else {
    throwBufferExpected(name, size);
  }
  if (multiple) {
    if (dv.byteLength % size !== 0) {
      throwSizeMismatch(name, size, dv.byteLength, true);
    }
  } else {
    if (dv.byteLength !== size) {
      throwSizeMismatch(name, size, dv.byteLength, false);
    }
  }
  return dv;
}

export function isBuffer(arg) {
  return (arg instanceof DataView || arg instanceof ArrayBuffer || arg instanceof SharedArrayBuffer);
}

export function getTypeName({ type, isSigned, bitSize }) {
  if (type === MemberType.Int) {
    return `${bitSize <= 32 ? '' : 'Big' }${isSigned ? 'Int' : 'Uint'}${bitSize}`;
  } else if (type === MemberType.Float) {
    return `Float${bitSize}`;
  } else if (type === MemberType.Bool) {
    return `Bool`;
  } else if (type === MemberType.Void) {
    return `Null`;
  }
}

function attachDataViewAccessors(s) {
  const {
    constructor: {
      prototype,
    },
    instance: {
      members
    },
  } = s;
  if (!Object.getOwnPropertyDescriptor(prototype, 'dataView')) {
    Object.defineProperties(prototype, {
      dataView: { get: getDataView, configurable: true, enumerable: true },
    });
  }
  const getTypedArray = getTypedArrayGetter(members);
  if (getTypedArray && !Object.getOwnPropertyDescriptor(prototype, 'typedArray')) {
    Object.defineProperties(prototype, {
      typedArray: { get: getTypedArray, configurable: true, enumerable: true },
    });
  }
}

function defineAlignedIntAccessor(access, member) {
  const { isSigned, bitSize, byteSize } = member;
  if (bitSize < 64) {
    // actual number of bits needed when stored aligned
    const typeName = getTypeName({ ...member, bitSize: byteSize * 8 });
    const get = DataView.prototype[`get${typeName}`];
    const set = DataView.prototype[`set${typeName}`];
    if (isSigned) {
      const signMask = (bitSize <= 32) ? 2 ** (bitSize - 1) : 2n ** BigInt(bitSize - 1);
      const valueMask = (bitSize <= 32) ? signMask - 1 : signMask - 1n;
      if (access === 'get') {
        return function(offset, littleEndian) {
          const n = get.call(this, offset, littleEndian);
          return (n & valueMask) - (n & signMask);
        };
      } else {
        return function(offset, value, littleEndian) {
          const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
          set.call(this, offset, n, littleEndian);
        };
      }
    } else {
      const valueMask = (bitSize <= 32) ? (2 ** bitSize) - 1 : (2n ** BigInt(bitSize)) - 1n;
      if (access === 'get') {
        return function(offset, littleEndian) {
          const n = get.call(this, offset, littleEndian);
          return n & valueMask;
        };
      } else {
        return function(offset, value, littleEndian) {
          const n = value & valueMask;
          set.call(this, offset, n, littleEndian);
        };
      }
    }
  } else {
    // larger than 64 bits
    const getWord = DataView.prototype.getBigUint64;
    const setWord = DataView.prototype.setBigUint64;
    const wordCount = Math.ceil(bitSize / 64);
    const get = function(offset, littleEndian) {
      let n = 0n;
      if (littleEndian) {
        for (let i = 0, j = offset + (wordCount - 1) * 8; i < wordCount; i++, j -= 8) {
          const w = getWord.call(this, j, littleEndian);
          n = (n << 64n) | w;
        }
      } else {
        for (let i = 0, j = offset; i < wordCount; i++, j += 8) {
          const w = getWord.call(this, j, littleEndian);
          n = (n << 64n) | w;
        }
      }
      return n;
    };
    const set = function(offset, value, littleEndian) {
      let n = value;
      const mask = 0xFFFFFFFFFFFFFFFFn;
      if (littleEndian) {
        for (let i = 0, j = offset; i < wordCount; i++, j += 8) {
          const w = n & mask;
          setWord.call(this, j, w, littleEndian);
          n >>= 64n;
        }
      } else {
        n <<= BigInt(wordCount * 64 - bitSize);
        for (let i = 0, j = offset + (wordCount - 1) * 8; i < wordCount; i++, j -= 8) {
          const w = n & mask;
          setWord.call(this, j, w, littleEndian);
          n >>= 64n;
        }
      }
      return n;
    };
    if (isSigned) {
      const signMask = 2n ** BigInt(bitSize - 1);
      const valueMask = signMask - 1n;
      if (access === 'get') {
        return function(offset, littleEndian) {
          const n = get.call(this, offset, littleEndian);
          return (n & valueMask) - (n & signMask);
        };
      } else {
        return function(offset, value, littleEndian) {
          const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
          set.call(this, offset, n, littleEndian);
        };
      }
    } else {
      const valueMask = (2n ** BigInt(bitSize)) - 1n;
      if (access === 'get') {
        return function(offset, littleEndian) {
          const n = get.call(this, offset, littleEndian);
          return n & valueMask;
        };
      } else {
        return function(offset, value, littleEndian) {
          const n = value & valueMask;
          set.call(this, offset, n, littleEndian);
        };
      }
    }
  }
}

function defineUnalignedIntAccessor(access, member) {
  const { isSigned, bitSize, bitOffset } = member;
  const bitPos = bitOffset & 0x07;
  if (bitPos + bitSize <= 8) {
    const set = DataView.prototype.setUint8;
    const get = DataView.prototype.getUint8;
    // sub-8-bit numbers have real use cases
    if (isSigned) {
      const signMask = 2 ** (bitSize - 1);
      const valueMask = signMask - 1;
      if (access === 'get') {
        return function(offset) {
          const n = get.call(this, offset);
          const s = n >>> bitPos;
          return (s & valueMask) - (s & signMask);
        };
      } else {
        const outsideMask = 0xFF ^ ((valueMask | signMask) << bitPos);
        return function(offset, value) {
          let b = get.call(this, offset);
          const n = (value < 0) ? signMask | (value & valueMask) : value & valueMask;
          b = (b & outsideMask) | (n << bitPos);
          set.call(this, offset, b);
        };
      }
    } else {
      const valueMask = (2 ** bitSize - 1);
      if (access === 'get') {
        return function(offset) {
          const n = get.call(this, offset);
          const s = n >>> bitPos;
          return s & valueMask;
        };
      } else {
        const outsideMask = 0xFF ^ (valueMask << bitPos);
        return function(offset, value) {
          const n = get.call(this, offset);
          const b = (n & outsideMask) | ((value & valueMask) << bitPos);
          set.call(this, offset, b);
        };
      }
    }
  }
  return defineUnalignedAccessorUsing(access, member, getDataViewIntAccessorEx);
}

function defineAlignedFloatAccessor(access, member) {
  const { bitSize } = member;
  if (bitSize === 16) {
    const buf = new DataView(new ArrayBuffer(4));
    const set = DataView.prototype.setUint16;
    const get = DataView.prototype.getUint16;
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >>> 15;
        const exp = (n & 0x7C00) >> 10;
        const frac = n & 0x03FF;
        if (exp === 0) {
          return (sign) ? -0 : 0;
        } else if (exp === 0x1F) {
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
        const exp = (n & 0x7F800000) >> 23;
        const frac = n & 0x007FFFFF;
        const exp16 = (exp - 127 + 15);
        let n16;
        if (exp === 0) {
          n16 = sign << 15;
        } else if (exp === 0xFF) {
          n16 = sign << 15 | 0x1F << 10 | (frac ? 1 : 0);
        } else if (exp16 >= 31) {
          n16 = sign << 15 | 0x1F << 10;
        } else {
          n16 = sign << 15 | exp16 << 10 | (frac >> 13);
        }
        set.call(this, offset, n16, littleEndian);
      }
    }
  } else if (bitSize === 80) {
    const buf = new DataView(new ArrayBuffer(8));
    const setWord = DataView.prototype.setBigUint64;
    const getWord = DataView.prototype.getBigUint64;
    const get = function(offset, littleEndian) {
      const w1 = getWord.call(this, offset, littleEndian);
      const w2 = getWord.call(this, offset + 8, littleEndian);
      return (littleEndian) ? w1 | w2 << 64n : w1 << 64n | w2;
    };
    const set = function(offset, value, littleEndian) {
      const w1 = value & 0xFFFFFFFFFFFFFFFFn;
      const w2 = value >> 64n;
      setWord.call(this, offset + (littleEndian ? 0 : 8), w1, littleEndian);
      setWord.call(this, offset + (littleEndian ? 8 : 0), w2, littleEndian);
    };
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >> 79n;
        const exp = (n & 0x7FFF0000000000000000n) >> 64n;
        const frac = n & 0x00007FFFFFFFFFFFFFFFn;
        if (exp === 0n) {
          return (sign) ? -0 : 0;
        } else if (exp === 0x7FFFn) {
          if (!frac) {
            return (sign) ? -Infinity : Infinity;
          } else {
            return NaN;
          }
        }
        const exp64 = exp - 16383n + 1023n;
        if (exp64 >= 2047n) {
          return (sign) ? -Infinity : Infinity;
        }
        const n64 = (sign << 63n) | (exp64 << 52n) | (frac >> 11n);
        buf.setBigUint64(0, n64, littleEndian);
        return buf.getFloat64(0, littleEndian);
      }
    } else {
      return function(offset, value, littleEndian) {
        buf.setFloat64(0, value, littleEndian);
        const n = buf.getBigUint64(0, littleEndian);
        const sign = n >> 63n;
        const exp = (n & 0x7FF0000000000000n) >> 52n;
        const frac = n & 0x000FFFFFFFFFFFFFn;
        let n80;
        if (exp === 0n) {
          n80 = sign << 79n | (frac << 11n);
        } else if (exp === 0x07FFn) {
          n80 = sign << 79n | 0x7FFFn << 64n | (frac ? 0x00002000000000000000n : 0n) | 0x00008000000000000000n;
          //                                                 ^ bit 61                       ^ bit 63
        } else {
          n80 = sign << 79n | (exp - 1023n + 16383n) << 64n | (frac << 11n) | 0x00008000000000000000n;
        }
        set.call(this, offset, n80, littleEndian);
      }
    }
  } else if (bitSize === 128) {
    const buf = new DataView(new ArrayBuffer(8));
    const getWord = DataView.prototype.getBigUint64;
    const setWord = DataView.prototype.setBigUint64;
    const get = function(offset, littleEndian) {
      const w1 = getWord.call(this, offset, littleEndian);
      const w2 = getWord.call(this, offset + 8, littleEndian);
      return (littleEndian) ? w1 | w2 << 64n : w1 << 64n | w2;
    };
    const set = function(offset, value, littleEndian) {
      const w1 = value & 0xFFFFFFFFFFFFFFFFn;
      const w2 = value >> 64n;
      setWord.call(this, offset + (littleEndian ? 0 : 8), w1, littleEndian);
      setWord.call(this, offset + (littleEndian ? 8 : 0), w2, littleEndian);
    };
    if (access === 'get') {
      return function(offset, littleEndian) {
        const n = get.call(this, offset, littleEndian);
        const sign = n >> 127n;
        const exp = (n & 0x7FFF0000000000000000000000000000n) >> 112n;
        const frac = n & 0x0000FFFFFFFFFFFFFFFFFFFFFFFFFFFFn;
        if (exp === 0n) {
          return (sign) ? -0 : 0;
        } else if (exp === 0x7FFFn) {
          if (!frac) {
            return (sign) ? -Infinity : Infinity;
          } else {
            return NaN;
          }
        }
        const exp64 = exp - 16383n + 1023n;
        if (exp64 >= 2047n) {
          return (sign) ? -Infinity : Infinity;
        }
        const n64 = (sign << 63n) | (exp64 << 52n) | (frac >> 60n);
        buf.setBigUint64(0, n64, littleEndian);
        return buf.getFloat64(0, littleEndian);
      }
    } else {
      return function(offset, value, littleEndian) {
        buf.setFloat64(0, value, littleEndian);
        const n = buf.getBigUint64(0, littleEndian);
        const sign = n >> 63n;
        const exp = (n & 0x7FF0000000000000n) >> 52n;
        const frac = n & 0x000FFFFFFFFFFFFFn;
        let n128;
        if (exp === 0n) {
          n128 = sign << 127n | (frac << 60n);
        } else if (exp === 0x07FFn) {
          n128 = sign << 127n | 0x7FFFn << 112n | (frac ? 1n : 0n);
        } else {
          n128 = sign << 127n | (exp - 1023n + 16383n) << 112n | (frac << 60n);
        }
        set.call(this, offset, n128, littleEndian);
      }
    }
  }
}

function defineUnalignedFloatAccessor(access, member) {
  return defineUnalignedAccessorUsing(access, member, getDataViewFloatAccessorEx);
}

function defineUnalignedAccessorUsing(access, member, getDataViewAccessor) {
  // pathological usage scenario--handle it anyway by copying the bitSize into a
  // temporary buffer, bit-aligning the data
  const { bitSize, bitOffset } = member;
  const bitPos = bitOffset & 0x07;
  const byteSize = [ 1, 2, 4, 8 ].find(b => b * 8 >= bitSize) ?? Math.ceil(bitSize / 64) * 64;
  const buf = new DataView(new ArrayBuffer(byteSize));
  if (access === 'get') {
    const getAligned = getDataViewAccessor('get', { ...member, byteSize });
    const copyBits = getBitAlignFunction(bitPos, bitSize, true);
    return function(offset, littleEndian) {
      copyBits(buf, this, offset);
      return getAligned.call(buf, 0, littleEndian);
    };
  } else {
    const setAligned = getDataViewAccessor('set', { ...member, byteSize });
    const applyBits = getBitAlignFunction(bitPos, bitSize, false);
    return function(offset, value, littleEndian) {
      setAligned.call(buf, 0, value, littleEndian);
      applyBits(this, buf, offset);
    };
  }
}

function cacheMethod(access, member, cb) {
  const { bitOffset, byteSize } = member;
  const typeName = getTypeName(member);
  const suffix = (byteSize === 0) ? `Bit${bitOffset & 0x07}` : ``;
  const name = `${access}${typeName}${suffix}`;
  var fn = methodCache[name];
  if (!fn) {
    fn = methodCache[name] = cb(name);
    if (fn && !fn.name) {
      Object.defineProperty(fn, 'name', { value: name, configurable: true, writable: false });
    }
  }
  return fn;
}

const methodCache = {};