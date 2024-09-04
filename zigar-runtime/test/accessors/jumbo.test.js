import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';

import All from '../../src/accessors/all.js';
import Jumbo, {
  isNeededByMember
} from '../../src/accessors/jumbo.js';

const Env = defineClass('AccessorTest', [ All, Jumbo ]);

describe('Accessor: jumbo', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const members = [
        { type: MemberType.Int, bitSize: 77, byteSize: 16, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 65, byteSize: 16, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 128, bitOffset: 8 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.true;
      }
    })
    it('should return false when mixin is not needed by a member', function() {
      const members = [
        { type: MemberType.Object, slot: 1 },
        { type: MemberType.Int, bitSize: 64, byteSize: 8, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 31, byteSize: 4, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 45, byteSize: 8, bitOffset: 0 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.false;
      }
    })
  })
  describe('getJumboAccessor', function() {
    it('should return methods for serializing/deserializing extra large big-ints', function() {
      const env = new Env();
      const dv1 = new DataView(new ArrayBuffer(16))
      const set1 = env.getJumboAccessor('set', 72);
      const get1 = env.getJumboAccessor('get', 72);
      set1.call(dv1, 0, 2n ** 72n - 1n, true);
      expect(get1.call(dv1, 0, true)).to.equal(2n ** 72n - 1n);
      const dv2 = new DataView(new ArrayBuffer(16))
      const set2 = env.getJumboAccessor('set', 128);
      const get2 = env.getJumboAccessor('get', 128);
      set2.call(dv2, 0, 2n ** 128n - 1n, true);
      expect(get2.call(dv2, 0, true)).to.equal(2n ** 128n - 1n);
    })
  })
})