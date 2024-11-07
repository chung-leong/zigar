import { mixin } from '../environment.js';
import { normalizeObject } from './value-of.js';

export default mixin({
  defineToJSON() {
    return {
      value() {
        return normalizeObject(this, true);
      },
    };
  },
});

