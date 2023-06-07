import { getTypeName  } from './types.js';

export function throwOverflow(bits, signed, v) {
  const typeName = getTypeName(MemberType.Int, bits, signed);
  throw new TypeError(`${typeName} cannot represent value '${v}'`);
}

export function throwSizeMismatch(dv, size) {
  throw new TypeError(`Struct size mismatch: ${dv.byteLength} != ${size}`);
}

export function throwOutOfBound(dv, align, index) {
  throw new RangeError(`Illegal array index: ${index}`);
}

export function rethrowRangeError(err, dv, align, index) {
  if (err instanceof RangeError) {
    throwOutOfBound(dv, align, index);
  } else {
    throw err;
  }
}
