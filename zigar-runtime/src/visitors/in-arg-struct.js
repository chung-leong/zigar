import { StructureFlag, VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { visitChild } from './all.js';

export default mixin({
  defineVisitorStruct(argMembers, retvalMember) {
    const argSlots = argMembers.filter(m => m.structure?.flags & StructureFlag.HasPointer).map(m => m.slot);
    const retvalSlot = retvalMember.slot;
    return {
      value(cb, flags, src) {
        if (flags & VisitorFlag.VisitArguments && argSlots.length > 0) {
          for (const slot of argSlots) {
            visitChild.call(this, slot, cb, flags, src);
          }
        }
        if (flags & VisitorFlag.VisitRetval && retvalSlot !== undefined) {
          visitChild.call(this, retvalSlot, cb, flags, src);
        }
      }
    };
  }
});
