import { StructureType } from './structure.js';
import { MemberType } from './member.js';
import { getMemoryCopier, restoreMemory } from './memory.js';
import { throwBufferSizeMismatch, throwTypeMismatch } from './error.js';
import { MEMORY } from './symbol.js';
import { isTypedArray } from './data-view.js';

export function addSpecialAccessors(s) {
  const {
    constructor,
    instance: {
      members,
    },
  } = s;
  Object.defineProperties(constructor.prototype, {
    dataView: { ...getDataViewAccessors(s), configurable: true },
    base64: { ...getBase64Accessors(), configurable: true },
    toJSON: { value: getValueOf, configurable: true, writable: true },
    valueOf: { value: getValueOf, configurable: true, writable: true },
  });
  if (canBeString(s)) {
    Object.defineProperty(constructor.prototype, 'string', {
      ...getStringAccessors(s), configurable: true
    });
  }
  if (canBeTypedArray(s)) {
    Object.defineProperty(constructor.prototype, 'typedArray', {
      ...getTypedArrayAccessors(s), configurable: true
    });
  }
}

function canBeString(s) {
  if (s.type === StructureType.Array || s.type === StructureType.Slice) {
    const { type, bitSize } = s.instance.members[0];
    if (type === MemberType.Uint && (bitSize === 8 || bitSize === 16)) {
      return true;
    }
  }
  return false;
}

function canBeTypedArray(s) {
  return !!s.typedArray;
}

export function getSpecialKeys(s) {
  const keys = [ 'dataView', 'base64' ];
  if (canBeString(s)) {
    keys.push('string');
  }
  if (canBeTypedArray(s)) {
    keys.push('typedArray');
  }
  return keys;
}

export function getDataViewAccessors(structure) {
  const { type, byteSize, sentinel } = structure;
  const copy = getMemoryCopier(byteSize, type === StructureType.Slice);
  return {
    get() {
      restoreMemory.call(this);
      return this[MEMORY];
    },
    set(dv) {
      checkDataView(dv);
      restoreMemory.call(this);
      const dest = this[MEMORY];
      if (dest.byteLength !== dv.byteLength) {
        throwBufferSizeMismatch(structure, dv, this);
      }
      sentinel?.validateData(dv, this.length);
      copy(dest, dv);
    },
  };
}

export function checkDataView(dv) {
  if (dv?.[Symbol.toStringTag] !== 'DataView') {
    throwTypeMismatch('a DataView', dv);
  }
  return dv;
}

export function getBase64Accessors() {
  return {
    get() {
      const dv = this.dataView;
      const ta = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const bstr = String.fromCharCode.apply(null, ta);
      return btoa(bstr);
    },
    set(str) {
      this.dataView = getDataViewFromBase64(str);
    }
  }
}

export function getDataViewFromBase64(str) {
  if (typeof(str) !== 'string') {
    throwTypeMismatch('a string', str);
  }
  const bstr = atob(str);
  const ta = new Uint8Array(bstr.length);
  for (let i = 0; i < ta.byteLength; i++) {
    ta[i] = bstr.charCodeAt(i);
  }
  return new DataView(ta.buffer);
}

const decoders = {};

export function getStringAccessors(structure) {
  const { sentinel, instance: { members: [ member ] } } = structure;
  const { byteSize } = member;
  return {
    get() {
      let decoder = decoders[byteSize];
      if (!decoder) {
        decoder = decoders[byteSize] = new TextDecoder(`utf-${byteSize * 8}`);
      }
      const dv = this.dataView;
      const TypedArray = (byteSize === 1) ? Int8Array : Int16Array;
      const ta = new TypedArray(dv.buffer, dv.byteOffset, this.length);
      const s = decoder.decode(ta);
      return (sentinel?.value === undefined) ? s : s.slice(0, -1);
    },
    set(src) {
      this.dataView = getDataViewFromUTF8(src, byteSize, sentinel?.value);
    },
  };
}

let encoder;

export function getDataViewFromUTF8(str, byteSize, sentinelValue) {
  if (typeof(str) !== 'string') {
    throwTypeMismatch('a string', str);
  }
  if (sentinelValue !== undefined) {
    if (str.charCodeAt(str.length - 1) !== sentinelValue) {
      str = str + String.fromCharCode(sentinelValue);
    }
  }
  let ta;
  if (byteSize === 1) {
    if (!encoder) {
      encoder = new TextEncoder(`utf-${byteSize * 8}`);
    }
    ta = encoder.encode(str);
  } else if (byteSize === 2) {
    const { length } = str;
    ta = new Uint16Array(length);
    for (let i = 0; i < length; i++) {
      ta[i] = str.charCodeAt(i);
    }
  }
  return new DataView(ta.buffer);
}

export function getTypedArrayAccessors(structure) {
  const { typedArray } = structure;
  return {
    get() {
      const dv = this.dataView;
      const length = dv.byteLength / typedArray.BYTES_PER_ELEMENT;
      return new typedArray(dv.buffer, dv.byteOffset, length);
    },
    set(ta) {
      this.dataView = getDataViewFromTypedArray(ta, typedArray);
    },
  };
}

export function getDataViewFromTypedArray(ta, TypedArray) {
  if (!isTypedArray(ta, TypedArray)) {
    throwTypeMismatch(TypedArray.name, ta);
  }
  return new DataView(ta.buffer, ta.byteOffset, ta.byteLength);;
}

export function getValueOf() {
  const map = new WeakMap();
  function extract(object) {
    let f;
    if (object[Symbol.iterator]) {
      const array = [];
      for (const element of object) {
        array.push(extract(element));
      }
      return array;
    } else if (object && typeof(object) === 'object') {
      let result = map.get(object);
      if (!result) {
        result = {};
        map.set(object, result);
        for (const [ name, child ] of Object.entries(object)) {
          result[name] = extract(child);
        }
        return result;
      }
      return result;
    } else {
      return object;
    }
  };
  return extract(this.$);
}