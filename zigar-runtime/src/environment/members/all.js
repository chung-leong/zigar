import { mixin } from '../class.js';

mixin({
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

export function isNeededByMember(member) {
  return true;
}

