import { MemberType } from './member.js';
import { getTypeName } from './data-view.js';

export function throwOverflow(member, value) {
  const typeName = getTypeName(member);
  throw new TypeError(`${typeName} cannot represent value '${value}'`);
}

export function throwSizeMismatch(name, expected, actual, multiple) {
  const s = (actual > 0) ? 's' : '';
  if (multiple) {
    const extra = actual % expected;
    throw new TypeError(`${name} has elements that are ${expected} byte${s} in length, received ${actual} (${extra} bytes extra)`);
  } else {
    throw new TypeError(`${name} has ${expected} byte${s}, received ${actual}`);
  }
}

export function throwBufferExpected(size) {
  throw new TypeError(`Expect an ArrayBuffer or DataView with a ${size} byte in length of `);
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

export function throwNoNewError() {
  throw new TypeError(`Cannot create new error\nCall function without the use of "new" to obtain an error object`);
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

export function throwNotInErrorSet(name) {
  throw new TypeError(`Error given is not a part of error set "${name}"`);
}

export function throwUnknownErrorNumber(number) {
  throw new TypeError(`Unknown error: #${number}`);
}

export function decamelizeErrorName(name) {
  const lc = name.replace(/(\p{Uppercase}+)(\p{Lowercase}*)/gu, (m0, m1, m2) => {
    if (m1.length === 1) {
      return ` ${m1.toLocaleLowerCase()}${m2}`;
    } else {
      if (m2) {
        const acronym = m1.substring(0, m1.length - 1);
        const letter = m1.charAt(m1.length - 1).toLocaleLowerCase();
        return ` ${acronym} ${letter}${m2}`;
      } else {
        return ` ${m1}`;
      }
    }
  }).trimStart();
  return lc.charAt(0).toLocaleUpperCase() + lc.substring(1);
}