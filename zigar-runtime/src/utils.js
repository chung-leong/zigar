import { MemberType } from './constants.js';
import { ENVIRONMENT, FALLBACK, LENGTH, MEMORY, NO_CACHE, RESTORE, SIGNATURE } from './symbols.js';

export function defineProperty(object, name, descriptor) {
  if (descriptor) {
    const {
      set,
      get,
      value,
      enumerable,
      configurable = true,
      writable = true,
    } = descriptor;
    Object.defineProperty(object, name, (get || set)
      ? { get, set, configurable, enumerable }
      : { value, configurable, enumerable, writable }
    );
  }
  return object;
}

export function defineProperties(object, descriptors) {
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    defineProperty(object, name, descriptor);
  }
  for (const symbol of Object.getOwnPropertySymbols(descriptors)) {
    const descriptor = descriptors[symbol];
    defineProperty(object, symbol, descriptor);
  }
  return object;
}

export function defineValue(value) {
  return (value !== undefined) ? { value } : undefined;
}

export function getErrorHandler(options) {
  return (options?.error === 'return')
  ? (cb) => {
      try {
        return cb();
      } catch (err) {
        return err;
      }
    }
  : (cb) => cb();
}

export function getPrimitiveName({ type, bitSize }) {
  switch (type) {
    case MemberType.Bool: return 'boolean';
    case MemberType.Int:
    case MemberType.Uint:
      if (bitSize > 32) {
        return 'bigint';
      }
    case MemberType.Float: return 'number';
  }
}

export function decodeText(arrays, encoding = 'utf-8') {
  const decoder = decoders[encoding] ||= new TextDecoder(encoding);
  let array;
  if (Array.isArray(arrays)) {
    if (arrays.length === 1) {
      array = arrays[0];
    } else {
      let len = 0;
      for (const a of arrays) {
        len += a.length;
      }
      const { constructor } = arrays[0];
      array = new constructor(len);
      let offset = 0;
      for (const a of arrays) {
        array.set(a, offset);
        offset += a.length;
      }
    }
  } else {
    array = arrays;
  }
  if (array.buffer[Symbol.toStringTag] === 'SharedArrayBuffer') {
    array = new array.constructor(array);
  }
  return decoder.decode(array);
}

export function encodeText(text, encoding = 'utf-8') {
  switch (encoding) {
    case 'utf-16': {
      const { length } = text;
      const ta = new Uint16Array(length);
      for (let i = 0; i < length; i++) {
        ta[i] = text.charCodeAt(i);
      }
      return ta;
    }
    default: {
      const encoder = encoders[encoding] ||= new TextEncoder();
      return encoder.encode(text);
    }
  }
}

export function encodeBase64(dv) {
  if (process.env.TARGET === 'node') {
    if (typeof(Buffer) === 'function' && Buffer.prototype instanceof Uint8Array) {
      return Buffer.from(dv.buffer, dv.byteOffset, dv.byteLength).toString('base64');
    }
  }
  const ta = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  const bstr = String.fromCharCode.apply(null, ta);
  return btoa(bstr);
}

export function decodeBase64(str) {
  if (process.env.TARGET === 'node') {
    if (typeof(Buffer) === 'function' && Buffer.prototype instanceof Uint8Array) {
      const b = Buffer.from(str, 'base64');
      return new DataView(b.buffer, b.byteOffset, b.byteLength);
    }
  }
  const bstr = atob(str);
  const ta = new Uint8Array(bstr.length);
  for (let i = 0; i < ta.byteLength; i++) {
    ta[i] = bstr.charCodeAt(i);
  }
  return new DataView(ta.buffer);
}

const decoders = {};
const encoders = {};

export function findSortedIndex(array, value, cb) {
  let low = 0;
  let high = array.length;
  if (high === 0) {
    return 0;
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const value2 = cb(array[mid]);
    if (value2 <= value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return high;
}

export function isMisaligned(address, align) {
  if (process.env.BITS == 64) {
    return (align) ? !!(address & BigInt(align - 1)) : false;
  } else {
    return (align) ? !!(address & (align - 1)) : false;
  }
}

export function alignForward(address, align) {
  if (process.env.BITS == 64) {
    return (address + BigInt(align - 1)) & ~BigInt(align - 1);
  } else {
    return (address + (align - 1)) & ~(align - 1);
  }
}

export const usizeMin = (process.env.BITS == 64) ? 0n : 0;
export const usizeMax = (process.env.BITS == 64) ? 0xFFFF_FFFF_FFFF_FFFFn : 0xFFFF_FFFF;
export const usizeInvalid = (process.env.BITS == 64) ? -1n : -1;
export const usizeByteSize = (process.env.BITS == 64) ? 8 : 4;

export function usize(number) {
  if (process.env.BITS == 64) {
    return BigInt(number);
  } else {
    return Number(number);
  }
}

export const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER);
export const minSafeInteger = BigInt(Number.MIN_SAFE_INTEGER);

export function safeInt(bigInt) {
  if (bigInt > maxSafeInteger || bigInt < minSafeInteger) {
    throw new RangeError('Number is too big/small');
  }
  return Number(bigInt);
}

export function readUsize(dv, offset, le) {
  if (process.env.BITS == 64) {
    return dv.getBigUint64(offset, le);
  } else {
    return dv.getUint32(offset, le);
  }
}

export function readUsizeSafe(dv, offset, le) {
  if (process.env.BITS == 64) {
    return safeInt(readUsize(dv, offset, le));
  } else {
    return readUsize(dv, offset, le);
  }
}

export function isInvalidAddress(address) {
  if (process.env.BITS == 64) {
    return address === 0xaaaa_aaaa_aaaa_aaaan;
  } else {
    return address === 0xaaaa_aaaa || address === -0x5555_5556;
  }
}

export function adjustAddress(address, addend) {
  if (process.env.BITS == 64) {
    return address + BigInt(addend);
  } else {
    return address + addend;
  }
}

export function transformIterable(arg) {
  if (typeof(arg.length) === 'number') {
    // it's an array of sort
    return arg;
  }
  const iterator = arg[Symbol.iterator]();
  const first = iterator.next();
  const length = first.value?.length;
  if (typeof(length) === 'number' && Object.keys(first.value).join() === 'length') {
    // return generator with length attached
    return Object.assign((function*() {
      let result;
      while (!(result = iterator.next()).done) {
        yield result.value;
      }
    })(), { length });
  } else {
    const array = [];
    let result = first;
    while (!result.done) {
      array.push(result.value);
      result = iterator.next();
    }
    return array;
  }
}

export function findElements(arg, Child) {
  // casting to a array/slice
  const { constructor: Arg } = arg;
  if (Arg === Child) {
    // matching object
    return 1;
  } else if (Arg.child === Child) {
    // matching slice/array
    return arg.length;
  }
}

export function findObjects(structures, SLOTS) {
  const list = [];
  const found = new Map();
  const find = (object) => {
    if (!object || found.get(object)) {
      return;
    }
    found.set(object, true);
    list.push(object);
    if (object[SLOTS]) {
      for (const child of Object.values(object[SLOTS])) {
        find(child);
      }
    }
  };
  for (const structure of structures) {
    find(structure.instance.template);
    find(structure.static.template);
  }
  return list;
}

export function isCompatibleType(TypeA, TypeB) {
  return (TypeA === TypeB)
      || ((TypeA?.[SIGNATURE] === TypeB[SIGNATURE]) && (TypeA?.[ENVIRONMENT] !== TypeB?.[ENVIRONMENT]));
}

export function isCompatibleInstanceOf(object, Type) {
  return (object instanceof Type) || isCompatibleType(object?.constructor, Type);
}

export function hasMethod(object, name) {
  return typeof(object?.[name]) === 'function';
}

export function isPromise(object) {
  return typeof(object?.then) === 'function';
}

export function decodeFlags(flags, set) {
  const object = {};
  for (const [ name, value ] of Object.entries(set)) {
    if (flags & value) {
      object[name] = true;
    }
  }
  return object;
}

export function decodeEnum(num, set) {
  for (const [ name, value ] of Object.entries(set)) {
    if (num === value) {
      return name;
    }
  }
}

export function getEnumNumber(string, set) {
  for (const [ name, value ] of Object.entries(set)) {
    if (name === string) {
      return value;
    }
  }
}

export function markAsSpecial({ get, set }) {
  get.special = set.special = true;
  return { get, set };
}

export function createView(size) {
  return new DataView(new ArrayBuffer(size));
}

export function copyView(dest, src, offset = 0) {
  const destA = new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength);
  if (process.env.TARGET === 'node') {
    src[FALLBACK]?.(false, offset);
  }
  const srcA = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
  destA.set(srcA, offset);
  if (process.env.TARGET === 'node') {
    dest[FALLBACK]?.(true, offset);
  }
}

export function clearView(dest, offset = 0, len = dest.byteLength - offset) {
  const destA = new Uint8Array(dest.buffer, dest.byteOffset, dest.byteLength);
  destA.fill(0, offset, offset + len);
  if (process.env.TARGET === 'node') {
    dest[FALLBACK]?.(true, offset, len);
  }
}

/* c8 ignore start */
export const isDetached = (Object.hasOwn(ArrayBuffer.prototype, 'detached')) 
? function(buffer) {
    return buffer.detached;
  }
: function(buffer) {
  return buffer.byteLength === 0;
}
/* c8 ignore end */

export function copyObject(dest, src) {
  const destDV = (process.env.TARGET === 'wasm') ? dest[RESTORE]() : dest[MEMORY];
  const srcDV = (process.env.TARGET === 'wasm') ? src[RESTORE]() : src[MEMORY];
  copyView(destDV, srcDV);
}

export function getSelf() {
  return this;
}

export function getLength() {
  return this[LENGTH];
}

export function toString() {
  return String(this);
}

export function always() {
  return true;
}

export function never() {
  return false;
}

export function empty() {}

export class ObjectCache {
  map = new WeakMap();

  find(dv) {
    return (!dv[NO_CACHE]) ? this.map.get(dv) : undefined;
  }

  save(dv, object) {
    if (!dv[NO_CACHE]) {
      this.map.set(dv, object);
    }
  }
}

const TimeFlag = {
  atime: 1 << 0,
  atime_now: 1 << 1,
  mtime: 1 << 2,
  mtime_now: 1 << 3,
};

const now = () => new Date() * 1000;

export function extractTimes(st_atim, st_mtim, fst_flags) {
  const times = {};
  if (fst_flags & TimeFlag.atime) {
    times.atime = st_atim;
  } else if (fst_flags & TimeFlag.atime_now) {
    times.atime = now();
  }
  if (fst_flags & TimeFlag.mtime) {
    times.mtime = st_mtim;
  } else if (fst_flags & TimeFlag.mtime_now) {
    times.mtime = now();
  }
  return times;
}

