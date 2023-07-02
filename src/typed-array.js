import { StructureType } from './structure.js';
import { getTypeName } from './data-view.js';
import { MEMORY, TYPED_ARRAY } from './symbol.js';

export function attachTypedArrayAccessor(s) {
  const {
    constructor,
    members,
  } = s;
  if (process.env.NODE_ENV !== 'production') {
    if (s.type !== StructureType.Array) {
      throw new Error('Only arrays can have typed array accessor');
    }
  }
  const TypedArray = getTypedArray(member[0]);
  if (TypedArray) {
    const get = function() {
      if (!this[TYPED_ARRAY]) {
        const dv = this[MEMORY];
        this[TYPED_ARRAY] = new TypedArray(dv.buffer, dv.byteOffset, dv.byteLength / byteSize);
      }
      return this[TYPED_ARRAY];
    };
    Object.defineProperties(constructor.prototype, {
      typedArray: { value: get, configurable: true, writable: true },
    });
  }
}

export function getTypedArrayClass(member) {
  const typeName = getTypeName(member);
  return TypedArrays[typeName];
}

const TypedArrays = {
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

