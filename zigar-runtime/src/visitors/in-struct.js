import { StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { visitChild } from './all.js';

export default mixin({
  defineVisitorStruct(members) {
    const slots = members.filter(m => m.structure?.flags & StructureFlag.HasPointer).map(m => m.slot);
    return {
      value(cb, flags, src) {
        for (const slot of slots) {
          visitChild.call(this, slot, cb, flags, src);
        }
      }
    };
  }
});
