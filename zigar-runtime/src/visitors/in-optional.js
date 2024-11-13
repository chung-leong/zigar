import { VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { visitChild } from './all.js';

export default mixin({
  defineVisitorOptional(valueMember, getPresent) {
    const { slot } = valueMember;
    return {
      value(cb, flags, src) {
        if (!getPresent.call(this)) {
          flags |= VisitorFlag.IsInactive;
        }
        if (!(flags & VisitorFlag.IsInactive) || !(flags & VisitorFlag.IgnoreInactive)) {
          visitChild.call(this, slot, cb, flags, src);
        }
      }
    };
  }
});
