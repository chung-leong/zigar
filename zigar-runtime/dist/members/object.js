import { MemberFlag, StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { throwReadOnly } from '../errors.js';
import { SLOTS, VIVIFICATE, INITIALIZE } from '../symbols.js';
import { bindSlot } from './all.js';

var object = mixin({
  defineMemberObject(member) {
    const { flags, structure, slot } = member;
    let get, set;
    if (flags & MemberFlag.IsString) {
      get = getString;
    } else if (flags & MemberFlag.IsTypedArray) {
      get = getTypedArray;
    } else if (flags & MemberFlag.IsClampedArray) {
      get = getClampedArray;
    } else if (flags & MemberFlag.IsPlain) {
      get = getPlain;
    } else if (structure.flags & (StructureFlag.HasValue | StructureFlag.HasProxy)) {
      get = getValue;
    } else {
      get = getObject;
    }
    if (flags & MemberFlag.IsReadOnly) {
      set = throwReadOnly;
    } else {
      set = setValue;
    }
    return bindSlot(slot, { get, set });
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

function getClampedArray(slot) {
  return getValue.call(this, slot)?.clampedArray ?? null;
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

export { object as default };
