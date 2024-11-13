import { VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { SLOTS, VISIT } from '../symbols.js';
import { visitChild } from './all.js';

export default mixin({
  defineVisitorVariadicStruct(retvalMember) {
    const retvalSlot = retvalMember.slot;
    return {
      value(cb, flags, src) {
        if (!(flags & VisitorFlag.IgnoreArguments)) {
          for (const [ slot, child ] of Object.entries(this[SLOTS])) {
            if (slot !== retvalSlot && VISIT in child) {
              visitChild.call(this, slot, cb, flags | VisitorFlag.IsImmutable, src);
            }
          }
        }
        if (!(flags & VisitorFlag.IgnoreRetval) && retvalSlot !== undefined) {
          visitChild.call(this, retvalSlot, cb, flags, src);
        }
      }
    };
  }
});
