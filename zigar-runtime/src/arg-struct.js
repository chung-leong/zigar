import { MemberType, getAccessors } from './member.js';
import { throwArgumentCountMismatch, rethrowArgumentError } from './error.js';
import { MEMORY, SLOTS } from './symbol.js';
import { addChildVivificators } from './struct.js';

export function finalizeArgStruct(s) {
  const {
    byteSize,
    instance: {
      members,
    },
    options,
  } = s;
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(args) {
    const dv = new DataView(new ArrayBuffer(byteSize));
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
  for (const member of members) {
    const accessors = getAccessors(member, options);
    Object.defineProperty(constructor.prototype, member.name, accessors);
  }
  if (hasObject) {
    addChildVivificators(s);
  }
  return constructor;
}
