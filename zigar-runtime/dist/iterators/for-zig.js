import { mixin } from '../environment.js';
import { defineValue } from '../utils.js';

var forZig = mixin({
  defineZigIterator() {
    return defineValue(getZigIterator);
  },
});

function getZigIterator(arg = {}) {
  const self = this;
  const args = (self.next.length === 1) ? [arg] : [];
  return {
    next() {
      const value = self.next(...args);
      const done = value === null;
      return { value, done };
    },
  };
}

export { forZig as default };
