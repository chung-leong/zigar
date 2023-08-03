import { MemberType, getAccessors } from './member.js';
import { createChildObjects } from './struct.js';
import { throwArgumentCountMismatch, rethrowArgumentError } from './error.js';
import { MEMORY } from './symbol.js';

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
  const constructor = s.constructor = function(args) {
    const dv = new DataView(new ArrayBuffer(size));
    Object.defineProperties(this, {
      [MEMORY]: { value: dv },
    });
    if (objectMembers.length > 0) {
      createChildObjects.call(this, objectMembers, this, dv);
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
