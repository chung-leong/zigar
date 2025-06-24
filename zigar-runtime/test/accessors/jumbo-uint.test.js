import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

describe('Accessor: jumbo-uint', function() {
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