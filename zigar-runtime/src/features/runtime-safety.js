import { Overflow } from '../../error.js';
import { mixin } from '../class.js';

export default mixin({
  imports: {
    isRuntimeSafetyActive: { argType: '', returnType: 'b' },
  },

  addRuntimeCheck(getAccessor) {
    return function (access, member) {
      const accessor = getAccessor(access, member);
      if (access === 'set') {
        const { min, max } = getIntRange(member);
        return function(offset, value, littleEndian) {
          if (value < min || value > max) {
            throw new Overflow(member, value);
          }
          accessor.call(this, offset, value, littleEndian);
        };
      }
      return accessor;
    };
  },
});

export function isNeededByMember(member) {
  if (this.runtimeSafety) {
    switch (member.type) {
      case MemberType.Int:
      case MemberType.Uint:
        return true;
    }
  }
  return false;
}

export function getIntRange(member) {
  const { type, bitSize } = member;
  const signed = (type === MemberType.Int);
  let magBits = (signed) ? bitSize - 1 : bitSize;
  if (bitSize <= 32) {
    const max = 2 ** magBits - 1;
    const min = (signed) ? -(2 ** magBits) : 0;
    return { min, max };
  } else {
    magBits = BigInt(magBits);
    const max = 2n ** magBits - 1n;
    const min = (signed) ? -(2n ** magBits) : 0n;
    return { min, max };
  }
}