import { StructureFlag, VisitorFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { visitChild } from './all.js';

export default mixin({
  defineVisitorUnion(members, getSelectorNumber) {
    const pointers = [];
    for (const [ index, { slot, structure } ] of members.entries()) {
      if (structure?.flags & StructureFlag.HasPointer) {
        pointers.push({ index, slot });
      }
    }
    return {
      value(cb, flags, src) {
        const selected = getSelectorNumber?.call(this);
        for (const { index, slot } of pointers) {
          let fieldFlags = flags;
          if (index !== selected) {
            fieldFlags |= VisitorFlag.IsInactive;
          }
          if (!(fieldFlags & VisitorFlag.IsInactive) || !(fieldFlags & VisitorFlag.IgnoreInactive)) {
            visitChild.call(this, slot, cb, fieldFlags, src);
          }
        }
      }
    };
  }
});
