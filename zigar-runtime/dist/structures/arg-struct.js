import { MemberType, StructureFlag, ArgStructFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { ArgumentCountMismatch } from '../errors.js';
import { VIVIFICATE, VISIT, THROWING, MEMORY, SLOTS, CONTEXT, FINALIZE } from '../symbols.js';
import { never, defineValue, CallContext } from '../utils.js';

var argStruct = mixin({
  defineArgStruct(structure, descriptors) {
    const {
      flags,
      byteSize,
      align,
      length,
      instance: { members },
    } = structure;
    const thisEnv = this;
    const argMembers = members.slice(1);
    const constructor = function(args) {
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
        let options;
        if (flags & ArgStructFlag.HasOptions) {
          if (args.length === length + 1) {
            options = args.pop();
          }
        }
        // length holds the minimum number of arguments
        if (args.length !== length) {
          throw new ArgumentCountMismatch(length, args.length);
        }
        this[CONTEXT] = new CallContext();
        if (flags & ArgStructFlag.IsAsync) {
          self[FINALIZE] = null;
        }
        thisEnv.copyArguments(self, args, argMembers, options);
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
    descriptors.length = defineValue(argMembers.length);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorStruct(structure, { isChildMutable });
    descriptors[Symbol.iterator] = this.defineArgIterator?.(argMembers);
    return constructor;
  },
  finalizeArgStruct(structure, staticDescriptors) {
    const { flags } = structure;
    staticDescriptors[THROWING] = defineValue(!!(flags & ArgStructFlag.IsThrowing));
  },
});

export { argStruct as default };
