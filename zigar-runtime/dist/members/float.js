import { mixin } from '../environment.js';

var float = mixin({
  defineMemberFloat(member) {
    return this.defineMemberUsing(member, this.getAccessor);
  },
});

export { float as default };
