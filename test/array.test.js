import { expect } from 'chai';

import { MemberType } from '../src/types.js';
import { DATA, RELOCATABLE } from '../src/symbols.js';
import { 
  obtainArrayGetter,
  obtainArraySetter,
  obtainArrayLengthGetter,
  getArrayIterator,
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
    it('should throw when index is out-of-bound', function() {
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
      expect(() => fn.call(object, -1)).to.throw();
      expect(() => fn.call(object, 4)).to.throw();
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
    // TODO: test cases for relocatables
  })
  describe('obtainArrayLengthGetter', function() {
    it('should return a function for getting the array length', function() {
      const member = {
        type: MemberType.Int,
        bits: 32,
        signed: true,
        align: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      const object = { [DATA]: dv };
      const fn = obtainArrayLengthGetter(member, {});
      const res = fn.call(object);
      expect(res).to.equal(3);
    })   
  })
  describe('obtainArraySetter', function() {
    it('should return a function for setting an array item', function() {
      const member = {
        type: MemberType.Int,
        bits: 32,
        signed: true,
        align: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      const object = { [DATA]: dv };
      const fn = obtainArraySetter(member, {});
      fn.call(object, 0, 1234);
      fn.call(object, 1, -2);
      fn.call(object, 2, -1);
      expect(dv.getInt32(0, true)).to.equal(1234);
      expect(dv.getInt32(4, true)).to.equal(-2);
      expect(dv.getInt32(8, true)).to.equal(-1);
    })
    it('should return a function for setting a big int', function() {
      const member = {
        type: MemberType.Int,
        bits: 64,
        signed: true,
        align: 8,
      };
      const dv = new DataView(new ArrayBuffer(24));
      const object = { [DATA]: dv };
      const fn = obtainArraySetter(member, {});
      fn.call(object, 0, 1234n);
      fn.call(object, 1, -2n);
      fn.call(object, 2, -1n);
      expect(dv.getBigInt64(0, true)).to.equal(1234n);
      expect(dv.getBigInt64(8, true)).to.equal(-2n);
      expect(dv.getBigInt64(16, true)).to.equal(-1n);
    })
    it('should throw when index is out-of-bound', function() {
      const member = {
        type: MemberType.Int,
        bits: 32,
        signed: true,
        align: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      const object = { [DATA]: dv };
      const fn = obtainArraySetter(member, {});
      expect(() => fn.call(object, -1, 1234)).to.throw();
      expect(() => fn.call(object, 4, 1234)).to.throw();
    })
    // TODO: test cases for relocatables
  })
  describe('getArrayIterator', function() {
    it('should return a iterator', function() {
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
      Object.defineProperty(object, 'get', { value: obtainArrayGetter(member, {}) });
      Object.defineProperty(object, 'length', { get: obtainArrayLengthGetter(member, {}) });
      const it = getArrayIterator.call(object);
      expect(it.next()).to.eql({ value: 1234, done: false });
      expect(it.next()).to.eql({ value: -2, done: false });
      expect(it.next()).to.eql({ value: -1, done: false });
      expect(it.next()).to.eql({ value: undefined, done: true });
      object[Symbol.iterator] = getArrayIterator;
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 1234, -2, -1]);
    })
  })
})