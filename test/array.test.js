import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
  getAccessors,
} from '../src/member.js';
import { MEMORY } from '../src/symbol.js';
import {
  StructureType,
  useArray,
  useSlice,
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
      useSlice();
      useIntEx();
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
      const object = new Hello();
      object.set(0, 321);
      expect(object.get(0)).to.equal(321);
      expect(object.length).to.equal(8);
      expect(object.typedArray).to.be.instanceOf(Uint32Array);
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
    it('should define structure for holding an int slice', function() {
      const structure = beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        size: 4,
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
      const object = Hello(new ArrayBuffer(32));
      object.set(1, 321);
      expect(object.get(1)).to.equal(321);
      expect(object.length).to.equal(8);
    })
    it('should have string property when slice contains Uint8', function() {
      const structure = beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        size: 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 8,
        byteSize: 1,
      });
      const Hello = finalizeStructure(structure);
      const dv = new DataView(new ArrayBuffer(4));
      dv.setUint8(0, 'A'.charCodeAt(0));
      dv.setUint8(1, 'B'.charCodeAt(0));
      dv.setUint8(2, 'C'.charCodeAt(0));
      dv.setUint8(3, 'D'.charCodeAt(0));
      const object = Hello(dv);
      const { string } = object;
      expect(string).to.equal('ABCD');
    })
    it('should have string property when slice contains Uint16', function() {
      const structure = beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 16,
        byteSize: 2,
      });
      const Hello = finalizeStructure(structure);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint16(0, 'A'.charCodeAt(0), true);
      dv.setUint16(2, 'B'.charCodeAt(0), true);
      dv.setUint16(4, 'C'.charCodeAt(0), true);
      dv.setUint16(6, 'D'.charCodeAt(0), true);
      const object = Hello(dv);
      const { string } = object;
      expect(string).to.equal('ABCD');
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