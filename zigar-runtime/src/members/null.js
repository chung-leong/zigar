import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';

export default mixin({
  defineMemberNull(member) {
    return {
      get: function() {
        return null;
      },
      set: throwReadOnly,
    };
  },
});
