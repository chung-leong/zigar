import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Accessor: unaligned-int', function() {
  describe('getAccessorUnalignedInt', function() {
    it('should return methods for accessing small misaligned ints', function() {
      const members = [
        { type: MemberType.Int, bitSize: 2, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 3, bitOffset: 2 },
        { type: MemberType.Int, bitSize: 3, bitOffset: 5 },
      ];
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(1 + 1))
      const get1 = env.getAccessorUnalignedInt('get', members[0]);
      const get2 = env.getAccessorUnalignedInt('get', members[1]);
      const get3 = env.getAccessorUnalignedInt('get', members[2]);
      dv.setUint8(1, 0xff);
      expect(get1.call(dv, 1)).to.equal(-1);
      expect(get2.call(dv, 1)).to.equal(-1);
      expect(get3.call(dv, 1)).to.equal(-1);
      const set1 = env.getAccessorUnalignedInt('set', members[0]);
      const set2 = env.getAccessorUnalignedInt('set', members[1]);
      const set3 = env.getAccessorUnalignedInt('set', members[2]);
      set1.call(dv, 1, 1);
      set2.call(dv, 1, 1);
      set3.call(dv, 1, 1);
      expect(dv.getUint8(1)).to.equal(parseInt('00100101', 2));
    })
  })
})