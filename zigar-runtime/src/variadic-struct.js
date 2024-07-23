import { ArgumentCountMismatch, InvalidVariadicArgument, adjustArgumentError } from './error.js';
import { getDescriptor } from './member.js';
import { getMemoryCopier } from './memory.js';
import { defineProperties, getMemoryRestorer } from './object.js';
import { always } from './pointer.js';
import { getChildVivificator } from './struct.js';
import {
  ALIGN, ATTRIBUTES, BIT_SIZE, COPIER, MEMORY, MEMORY_RESTORER, PARENT, POINTER_VISITOR, PRIMITIVE, SIZE,
  SLOTS, VIVIFICATOR
} from './symbol.js';
import { MemberType } from './types.js';

export function defineVariadicStruct(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
  } = structure;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const argMembers = members.slice(1);
  const argCount = argMembers.length;
  const argKeys = argMembers.map(m => m.name);
  const maxSlot = members.map(m => m.slot).sort().pop();
  const constructor = structure.constructor = function(args, name, offset) {
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
        throw adjustArgumentError(name, index - offset, argCount - offset, err);
      }
      /* WASM-ONLY */
      // the arg struct is passed to the function in WebAssembly and fields are
      // expected to aligned to at least 4
      argAlign = Math.max(env.wordSize, argAlign);
      /* WASM-ONLY-END */
      if (argAlign > maxAlign) {
        maxAlign = argAlign;
      }
      const offset = offsets[index] = (totalByteSize + argAlign - 1) & ~(argAlign - 1);
      totalByteSize = offset + dv.byteLength;
    }
    const attrs = new ArgAttributes(args.length);
    const dv = env.allocateMemory(totalByteSize, maxAlign);
    // attach the alignment so we can correctly shadow the struct
    dv[ALIGN] = maxAlign;
    this[MEMORY] = dv;
    this[SLOTS] = {};
    for (const [ index, key ] of argKeys.entries()) {
      try {
        this[key] = args[index];
      } catch (err) {
        throw adjustArgumentError(name, index - offset, argCount - offset, err);
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
      const childDV = env.obtainView(dv.buffer, offset, byteLength);
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
  const memberDescriptors = {};
  for (const member of members) {
    memberDescriptors[member.name] = getDescriptor(member, env);
  }
  const { slot: retvalSlot, type: retvalType } = members[0];
  const isChildMutable = (retvalType === MemberType.Object)
  ? function(object) {
      const child = this[VIVIFICATOR](retvalSlot);
      return object === child;
    }
  : function() { return false };
  const visitPointers = function(cb, options = {}) {
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
      this[VIVIFICATOR](retvalSlot);
    }
    for (const child of Object.values(this[SLOTS])) {
      child?.[POINTER_VISITOR]?.(cb, childOptions);
    }
  };
  const ArgAttributes = function(length) {
    this[MEMORY] = env.allocateMemory(length * 8, 4);
    this.length = length;
    this.littleEndian = env.littleEndian;
  }
  const setAttributes = function(index, offset, bitSize, align, type) {
    const dv = this[MEMORY];
    const le = env.littleEndian;
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
    set: { value: setAttributes },
    [COPIER]: { value: getMemoryCopier(4, true) },
    /* WASM-ONLY */
    [MEMORY_RESTORER]: { value: getMemoryRestorer(null, env) },
    /* WASM-ONLY-END */
  });
  defineProperties(constructor.prototype, {
    ...memberDescriptors,
    [COPIER]: { value: getMemoryCopier(undefined, true) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure, env) },
    [POINTER_VISITOR]: { value: visitPointers },
    /* WASM-ONLY */
    [MEMORY_RESTORER]: { value: getMemoryRestorer(null, env) },
    /* WASM-ONLY-END */
  });
  defineProperties(constructor, {
    [SIZE]: { value: byteSize },
    // [ALIGN]: omitted so that Environment.createShadow() would obtain the alignment from the data view
  });
  return constructor;
}
