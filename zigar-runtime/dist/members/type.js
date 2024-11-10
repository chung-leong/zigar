import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';
import { SLOTS } from '../symbols.js';
import { bindSlot } from './all.js';

var type = mixin({
  defineMemberType(member, env) {
    const { slot } = member;
    return bindSlot(slot, {
      get(slot) {
        // unsupported types will have undefined structure
        const structure = this[SLOTS][slot];
        return structure?.constructor;
      },
      set: throwReadOnly,
    });
  }
});

export { type as default };
