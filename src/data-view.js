import { MemberType, getTypeName } from './type.js';
import { obtainBitAlignFunction } from './memory.js';
import { throwSizeMismatch, throwBufferExpected } from './error.js';
import { MEMORY } from './symbol.js';

export function obtainDataViewGetter({ type, isSigned, bitOffset, bitSize, byteSize }) {
  const bitPos = bitOffset & 0x07;
  const name = getMethodName('get', type, isSigned, bitPos, bitSize, byteSize);
  if (DataView.prototype[name]) {
    return DataView.prototype[name];
  }
  if (methodCache[name]) {
    return methodCache[name];
  }
  let fn;
  if (byteSize !== 0) {
    if (type === MemberType.Int) {
      if (bitSize < 64) {
        // actual number of bits needed when stored byte-aligned
        const typeName = getTypeName(type, isSigned, byteSize * 8);
        const get = DataView.prototype[`get${typeName}`];
        if (isSigned) {
          const signMask = (bitSize <= 32) ? 2 ** (bitSize - 1) : 2n ** BigInt(bitSize - 1);
          const valueMask = (bitSize <= 32) ? signMask - 1 : signMask - 1n; 
          fn = function(offset, littleEndian) {
            const n = get.call(this, offset, littleEndian);
            return (n & valueMask) - (n & signMask);
          };
        } else {
          const valueMask = (bitSize <= 32) ? (2 ** bitSize) - 1 : (2n ** BigInt(bitSize)) - 1n; 
          fn = function(offset, littleEndian) {
            const n = get.call(this, offset, littleEndian);
            return n & valueMask;
          };
        }
      } else {
        const getWord = DataView.prototype.getBigUint64;
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
        if (isSigned) {
          const signMask = 2n ** BigInt(bitSize - 1);
          const valueMask = signMask - 1n; 
          fn = function(offset, littleEndian) {
            const n = get.call(this, offset, littleEndian);
            return (n & valueMask) - (n & signMask);
          };
        } else {
          const valueMask =  (2n ** BigInt(bitSize)) - 1n; 
          fn = function(offset, littleEndian) {
            const n = get.call(this, offset, littleEndian);
            return n & valueMask;
          };
        }
      }
    } else if (type === MemberType.Float) {
      if (bitSize === 16) {
        const dest = new DataView(new ArrayBuffer(4));
        const get = DataView.prototype.getUint16;
        fn = function(offset, littleEndian) {
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
          dest.setUint32(0, n32, littleEndian);
          return dest.getFloat32(0, littleEndian);
        }
      } else if (bitSize === 80) {
        const dest = new DataView(new ArrayBuffer(8));
        const getWord = DataView.prototype.getBigUint64;
        const get = function(offset, littleEndian) {
          const w1 = getWord.call(this, offset, littleEndian);
          const w2 = getWord.call(this, offset + 8, littleEndian);
          return (littleEndian) ? w1 | w2 << 64n : w1 << 64n | w2;
        };
        fn = function(offset, littleEndian) {
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
          dest.setBigUint64(0, n64, littleEndian);
          return dest.getFloat64(0, littleEndian);
        }
      } else if (bitSize === 128) {
        const dest = new DataView(new ArrayBuffer(8));
        const getWord = DataView.prototype.getBigUint64;
        const get = function(offset, littleEndian) {
          const w1 = getWord.call(this, offset, littleEndian);
          const w2 = getWord.call(this, offset + 8, littleEndian);
          return (littleEndian) ? w1 | w2 << 64n : w1 << 64n | w2;
        };
        fn = function(offset, littleEndian) {
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
          dest.setBigUint64(0, n64, littleEndian);
          return dest.getFloat64(0, littleEndian);
        }
      }
    } else if (type === MemberType.Bool) {
      const typeName = getTypeName(MemberType.Int, true, byteSize * 8);
      const get = DataView.prototype[`get${typeName}`];
      fn = function(offset, littleEndian) {
        return !!get.call(this, offset, littleEndian);
      };
    }     
  } else {
    const get = DataView.prototype.getUint8;
    if (type === MemberType.Bool && bitSize === 1) {
      // bitfield--common enough to warrant special handle
      const mask = 1 << bitPos;
      fn = function(offset) {
        const n = get.call(this, offset);
        return !!(n & mask);
      };
    } else if (type === MemberType.Int && bitPos + bitSize <= 8) {
      // sub-8-bit numbers also have real use cases
      if (isSigned) {
        const signMask = 2 ** (bitSize - 1);
        const valueMask = signMask - 1;
        fn = function(offset) {
          const n = get.call(this, offset);
          const s = n >>> bitPos;
          return (s & valueMask) - (s & signMask);
        };
      } else {
        const valueMask = (2 ** bitSize - 1); 
        fn = function(offset) {
          const n = get.call(this, offset);
          const s = n >>> bitPos;
          return s & valueMask;
        };
      }
    } else {
      // pathological usage--handle it anyway by copying the bitSize into a 
      // temporary buffer, bit-aligning the data
      const byteSize = getByteSize(bitSize);
      const dest = new DataView(new ArrayBuffer(byteSize));
      const getAligned = obtainDataViewGetter({ type, bitSize, isSigned, bitOffset: 0, byteSize });
      const copyBits = obtainBitAlignFunction(bitPos, bitSize, true);
      fn = function(offset, littleEndian) {
        copyBits(dest, this, offset);
        return getAligned.call(dest, 0, littleEndian);
      };
    }
  }
  if (!fn) {
    throw new Error(`Missing getter: ${type}`)
  }
  Object.defineProperty(fn, 'name', { value: name, writable: false });
  methodCache[name] = fn;
  return fn;
}

export function obtainDataViewSetter({ type, bitSize, isSigned, byteSize, bitOffset }) {
  const bitPos = bitOffset & 0x07;
  const name = getMethodName('set', type, isSigned, bitPos, bitSize, byteSize);
  if (DataView.prototype[name]) {
    return DataView.prototype[name];
  }
  if (methodCache[name]) {
    return methodCache[name];
  }
  let fn;
  if (byteSize !== 0) {
    if (type === MemberType.Int) {
      if (bitSize < 64) {
        const typeName = getTypeName(type, isSigned, byteSize * 8);
        const set = DataView.prototype[`set${typeName}`];
        if (isSigned) {
          const signMask = (bitSize <= 32) ? 2 ** (bitSize - 1) : 2n ** BigInt(bitSize - 1);
          const valueMask = (bitSize <= 32) ? signMask - 1 : signMask - 1n; 
          fn = function(offset, v, littleEndian) {
            const n = (v < 0) ? signMask | (v & valueMask) : v & valueMask;
            set.call(this, offset, n, littleEndian);
          };
        } else {
          const valueMask = (bitSize <= 32) ? (2 ** bitSize) - 1: (2n ** BigInt(bitSize)) - 1n; 
          fn = function(offset, v, littleEndian) {
            const n = v & valueMask;
            set.call(this, offset, n, littleEndian);
          };
        }
      } else {
        const setWord = DataView.prototype.setBigUint64;
        const wordCount = Math.ceil(bitSize / 64);
        const set = function(offset, v, littleEndian) {
          let n = v;
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
          const signMask = (bitSize <= 32) ? 2 ** (bitSize - 1) : 2n ** BigInt(bitSize - 1);
          const valueMask = (bitSize <= 32) ? signMask - 1 : signMask - 1n; 
          fn = function(offset, v, littleEndian) {
            const n = (v < 0) ? signMask | (v & valueMask) : v & valueMask;
            set.call(this, offset, n, littleEndian);
          };
        } else {
          const valueMask = (bitSize <= 32) ? (2 ** bitSize) - 1: (2n ** BigInt(bitSize)) - 1n; 
          fn = function(offset, v, littleEndian) {
            const n = v & valueMask;
            set.call(this, offset, n, littleEndian);
          };
        }
      }
    } else if (type === MemberType.Float) {
      if (bitSize === 16) {
        const src = new DataView(new ArrayBuffer(4));
        const set = DataView.prototype.setUint16;
        fn = function(offset, v, littleEndian) {
          src.setFloat32(0, v, littleEndian);
          const n = src.getUint32(0, littleEndian);
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
      } else if (bitSize === 80) {
        const src = new DataView(new ArrayBuffer(8));
        const setWord = DataView.prototype.setBigUint64;
        const set = function(offset, v, littleEndian) {
          const w1 = v & 0xFFFFFFFFFFFFFFFFn;
          const w2 = v >> 64n;
          setWord.call(this, offset + (littleEndian ? 0 : 8), w1, littleEndian);
          setWord.call(this, offset + (littleEndian ? 8 : 0), w2, littleEndian);
        };
        fn = function(offset, v, littleEndian) {
          src.setFloat64(0, v, littleEndian);
          const n = src.getBigUint64(0, littleEndian);
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
      } else if (bitSize === 128) {
        const src = new DataView(new ArrayBuffer(8));
        const setWord = DataView.prototype.setBigUint64;
        const set = function(offset, v, littleEndian) {
          const w1 = v & 0xFFFFFFFFFFFFFFFFn;
          const w2 = v >> 64n;
          setWord.call(this, offset + (littleEndian ? 0 : 8), w1, littleEndian);
          setWord.call(this, offset + (littleEndian ? 8 : 0), w2, littleEndian);
        };
        fn = function(offset, v, littleEndian) {
          src.setFloat64(0, v, littleEndian);
          const n = src.getBigUint64(0, littleEndian);
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
    } else if (type === MemberType.Bool) {
      const typeName = getTypeName(MemberType.Int, true, byteSize * 8);
      const set = DataView.prototype[`set${typeName}`];
      fn = function(offset, v, littleEndian) {
        set.call(this, offset, v ? 1 : 0, littleEndian);
      };
    }
  } else {
    const get = DataView.prototype.getInt8;
    const set = DataView.prototype.setInt8;
    if (type === MemberType.Bool && bitSize === 1) {
      const mask = 1 << bitPos;
      fn = function(offset, value) {
        const n = get.call(this, offset);
        const b = (value) ? n | mask : n & ~mask;
        set.call(this, offset, b);
      };
    } else if (type === MemberType.Int && bitPos + bitSize <= 8) {
      if (isSigned) {
        const signMask = 2 ** (bitSize - 1);        
        const valueMask = signMask - 1;
        const outsideMask = 0xFF ^ ((valueMask | signMask) << bitPos);
        fn = function(offset, v) {
          let b = get.call(this, offset);
          const n = (v < 0) ? signMask | (v & valueMask) : v & valueMask;
          b = (b & outsideMask) | (n << bitPos);
          set.call(this, offset, b);
        };
      } else {
        const valueMask = (2 ** bitSize) - 1; 
        const outsideMask = 0xFF ^ (valueMask << bitPos);
        fn = function(offset, value) {
          const n = get.call(this, offset);
          const v = value & valueMask;
          const b = (n & outsideMask) | (v << bitPos);
          set.call(this, offset, b);
        };
      }
    } else {
      const byteSize = getByteSize(bitSize);
      const src = new DataView(new ArrayBuffer(byteSize));
      const setAligned = obtainDataViewSetter({ type, isSigned, bitOffset: 0, bitSize, byteSize });
      const applyBits = obtainBitAlignFunction(bitPos, bitSize, false);
      fn = function(offset, value, littleEndian) {
        setAligned.call(src, 0, value, littleEndian);
        applyBits(this, src, offset);
      };
    }
  }
  if (!fn) {
    throw new Error(`Missing setter: ${type}`)
  }
  Object.defineProperty(fn, 'name', { value: name, writable: false });
  methodCache[name] = fn;
  return fn;
}

export function obtainDataView(arg, name, size, multiple = false) {
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


export function getDataView() {
  return this[MEMORY];
}

function getMethodName(prefix, type, isSigned, bitPos, bitSize, byteSize) {
  const typeName = getTypeName(type, isSigned, bitSize);
  const suffix = (byteSize === 0) ? `Bit${bitPos}` : ``;
  return `${prefix}${typeName}${suffix}`;
}

function getByteSize(bitSize) {
  return [ 1, 2, 4, 8 ].find(b => b * 8 >= bitSize) ?? Math.ceil(bitSize / 64) * 64;
}
  
const methodCache = {};
