import { getTypeName } from './data-view.js';

export function attachStringAccessors(s) {
  const {
    members: [ member ],
  } = s;
  const get = getStringGetter(member);
  if (get) {
    Object.defineProperties(constructor.prototype, {
      toString: { value: get, configurable: true, writable: true },
      string: { get, configurable: true, enumerable: true },
    });
  }
}

export function getStringGetter(member) {
  const typeName = getTypeName(member);
  const TypedArray = TypedArrays[typeName];
  if (TypedArray) {
    const { byteSize } = member;
    return function () {
      const dv = this[MEMORY];
      const ta = new TypedArray(dv.buffer, dv.byteOffset, dv.byteLength / byteSize);
      const decoder = new TextDecoder();
      return decoder.decode(ta);
    }
  }
}

const TypedArrays = {
  Uint8: Int8Array,
  Uint6: Int16Array,
  Uint32: Int32Array,
};
