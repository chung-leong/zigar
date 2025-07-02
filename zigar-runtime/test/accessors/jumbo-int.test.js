import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Accessor: jumbo-int', function() {
  describe('getAccessorJumboInt', function() {
    it('should return methods for accessing extra-large big-ints', function() {
      const env = new Env();
      const members = [
        { type: MemberType.Int, bitSize: 72, byteSize: 16, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 128, byteSize: 16, bitOffset: 0 },
      ];
      const dv1 = new DataView(new ArrayBuffer(16))
      const set1 = env.getAccessorJumboInt('set', members[0]);
      const get1 = env.getAccessorJumboInt('get', members[0]);
      set1.call(dv1, 0, -2n, true);
      expect(get1.call(dv1, 0, true)).to.equal(-2n);
      const dv2 = new DataView(new ArrayBuffer(16))
      const set2 = env.getAccessorJumboInt('set', members[1]);
      const get2 = env.getAccessorJumboInt('get', members[1]);
      set2.call(dv2, 0, -3n, true);
      expect(get2.call(dv2, 0, true)).to.equal(-3n);
    })
  })
})