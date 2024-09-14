import { mixin } from '../environment.js';

export default mixin({
  defineMemberNull(member) {
    return {
      get: function() {
        return null;
      },
    };
  },
});
