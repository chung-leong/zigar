import { StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { visitChild } from './all.js';

var inStruct = mixin({
  defineVisitorStruct(members) {
    // TODO: handle non-byte-aligned pointers
    const slots = members.filter(m => (m.structure?.flags & StructureFlag.HasPointer) && !(m.bitOffset & 7)).map(m => m.slot);
    return {
      value(cb, flags, src) {
        for (const slot of slots) {
          visitChild.call(this, slot, cb, flags, src);
        }
      }
    };
  }
});

export { inStruct as default };
