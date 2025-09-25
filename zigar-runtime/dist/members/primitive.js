import { mixin } from '../environment.js';
import '../errors.js';
import { RESTORE } from '../symbols.js';

var primitive = mixin({
  ...({
    defineMemberUsing(member, getAccessor) {
      const { littleEndian } = this;
      const { bitOffset, byteSize } = member;
      const getter = getAccessor.call(this, 'get', member);
      const setter = getAccessor.call(this, 'set', member);
      if (bitOffset !== undefined) {
        const offset = bitOffset >> 3;
        return {
          get: function getValue() {
            const dv = this[RESTORE]() ;
            return getter.call(dv, offset, littleEndian);
          },
          set: function setValue(value) {
            const dv = this[RESTORE]() ;
            return setter.call(dv, offset, value, littleEndian);
          }
        }
      } else {
        return {
          get: function getElement(index) {
            const dv = this[RESTORE]() ;
            return getter.call(dv, index * byteSize, littleEndian);
          },
          set: function setElement(index, value) {
            const dv = this[RESTORE]() ;
            return setter.call(dv, index * byteSize, value, littleEndian);
          },
        }
      }
    },
  } ),
});

export { primitive as default };
