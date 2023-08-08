import { StructureType } from './structure.js';
import { MemberType } from './member.js';
import { MEMORY, TYPED_ARRAY } from './symbol.js';

export function addTypedArrayAccessor(s) {
  const {
    constructor,
    instance: {
      members: [ member ],
    },
    typedArray,
  } = s;
  if (process.env.NODE_ENV !== 'production') {
    /* c8 ignore next 3 */
    if (s.type !== StructureType.Array && s.type !== StructureType.Slice) {
      throw new Error('Only arrays can have typed array accessor');
    }
  }
  if (typedArray) {
    const get = function() {
      if (!this[TYPED_ARRAY]) {
        const dv = this[MEMORY];
        this[TYPED_ARRAY] = new typedArray(dv.buffer, dv.byteOffset, this.length);
      }
      return this[TYPED_ARRAY];
    };
    Object.defineProperties(constructor.prototype, {
      typedArray: { get, configurable: true },
    });
  }
}

export function getTypedArrayClass({ type, isSigned, byteSize }) {
  if (type === MemberType.Int) {
    if (isSigned) {
      switch (byteSize) {
        case 1: return Int8Array;
        case 2: return Int16Array;
        case 4: return Int32Array;
        case 8: return BigInt64Array;
      }
    } else {
      switch (byteSize) {
        case 1: return Uint8Array;
        case 2: return Uint16Array;
        case 4: return Uint32Array;
        case 8: return BigUint64Array;
      }
    }
  } else if (type === MemberType.Float) {
    switch (byteSize) {
      case 4: return Float32Array;
      case 8: return Float64Array;
    }
  }
}

export function isTypedArray(arg, TypedArray) {
  const tag = arg?.[Symbol.toStringTag];
  return (!!TypedArray && tag === TypedArray.name);
}