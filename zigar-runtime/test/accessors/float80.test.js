import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Accessor: float80', function() {
  describe('getAccessorFloat80', function() {
    it('should return methods for accessing 80-bit floats', function() {
      const env = new Env();
      const members = [
        { type: MemberType.Float, bitSize: 80, byteSize: 16, bitOffset: 0 },
      ];
      const get = env.getAccessorFloat80('get', members[0]);
      const set = env.getAccessorFloat80('set', members[0]);
      for (const littleEndian of [ true, false ]) {
        const dv = new DataView(new ArrayBuffer(1 + 16))
        expect(get.call(dv, 1, littleEndian)).to.equal(0);
        set.call(dv, 1, Number.MIN_VALUE, littleEndian);
        expect(get.call(dv, 1, littleEndian)).to.equal(Number.MIN_VALUE);
        set.call(dv, 1, -Number.MIN_VALUE, littleEndian);
        expect(get.call(dv, 1, littleEndian)).to.equal(-Number.MIN_VALUE);
        set.call(dv, 1, Number.MAX_VALUE, littleEndian);
        expect(get.call(dv, 1, littleEndian)).to.equal(Number.MAX_VALUE);
        // make the exponent bigger that what a 64-bit can hold
        dv.setUint8(littleEndian ? 10 : 7, 0x44);
        expect(get.call(dv, 1, littleEndian)).to.equal(Infinity);
        set.call(dv, 1, -Number.MAX_VALUE, littleEndian);
        expect(get.call(dv, 1, littleEndian)).to.equal(-Number.MAX_VALUE);
        dv.setUint8(littleEndian ? 10 : 7, 0xC4);
        expect(get.call(dv, 1, littleEndian)).to.equal(-Infinity);
        set.call(dv, 1, Math.PI, littleEndian);
        expect(get.call(dv, 1, littleEndian)).to.equal(Math.PI);
        set.call(dv, 1, Infinity, littleEndian);
        expect(get.call(dv, 1, littleEndian)).to.equal(Infinity);
        set.call(dv, 1, -Infinity, littleEndian);
        expect(get.call(dv, 1, littleEndian)).to.equal(-Infinity);
        set.call(dv, 1, NaN, littleEndian);
        expect(get.call(dv, 1, littleEndian)).to.be.NaN;
      }
    })
  })
})