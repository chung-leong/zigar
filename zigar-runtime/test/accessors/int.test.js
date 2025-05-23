import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Accessor: int', function() {
  describe('getAccessorInt', function() {
    it('should return methods for accessing non-standard ints', function() {
      const env = new Env();
      const members = [
        { type: MemberType.Int, bitSize: 7, byteSize: 1, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 15, byteSize: 2, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 30, byteSize: 4, bitOffset: 0 },
      ];
      const dv1 = new DataView(new ArrayBuffer(1 + 1))
      const get1 = env.getAccessorInt('get', members[0]);
      dv1.setUint8(1, 0x7f);
      expect(get1.call(dv1, 1)).to.equal(-1);
      const set1 = env.getAccessorInt('set', members[0]);
      set1.call(dv1, 1, -2);
      expect(dv1.getUint8(1)).to.equal(0x7e);

      const dv2 = new DataView(new ArrayBuffer(2 + 2))
      const get2 = env.getAccessorInt('get', members[1]);
      dv2.setUint16(2, 0x7fff, false);
      expect(get2.call(dv2, 2, false)).to.equal(-1);
      const set2 = env.getAccessorInt('set', members[1]);
      set2.call(dv2, 2, -2, false);
      expect(dv2.getUint16(2, false)).to.equal(0x7ffe);

      const dv3 = new DataView(new ArrayBuffer(4 + 4))
      const get3 = env.getAccessorInt('get', members[2]);
      dv3.setUint32(4, 0x3fff_ffff, true);
      expect(get3.call(dv3, 4, true)).to.equal(-1);
      const set3 = env.getAccessorInt('set', members[2]);
      set3.call(dv3, 4, -2, true);
      expect(dv3.getUint32(4, true)).to.equal(0x3fff_fffe);
    })
  })
})