import { expect } from 'chai';

import { MEMORY } from '../src/symbol.js';
import {
  getAccessors,
} from '../src/member.js';

describe('Member functions', function() {
  describe('getAccessors', function() {
    it('should return a function for retrieving an array item', function() {
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = { [MEMORY]: dv };
      const { get } = getAccessors('get', member);
      const res1 = get.call(object, 0);
      const res2 = get.call(object, 1);
      const res3 = get.call(object, 2);
      expect(res1).to.equal(1234);
      expect(res2).to.equal(-2);
      expect(res3).to.equal(-1);
    })
    it('should return a function for setting an array item', function() {
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      const { set } = getAccessors('get', member);
      const object = { [MEMORY]: dv };
      set.call(object, 0, 1234);
      set.call(object, 1, -2);
      set.call(object, 2, -1);
      expect(dv.getInt32(0, true)).to.equal(1234);
      expect(dv.getInt32(4, true)).to.equal(-2);
      expect(dv.getInt32(8, true)).to.equal(-1);
    })
    it('should return a function for retrieving a big int array element', function() {
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 64,
        byteSize: 8,
      };
      const dv = new DataView(new ArrayBuffer(24));
      dv.setBigInt64(0, 1234n, true);
      dv.setBigInt64(8, -2n, true);
      dv.setBigInt64(16, -1n, true);
      const object = { [MEMORY]: dv };
      const { get } = getAccessors('get', member);
      const res1 = get.call(object, 0);
      const res2 = get.call(object, 1);
      const res3 = get.call(object, 2);
      expect(res1).to.equal(1234n);
      expect(res2).to.equal(-2n);
      expect(res3).to.equal(-1n);
    })
    it('should return a function for setting a big int array element', function() {
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 64,
        byteSize: 8,
      };
      const dv = new DataView(new ArrayBuffer(24));
      const object = { [MEMORY]: dv };
      const { set } = getAccessors('get', member);
      set.call(object, 0, 1234n);
      set.call(object, 1, -2n);
      set.call(object, 2, -1n);
      expect(dv.getBigInt64(0, true)).to.equal(1234n);
      expect(dv.getBigInt64(8, true)).to.equal(-2n);
      expect(dv.getBigInt64(16, true)).to.equal(-1n);
    })
    it('should throw when index is out-of-bound', function() {
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = { [MEMORY]: dv };
      const { get, set } = getAccessors('get', member);
      expect(() => get.call(object, -1)).to.throw();
      expect(() => get.call(object, 4)).to.throw();
      expect(() => set.call(object, -1, 0)).to.throw();
      expect(() => set.call(object, 4, 0)).to.throw();
    })
    it('should return functions employing the correct endianness', function() {
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, false);
      dv.setInt32(4, -2, false);
      dv.setInt32(8, -1, false);
      const object = { [MEMORY]: dv };
      const { get, set } = getAccessors('get', member, { littleEndian: false });
      expect(get.call(object, 0)).to.equal(1234);
      expect(get.call(object, 1)).to.equal(-2);
      expect(get.call(object, 2)).to.equal(-1);
      set.call(object, 1235);
      set.call(object, -3);
      set.call(object, -2);
      expect(get.call(object, 0, false)).to.equal(1235);
      expect(get.call(object, 1, false)).to.equal(-3);
      expect(get.call(object, 2, false)).to.equal(-2);
    })
  })
})