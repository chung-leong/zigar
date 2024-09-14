import { mixin } from '../environment.js';

export default mixin({
  defineMemberUndefined(member) {
    return {
      get: function() {
        return undefined;
      },
    };
  },
});

