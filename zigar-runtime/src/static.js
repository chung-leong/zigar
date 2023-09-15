import { MemberType, getAccessors } from './member.js';
import { CHILD_VIVIFICATOR, SLOTS } from './symbol.js';

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
  const vivificators = {};
  for (const member of members) {
    // static members are either Pointer or Type
    let { get, set } = getAccessors(member, options);
    const { type, slot, structure: { isConst } } = member;
    if (type === MemberType.Object) {
      const getPtr = get;
      get = function() {
        // dereference pointer
        const ptr = getPtr.call(this);
        return ptr['*'];
      };
      set = (isConst) ? undefined : function(value) {
        const ptr = getPtr.call(this);
        ptr['*'] = value;
      };
      vivificators[slot] = () => template[SLOTS][slot];
    }
    Object.defineProperty(constructor, member.name, { get, set, configurable: true, enumerable: true });
  }
  Object.defineProperty(constructor, CHILD_VIVIFICATOR, { value: vivificators });
}
