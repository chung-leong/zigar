import { mixin } from '../environment.js';
import { visitChild } from './all.js';

var inArray = mixin({
  defineVisitorArray() {
    return {
      value(cb, flags, src) {
        for (let slot = 0, len = this.length; slot < len; slot++) {
          visitChild.call(this, slot, cb, flags, src);
        }
      }
    };
  },
});

export { inArray as default };
