import { ProxyType } from '../constants.js';
import { mixin } from '../environment.js';
import { getProxyTarget } from '../proxies.js';
import { defineValue, getErrorHandler } from '../utils.js';

export default mixin({
  defineArrayEntries() {
    return defineValue(getArrayEntries);
  },
  defineArrayIterator() {
    return defineValue(getArrayIterator);
  }
});

function getArray(arg) {
  const proxy = getProxyTarget(arg);
  if (proxy) {
    const { target } = proxy;
    return (proxy.type & ProxyType.Pointer) ? target['*'] : target;
  }
  return arg;
}

function getArrayIterator() {
  const array = getArray(this);
  const length = array.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = array.get(current);
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function getArrayEntriesIterator(options) {
  const handleError = getErrorHandler(options);
  const array = getArray(this);
  const length = array.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = [ current, handleError(() => array.get(current)) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

function getArrayEntries(options) {
  return {
    [Symbol.iterator]: getArrayEntriesIterator.bind(this, options),
    length: this.length,
  };
}