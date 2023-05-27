const Pointer = 0;
const Bool = 1;
const Int = 2;
const Float = 3;

export const dataSymbol = Symbol('data');
export const shadowSymbol = Symbol('shadow');

const methodCache = {};
 
function getTypeName(type, bits, signed) {
  if (type === Int) {
    return `${bits <= 32 ? '' : 'Big' }${signed ? 'Int' : 'Uint'}${bits}`;
  } else if (type === Float) {
    return `Float${bits}`;
  } else if (type === Bool) {
    return `Bool${bits}`;
  }
}

function createGetter(name, type, bits, signed, bitOffset) {
  if (methodCache[name]) {
    return methodCache[name];
  }
  var fn;
  if (bitOffset === 0) {
    if (type === Int) {
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
    } else if (type === Float) {
      // TODO
    } if (type === Bool) {
      const typeName = `Int${bits}`;
      const get = DataView.prototype[`get${typeName}`];
      fn = function(offset, littleEndian) {
        return !!get.call(this, offset, littleEndian);
      };
    }     
  } else {
    const get = DataView.prototype.getUint8;
    if (type === Bool && bits === 1) {
      // bitfield--common enough to warrant special handle
      const mask = 1 << bitOffset;
      fn = function(offset) {
        const n = get.call(this, offset);
        return !!(n & mask);
      };
    } else if (bitOffset + bits <= 8) {
      // sub-8-bit numbers also have real use cases
      if (signed) {
        const signMask = ((bits - 1) ** 2) << bitOffset;
        const valueMask = signMask - 1; 
        fn = function(offset) {
          const n = get.call(this, offset);
          const v = (n & valueMask) >>> bitOffset;
          return (n & signMask) ? -v : v;
        };
      } else {
        const valueMask = (bits ** 2 - 1) << bitOffset; 
        fn = function(offset) {
          const n = get.call(this, offset);
          return (n & valueMask) >>> bitOffset;
        };
      }
    } else {
      // pathological usage--handle it anyway by copying the bits into a 
      // temporary buffer, bit-aligning the data
      const dest = new DataView(new ArrayBuffer(Math.ceil(bits / 8)));
      const typeName = getTypeName(type, bits, signed);
      const getter = `get${typeName}`;
      const getAligned = dest[getter] ?? createGetter(getter, type, bits, signed, 0);
      const shift = 8 - bitOffset;
      const leadMask = ((2 ** shift) - 1) << bitOffset;
      const trailMask = 0xFF ^ leadMask;
      const set = DataView.prototype.setUint8;
      fn = function(offset, littleEndian) {
        var i = offset, j = 0;
        // read leading byte, mask off bits before bit offset, and shift them to the start of the byte
        var n = get.call(this, i++);
        var overhang = (byte & leadMask) >>> bitOffset;
        var remaining = bits - shift;
        var byte;
        while (remaining >= 8) {
          // read next bytes, shift it forward, and combine it with bits that came before
          n = get.call(this, i++);
          byte = overhang | ((n & trailMask) << shift);
          set.call(dest, j++, b);
          // new leftover
          overhang = (n & leadMask) >>> bitOffset;
          remaining -= 8;
        }
        if (remaining > 0) {
          const finalMask = ((2 ** remaining) - 1) << bitOffset;
          n = get.call(this, i);
          byte = overhang | ((n & finalMask) << shift);
          set.call(dest, j, b);
        }
        return getAligned(dest, 0, littleEndian);
      };
    }
  }
  Object.defineProperties(fn, 'name', { value: name, writable: false });
  methodCache[name] = fn;
  return fn;
}

function createSetter(name, type, bits, signed) {        
  if (methodCache[name]) {
    return methodCache[name];
  }
  var fn;
  if (bitOffset === 0) {
    if (type === Int) {
      if (bits < 64) {
      }
    }
  } else {
    if (type === Bool && bits === 1) {
      const mask = 1 << bitOffset;
      const get = DataView.prototype.getInt8;
      fn = function(offset) {
        var n = get.call(this, offset);
        set.call(this, n | mask);
      };
    }
  }
  Object.defineProperties(fn, 'name', { value: name, writable: false });
  methodCache[name] = fn;
  return fn;
}

export function defineStruct(structName, structSize, fields, options = {}) {
  const {
    littleEndian = true,
    exposeDataView = false,
    runtimeSafety = true,
  } = options;
  const defaultValues = {};
  const oneTimeSetters = {};
  for (const [ name, { defaultValue } ] of Object.entries(fields)) {
    if (defaultValue !== undefined) {
      defaultValues[name] = defaultValue;
    }
  }

  function construct(arg) {
    var dv;
    var init;
    if (arg instanceof DataView) {
      dv = arg;
    } else if (arg instanceof ArrayBuffer) {
      dv = new DataView(arg);
    } else if (arg instanceof Object) {
      init = { ...defaultValues, ...arg };
    } else if (arg !== undefined) {
      throw new Error(`Expected an ArrayBuffer, a DataView, or an object`);
    } else {
      init = defaultValues;
    }
    if (dv) {
      if (dv.byteLength != structSize) {
        throw new Error(`Struct size mismatch: ${dv.byteLength} != ${structSize}`);
      }            
    } else {
      dv = new DataView(new ArrayBuffer(structSize));
    }
    Object.defineProperty(this, dataSymbol, { value: dv  });
    this.addMissing();
    const proto = Object.getPrototypeOf(this);
    if (init) {
      for (const [ name, value ] of Object.entries(init)) {
        if (proto.hasOwnProperty(name)) {
          const set = oneTimeSetters[name];
          if (set) {
            // override the prototype temporarily
            Object.defineProperty(this, name, { set, configurable: true });
          }
          this[name] = value;
          if (set) {
            // remove descriptor set on the object
            delete this[name];
          }
        } else {
          throw new Error(`Struct does not have a field by that name: ${name}`);
        }
      }  
    }
  }

  function overflow(bits, signed, v) {
    const typeName = getTypeName(Int, bits, signed);
    throw new Error(`${typeName} cannot represent value '${v}'`);
  }

  const lines = [];
  lines.push(`(class ${structName} {`);
  lines.push(`constructor(...arg) { construct.apply(this, arg) }`);
  const dv = 'this[dataSymbol]';
  const getters = {}, setters = {};
  for (const [ name, { type, bits, signed, offset, bitOffset, writable, defaultValue } ] of Object.entries(fields)) {
    if (type !== Pointer) {
      const typeName = getTypeName(type, bits, signed);
      const prop = JSON.stringify(name);
      const suffix = (bitOffset > 0) ? `Bit${bitOffset}` : ``;
      const getter = `get${typeName}${suffix}`;
      const lastArg = (type === Int && bits > 8) ? `, ${littleEndian}` : ``;
      lines.push(`get ${prop}() { return ${dv}.${getter}(${offset}${lastArg}) }`);
      getters[getter] = { type, bits, signed, bitOffset };
      if (writable || defaultValue) {
        const setter = `set${typeName}${suffix}`;
        var check = '';
        if (runtimeSafety && type === Int) {
          const suffix = (bits <= 53) ? '' : 'n';
          const max = (2 ** (signed ? bits - 1 : bits)- 1) + suffix;
          const min = ((signed) ? -(2 ** (bits - 1)) : 0) + suffix;
          check = `if (v < ${min} || v > ${max}) overflow(${bits}, ${signed}, v); `;
        }
        const stmt = `{ ${check}${dv}.${setter}(${offset}, v${lastArg}) }`;
        if (writable) {
          lines.push(`set ${prop}(v) ${stmt}`);
        } else {
          oneTimeSetters[name] = eval(`(function(v) ${stmt})`);
        }
        setters[setter] = { type, bits, signed, bitOffset };
      }
    }
  }

  if (exposeDataView) {
    if (!fields.hasOwnProperty('dataView')) {
      lines.push(`get dataView() { return ${dv} }`);
    }
  }

  lines.push(`addMissing() {`)
  for (const [ name, { type, bits, signed, bitOffset } ] of Object.entries(getters)) {
    if (!DataView.prototype.hasOwnProperty(name)) {
      lines.push(`${dv}.${name} = createGetter('${name}', ${type}, ${bits}, ${signed}, ${bitOffset});`)
    }
  }
  for (const [ name, { type, bits, signed, bitOffset } ] of Object.entries(setters)) {
    if (!DataView.prototype.hasOwnProperty(name)) {
      lines.push(`${dv}.${name} = createSetter('${name}', ${type}, ${bits}, ${signed}, ${bitOffset});`)
    }
  }
  lines.push(`}`);     // end of addMissing()
  lines.push(`})`);     // end of class
  return eval(lines.join('\n'));
}

  