import { mixin } from '../environment.js';
import { NotUndefined, OutOfBound } from '../errors.js';
import { MemberType } from '../members/all.js';

export default mixin({
  getDescriptorVoid(member, env) {
    const { bitOffset } = member;
    return {
      get() {
        return undefined;
      },
      set: (bitOffset !== undefined)
      ? function(value) {
        if (value !== undefined) {
          throw new NotUndefined(member);
        }
      }
      : function(index, value) {
        if (value !== undefined) {
          throw new NotUndefined(member);
        }
        if (index < 0 || index >= this.length) {
          throw new OutOfBound(member, index);
        }
      },
    };
  }
});

export function isNeededByMember(member) {
  return member.type === MemberType.Void;
}