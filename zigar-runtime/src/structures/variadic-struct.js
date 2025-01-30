import { ArgStructFlag, MemberType, StructureFlag } from '../constants.js';
import { mixin } from '../environment.js';
import { adjustArgumentError, ArgumentCountMismatch, InvalidVariadicArgument } from '../errors.js';
import {
  ALIGN, ATTRIBUTES, BIT_SIZE, COPY, MEMORY, PARENT, PRIMITIVE, RETURN, SLOTS, THROWING, VISIT,
  VIVIFICATE,
} from '../symbols.js';
import { defineProperties, defineValue } from '../utils.js';

export default mixin({
  defineVariadicStruct(structure, descriptors) {
    const {
      byteSize,
      align,
      flags,
      length,
      instance: { members },
    } = structure;
    const thisEnv = this;
    const argMembers = members.slice(1);
    const constructor = function(args) {
      if (args.length < length) {
        throw new ArgumentCountMismatch(length, args.length, true);
      }
      // calculate the actual size of the struct based on arguments given
      let totalByteSize = byteSize;
      let maxAlign = align;
      const varArgs = args.slice(length);
      const offsets = {};
      for (const [ index, arg ] of varArgs.entries()) {
        const dv = arg?.[MEMORY]
        const argAlign = (process.env.TARGET === 'wasm')
        // the arg struct is passed to the function in WebAssembly and fields are
        // expected to aligned to at least 4
        ? Math.max(4, arg?.constructor?.[ALIGN])
        : arg?.constructor?.[ALIGN];
        if (!dv || !argAlign) {
          const err = new InvalidVariadicArgument();
          throw adjustArgumentError(err, length + index);
        }
        if (argAlign > maxAlign) {
          maxAlign = argAlign;
        }
        // can't use alignForward() here, since that uses bigint when platform is 64-bit
        const byteOffset = offsets[index] = (totalByteSize + (argAlign - 1)) & ~(argAlign - 1);
        totalByteSize = byteOffset + dv.byteLength;
      }
      const attrs = new ArgAttributes(args.length);
      const dv = thisEnv.allocateMemory(totalByteSize, maxAlign);
      // attach the alignment so we can correctly shadow the struct
      dv[ALIGN] = maxAlign;
      this[MEMORY] = dv;
      this[SLOTS] = {};
      // copy fixed args
      thisEnv.copyArguments(this, args, argMembers);
      // set their attributes
      let maxSlot = -1;
      for (const [ index, { bitOffset, bitSize, type, slot, structure: { align } } ] of argMembers.entries()) {
        attrs.set(index, bitOffset / 8, bitSize, align, type);
        if (slot > maxSlot) {
          maxSlot = slot;
        }
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
        attrs.set(length + index, offset, bitSize, align, type);
      }
      this[ATTRIBUTES] = attrs;
    };
    for (const member of members) {
      descriptors[member.name] = this.defineMember(member);
    }
    const retvalSetter = descriptors.retval.set;
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
    });
    descriptors[VIVIFICATE] = (flags & StructureFlag.HasObject) && this.defineVivificatorStruct(structure);
    descriptors[VISIT] = this.defineVisitorVariadicStruct(members);
    descriptors[RETURN] = defineValue(function(value) {
      retvalSetter.call(this, value, this[ALLOCATOR]);
    });
    if (process.env.TARGET === 'wasm') {
      descriptors[COPY] = this.defineRetvalCopier(members[0]);
    }
    return constructor;
  },
  finalizeVariadicStruct(structure, staticDescriptors) {
    const { flags } = structure;
    staticDescriptors[THROWING] = defineValue(!!(flags & ArgStructFlag.IsThrowing));
    // variadic struct doesn't have a known alignment--we attach the necessary alignment to the
    // data view instead (see above)
    staticDescriptors[ALIGN] = defineValue(undefined);
  },
});
