import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

describe('Accessor: jumbo', function() {
  describe('getJumboAccessor', function() {
    it('should return methods for serializing/deserializing extra large big-ints', function() {
      const env = new Env();
      const dv1 = new DataView(new ArrayBuffer(16))
      const set1 = env.getJumboAccessor('set', 72);
      const get1 = env.getJumboAccessor('get', 72);
      const set2 = env.getJumboAccessor('set', 128);
      const get2 = env.getJumboAccessor('get', 128);
      for (const littleEndian of [ false ]) {
        set1.call(dv1, 0, 2n ** 72n - 1n, littleEndian);
        expect(get1.call(dv1, 0, littleEndian)).to.equal(2n ** 72n - 1n);
        const dv2 = new DataView(new ArrayBuffer(16))
        set2.call(dv2, 0, 2n ** 128n - 1n, littleEndian);
        expect(get2.call(dv2, 0, littleEndian)).to.equal(2n ** 128n - 1n);
      }
    })
  })
})