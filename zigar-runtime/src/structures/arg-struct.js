import { ArgStructFlag, MemberType, StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { ArgumentCountMismatch, UndefinedArgument, adjustArgumentError } from '../errors.js';
import { MEMORY, SLOTS, THROWING, VISIT, VIVIFICATE } from '../symbols.js';
import { defineValue, never } from '../utils.js';

export default mixin({
  defineArgStruct(structure, descriptors) {
    const {
      flags,
      byteSize,
      align,
      instance: { members },
    } = structure;
    const thisEnv = this;
    const argMembers = members.slice(1);
    const argCount = argMembers.length;
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
      if (flags & StructureFlag.HasSlot) {
        self[SLOTS] = {};
      }
      if (creating) {
        if (args.length !== argCount) {
          throw new ArgumentCountMismatch(name, argCount - offset, args.length - offset);
        }
        for (let i = 0; i < argCount; i++) {
          try {
            const arg = args[i];
            if (arg === undefined) {
              const { type } = argMembers[i];
              if (type !== MemberType.Void) {
                throw new UndefinedArgument();
              }
            }
            this[i] = arg;
          } catch (err) {
            throw adjustArgumentError(name, i - offset, argCount - offset, err);
          }
        }
      } else {
        return self;
      }
    };
    for (const member of members) {
      descriptors[member.name] = this.defineMember(member);
    }
    const { slot: rvSlot, type: rvType } = members[0];
    const isChildMutable = (rvType === MemberType.Object)
    ? function(object) {
        const child = this[VIVIFICATE](rvSlot);
        return object === child;
      }
    : never;
    descriptors.length = defineValue(argCount);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(structure, { isChildMutable });
    return constructor;
  },
  finalizeArgStruct(structure, staticDescriptors) {
    const { flags } = structure;
    staticDescriptors[THROWING] = defineValue(!!(flags & ArgStructFlag.IsThrowing));
  },
});
