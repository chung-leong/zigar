import { mixin } from '../environment.js';
import { ARRAY } from '../symbols.js';
import { defineValue, getErrorHandler } from '../utils.js';

var forArray = mixin({
  defineArrayEntries() {
    return defineValue(getArrayEntries);
  },
  defineArrayIterator() {
    return defineValue(getArrayIterator);
  }
});

function getArrayIterator() {
  const self = this[ARRAY] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = self.get(current);
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
  const self = this[ARRAY] ?? this;
  const length = this.length;
  let index = 0;
  return {
    next() {
      let value, done;
      if (index < length) {
        const current = index++;
        value = [ current, handleError(() => self.get(current)) ];
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

export { forArray as default };
