import { MemberType, StructureType } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  defineMemberUint(member) {
    let getAccessor = this.getAccessor;
    if (this.runtimeSafety) {
      getAccessor = this.addRuntimeCheck(getAccessor);
    }
    getAccessor = this.addIntConversion(getAccessor);
    return this.defineMemberUsing(member, getAccessor);
  },
});

export function isNeededByMember(member) {
  return member.type === MemberType.Uint;
}

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Pointer;
}
