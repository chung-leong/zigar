import { ArgumentCountMismatch, InvalidVariadicArgument, adjustArgumentError } from './error.js';
import { getDescriptor } from './member.js';
import { getMemoryCopier } from './memory.js';
import { defineProperties } from './object.js';
import { always } from './pointer.js';
import { getChildVivificator } from './struct.js';
import {
  ALIGN, ATTRIBUTES, COPIER, MEMORY, MEMORY_RESTORER, POINTER_VISITOR, PRIMITIVE, SIZE, SLOTS,
  VIVIFICATOR,
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
  const argKeys = argMembers.map(m => m.name);
  const maxSlot = members.map(m => m.slot).sort().pop();
  const argCount = argKeys.length;
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
      if (!dv) {
        const err = new InvalidVariadicArgument();
        throw adjustArgumentError(name, index - offset, argCount - offset, err);
      }
      const argAlign = arg.constructor[ALIGN];
      const offset = offsets[index] = (totalByteSize + argAlign - 1) & ~(argAlign - 1);
      totalByteSize = offset + dv.byteLength;
      if (argAlign > maxAlign) {
        maxAlign = argAlign;
      }
    }
    const dv = env.allocateMemory(totalByteSize, maxAlign);
    this[MEMORY] = dv;
    this[SLOTS] = {};
    for (const [ index, key ] of argKeys.entries()) {
      try {
        this[key] = args[index];
      } catch (err) {
        throw adjustArgumentError(name, index - offset, argCount - offset, err);
      }
    }
    const { littleEndian } = env;
    const attrDV = env.allocateMemory(args.length * 4, 4);
    let attrOffset = 0;
    for (const { bitOffset, byteSize, type } of argMembers) {
      attrDV.setUint16(attrOffset, bitOffset / 8, littleEndian);
      attrDV.setUint8(attrOffset + 2, Math.min(255, byteSize));
      attrDV.setUint8(attrOffset + 3, type == MemberType.Float);
      attrOffset += 4;
    }
    for (const [ index, arg ] of varArgs.entries()) {
      const { byteLength } = arg[MEMORY];
      const offset = offsets[index];
      const childDV = env.obtainView(dv.buffer, offset, byteLength);
      const child = arg.constructor.call(null, childDV);
      const slot = maxSlot + index + 1;
      child.$ = arg;
      this[SLOTS][slot] = child;
      attrDV.setUint16(attrOffset, offset, littleEndian);
      attrDV.setUint8(attrOffset + 2, Math.min(255, byteLength));
      attrDV.setUint8(attrOffset + 3, arg.constructor[PRIMITIVE] == MemberType.Float);
      attrOffset += 4;
    }
    this[ATTRIBUTES] = attrDV;
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
  defineProperties(constructor.prototype, {
    ...memberDescriptors,
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure, env) },
    [POINTER_VISITOR]: { value: visitPointers },
    /* WASM-ONLY */
    [MEMORY_RESTORER]: { value: function() {} },
    /* WASM-ONLY-END */
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  return constructor;
}
