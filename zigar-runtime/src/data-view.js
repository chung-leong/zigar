import { MemberType } from './environment/members/all.js';
import { COMPAT } from './symbol.js';

export function getTypedArrayClass(member) {
  const { type: memberType, byteSize } = member;
  if (memberType === MemberType.Int) {
    switch (byteSize) {
      case 1: return Int8Array;
      case 2: return Int16Array;
      case 4: return Int32Array;
      case 8: return BigInt64Array;
    }
  } else if (memberType === MemberType.Uint) {
    switch (byteSize) {
      case 1: return Uint8Array;
      case 2: return Uint16Array;
      case 4: return Uint32Array;
      case 8: return BigUint64Array;
    }
  } else if (memberType === MemberType.Float) {
    switch (byteSize) {
      case 4: return Float32Array;
      case 8: return Float64Array;
    }
  } else if (memberType === MemberType.Object) {
    return member.structure.typedArray;
  }
  return null;
}

export function isTypedArray(arg, TypedArray) {
  const tag = arg?.[Symbol.toStringTag];
  return (!!TypedArray && tag === TypedArray.name);
}

export function isCompatibleBuffer(arg, constructor) {
  if (arg) {
    const tags = constructor[COMPAT];
    if (tags) {
      const tag = arg?.[Symbol.toStringTag];
      if (tags.includes(tag)) {
        return true;
      }
    }
    if (constructor.child) {
      if (findElements(arg, constructor.child) !== undefined) {
        return true;
      }
    }
  }
  return false;
}


