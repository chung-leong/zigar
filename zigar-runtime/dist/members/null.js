import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';

var _null = mixin({
  defineMemberNull(member) {
    return {
      get: function() {
        return null;
      },
      set: throwReadOnly,
    };
  },
});

export { _null as default };
