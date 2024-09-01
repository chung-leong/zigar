import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';
import { MemberType } from '../../src/members/all.js';

import Float128, {
  isNeededByMember
} from '../../src/accessors/float128.js';

const Env = defineClass('AccessorTest', [ Float128 ]);

describe('Accessor: float128', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const members = [
        { type: MemberType.Float, bitSize: 128, byteSize: 16, bitOffset: 0 },
        { type: MemberType.Float, bitSize: 128, bitOffset: 2 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.true;
      }
    })
    it('should return false when mixin is not needed by a member', function() {
      const members = [
        { type: MemberType.Object, slot: 1 },
        { type: MemberType.Float, bitSize: 32, byteSize: 4, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 7, bitOffset: 1 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.false;
      }
    })
  })
  describe('getAccessorFloat128', function() {
    it('should return methods for accessing 128-bit floats', function() {
      const env = new Env();
      const members = [
        { type: MemberType.Float, bitSize: 128, byteSize: 16, bitOffset: 0 },
      ];
      const dv = new DataView(new ArrayBuffer(1 + 16))
      const get = env.getAccessorFloat128('get', members[0]);
      expect(get.call(dv, 1)).to.equal(0);
      const set = env.getAccessorFloat128('set', members[0]);
      set.call(dv, 1, Math.PI);
      expect(get.call(dv, 1)).to.equal(Math.PI);
    })
  })
})