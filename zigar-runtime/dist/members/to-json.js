import { mixin } from '../environment.js';
import { normalizeObject } from './value-of.js';

var toJson = mixin({
  defineToJSON() {
    return {
      value() {
        return normalizeObject(this, true);
      },
    };
  },
});

export { toJson as default };
