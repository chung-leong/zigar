import { adjustRangeError } from '../../error.js';
import { MEMORY, MEMORY_RESTORER } from '../../symbol.js';
import { mixin } from '../class.js';

if (process.env.WASM) {
  mixin({
    getDescriptorUsing(member, getAccessor) {
      const { littleEndian } = this;
      const { bitOffset, byteSize } = member;
      const getter = getAccessor('get', member);
      const setter = getAccessor('set', member);
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
  });
} else {
  mixin({
    getDescriptorUsing(member, getAccessor) {
      const { littleEndian } = this;
      const { bitOffset, byteSize } = member;
      const getter = getAccessor('get', member);
      const setter = getAccessor('set', member);
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
  });
}

export function isRequiredByMember(member) {
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
