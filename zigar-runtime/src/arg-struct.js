import { defineProperties } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { throwArgumentCountMismatch, rethrowArgumentError } from './error.js';
import { getChildVivificator, getPointerVisitor } from './struct.js';
import { ALIGN, CHILD_VIVIFICATOR, MEMORY, MEMORY_COPIER, POINTER_VISITOR, SIZE, SLOTS } from './symbol.js';
import { getMemoryCopier } from './memory.js';

export function defineArgStruct(s, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = s;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(args) {
    const dv = env.allocateMemory(byteSize, align);
    this[MEMORY] = dv;
    if (hasObject) {
      this[SLOTS] = {};
    }
    initializer.call(this, args);
  };
  const argNames = members.slice(0, -1).map(m => m.name);
  const argCount = argNames.length;
  const initializer = function(args) {
    if (args.length !== argCount) {
      throwArgumentCountMismatch(s, args.length);
    }
    for (const [ index, name ] of argNames.entries()) {
      try {
        this[name] = args[index];
      } catch (err) {
        rethrowArgumentError(s, index, err);
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
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificator(s) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s, { isChildMutable }) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  return constructor;
}
