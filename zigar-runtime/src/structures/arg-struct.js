import { ArgStructFlag, MemberType, StructFlag, StructureFlag, StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { ArgumentCountMismatch, UndefinedArgument, adjustArgumentError } from '../errors.js';
import { CONTEXT, MEMORY, SLOTS, THROWING, VISIT, VIVIFICATE } from '../symbols.js';
import { defineValue, never } from '../utils.js';

export default mixin({
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
        self[CONTEXT] = new CallContext();
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
    return constructor;
  },
  finalizeArgStruct(structure, staticDescriptors) {
    const { flags } = structure;
    staticDescriptors[THROWING] = defineValue(!!(flags & ArgStructFlag.IsThrowing));
  },
  copyArguments(dest, src, members, options) {
    let srcIndex = 0;
    let allocatorCount = 0;
    for (const [ destIndex, { type, structure } ] of members.entries()) {
      let arg;
      if (structure.type === StructureType.Struct) {
        if (structure.flags & StructFlag.IsAllocator) {
          // use programmer-supplied allocator if found in options object, handling rare scenarios
          // where a function uses multiple allocators
          allocatorCount++;
          const allocator = (allocatorCount === 1)
          ? options?.['allocator'] ?? options?.['allocator1']
          : options?.[`allocator${allocatorCount}`];
          // otherwise use default allocator which allocates relocatable memory from JS engine
          arg = allocator ?? this.createDefaultAllocator(structure, dest[CONTEXT]);
        } else if (structure.flags & StructFlag.IsPromise) {
          // use programmer-supplied callback if found, otherwise a function that resolves/rejects
          // a promise attached to the argument struct
          arg = options?.['callback'] ?? this.createPromise(dest);
        } else if (structure.flags & StructFlag.IsAbortSignal) {
          // create an Int32Array with one element, hooking it up to the programmer-supplied
          // AbortSignal object if found
          arg = this.createAbortSignal(options?.['signal']);
        }
      }
      if (arg === undefined) {
        // just a regular argument
        arg = src[srcIndex++];
        // only void has the value of undefined
        if (arg === undefined && type !== MemberType.Void) {
          throw new UndefinedArgument();
        }
      }
      try {
        dest[destIndex] = arg;
      } catch (err) {
        throw adjustArgumentError.call(err, destIndex, src.length);
      }
    }
  },
  createPromise(dest) {
    let resolve, reject;
    dest[PROMISE] = new Promise((...args) => {
      resolve = args[0];
      reject = args[1];
    });
    return (value) => {
      if (value instanceof Error) {
        reject(value);
      } else {
        resolve(value);
      }
    };
  },
  createAbortSignal(signal) {
    const array = new Int32Array(1);
    if (signal) {
      if (signal.aborted) {
        array[0] = 1;
      } else {
        signal.addEventListener('abort', () => {
          Atomics.store(array, 0, 1);
        }, { once: true });
      }
    }
    return { ptr: array };
  },
});

export class CallContext {
  memoryList = [];
  shadowMap = null;
};
