import { adjustRangeError } from '../../error.js';
import { MEMORY, MEMORY_RESTORER } from '../../symbol.js';
import { mixin } from '../class.js';

export default mixin({
  getDescriptorBool(member) {
    return this.getDescriptorUsing(member, this.getAccessor);
  },
  getDescriptorFloat(member) {
    return this.getDescriptorUsing(member, this.getAccessor);
  },
  getDescriptorInt(member) {
    let getAccessor = this.getAccessor;
    if (this.runtimeSafety) {
      getAccessor = this.addRuntimeCheck(env, getAccessor);
    }
    return this.getDescriptorUsing(member, getAccessor);
  },
  getDescriptorUint(member) {
    return this.getDescriptorInt(member);
  },
  ...(process.env.WASM ? {
    getDescriptorUsing(member, getAccessor) {
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
              if (err instanceof TypeError && this[MEMORY_RESTORER]()) {
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
              if (err instanceof TypeError && this[MEMORY_RESTORER]()) {
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
              if (err instanceof TypeError && this[MEMORY_RESTORER]()) {
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
              if (err instanceof TypeError && this[MEMORY_RESTORER]()) {
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
    getDescriptorUsing(member, getAccessor) {
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
