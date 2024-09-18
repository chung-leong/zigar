import { mixin } from '../environment.js';

// handle bools in packed structs

export default mixin({
  getAccessorUnalignedBool1(access, member) {
    const { bitOffset } = member;
    const bitPos = bitOffset & 0x07;
    const mask = 1 << bitPos;
    if (access === 'get') {
      return function(offset) {
        const n = this.getInt8(offset);
        return !!(n & mask);
      };
    } else {
      return function(offset, value) {
        const n = this.getInt8(offset);
        const b = (value) ? n | mask : n & ~mask;
        this.setInt8(offset, b);
      };
    }
  },
});

