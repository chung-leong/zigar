import { MemberType, getAccessors } from './member.js';
import { SLOTS } from './symbol.js';

export function addStaticMembers(s) {
  const {
    constructor,
    static: {
      members,
      template,
    },
    options,
  } = s;
  const descriptors = {};
  if (template) {
    descriptors[SLOTS] = { value: template[SLOTS] };
  }
  for (const member of members) {
    // static members are either Pointer or Type
    let { get, set } = getAccessors(member, options);
    if (member.type === MemberType.Object) {
      const getPtr = get;
      get = function() {
        // dereference pointer
        const ptr = getPtr.call(this);
        return ptr['*'];
      };
      set = (member.isConst) ? undefined : function(value) {
        const ptr = getPtr.call(this);
        ptr['*'] = value;
      };
    }
    descriptors[member.name] = { get, set, configurable: true, enumerable: true };
  };
  Object.defineProperties(constructor, descriptors);
}
