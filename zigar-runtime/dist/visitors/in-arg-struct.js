import { StructureFlag, VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { visitChild } from './all.js';

var inArgStruct = mixin({
  defineVisitorArgStruct(members) {
    const argSlots = [];
    let rvSlot = undefined;
    for (const [ index, { slot, structure } ] of members.entries()) {
      if (structure.flags & StructureFlag.HasPointer) {
        if (index === 0) {
          rvSlot = slot;
        } else {
          argSlots.push(slot);
        }
      }
    }
    return {
      value(cb, flags, src) {
        if (!(flags & VisitorFlag.IgnoreArguments) && argSlots.length > 0) {
          for (const slot of argSlots) {
            visitChild.call(this, slot, cb, flags | VisitorFlag.IsImmutable, src);
          }
        }
        if (!(flags & VisitorFlag.IgnoreRetval) && rvSlot !== undefined) {
          visitChild.call(this, rvSlot, cb, flags, src);
        }
      }
    };
  }
});

export { inArgStruct as default };
