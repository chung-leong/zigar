import { MemberType, getAccessors } from './member.js';
import { throwArgumentCountMismatch, rethrowArgumentError } from './error.js';
import { MEMORY, ZIG, PARENT, SLOTS } from './symbol.js';

export function finalizeArgStruct(s) {
  const {
    size,
    instance: {
      members,
    },
    options,
  } = s;
  const descriptors = {};
  for (const member of members) {
    descriptors[member.name] = getAccessors(member, options);
  }
  const objectMembers = members.filter(m => m.type === MemberType.Object);
  const { slot: retvalSlot } = members[members.length - 1];
    const constructor = s.constructor = function(args) {
    const dv = new DataView(new ArrayBuffer(size));
    Object.defineProperties(this, {
      [MEMORY]: { value: dv },
    });
    if (objectMembers.length > 0) {
      const slots = {};
      const parentOffset = dv.byteOffset;
      for (const { structure: { constructor }, bitOffset, byteSize, slot } of objectMembers) {
        const offset = parentOffset + (bitOffset >> 3);
        const childDV = new DataView(dv.buffer, offset, byteSize);
        // use ZIG as receiver for retval, so pointers will already be owned by ZIG
        const recv = (slot === retvalSlot) ? ZIG : PARENT;
        slots[slot] = constructor.call(recv, childDV);
      }
      Object.defineProperties(this, {
        [SLOTS]: { value: slots },
      });
    }
    initializer.call(this, args);
  };
  const argNames = members.slice(0, -1).map(m => m.name);
  const argCount = argNames.length;
  const initializer = s.initializer = function(args) {
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

  Object.defineProperties(constructor.prototype, descriptors);
  return constructor;
};
