import { MemberFlag, MemberType, StructureType } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  addIntConversion(getAccessor) {
    return function (access, member) {
      const accessor = getAccessor.call(this, access, member);
      if (access === 'set') {
        const Type = (member.bitSize > 32) ? BigInt : Number;
        return function(offset, value, littleEndian) {
          accessor.call(this, offset, Type(value), littleEndian);
        };
      } else {
        if (member.flags & MemberFlag.IsSize) {
          return function(offset, littleEndian) {
            return Number(accessor.call(this, offset, littleEndian));
          };
        }
      }
      return accessor;
    };
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Int || member.type === MemberType.Uint;
}

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Pointer;
}
