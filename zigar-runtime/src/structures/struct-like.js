import { MemberType, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { NotOnByteBoundary } from '../errors.js';
import { MEMORY, PARENT, SLOTS } from '../symbols.js';

export default mixin({
  defineVivificatorStruct(structure) {
    const { instance: { members } } = structure;
    const objectMembers = {};
    for (const member of members.filter(m => m.type === MemberType.Object)) {
      objectMembers[member.slot] = member;
    }
    const thisEnv = this;
    return {
      value(slot) {
        const member = objectMembers[slot];
        const { bitOffset, byteSize, structure: { constructor } } = member;
        const dv = this[MEMORY];
        const parentOffset = dv.byteOffset;
        const offset = parentOffset + (bitOffset >> 3);
        let len = byteSize;
        if (len === undefined) {
          if (bitOffset & 7) {
            throw new NotOnByteBoundary(member);
          }
          len = member.bitSize >> 3;
        }
        const childDV = thisEnv.obtainView(dv.buffer, offset, len);
        const object = this[SLOTS][slot] = constructor.call(PARENT, childDV);
        return object;
      }
    };
  },
});

export function isNeededByStructure(structure) {
  const { type, instance: { members } } = structure;
  switch (type) {
    case StructureType.Struct:
    case StructureType.Union:
    case StructureType.ErrorUnion:
    case StructureType.Optional: {
      for (const { type } of members) {
        if (type === MemberType.Object) {
          return true;
        }
      }
    }
  }
  return false;
}
