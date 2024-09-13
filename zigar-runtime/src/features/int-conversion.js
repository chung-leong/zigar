import { MemberFlag, MemberType, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { InvalidIntConversion } from '../errors.js';

export default mixin({
  addIntConversion(getAccessor) {
    return function (access, member) {
      const accessor = getAccessor.call(this, access, member);
      if (access === 'set') {
        return (member.bitSize > 32)
        ? function(offset, value, littleEndian) {
            accessor.call(this, offset, BigInt(value), littleEndian);
          }
        : function(offset, value, littleEndian) {
          const number = Number(value);
          if (!isFinite(number)) {
            throw new InvalidIntConversion(value)
          }
          accessor.call(this, offset, number, littleEndian);
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
