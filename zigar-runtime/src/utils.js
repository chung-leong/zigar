import { memberNames, MemberType } from './constants.js';
import { PROXY } from './symbols.js';

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

export function getTypeName(member) {
  const { type, bitSize, byteSize } = member;
  const suffix = (type === MemberType.Bool && byteSize) ? byteSize * 8 : bitSize;
  let name = memberNames[type] + suffix;
  if (bitSize > 32 && (type === MemberType.Int || type === MemberType.Uint)) {
    if (bitSize <= 64) {
      name = `Big${name}`;
    } else {
      name = `Jumbo${name}`;
    }
  }
  if (byteSize === undefined) {
    name += 'Unaligned';
  }
  return name;
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

export function isMisaligned(address, align) {
  if (align === undefined) {
    return false;
  }
  if (typeof(address) === 'bigint') {
    address = Number(address & 0xFFFFFFFFn);
  }
  const mask = align - 1;
  return (address & mask) !== 0;
}

export function alignForward(address, align) {
  let mask;
  if (typeof(address) === 'bigint') {
    align = BigInt(align);
    mask = ~(align - 1n);
  } else {
    mask = ~(align - 1);
  }
  return (address + align - 1) & mask;
}

export function isInvalidAddress(address) {
  if (typeof(address) === 'bigint') {
    return address === 0xaaaaaaaaaaaaaaaan;
  } else {
    return address === 0xaaaaaaaa;
  }
}

export function add(arg1, arg2) {
  return arg1 + ((typeof(arg1) === 'bigint') ? BigInt(arg2) : arg2);
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

function adjustIndex(index, len) {
  index = index | 0;
  if (index < 0) {
    index = len + index;
    if (index < 0) {
      index = 0;
    }
  } else {
    if (index > len) {
      index = len;
    }
  }
  return index;
}

function getSubArrayView(begin, end) {
  begin = (begin === undefined) ? 0 : adjustIndex(begin, this.length);
  end = (end === undefined) ? this.length : adjustIndex(end, this.length);
  const dv = this[MEMORY];
  const offset = begin * elementSize;
  const len = (end * elementSize) - offset;
  return thisEnv.obtainView(dv.buffer, dv.byteOffset + offset, len);
}

function getSubarrayOf(begin, end) {
  const dv = getSubArrayView.call(this, begin, end);
  return constructor(dv);
};

function getSliceOf(begin, end, options = {}) {
  const {
    fixed = false
  } = options;
  const dv1 = getSubArrayView.call(this, begin, end);
  const dv2 = thisEnv.allocateMemory(dv1.byteLength, align, fixed);
  const slice = constructor(dv2);
  copier.call(slice, { [MEMORY]: dv1 });
  return slice;
};
