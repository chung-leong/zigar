import { expect } from 'chai';
import { defineEnvironment, reset } from '../../../src/environment/class.js';
import { MemberType } from '../../../src/environment/members/all.js';

import '../../../src/environment/accessors/all.js?dep=big-int';
import {
  isNeededByMember
} from '../../../src/environment/accessors/big-int.js';

const Env = defineEnvironment();
reset();

describe('Accessor: big-int', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const members = [
        { type: MemberType.Int, bitSize: 37, byteSize: 8, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 45, byteSize: 8, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 33, bitOffset: 8 },
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
        { type: MemberType.Int, bitSize: 128, byteSize: 16, bitOffset: 0 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.false;
      }
    })
  })
  describe('getAccessorBigInt', function() {
    it('should return methods for accessing non-standard big-ints', function() {
      const env = new Env();
      const members = [
        { type: MemberType.Int, bitSize: 48, byteSize: 8, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 63, byteSize: 8, bitOffset: 0 },
      ];
      const dv1 = new DataView(new ArrayBuffer(8 + 8))
      const get1 = env.getAccessorBigInt('get', members[0]);
      dv1.setBigUint64(8, 0x0000_ffff_ffff_fffen, true);
      expect(get1.call(dv1, 8, true)).to.equal(-2n);
      const dv2 = new DataView(new ArrayBuffer(8 + 8))
      const get2 = env.getAccessorBigInt('get', members[1]);
      dv2.setBigUint64(8, 0x7fff_ffff_ffff_ffffn, false);
      expect(get2.call(dv2, 8, false)).to.equal(-1n);
    })
  })
})