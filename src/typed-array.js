import { StructureType } from './structure.js';
import { getTypeName } from './data-view.js';
import { MEMORY, TYPED_ARRAY } from './symbol.js';

export function addTypedArrayAccessor(s) {
  const {
    constructor,
    instance: {
      members: [ member ],
    }
  } = s;
  if (process.env.NODE_ENV !== 'production') {
    /* c8 ignore next 3 */
    if (s.type !== StructureType.Array && s.type !== StructureType.Slice) {
      throw new Error('Only arrays can have typed array accessor');
    }
  }
  const TypedArray = getTypedArrayClass(member);
  if (TypedArray) {
    const get = function() {
      if (!this[TYPED_ARRAY]) {
        const dv = this[MEMORY];
        this[TYPED_ARRAY] = new TypedArray(dv.buffer, dv.byteOffset, this.length);
      }
      return this[TYPED_ARRAY];
    };
    Object.defineProperties(constructor.prototype, {
      typedArray: { get, configurable: true },
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

