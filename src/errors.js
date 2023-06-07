import { MemberType, getTypeName } from './types.js';

export function throwOverflow(bits, signed, v) {
  const typeName = getTypeName(MemberType.Int, bits, signed);
  throw new TypeError(`${typeName} cannot represent value '${v}'`);
}

export function throwSizeMismatch(actual, expected) {
  throw new TypeError(`Struct size mismatch: ${actual} != ${expected}`);
}

export function throwOutOfBound(length, align, index) {
  throw new RangeError(`Illegal array index: ${index}`);
}

export function rethrowRangeError(err, length, align, index) {
  if (err instanceof RangeError) {
    throwOutOfBound(length, align, index);
  } else {
    throw err;
  }
}
