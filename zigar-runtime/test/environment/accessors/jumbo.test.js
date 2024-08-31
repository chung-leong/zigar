import { expect } from 'chai';
import { defineClass } from '../../../src/environment/class.js';
import { MemberType } from '../../../src/environment/members/all.js';

import All from '../../../src/environment/accessors/all.js';
import Jumbo, {
  isNeededByMember
} from '../../../src/environment/accessors/jumbo.js';

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
      const members = [
        { type: MemberType.Int, bitSize: 72, byteSize: 16, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 128, byteSize: 16, bitOffset: 0 },
      ];
      const dv1 = new DataView(new ArrayBuffer(16))
      const set1 = env.getAccessorJumboInt('set', members[0]);
      const get1 = env.getAccessorJumboInt('get', members[0]);
      set1.call(dv1, 0, 2 ** 72 - 1, true);
      expect(get1.call(dv1, 0, true)).to.equal(2 ** 72 - 1);
      const dv2 = new DataView(new ArrayBuffer(16))
      const set2 = env.getAccessorJumboInt('set', members[1]);
      const get2 = env.getAccessorJumboInt('get', members[1]);
      set2.call(dv2, 0, 2 ** 128 - 1, true);
      expect(get2.call(dv2, 0, true)).to.equal(2 ** 128 - 1);
    })
  })
})