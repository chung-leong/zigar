import { mixin } from '../environment.js';

var bool = mixin({
  defineMemberBool(member) {
    return this.defineMemberUsing(member, this.getAccessor);
  },
});

export { bool as default };
