import { ArgumentCountMismatch, adjustArgumentError } from './error.js';
import { getDescriptor } from './member.js';
import { getMemoryCopier } from './memory.js';
import { defineProperties } from './object.js';
import { getChildVivificator, getPointerVisitor } from './struct.js';
import { ALIGN, COPIER, MEMORY, POINTER_VISITOR, SIZE, SLOTS, VIVIFICATOR } from './symbol.js';
import { MemberType } from './types.js';

export function defineArgStruct(structure, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = structure;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const argKeys = members.slice(0, -1).map(m => m.name);
  const argCount = argKeys.length;
  const constructor = structure.constructor = function(args, name, offset) {
    const dv = env.allocateMemory(byteSize, align);
    this[MEMORY] = dv;
    if (hasObject) {
      this[SLOTS] = {};
    }
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
  };
  const memberDescriptors = {};
  for (const member of members) {
    memberDescriptors[member.name] = getDescriptor(member, env);
  }
  const isChildMutable = function(object) {
      return (object === this.retval);
  };
  defineProperties(constructor.prototype, {
    ...memberDescriptors,
    [COPIER]: { value: getMemoryCopier(byteSize) },
    [VIVIFICATOR]: hasObject && { value: getChildVivificator(structure, env) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(structure, { isChildMutable }) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  return constructor;
}
