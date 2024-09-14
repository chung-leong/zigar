import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Accessor: float128', function() {
  describe('getAccessorFloat128', function() {
    it('should return methods for accessing 128-bit floats', function() {
      const env = new Env();
      const members = [
        { type: MemberType.Float, bitSize: 128, byteSize: 16, bitOffset: 0 },
      ];
      const dv = new DataView(new ArrayBuffer(1 + 16))
      const get = env.getAccessorFloat128('get', members[0]);
      expect(get.call(dv, 1)).to.equal(0);
      const set = env.getAccessorFloat128('set', members[0]);
      set.call(dv, 1, Math.PI);
      expect(get.call(dv, 1)).to.equal(Math.PI);
    })
  })
})