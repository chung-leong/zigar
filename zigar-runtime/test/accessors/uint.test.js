import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';

import All from '../../src/accessors/all.js';
import Uint, {
  isNeededByMember
} from '../../src/accessors/uint.js';

const Env = defineClass('AccessorTest', [ All, Uint ]);

describe('Accessor: int', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const members = [
        { type: MemberType.Uint, bitSize: 7, byteSize: 1, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 15, byteSize: 2, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 31, bitOffset: 4 },
        { type: MemberType.Uint, bitSize: 7, bitOffset: 4 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.true;
      }
    })
    it('should return false when mixin is not needed by a member', function() {
      const members = [
        { type: MemberType.Object, slot: 1 },
        { type: MemberType.Uint, bitSize: 32, byteSize: 4, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 7, bitOffset: 1 },
        { type: MemberType.Uint, bitSize: 33, byteSize: 8, bitOffset: 0 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.false;
      }
    })
  })
  describe('getAccessorUint', function() {
    it('should return methods for accessing non-standard ints', function() {
      const env = new Env();
      const members = [
        { type: MemberType.Uint, bitSize: 7, byteSize: 1, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 15, byteSize: 2, bitOffset: 0 },
        { type: MemberType.Uint, bitSize: 30, byteSize: 4, bitOffset: 0 },
      ];
      const dv1 = new DataView(new ArrayBuffer(1 + 1))
      const get1 = env.getAccessorUint('get', members[0]);
      dv1.setUint8(1, 0x7f);
      expect(get1.call(dv1, 1)).to.equal(0x7f);
      const set1 = env.getAccessorUint('set', members[0]);
      set1.call(dv1, 1, 0x7e);
      expect(dv1.getUint8(1)).to.equal(0x7e);

      const dv2 = new DataView(new ArrayBuffer(2 + 2))
      const get2 = env.getAccessorUint('get', members[1]);
      dv2.setUint16(2, 0x7fff, false);
      expect(get2.call(dv2, 2, false)).to.equal(0x7fff);
      const set2 = env.getAccessorUint('set', members[1]);
      set2.call(dv2, 2, 0x7ffe, false);
      expect(dv2.getUint16(2, false)).to.equal(0x7ffe);

      const dv3 = new DataView(new ArrayBuffer(4 + 4))
      const get3 = env.getAccessorUint('get', members[2]);
      dv3.setUint32(4, 0x3fff_ffff, true);
      expect(get3.call(dv3, 4, true)).to.equal(0x3fff_ffff);
      const set3 = env.getAccessorUint('set', members[2]);
      set3.call(dv3, 4, 0x3fff_fffe, true);
      expect(dv3.getUint32(4, true)).to.equal(0x3fff_fffe);
    })
  })
})