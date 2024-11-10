import { MemberType } from '../constants.js';
import { mixin } from '../environment.js';

// handles bools, including implicit ones in optional pointers, where an address
// of zero would be treated as boolean false

var bool = mixin({
  getAccessorBool(access, member) {
    const { byteSize } = member;
    const bitSize = byteSize * 8;
    const f = this.getAccessor(access, { type: MemberType.Uint, bitSize, byteSize });
    if (access === 'get') {
      return function(offset, littleEndian) {
        return !!f.call(this, offset, littleEndian);
      }
    } else {
      const zero = (bitSize <= 32) ? 0 : 0n;
      const one = (bitSize <= 32) ? 1 : 1n;
      return function(offset, value, littleEndian) {
        f.call(this, offset, value ? one : zero, littleEndian);
      }
    }
  }
});

export { bool as default };
