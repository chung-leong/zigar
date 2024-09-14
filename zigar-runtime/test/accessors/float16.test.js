import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Accessor: float16', function() {
  describe('getAccessorFloat16', function() {
    it('should return methods for accessing 16-bit floats', function() {
      const env = new Env();
      const members = [
        { type: MemberType.Float, bitSize: 16, byteSize: 2, bitOffset: 0 },
      ];
      const dv = new DataView(new ArrayBuffer(1 + 2))
      const get = env.getAccessorFloat16('get', members[0]);
      expect(get.call(dv, 1)).to.equal(0);
      const set = env.getAccessorFloat16('set', members[0]);
      set.call(dv, 1, 3.25);
      expect(get.call(dv, 1)).to.equal(3.25);
    })
  })
})