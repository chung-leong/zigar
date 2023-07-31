import { MemberType, getAccessors } from './member.js';
import { createChildObjects,  } from './struct.js';
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
    const isArgument = member.name !== 'retval';
    descriptors[member.name] = getAccessors(member, { autoDeref: !isArgument, ...options });
  }
  const objectMembers = members.filter(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const dv = new DataView(new ArrayBuffer(size));
    Object.defineProperties(this, {
      [MEMORY]: { value: dv },
    });
    if (objectMembers.length > 0) {
      createChildObjects.call(this, objectMembers, this, dv);
    }
  };
  Object.defineProperties(constructor.prototype, descriptors);
  return constructor;
};

