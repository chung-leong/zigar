import { MemberFlag, StructureFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';
import { INITIALIZE, SLOTS, VIVIFICATE } from '../symbols.js';
import { bindSlot } from './all.js';

export default mixin({
  defineMemberObject(member) {
    return bindSlot(member.slot, {
      get: (member.flags & MemberFlag.IsString)
        ? getString
        : (member.structure.flags & StructureFlag.HasValue) ? getValue : getObject,
      set: (member.flags & MemberFlag.IsReadOnly) ? throwReadOnly : setValue,
    });
  }
});

function getValue(slot) {
  return getObject.call(this, slot).$;
}

function getObject(slot) {
  return this[SLOTS][slot] ?? this[VIVIFICATE](slot);
}

function getString(slot) {
  return getObject.call(this, slot).$.string;
}

function setValue(slot, value, allocator) {
  const object = getObject.call(this, slot);
  object[INITIALIZE](value, allocator);
}
