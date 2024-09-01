import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';
import { MemberType } from '../../src/members/all.js';

import BoolUnaligned, {
  isNeededByMember
} from '../../src/accessors/bool1-unaligned.js';

const Env = defineClass('AccessorTest', [ BoolUnaligned ]);

describe('Accessor: bool1-unaligned', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const members = [
        { type: MemberType.Bool, bitSize: 1, bitOffset: 0 },
        { type: MemberType.Bool, bitSize: 1, bitOffset: 1 },
        { type: MemberType.Bool, bitSize: 1, bitOffset: 2 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.true;
      }
    })
    it('should return false when mixin is not needed by a member', function() {
      const members = [
        { type: MemberType.Literal, slot: 1 },
        { type: MemberType.Comptime, slot: 1 },
        { type: MemberType.Object, slot: 1 },
        { type: MemberType.Bool, bitSize: 1, byteSize: 1, bitOffset: 0 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.false;
      }
    })
  })
  describe('getAccessorBool1Unaligned', function() {
    it('should return methods for accessing bool in packed struct', function() {
      const members = [
        { type: MemberType.Bool, bitSize: 1, bitOffset: 0 },
        { type: MemberType.Bool, bitSize: 1, bitOffset: 1 },
        { type: MemberType.Bool, bitSize: 1, bitOffset: 2 },
      ];
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(1 + 1))
      const get1 = env.getAccessorBool1Unaligned('get', members[0]);
      expect(get1.call(dv, 1)).to.be.false;
      dv.setUint8(1, 3);
      expect(get1.call(dv, 1)).to.be.true;
      const set1 = env.getAccessorBool1Unaligned('set', members[0]);
      set1.call(dv, 1, false);
      expect(dv.getUint8(1)).to.equal(2);
      const get2 = env.getAccessorBool1Unaligned('get', members[1]);
      expect(get2.call(dv, 1)).to.be.true;
      dv.setUint8(1, 4);
      expect(get2.call(dv, 1)).to.be.false;
      const set2 = env.getAccessorBool1Unaligned('set', members[1]);
      set2.call(dv, 1, true);
      set1.call(dv, 1, true);
      expect(dv.getUint8(1)).to.equal(7);
      const get3 = env.getAccessorBool1Unaligned('get', members[2]);
      expect(get3.call(dv, 1)).to.be.true;
    })
  })
})