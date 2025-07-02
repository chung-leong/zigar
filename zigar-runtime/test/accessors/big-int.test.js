import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Accessor: big-int', function() {
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
      const set1 = env.getAccessorBigInt('set', members[0]);
      set1.call(dv1, 8, -2n, true);
      expect(get1.call(dv1, 8, true)).to.equal(-2n);
      set1.call(dv1, 8, 0x0000_7fff_ffff_fffen, true);
      expect(get1.call(dv1, 8, true)).to.equal(0x0000_7fff_ffff_fffen);
      const dv2 = new DataView(new ArrayBuffer(8 + 8))
      const get2 = env.getAccessorBigInt('get', members[1]);
      dv2.setBigUint64(8, 0x7fff_ffff_ffff_ffffn, false);
      expect(get2.call(dv2, 8, false)).to.equal(-1n);
    })
  })
})