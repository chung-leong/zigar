import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';

import All from '../../src/accessors/all.js';
import BigUint, {
  isNeededByMember
} from '../../src/accessors/big-uint.js';

const Env = defineClass('AccessorTest', [ All, BigUint ]);

describe('Accessor: big-uint', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const members = [
        { type: MemberType.Uint, bitSize: 37, byteSize: 8, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 45, byteSize: 8, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 33, bitOffset: 8 },
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
        { type: MemberType.Uint, bitSize: 128, byteSize: 16, bitOffset: 0 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.false;
      }
    })
  })
  describe('getAccessorBigUint', function() {
    it('should return methods for accessing non-standard big-uints', function() {
      const env = new Env();
      const members = [
        { type: MemberType.Uint, bitSize: 48, byteSize: 8, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 63, byteSize: 8, bitOffset: 0 },
      ];
      const dv1 = new DataView(new ArrayBuffer(8 + 8))
      const get1 = env.getAccessorBigUint('get', members[0]);
      dv1.setBigUint64(8, 0x0000_ffff_ffff_fffen, true);
      expect(get1.call(dv1, 8, true)).to.equal(0x0000_ffff_ffff_fffen);
      const dv2 = new DataView(new ArrayBuffer(8 + 8))
      const get2 = env.getAccessorBigUint('get', members[1]);
      dv2.setBigUint64(8, 0x7fff_ffff_ffff_ffffn, false);
      expect(get2.call(dv2, 8, false)).to.equal(0x7fff_ffff_ffff_ffffn);
    })
  })
})