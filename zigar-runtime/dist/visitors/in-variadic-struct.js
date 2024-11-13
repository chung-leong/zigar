import { StructureFlag, VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { SLOTS, VISIT } from '../symbols.js';
import { visitChild } from './all.js';

var inVariadicStruct = mixin({
  defineVisitorVariadicStruct(members) {
    const rvMember = members[0];
    const rvSlot = (rvMember.structure.flags & StructureFlag.HasPointer) ? rvMember.slot : undefined;
    return {
      value(cb, flags, src) {
        if (!(flags & VisitorFlag.IgnoreArguments)) {
          for (const [ slot, child ] of Object.entries(this[SLOTS])) {
            if (slot !== rvSlot && VISIT in child) {
              visitChild.call(this, slot, cb, flags | VisitorFlag.IsImmutable, src);
            }
          }
        }
        if (!(flags & VisitorFlag.IgnoreRetval) && rvSlot !== undefined) {
          visitChild.call(this, rvSlot, cb, flags, src);
        }
      }
    };
  }
});

export { inVariadicStruct as default };
