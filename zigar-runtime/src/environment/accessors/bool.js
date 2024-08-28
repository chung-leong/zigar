import { mixin } from '../class.js';
import { MemberType } from '../members/all.js';

mixin({
  getAccessorBool(access, member) {
    const { bitSize } = member;
    const f = this.getAccessor(access, { ...member, type: MemberType.Uint });
    if (access === 'get') {
      return function(offset, littleEndian) {
        return !!f.call(this, offset);
      }
    } else {
      const zero = (bitSize <= 32) ? 0 : 0n;
      const one = (bitSize <= 32) ? 1 : 1n;
      return function(offset, value, littleEndian) {
        f.call(this, offset, value ? one : zero);
      }
    }
  }
});

export function isRequiredByMember(member) {
  // TODO
}
