import { StructureFlag, ArgStructFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { ArgumentCountMismatch } from '../errors.js';
import { VIVIFICATE, VISIT, COPY, MEMORY, ZIG, THROWING, SLOTS, FINALIZE } from '../symbols.js';
import { defineValue } from '../utils.js';

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
    descriptors.length = defineValue(argMembers.length);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = (flags & StructureFlag.HasPointer) && this.defineVisitorArgStruct(members);
    const { byteSize: retvalSize, bitOffset: retvalBitOffset } = members[0];
    descriptors[Symbol.iterator] = this.defineArgIterator?.(argMembers);
    {
      const copy = this.getCopyFunction(retvalSize);
      const retvalOffset = retvalBitOffset >> 3;
      descriptors[COPY] = (retvalSize > 0) ? {
        value(shadowDV) {
          const dv = this[MEMORY];
          const { address } = shadowDV[ZIG];
          const src = new DataView(thisEnv.memory.buffer, address + retvalOffset, retvalSize);
          const dest = new DataView(dv.buffer, dv.byteOffset + retvalOffset, retvalSize);
          copy(dest, src);
        }
      } : null;
    }
    return constructor;
  },
  finalizeArgStruct(structure, staticDescriptors) {
    const { flags } = structure;
    staticDescriptors[THROWING] = defineValue(!!(flags & ArgStructFlag.IsThrowing));
  },
});

export { argStruct as default };
