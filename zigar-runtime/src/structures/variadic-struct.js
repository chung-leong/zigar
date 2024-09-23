import { ArgStructFlag, MemberType, StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { ArgumentCountMismatch, InvalidVariadicArgument, UndefinedArgument, adjustArgumentError } from '../errors.js';
import {
  ALIGN, ATTRIBUTES, BIT_SIZE, COPY, MEMORY, PARENT, PRIMITIVE, RESTORE, SLOTS, THROWING, VISIT, VIVIFICATE
} from '../symbols.js';
import { always, defineProperties, defineValue } from '../utils.js';

export default mixin({
  defineVariadicStruct(structure, descriptors) {
    const {
      byteSize,
      align,
      flags,
      instance: { members },
    } = structure;
    const argMembers = members.slice(1);
    const argCount = argMembers.length;
    const maxSlot = members.map(m => m.slot).sort().pop();
    const thisEnv = this;
    const constructor = function(args, name, offset) {
      if (args.length < argCount) {
        throw new ArgumentCountMismatch(name, `at least ${argCount - offset}`, args.length - offset);
      }
      // calculate the actual size of the struct based on arguments given
      let totalByteSize = byteSize;
      let maxAlign = align;
      const varArgs = args.slice(argCount);
      const offsets = {};
      for (const [ index, arg ] of varArgs.entries()) {
        const dv = arg[MEMORY]
        let argAlign = arg.constructor[ALIGN];
        if (!dv || !argAlign) {
          const err = new InvalidVariadicArgument();
          throw adjustArgumentError(name, argCount + index - offset, args.length - offset, err);
        }
        if (process.env.TARGET === 'wasm') {
          // the arg struct is passed to the function in WebAssembly and fields are
          // expected to aligned to at least 4
          argAlign = Math.max(4, argAlign);
        }
        if (argAlign > maxAlign) {
          maxAlign = argAlign;
        }
        // can't use alignForward here, since that uses bigint when platform is 64-bit
        const byteOffset = offsets[index] = (totalByteSize + (argAlign - 1)) & ~(argAlign - 1);
        totalByteSize = byteOffset + dv.byteLength;
      }
      const attrs = new ArgAttributes(args.length);
      const dv = thisEnv.allocateMemory(totalByteSize, maxAlign);
      // attach the alignment so we can correctly shadow the struct
      dv[ALIGN] = maxAlign;
      this[MEMORY] = dv;
      this[SLOTS] = {};
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
      // set attributes of retval and fixed args
      for (const [ index, { bitOffset, bitSize, type, structure: { align } } ] of argMembers.entries()) {
        attrs.set(index, bitOffset / 8, bitSize, align, type);
      }
      // create additional child objects and copy arguments into them
      for (const [ index, arg ] of varArgs.entries()) {
        const slot = maxSlot + index + 1;
        const { byteLength } = arg[MEMORY];
        const offset = offsets[index];
        const childDV = thisEnv.obtainView(dv.buffer, offset, byteLength);
        const child = this[SLOTS][slot] = arg.constructor.call(PARENT, childDV);
        const bitSize = arg.constructor[BIT_SIZE] ?? byteLength * 8;
        const align = arg.constructor[ALIGN];
        const type = arg.constructor[PRIMITIVE];
        child.$ = arg;
        // set attributes
        attrs.set(argCount + index, offset, bitSize, align, type);
      }
      this[ATTRIBUTES] = attrs;
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
    : function() { return false };
    const ArgAttributes = function(length) {
      this[MEMORY] = thisEnv.allocateMemory(length * 8, 4);
      this.length = length;
      this.littleEndian = thisEnv.littleEndian;
    }
    const setAttributes = function(index, offset, bitSize, align, type) {
      const dv = this[MEMORY];
      const le = thisEnv.littleEndian;
      dv.setUint16(index * 8, offset, le);
      dv.setUint16(index * 8 + 2, bitSize, le);
      dv.setUint16(index * 8 + 4, align, le);
      dv.setUint8(index * 8 + 6, type == MemberType.Float);
      dv.setUint8(index * 8 + 7, type == MemberType.Int || type == MemberType.Float);
    };
    defineProperties(ArgAttributes, {
      [ALIGN]: { value: 4 },
    });
    defineProperties(ArgAttributes.prototype, {
      set: defineValue(setAttributes),
      [COPY]: this.defineCopier(4, true),
      ...(process.env.TARGET === 'wasm' ? {
        [RESTORE]: this.defineRestorer(),
      } : undefined),
    });
    descriptors[COPY] = this.defineCopier(undefined, true);
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = {
      value(cb, options = {}) {
        const {
          vivificate = false,
          isActive = always,
          isMutable = always,
        } = options;
        const childOptions = {
          ...options,
          isActive,
          isMutable: (object) => isMutable(this) && isChildMutable.call(this, object),
        };
        if (vivificate && retvalType === MemberType.Object) {
          this[VIVIFICATE](retvalSlot);
        }
        for (const child of Object.values(this[SLOTS])) {
          child?.[VISIT]?.(cb, childOptions);
        }
      },
    };
    return constructor;
  },
  finalizeVariadicStruct(structure, staticDescriptors) {
    const { flags } = structure;
    staticDescriptors[THROWING] = defineValue(!!(flags & ArgStructFlag.IsThrowing));
  },
});
