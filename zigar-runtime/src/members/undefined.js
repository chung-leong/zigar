import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';

export default mixin({
  defineMemberUndefined(member) {
    return {
      get: function() {
        return undefined;
      },
      set: throwReadOnly,
    };
  },
});

