import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

describe('Accessor: big-uint', function() {
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
      const set1 = env.getAccessorBigUint('set', members[0]);
      set1.call(dv1, 8, 1234n, true);
      expect(get1.call(dv1, 8, true)).to.equal(1234n);
      set1.call(dv1, 8, 0x0000_ffff_ffff_fffen, true);
      expect(get1.call(dv1, 8, true)).to.equal(0x0000_ffff_ffff_fffen);
      const dv2 = new DataView(new ArrayBuffer(8 + 8))
      const get2 = env.getAccessorBigUint('get', members[1]);
      dv2.setBigUint64(8, 0x7fff_ffff_ffff_ffffn, false);
      expect(get2.call(dv2, 8, false)).to.equal(0x7fff_ffff_ffff_ffffn);
    })
  })
})