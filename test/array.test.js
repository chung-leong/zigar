import { expect } from 'chai';

import { MemberType } from '../src/types.js';
import { DATA, RELOCATABLE } from '../src/symbols.js';
import { 
  obtainArrayGetter,
  obtainArraySetter,
  obtainArrayLengthGetter,
} from '../src/array.js';

describe('Array functions', function() {
  describe('obtainArrayGetter', function() {
    it('should return a function for retrieving an array item', function() {
      const member = {
        type: MemberType.Int,
        bits: 32,
        signed: true,
        align: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = { [DATA]: dv };
      const fn = obtainArrayGetter(member, {});
      const res1 = fn.call(object, 0);
      const res2 = fn.call(object, 1);
      const res3 = fn.call(object, 2);
      expect(res1).to.equal(1234);
      expect(res2).to.equal(-2);
      expect(res3).to.equal(-1);
    })
    it('should return a function for retrieving a big int', function() {
      const member = {
        type: MemberType.Int,
        bits: 64,
        signed: true,
        align: 8,
      };
      const dv = new DataView(new ArrayBuffer(24));
      dv.setBigInt64(0, 1234n, true);
      dv.setBigInt64(8, -2n, true);
      dv.setBigInt64(16, -1n, true);
      const object = { [DATA]: dv };
      const fn = obtainArrayGetter(member, {});
      const res1 = fn.call(object, 0);
      const res2 = fn.call(object, 1);
      const res3 = fn.call(object, 2);
      expect(res1).to.equal(1234n);
      expect(res2).to.equal(-2n);
      expect(res3).to.equal(-1n);
    })
    it('should return a function employing the correct endianness', function() {
      const member = {
        type: MemberType.Int,
        bits: 32,
        signed: true,
        align: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, false);
      dv.setInt32(4, -2, false);
      dv.setInt32(8, -1, false);
      const object = { [DATA]: dv };
      const fn = obtainArrayGetter(member, { littleEndian: false });
      const res1 = fn.call(object, 0);
      const res2 = fn.call(object, 1);
      const res3 = fn.call(object, 2);
      expect(res1).to.equal(1234);
      expect(res2).to.equal(-2);
      expect(res3).to.equal(-1);
    })
  })
})