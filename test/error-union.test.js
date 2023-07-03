import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
  useFloatEx,
  useObject,
} from '../src/member.js';
import {
  StructureType,
  useErrorSet,
  useErrorUnion,
  useStruct,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import {
  getErrorUnionAccessors,
} from '../src/error-union.js';

describe('Error union functions', function() {
  describe('finalizeErrorUnion', function() {
    beforeEach(function() {
      useIntEx();
      useErrorSet();
      useErrorUnion();
    })
    it('should define an error union', function() {
      const setStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'Error',
      });
      attachMember(setStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
      });
      attachMember(setStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
      });
      finalizeStructure(setStructure);
      const structure = beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        size: 10,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      attachMember(structure, {
        name: 'error',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: setStructure
      });
      const Hello = finalizeStructure(structure);
      const object = Hello(new ArrayBuffer(10));
      expect(object.get(object)).to.equal(0n);
      object.set(1234n);
      expect(object.get(object)).to.equal(1234n);
    })
  })
  describe('getErrorUnionAccessors', function() {
    beforeEach(function() {
      useStruct();
      useErrorUnion();
      useIntEx();
      useFloatEx();
      useObject();
    })
    it('should return a function for getting float with potential error', function() {
      let errorNumber;
      const DummyErrorSet = function(arg) {
        if (this instanceof DummyErrorSet) {
          this[Symbol.toPrimitive] = () => arg;
        } else {
          errorNumber = arg;
          return dummyError;
        }
      };
      Object.setPrototypeOf(DummyErrorSet.prototype, Error.prototype);
      const dummyError = new DummyErrorSet(18);
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
        if (this instanceof DummyErrorSet) {
          this[Symbol.toPrimitive] = () => arg;
        } else {
          errorNumber = arg;
          return dummyError;
        }
      };
      Object.setPrototypeOf(DummyErrorSet.prototype, Error.prototype);
      const dummyError = new DummyErrorSet(18);
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
      const DummyErrorSet = function(arg) {
        if (this instanceof DummyErrorSet) {
          this[Symbol.toPrimitive] = () => arg;
        } else {
          return dummyError;
        }
      };
      Object.setPrototypeOf(DummyErrorSet.prototype, Error.prototype);
      const dummyError = new DummyErrorSet(18);
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
      set.call(object, 1234.5678);
      expect(dv.getUint16(8, true)).to.equal(0);
      expect(dv.getFloat64(0, true)).to.equal(1234.5678);
    })
    it('should return a function for setting object or error', function() {
      const DummyErrorSet = function(arg) {
        if (this instanceof DummyErrorSet) {
          this[Symbol.toPrimitive] = () => arg;
        } else {
          return dummyError;
        }
      };
      Object.setPrototypeOf(DummyErrorSet.prototype, Error.prototype);
      const dummyError = new DummyErrorSet(18);
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
      set.call(object, 456);
      expect(dv.getUint16(8, true)).to.equal(0);
      expect(object[SLOTS][0].value).to.equal(456);
    })
  })
})