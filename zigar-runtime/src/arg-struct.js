import { defineProperties } from './structure.js';
import { MemberType, getAccessors } from './member.js';
import { getPointerAlign } from './memory.js';
import { throwArgumentCountMismatch, rethrowArgumentError } from './error.js';
import { getChildVivificators, getPointerVisitor } from './struct.js';
import { CHILD_VIVIFICATOR, MEMORY, POINTER_VISITOR, SLOTS } from './symbol.js';

export function finalizeArgStruct(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members,
    },
    hasPointer,
    options,
  } = s;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const ptrAlign = getPointerAlign(align);
  const constructor = s.constructor = function(args) {
    const dv = env.createBuffer(byteSize, ptrAlign);
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
    memberDescriptors[member.name] = getAccessors(member, options);
  }
  defineProperties(constructor.prototype, {
    ...memberDescriptors,
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificators(s) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s) },
  });
  return constructor;
}
