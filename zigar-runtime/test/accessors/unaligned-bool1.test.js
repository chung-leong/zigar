import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

describe('Accessor: unaligned-bool1', function() {
  describe('getAccessorUnalignedBool1', function() {
    it('should return methods for accessing bool in packed struct', function() {
      const members = [
        { type: MemberType.Bool, bitSize: 1, bitOffset: 0 },
        { type: MemberType.Bool, bitSize: 1, bitOffset: 1 },
        { type: MemberType.Bool, bitSize: 1, bitOffset: 2 },
      ];
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(1 + 1))
      const get1 = env.getAccessorUnalignedBool1('get', members[0]);
      expect(get1.call(dv, 1)).to.be.false;
      dv.setUint8(1, 3);
      expect(get1.call(dv, 1)).to.be.true;
      const set1 = env.getAccessorUnalignedBool1('set', members[0]);
      set1.call(dv, 1, false);
      expect(dv.getUint8(1)).to.equal(2);
      const get2 = env.getAccessorUnalignedBool1('get', members[1]);
      expect(get2.call(dv, 1)).to.be.true;
      dv.setUint8(1, 4);
      expect(get2.call(dv, 1)).to.be.false;
      const set2 = env.getAccessorUnalignedBool1('set', members[1]);
      set2.call(dv, 1, true);
      set1.call(dv, 1, true);
      expect(dv.getUint8(1)).to.equal(7);
      const get3 = env.getAccessorUnalignedBool1('get', members[2]);
      expect(get3.call(dv, 1)).to.be.true;
    })
  })
})