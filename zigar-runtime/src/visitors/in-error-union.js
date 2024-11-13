import { VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { visitChild } from './all.js';

export default mixin({
  defineVisitorErrorUnion(valueMember, getErrorNumber) {
    const { slot } = valueMember;
    return {
      value(cb, flags, src) {
        if (getErrorNumber.call(this)) {
          flags |= VisitorFlag.IsInactive;
        }
        if (!(flags & VisitorFlag.IsInactive) || flags & VisitorFlag.VisitInactive) {
          visitChild.call(this, slot, cb, flags, src);
        }
      }
    };
  }
});
