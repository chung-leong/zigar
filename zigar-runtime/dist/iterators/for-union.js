import { mixin } from '../environment.js';
import { PROPS, GETTERS } from '../symbols.js';
import { defineValue, getErrorHandler } from '../utils.js';

var forUnion = mixin({
  defineUnionEntries() {
    return defineValue(getUnionEntries);
  },
  defineUnionIterator() {
    return defineValue(getUnionIterator);
  }
});

function getUnionEntries(options) {
  return {
    [Symbol.iterator]: getUnionEntriesIterator.bind(this, options),
    length: this[PROPS].length,
  };
}

function getUnionIterator(options) {
  const entries = getUnionEntries.call(this, options);
  return entries[Symbol.iterator]();
}

function getUnionEntriesIterator(options) {
  const handleError = getErrorHandler(options);
  const self = this;
  const props = this[PROPS];
  const getters = this[GETTERS];
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < props.length) {
        const current = props[index++];
        // get value of prop with no check
        value = [ current, handleError(() => getters[current].call(self)) ];
        done = false;
      } else {
        done = true;
      }
      return { value, done };
    },
  };
}

export { forUnion as default };
