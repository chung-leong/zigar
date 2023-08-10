import { StructureType } from './structure.js';
import { MemberType, restoreMemory } from './member.js';
import { getMemoryCopier } from './memory.js';
import { throwBufferSizeMismatch } from './error.js';
import { MEMORY } from './symbol.js';

export function addSpecialAccessors(s) {
  const {
    constructor,
    instance: {
      members,
    },
  } = s;
  const dvAccessors = getDataViewAccessors(s);
  const base64Acccessors = getBase64Accessors();
  const descriptors = {
    dataView: { ...dvAccessors, configurable: true },
    base64: { ...base64Acccessors, configurable: true },
    toJSON: { value: getValueOf, configurable: true, writable: true },
    valueOf: { value: getValueOf, configurable: true, writable: true },
  };
  if (s.type === StructureType.Array || s.type === StructureType.Slice) {
    const { type, isSigned, byteSize } = members[0];
    if (type === MemberType.Int && !isSigned && (byteSize === 1 || byteSize === 2)) {
      const strAccessors = getStringAccessors(byteSize);
      descriptors.string = { ...strAccessors, configurable: true };
    }
  }
  if (s.type === StructureType.Array || s.type === StructureType.Slice || s.type === StructureType.Vector) {
    if (s.typedArray) {
      const { byteSize } = members[0];
      const taAccessors = getTypedArrayAccessors(s.typedArray, byteSize);
      descriptors.typedArray = { ...taAccessors, configurable: true };
    }
  }
  Object.defineProperties(constructor.prototype, descriptors);
}

export function getDataViewAccessors(structure) {
  const { size } = structure;
  const copy = getMemoryCopier(size);
  return {
    get() {
      if (process.env.ZIGAR_TARGET === 'WASM-RUNTIME') {
        restoreMemory.call(this);
      }
      return this[MEMORY];
    },
    set(src) {
      if (src.byteLength !== size) {
        throwBufferSizeMismatch(structure, src);
      }
      if (process.env.ZIGAR_TARGET === 'WASM-RUNTIME') {
        restoreMemory.call(this);
      }
      copy(this[MEMORY], src);
    },
  };
}

export function getBase64Accessors() {
  return {
    get() {
      const dv = this.dataView;
      const ta = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const bstr = String.fromCharCode.apply(null, ta);
      return btoa(bstr);
    },
    set(src) {
      const bstr = atob(src);
      const ta = new Uint8Array(bstr.length);
      for (let i = 0; i < ta.byteLength; i++) {
        ta[i] = bstr.charCodeAt(i);
      }
      const dv = new DataView(ta.buffer);
      this.dataView = dv;
    }
  }
}

const decoders = {};
const encoders = {};

export function getStringAccessors(byteSize) {
  return {
    get() {
      let decoder = decoders[byteSize];
      if (!decoder) {
        decoder = decoders[byteSize] = new TextDecoder(`utf-${byteSize * 8}`);
      }
      const dv = this.dataView;
      const TypedArray = (byteSize === 1) ? Int8Array : Int16Array;
      const ta = new TypedArray(dv.buffer, dv.byteOffset, dv.byteLength / byteSize);
      return decoder.decode(ta);
    },
    set(src) {
      let encoder = encoders[byteSize];
      if (!encoder) {
        encoder = encoders[byteSize] = new TextEncoder(`utf-${byteSize * 8}`);
      }
      const ta = encoder.encode(src);
      const dv = new DataView(ta.buffer);
      this.dataView = dv;
    },
  };
}

export function getTypedArrayAccessors(typedArray, byteSize) {
  return {
    get() {
      const dv = this.dataView;
      return new typedArray(dv.buffer, dv.byteOffset, dv.byteLength / byteSize);
    },
    set(src) {
      const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);;
      this.dataView = dv;
    },
  };
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