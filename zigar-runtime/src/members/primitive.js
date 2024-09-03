import { mixin } from '../environment.js';
import { adjustRangeError } from '../errors.js';
import { MEMORY, RESTORE } from '../symbols.js';

export default mixin({
  defineMemberBool(member) {
    return this.defineMemberUsing(member, this.getAccessor);
  },
  defineMemberFloat(member) {
    return this.defineMemberUsing(member, this.getAccessor);
  },
  defineMemberInt(member) {
    let getAccessor = this.getAccessor;
    if (this.runtimeSafety) {
      getAccessor = this.addRuntimeCheck(env, getAccessor);
    }
    return this.defineMemberUsing(member, getAccessor);
  },
  defineMemberUint(member) {
    return this.defineMemberInt(member);
  },
  ...(process.env.TARGET === 'wasm' ? {
    defineMemberUsing(member, getAccessor) {
      const { littleEndian } = this;
      const { bitOffset, byteSize } = member;
      const getter = getAccessor.call(this, 'get', member);
      const setter = getAccessor.call(this, 'set', member);
      /* c8 ignore start */
      if (process.env.DEV) {
        if (!getter || !setter) {
          return;
        }
      }
      /* c8 ignore end */
      if (bitOffset !== undefined) {
        const offset = bitOffset >> 3;
        return {
          get: function getValue() {
            try {
              return getter.call(this[MEMORY], offset, littleEndian);
            } catch (err) {
              if (err instanceof TypeError && this[RESTORE]()) {
                return getter.call(this[MEMORY], offset, littleEndian);
              } else {
                throw err;
              }
            }
          },
          set: function setValue(value) {
            try {
              return setter.call(this[MEMORY], offset, value, littleEndian);
            } catch (err) {
              if (err instanceof TypeError && this[RESTORE]()) {
                return setter.call(this[MEMORY], offset, value, littleEndian);
              } else {
                throw err;
              }
            }
          }
        }
      } else {
        return {
          get: function getElement(index) {
            try {
              return getter.call(this[MEMORY], index * byteSize, littleEndian);
            } catch (err) {
              if (err instanceof TypeError && this[RESTORE]()) {
                return getter.call(this[MEMORY], index * byteSize, littleEndian);
              } else {
                throw adjustRangeError(member, index, err);
              }
            }
          },
          set: function setElement(index, value) {
            try {
              return setter.call(this[MEMORY], index * byteSize, value, littleEndian);
            } catch (err) {
              if (err instanceof TypeError && this[RESTORE]()) {
                return setter.call(this[MEMORY], index * byteSize, value, littleEndian);
              } else {
                throw adjustRangeError(member, index, err);
              }
            }
          },
        }
      }
    },
  } : {
    defineMemberUsing(member, getAccessor) {
      const { littleEndian } = this;
      const { bitOffset, byteSize } = member;
      const getter = getAccessor.call(this, 'get', member);
      const setter = getAccessor.call(this, 'set', member);
      /* c8 ignore start */
      if (process.env.DEV) {
        if (!getter || !setter) {
          return;
        }
      }
      /* c8 ignore end */
      if (bitOffset !== undefined) {
        const offset = bitOffset >> 3;
        return {
          get: function getValue() {
            return getter.call(this[MEMORY], offset, littleEndian);
          },
          set: function setValue(value) {
            return setter.call(this[MEMORY], offset, value, littleEndian);
          }
        }
      } else {
        return {
          get: function getElement(index) {
            try {
              return getter.call(this[MEMORY], index * byteSize, littleEndian);
            } catch (err) {
              throw adjustRangeError(member, index, err);
            }
          },
          set: function setElement(index, value) {
            return setter.call(this[MEMORY], index * byteSize, value, littleEndian);
          },
        }
      }
    },
  }),
});

export function isNeededByMember(member) {
  switch (member.type) {
    case MemberType.Bool:
    case MemberType.Int:
    case MemberType.Uint:
    case MemberType.Float:
      return true;
    default:
      return false;
  }
}
