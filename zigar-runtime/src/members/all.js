import { mixin } from '../environment.js';
import { GETTER, SETTER, SLOTS } from '../symbols.js';

export default mixin({
  getDescriptor(member) {
    const { type } = member;
    const name = `getDescriptor${memberNames[type]}`;
    const f = this[name];
    /* c8 ignore start */
    if (process.env.DEV) {
      if (!f) {
        throw new Error(`Missing method: ${name}`);
      }
    }
    /* c8 ignore end */
    return f.call(this, member);
  },
});

export function isNeededByMember(member) {
  return true;
}

export const MemberType = {
  Void: 0,
  Bool: 1,
  Int: 2,
  Uint: 3,
  Float: 4,
  Object: 5,
  Type: 6,
  Comptime: 7,
  Static: 8,
  Literal: 9,
  Null: 10,
  Undefined: 11,
  Unsupported: 12,
};
export const memberNames = Object.keys(MemberType);

export function isReadOnly({ type }) {
  switch (type) {
    case MemberType.Type:
    case MemberType.Comptime:
    case MemberType.Literal:
      return true;
    default:
      return false;
  }
};

export function bindSlot(slot, { get, set }) {
  if (slot !== undefined) {
    return {
      get: function() {
        return get.call(this, slot);
      },
      set: (set)
      ? function(arg) {
          return set.call(this, slot, arg);
        }
      : undefined,
    };
  } else {
    // array accessors
    return { get, set };
  }
}

export function getValue(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATOR](slot);
  return object[GETTER]();
}

export function getObject(slot) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATOR](slot);
  return object;
}

export function setValue(slot, value) {
  const object = this[SLOTS][slot] ?? this[VIVIFICATOR](slot);
  object[SETTER](value);
}

