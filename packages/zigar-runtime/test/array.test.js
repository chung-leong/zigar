import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
  useObject,
  getAccessors,
} from '../src/member.js';
import { MEMORY } from '../src/symbol.js';
import {
  StructureType,
  useArray,
  useStruct,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';
import {
  getArrayLengthGetter,
  getArrayIterator,
} from '../src/array.js';

describe('Array functions', function() {
  describe('finalizeArray', function() {
    beforeEach(function() {
      useArray();
      useStruct();
      useIntEx();
      useObject();
    })
    it('should define structure for holding an int array', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 4 * 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const object = new Hello(new Uint32Array(8));
      object.set(0, 321);
      expect(object.get(0)).to.equal(321);
      expect(object.length).to.equal(8);
      expect(object.typedArray).to.be.instanceOf(Uint32Array);
    })
    it('should allow array access using bracket operator', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 4 * 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello(new Uint32Array(8));
      object[0] = 321;
      expect(object[0]).to.equal(321);
      expect(() => delete object[0]).to.throw();
      expect(object[0]).to.equal(321);
      for (let i = 0; i < object.length; i++) {
        object[i] = i;
      }
      for (let i = 0; i < object.length; i++) {
        expect(object[i]).to.equal(i);
      }
      // ensure it that it doesn't throw with symbol
      expect(() => object[Symbol.asyncIterator]).to.not.throw();
    })
    it('should have getter and setter that are bound to the object', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 4 * 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello(new Uint32Array(8));
      const { get, set, length } = object;
      for (let i = 0; i < length; i++) {
        set(i, i);
      }
      for (let i = 0; i < length; i++) {
        expect(get(i)).to.equal(i);
      }
    })
    it('should define array that is iterable', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 4 * 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      const dv = new DataView(new ArrayBuffer(4 * 8));
      dv.setUint32(0, 1234, true);
      dv.setUint32(16, 4567, true);
      const object = Hello(dv);
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 1234, 0, 0, 0, 4567, 0, 0, 0 ]);
    })
    it('should accept an array as initializer', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 4 * 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      for (let i = 0; i < 8; i++) {
        expect(object.get(i)).to.equal(i + 1);
      }
    })
    it('should accept an object of the same type as initializer', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 4 * 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      const object2 = new Hello(object);
      expect([ ...object2 ]).to.eql([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
    })
    it('should accept an array of bigints as initializer', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 8 * 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 64,
        byteSize: 8,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello([ 100n, 200n, 300n, 400n ]);
      for (let i = 0; i < 4; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 100n);
      }
    })
    it('should throw when initializer is of the wrong length', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 4 * 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello([ 1, 2, 3, 4, 5, 6, 7, 8, 9 ])).to.throw();
    })
    it('should throw when given an object of the incorrect type', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 4 * 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello({})).to.throw();
    })
    it('should correctly initialize an array of structs', function() {
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 4 * 2,
      });
      attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
      });
      attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
      });
      const Hello = finalizeStructure(structStructure);
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 8 * 4,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      const HelloArray = finalizeStructure(structure);
      const object = new HelloArray([
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
        { dog: 7, cat: 8 },
      ]);
      expect(object.valueOf()).to.eql([
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
        { dog: 7, cat: 8 },
      ]);
    })
    it('should allow reinitialization through the dollar property', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 8 * 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 64,
        byteSize: 8,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello([ 100n, 200n, 300n, 400n ]);
      for (let i = 0; i < 4; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 100n);
      }
      object.$ = new BigUint64Array([ 1000n, 2000n, 3000n, 4000n ]);
      for (let i = 0; i < 4; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 1000n);
      }
    })
    it('should allow the assignment of setter and getter as well as other properties', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 4 * 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      let called;
      object.get = () => { called = 'get' };
      object.get();
      expect(called).to.equal('get');
      object.set = () => { called = 'set' };
      object.set();
      expect(called).to.equal('set');
      object.ok = () => { called = 'ok' };
      object.ok();
    })
    it('should allow the deletion of setter and getter as well as other properties', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        size: 4 * 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      object.get = () => {};
      delete object.get;
      expect(object.get(0)).to.equal(1);
      object.set = () => {};
      delete object.set;
      object.set(0, 1);
      expect(object.get(0)).to.equal(1);
      object.ok = () => {};
      delete object.ok;
      expect(object.ok).to.be.undefined;
    })
  })
  describe('getArrayLengthGetter', function() {
    it('should return a getter that calculate length using shift', function() {
      const get = getArrayLengthGetter(8);
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(32))
      };
      expect(get.call(object)).to.equal(4);
    })
    it('should return a getter that calculate length using division', function() {
      const get = getArrayLengthGetter(6);
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(36))
      };
      expect(get.call(object)).to.equal(6);
    })
  })
  describe('getArrayIterator', function() {
    beforeEach(function() {
      useIntEx();
    })
    it('should return a iterator', function() {
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
      const { get } = getAccessors(member, {});
      Object.defineProperty(object, 'get', { value: get });
      Object.defineProperty(object, 'length', {
        get: function() {
          const dv = this[MEMORY];
          return dv.byteLength / 4;
        },
      });
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