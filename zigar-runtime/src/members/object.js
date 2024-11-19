import { MemberFlag, StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';
import { INITIALIZE, SLOTS, VIVIFICATE } from '../symbols.js';
import { bindSlot } from './all.js';

export default mixin({
  defineMemberObject(member) {
    return bindSlot(member.slot, {
      get: (member.structure.flags & StructureFlag.HasValue) ? getValue : getObject,
      set: (member.flags & MemberFlag.IsReadOnly) ? throwReadOnly : setValue,
    });
  }
});

function getValue(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATE](slot);
  return object.$;
}

function getObject(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATE](slot);
  return object;
}

function setValue(slot, value, allocator) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATE](slot);
  object[INITIALIZE](value, allocator);
}

