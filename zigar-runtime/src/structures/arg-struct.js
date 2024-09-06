import { MemberType, StructureFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { ArgumentCountMismatch, adjustArgumentError } from '../errors.js';
import { MEMORY, SLOTS, VISIT, VIVIFICATE } from '../symbols.js';
import { never } from '../utils.js';

export default mixin({
  defineArgStruct(structure, descriptors) {
    const {
      flags,
      byteSize,
      align,
      instance: { members },
    } = structure;
    const thisEnv = this;
    const hasObject = !!members.find(m => m.type === MemberType.Object);
    const argKeys = members.slice(1).map(m => m.name);
    const argCount = argKeys.length;
    const constructor = function(args, name, offset) {
      const creating = this instanceof constructor;
      let self, dv;
      if (creating) {
        self = this;
        dv = thisEnv.allocateMemory(byteSize, align);
      } else {
        self = Object.create(constructor.prototype);
        dv = args;
      }
      self[MEMORY] = dv;
      if (hasObject) {
        self[SLOTS] = {};
      }
      if (creating) {
        if (args.length !== argCount) {
          throw new ArgumentCountMismatch(name, argCount - offset, args.length - offset);
        }
        for (const [ index, key ] of argKeys.entries()) {
          try {
            this[key] = args[index];
          } catch (err) {
            throw adjustArgumentError(name, index - offset, argCount - offset, err);
          }
        }
      } else {
        return self;
      }
    };
    for (const member of members) {
      descriptors[member.name] = this.defineMember(member);
    }
    const { slot: retvalSlot, type: retvalType } = members[0];
    const isChildMutable = (retvalType === MemberType.Object)
    ? function(object) {
        const child = this[VIVIFICATE](retvalSlot);
        return object === child;
      }
    : never;
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(structure, { isChildMutable });
    return constructor;
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.ArgStruct;
}
