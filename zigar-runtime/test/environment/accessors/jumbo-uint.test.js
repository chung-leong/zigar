import { expect } from 'chai';
import { defineClass } from '../../../src/environment/class.js';
import { MemberType } from '../../../src/environment/members/all.js';

import All from '../../../src/environment/accessors/all.js';
import JumboUint, {
  isNeededByMember
} from '../../../src/environment/accessors/jumbo-uint.js';
import Jumbo from '../../../src/environment/accessors/jumbo.js';

const Env = defineClass('AccessorTest', [ All, Jumbo, JumboUint ]);

describe('Accessor: jumbo-uint', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const members = [
        { type: MemberType.Uint, bitSize: 77, byteSize: 16, bitOffset: 0 },
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
        { type: MemberType.Uint, bitSize: 64, byteSize: 8, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 31, byteSize: 4, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 45, byteSize: 8, bitOffset: 0 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.false;
      }
    })
  })
  describe('getAccessorJumboUint', function() {
    it('should return methods for accessing extra-large big-uints', function() {
      const env = new Env();
      const members = [
        { type: MemberType.Uint, bitSize: 72, byteSize: 16, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 128, byteSize: 16, bitOffset: 0 },
      ];
      const dv1 = new DataView(new ArrayBuffer(16))
      const set1 = env.getAccessorJumboUint('set', members[0]);
      const get1 = env.getAccessorJumboUint('get', members[0]);
      set1.call(dv1, 0, 2n * 71n - 1n, true);
      expect(get1.call(dv1, 0, true)).to.equal(2n * 71n - 1n);
      const dv2 = new DataView(new ArrayBuffer(16))
      const set2 = env.getAccessorJumboUint('set', members[1]);
      const get2 = env.getAccessorJumboUint('get', members[1]);
      set2.call(dv2, 0, 2n * 127n - 1n, true);
      expect(get2.call(dv2, 0, true)).to.equal(2n * 127n - 1n);
    })
  })
})