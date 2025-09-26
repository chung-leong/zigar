import { MemberFlag, StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';
import { INITIALIZE, SLOTS, VIVIFICATE } from '../symbols.js';
import { bindSlot } from './all.js';

export default mixin({
  defineMemberObject(member) {
    let get, set;
    if (member.flags & MemberFlag.IsString) {
      get = getString;
    } else if (member.flags & MemberFlag.IsTypedArray) {
      get = getTypedArray;
    } else if (member.flags & MemberFlag.IsPlain) {
      get = getPlain;
    } else if (member.structure.flags & (StructureFlag.HasValue | StructureFlag.HasProxy)) {
      get = getValue;
    } else {
      get = getObject;
    }
    if (member.flags & MemberFlag.IsReadOnly) {
      set = throwReadOnly;
    } else {
      set = setValue;
    }
    return bindSlot(member.slot, { get, set });
  }
});

function getValue(slot) {
  return getObject.call(this, slot).$;
}

function getString(slot) {
  return getValue.call(this, slot)?.string ?? null;
}

function getTypedArray(slot) {
  return getValue.call(this, slot)?.typedArray ?? null;
}

function getPlain(slot) {
  return getValue.call(this, slot)?.valueOf?.() ?? null;
}

function getObject(slot) {
  return this[SLOTS][slot] ?? this[VIVIFICATE](slot);
}

function setValue(slot, value, allocator) {
  const object = getObject.call(this, slot);
  object[INITIALIZE](value, allocator);
}
