import { mixin } from '../environment.js';
import { Unsupported } from '../errors.js';

var unsupported = mixin({
  defineMemberUnsupported(member) {
    const throwUnsupported = function() {
      throw new Unsupported();
    };
    return { get: throwUnsupported, set: throwUnsupported };
  },
});

export { unsupported as default };
