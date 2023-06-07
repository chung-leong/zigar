import { MemberType, getTypeName } from './types.js';
import { DATA, TYPED_ARRAY } from './symbols.js';

export function obtainTypedArrayGetter(members) {
  const hash = {};
  for (const { type, bits, signed } of members) {
    if (type === MemberType.Int || type === MemberType.Float) {
      const typeName = getTypeName(type, bits, signed);
      const constructor = typedArrays[typeName];
      if (!constructor) {
        return;
      }
      hash[typeName] = constructor;
    } else {
      return;
    }
  }
  const entries = Object.entries(hash);
  if (entries.length !== 1) {
    return;
  }
  const [ typeName, constructor ] = entries[0];
  if (typedArrayGetters[typeName]) {
    return typedArrayGetters[typeName];
  }
  const size = members[0].bits >> 3;
  const fn = function() {
    if (!this[TYPED_ARRAY]) {
      const dv = this[DATA];
      this[TYPED_ARRAY] = new constructor(dv.buffer, dv.byteOffset, dv.byteLength / size);
    }
    return this[TYPED_ARRAY];
  };
  typedArrayGetters[typeName] = fn;
  return fn;
}

const typedArrayGetters = {};

const typedArrays = {
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

