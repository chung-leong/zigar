import { mixin } from '../environment.js';
import { replaceRangeError } from '../errors.js';
import { MEMORY, RESTORE } from '../symbols.js';

export default mixin({
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
            const dv = (process.env.TARGET === 'wasm') ? this[RESTORE]() : this[MEMORY];
            return getter.call(dv, offset, littleEndian);
          },
          set: function setValue(value) {
            const dv = (process.env.TARGET === 'wasm') ? this[RESTORE]() : this[MEMORY];
            return setter.call(dv, offset, value, littleEndian);
          }
        }
      } else {
        return {
          get: function getElement(index) {
            const dv = (process.env.TARGET === 'wasm') ? this[RESTORE]() : this[MEMORY];
            return getter.call(dv, index * byteSize, littleEndian);
          },
          set: function setElement(index, value) {
            const dv = (process.env.TARGET === 'wasm') ? this[RESTORE]() : this[MEMORY];
            return setter.call(dv, index * byteSize, value, littleEndian);
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
              throw replaceRangeError(member, index, err);
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
