import { memberNames, structureNames } from '../constants.js';
import { mixin } from '../environment.js';

export default mixin({
  defineMember(member, applyTransform = true) {
    if (!member) {
      return {};
    }
    const { type, structure } = member;
    const handleName = `defineMember${memberNames[type]}`;
    const f = this[handleName];
    /* c8 ignore start */
    if (process.env.DEV) {
      if (!f) {
        throw new Error(`Missing method: ${handleName}`);
      }
    }
    /* c8 ignore end */
    const descriptor = f.call(this, member);
    if (applyTransform) {
      // we use int/uint getters to access underlying values of enums and error sets;
      // the transform functions put wrapper functions around the accessors that
      // perform item lookup
      const { type } = structure;
      const handleName = `transformDescriptor${structureNames[type]}`;
      const f = this[handleName];
      if (f) {
        return f.call(this, descriptor, member);
      }
    }
    return descriptor;
  },
});

export function bindSlot(slot, { get, set }) {
  if (slot !== undefined) {
    return {
      get: function() {
        return get.call(this, slot);
      },
      set: (set)
      ? function(arg) {
          return set.call(this, slot, arg);
        }
      : undefined,
    };
  } else {
    // array accessors
    return { get, set };
  }
}

