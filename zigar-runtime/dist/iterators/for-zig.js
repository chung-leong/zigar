import { mixin } from '../environment.js';
import { defineValue } from '../utils.js';

var forZig = mixin({
  defineZigIterator() {
    return defineValue(getZigIterator);
  },
});

function getZigIterator() {
  const self = this;
  return {
    next() {
      const value = self.next();
      const done = value === null;
      return { value, done };
    },
  };
}

export { forZig as default };
