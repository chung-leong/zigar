import { mixin } from '../environment.js';
import { INITIALIZE } from '../symbols.js';
import { markAsSpecial } from '../utils.js';

var stringArray = mixin({
  defineStringArray(structure) {
    return markAsSpecial({
      get() {
        const array = [];
        for (const child of this) {
          array.push(child.string);
        }
        return array;
      },
      set(array, allocator) {
        this[INITIALIZE](array, allocator);
      },
    });
  },
});

export { stringArray as default };
