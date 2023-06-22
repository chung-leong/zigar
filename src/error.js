import { MemberType, getTypeName } from './type.js';

export function throwOverflow(isSigned, bitSize, value) {
  const typeName = getTypeName(MemberType.Int, isSigned, bitSize);
  throw new TypeError(`${typeName} cannot represent value '${value}'`);
}

export function throwSizeMismatch(actual, expected) {
  throw new TypeError(`Struct size mismatch: ${actual} != ${expected}`);
}

export function throwBufferExpected(size) {
  throw new TypeError(`Expect an ArrayBuffer or DataView with a byte length of ${size}`);
}

export function throwOutOfBound(length, align, index) {
  throw new RangeError(`Illegal array index: ${index}`);
}

export function throwNotNull() {
  throw new RangeError(`Property can only be null`);
}

export function rethrowRangeError(err, length, align, index) {
  if (err instanceof RangeError) {
    throwOutOfBound(length, align, index);
  } else {
    throw err;
  }
}

export function throwNoNewEnum() {
  throw new TypeError(`Cannot create new enum item\nCall function without the use of "new" to obtain an enum object`);
}

export function throwInvalidEnum(value) {
  throw new TypeError(`Value given does not correspond to an enum item: ${value}`);
}

export function throwEnumExpected(constructor) {
  throw new TypeError(`Enum item expected: ${constructor.name}`);
}

export function throwInvalidType(constructor) {
  throw new TypeError(`Object of specific type expected: ${constructor.name}`);
}
