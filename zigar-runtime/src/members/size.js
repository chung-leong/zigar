import { MemberFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  imports: {
    isRuntimeSafetyActive: { argType: '', returnType: 'b' },
  },

  addSizeAdjustment(getAccessor) {
    return function (access, member) {
      const accessor = getAccessor.call(this, access, member);
      if (access === 'set') {
        const Type = (member.bitSize > 32) ? BigInt : Number;
        return function(offset, value, littleEndian) {
          accessor.call(this, offset, Type(value), littleEndian);
        };
      } else {
        return function(offset, littleEndian) {
          return Number(accessor.call(this, offset, littleEndian));
        };
      }
    };
  },
});

export function isNeededByMember(member) {
  return !!(member.flags & MemberFlag.IsSize);
}

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Pointer;
}
