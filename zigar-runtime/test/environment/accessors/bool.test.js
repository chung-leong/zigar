import { expect } from 'chai';
import { defineEnvironment, reset } from '../../../src/environment/class.js';
import { MemberType } from '../../../src/environment/members/all.js';

import '../../../src/environment/accessors/all.js?dep=bool';
import {
  isNeededByMember
} from '../../../src/environment/accessors/bool.js';

const Env = defineEnvironment();
reset();

describe('Accessor: bool', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const members = [
        { type: MemberType.Bool, bitSize: 1, byteSize: 1, bitOffset: 0 },
        { type: MemberType.Bool, bitSize: 32, byteSize: 4, bitOffset: 0 },
        { type: MemberType.Bool, bitSize: 64, byteSize: 8, bitOffset: 0 },
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
        { type: MemberType.Bool, bitSize: 1, bitOffset: 0 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.false;
      }
    })
  })
  describe('getAccessorBool', function() {
    it('should return methods for accessing bool', function() {
      const members = [
        { type: MemberType.Bool, bitSize: 1, byteSize: 1, bitOffset: 0 },
        { type: MemberType.Bool, bitSize: 32, byteSize: 4, bitOffset: 0 },
        { type: MemberType.Bool, bitSize: 64, byteSize: 8, bitOffset: 0 },
      ];
      const env = new Env();
      const dv1 = new DataView(new ArrayBuffer(1 + 1))
      const get1 = env.getAccessorBool('get', members[0]);
      expect(get1.call(dv1, 1)).to.be.false;
      dv1.setUint8(1, 1);
      expect(get1.call(dv1, 1)).to.be.true;
      const set1 = env.getAccessorBool('set', members[0]);
      set1.call(dv1, 1, false);
      expect(dv1.getUint8(1)).to.equal(0);
      const dv2 = new DataView(new ArrayBuffer(4 + 4))
      const get2 = env.getAccessorBool('get', members[1]);
      expect(get2.call(dv2, 4)).to.be.false;
      dv2.setUint32(4, 1, false);
      expect(get2.call(dv2, 4)).to.be.true;
      const set2 = env.getAccessorBool('set', members[1]);
      set2.call(dv2, 4, false);
      expect(dv2.getUint32(1, false)).to.equal(0);

      const dv3 = new DataView(new ArrayBuffer(8 + 8))
      const get3 = env.getAccessorBool('get', members[2]);
      expect(get3.call(dv3, 8)).to.be.false;
      dv3.setBigUint64(8, 1n, true);
      expect(get3.call(dv3, 4)).to.be.true;
      const set3 = env.getAccessorBool('set', members[2]);
      set3.call(dv3, 8, false);
      expect(dv3.getBigUint64(8, true)).to.equal(0n);

    })
  })
})