import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';

var _undefined = mixin({
  defineMemberUndefined(member) {
    return {
      get: function() {
        return undefined;
      },
      set: throwReadOnly,
    };
  },
});

export { _undefined as default };
