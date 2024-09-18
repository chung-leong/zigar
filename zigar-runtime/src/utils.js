import { MemberType } from './constants.js';
import { LENGTH, PROXY } from './symbols.js';

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
  const decoder = decoders[encoding] ??= new TextDecoder(encoding);
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
      const encoder = encoders[encoding] ??= new TextEncoder();
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

export const isMisaligned = (process.env.BITS === '64')
? function(address, align) {
    return (align !== undefined) ? !!(address & BigInt(align - 1)) : false;
  }
: (process.env.BITS === '32')
? function(address, align) {
    return (align !== undefined) ? !!(address & (align - 1)) : false;
  }
  /* c8 ignore next */
: undefined;

export const alignForward = (process.env.BITS === '64')
? function(address, align) {
    return (address + BigInt(align - 1)) & ~BigInt(align - 1);
  }
: (process.env.BITS === '32')
? function(address, align) {
    return (address + (align - 1)) & ~(align - 1);
  }
  /* c8 ignore next */
: undefined;

export const isInvalidAddress = (process.env.BITS === '64')
? function(address) {
    return address === 0xaaaaaaaaaaaaaaaan;
  }
: (process.env.BITS === '32')
? function(address) {
    return address === 0xaaaaaaaa;
  }
  /* c8 ignore next */
: undefined;

export const adjustAddress = (process.env.BITS === '64')
? function(address, addend) {
    return address + BigInt(addend);
  }
: (process.env.BITS === '32')
? function(address, addend) {
    return address + addend;
  }
  /* c8 ignore next */
: undefined;

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

export function getSelf() {
  return this;
}

export function getLength() {
  return this[LENGTH];
}

export function getProxy() {
  return this[PROXY];
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

export class ObjectCache {
  map = new WeakMap();

  find(dv) {
    return this.map.get(dv);
  }

  save(dv, object) {
    this.map.set(dv, object);
    return object;
  }
}
