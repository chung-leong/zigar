import { expect } from 'chai';

import { StructureType } from '../src/structure.js';
import { MemberType } from '../src/member.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import {
  getErrorUnionAccessors,
} from '../src/error-union.js';

describe('Error union functions', function() {
  describe('getErrorUnionAccessors', function() {
    it('should return a function for getting float with potential error', function() {
      let errorNumber;
      const DummyErrorSet = function(arg) {
        errorNumber = arg;
        return dummyError;
      };
      const dummyError = new Error('I am Groot');
      const members = [
        {
          type: MemberType.Float,
          bitOffset: 0,
          bitSize: 64,
          byteSize: 8,
        },
        {
          type: MemberType.Int,
          isSigned: false,
          bitOffset: 64,
          bitSize: 16,
          byteSize: 2,
          structure: { constructor: DummyErrorSet }
        },
      ];
      const dv = new DataView(new ArrayBuffer(10));
      dv.setUint16(8, 18, true);
      const object = {
        [MEMORY]: dv,
      };
      const { get } = getErrorUnionAccessors(members, {});
      expect(() => get.call(object)).to.throw().equal(dummyError);
      expect(errorNumber).to.equal(18);
      dv.setUint16(8, 0, true);
      dv.setFloat64(0, 3.14, true);
      const result = get.call(object);
      expect(result).to.equal(3.14);
    })
    it('should return a function for getting object value with potential error', function() {
      let errorNumber;
      const DummyErrorSet = function(arg) {
        errorNumber = arg;
        return dummyError;
      };
      const dummyError = new Error('I am Groot');
      const DummyClass = function() {};
      const members = [
        {
          type: MemberType.Object,
          bitOffset: 16,
          bitSize: 0,
          byteSize: 8,
          slot: 0,
          structure: {
            type: StructureType.Struct,
            constructor: DummyClass,
          }
        },
        {
          type: MemberType.Int,
          isSigned: false,
          bitOffset: 64,
          bitSize: 16,
          byteSize: 2,
          structure: { constructor: DummyErrorSet }
        },
      ];
      const dv = new DataView(new ArrayBuffer(10));
      dv.setUint16(8, 18, true);
      const object = {
        [MEMORY]: dv,
        [SLOTS]: { 0: null },
      };
      const dummyObject = new DummyClass();
      const { get } = getErrorUnionAccessors(members, {});
      expect(() => get.call(object)).to.throw().equal(dummyError);
      expect(errorNumber).to.equal(18);
      dv.setUint16(8, 0, true);
      object[SLOTS][0] = dummyObject;
      const result = get.call(object);
      expect(result).to.equal(dummyObject);
    })
    it('should return a function for setting int or error', function() {
      let errorNumber;
      const DummyErrorSet = function(arg) {
        errorNumber = arg;
        return dummyError;
      };
      const dummyError = new Error('I am Groot');
      dummyError[Symbol.toPrimitive] = () => 18;
      const members = [
        {
          type: MemberType.Float,
          bitOffset: 0,
          bitSize: 64,
          byteSize: 8,
        },
        {
          type: MemberType.Int,
          isSigned: false,
          bitOffset: 64,
          bitSize: 16,
          byteSize: 2,
          structure: { constructor: DummyErrorSet }
        },
      ];
      const dv = new DataView(new ArrayBuffer(10));
      dv.setFloat64(0, 3.14, true);
      const object = {
        [MEMORY]: dv,
      };
      const { set } = getErrorUnionAccessors(members, {});
      set.call(object, dummyError);
      expect(dv.getUint16(8, true)).to.equal(18);
      expect(dv.getFloat64(0, true)).to.equal(0);
      expect(errorNumber).to.equal(18);
      set.call(object, 1234.5678);
      expect(dv.getUint16(8, true)).to.equal(0);
      expect(dv.getFloat64(0, true)).to.equal(1234.5678);
    })
    it('should return a function for setting object or error', function() {
      let errorNumber;
      const DummyErrorSet = function(arg) {
        errorNumber = arg;
        return dummyError;
      };
      const dummyError = new Error('I am Groot');
      dummyError[Symbol.toPrimitive] = () => 18;
      const DummyClass = function(value) {
        this.value = value;
      };
      const members = [
        {
          type: MemberType.Object,
          bitOffset: 0,
          bitSize: 64,
          byteSize: 8,
          slot: 0,
          structure: {
            type: StructureType.Struct,
            constructor: DummyClass,
            copier: (dest, src) => {
              dest.value = src.value;
            },
            resetter: (dest) => {
              dest.value = 0;
            },
          }
        },
        {
          type: MemberType.Int,
          isSigned: false,
          bitOffset: 64,
          bitSize: 16,
          byteSize: 2,
          structure: { constructor: DummyErrorSet }
        },
      ];
      const dummyObject = new DummyClass(123);
      const dv = new DataView(new ArrayBuffer(10));
      const object = {
        [MEMORY]: dv,
        [SLOTS]: { 0: dummyObject },
      };
      const { set } = getErrorUnionAccessors(members, {});
      set.call(object, dummyError);
      expect(dv.getUint16(8, true)).to.equal(18);
      // TODO: implement resetter
      //expect(object[SLOTS][0].value).to.equal(0);
      expect(errorNumber).to.equal(18);
      set.call(object, 456);
      expect(dv.getUint16(8, true)).to.equal(0);
      expect(object[SLOTS][0].value).to.equal(456);
    })
  })
})