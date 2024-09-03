import { MemberType, StructureFlags } from '../constants.js';
import { mixin } from '../environment.js';
import { bindSlot } from './all.js';

export default mixin({
  defineMemberObject(member) {
    return bindSlot(member.slot, {
      get: (member.structure.flags & StructureFlags.HasValue) ? getValue : getObject,
      set: (member.flags & MemberFlags.IsReadOnly) ? null : setValue,
    });
  }
});

export function isNeededByMember(member) {
  return member.type === MemberType.Object;
}

function getValue(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATE](slot);
  return object[SELF];
}

function getObject(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATE](slot);
  return object;
}

function setValue(slot, value) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATE](slot);
  object[SELF] = value;
}

