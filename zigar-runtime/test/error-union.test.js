import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
  useUintEx,
  useFloatEx,
  useObject,
} from '../src/member.js';
import {
  StructureType,
  usePrimitive,
  useErrorSet,
  useErrorUnion,
  useStruct,
  usePointer,
  useSlice,
} from '../src/structure.js';
import { initializeErrorSets } from '../src/error-set.js';
import { CHILD_VIVIFICATOR, MEMORY, SLOTS } from '../src/symbol.js';
import { getErrorUnionAccessors } from '../src/error-union.js';
import { Environment } from '../src/environment.js'
const {
  beginStructure,
  attachMember,
  finalizeStructure,
} = Environment.prototype;

describe('Error union functions', function() {
  describe('finalizeErrorUnion', function() {
    beforeEach(function() {
      usePrimitive();
      useErrorUnion();
      useErrorSet();
      useStruct();
      usePointer();
      useSlice();
      useIntEx();
      useUintEx();
      useObject();
      initializeErrorSets();
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
        byteSize: 10,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: {},
      });
      attachMember(structure, {
        name: 'error',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: setStructure,
      });
      const Hello = finalizeStructure(structure);
      const object = Hello(new ArrayBuffer(10));
      expect(object.$).to.equal(0n);
      object.$ = 1234n;
      expect(object.$).to.equal(1234n);
    })
    it('should throw when no initializer is provided', function() {
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
        byteSize: 10,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: {},
      });
      attachMember(structure, {
        name: 'error',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: setStructure,
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should define an error union with internal struct', function() {
      const setStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'Error',
      });
      attachMember(setStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        slot: 1,
      });
      attachMember(setStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        slot: 2,
      });
      const SomeError = finalizeStructure(setStructure);
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Animal',
        byteSize: 8,
      });
      attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      const Animal = finalizeStructure(structStructure);
      const structure = beginStructure({
        type: StructureType.ErrorUnion,
        name: '!Animal',
        byteSize: 10,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      attachMember(structure, {
        name: 'error',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: setStructure,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({ dog: 17, cat: 234 });
      expect(object).to.be.an('!Animal');
      expect(object.$).to.be.an('Animal');
      object.$ = SomeError.UnableToCreateObject;
      expect(() => object.$).to.throw(SomeError)
        .with.property('message').that.equal('Unable to create object');
    })
    it('should define an error union with a pointer', function() {
      const setStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'Error',
      });
      attachMember(setStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        slot: 16,
      });
      attachMember(setStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        slot: 17,
      });
      finalizeStructure(setStructure);
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const ptrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(ptrStructure);
      const structure = beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 16,
        hasPointer: true,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      attachMember(structure, {
        name: 'error',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: setStructure,
      });
      const Hello = finalizeStructure(structure);
      const object = Hello(new ArrayBuffer(16));
      object[MEMORY].setInt16(8, 16, true)
      expect(() => object.$).to.throw();
      object.$ = new Int32(0);
      object.$['*'] = 5;
      expect(object.$['*']).to.equal(5);
    })
    it('should define an error union with a slice', function() {
      const setStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'Error',
      });
      attachMember(setStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        slot: 16,
      });
      attachMember(setStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        slot: 17,
      });
      finalizeStructure(setStructure);
      const sliceStructure = beginStructure({
        type: StructureType.Slice,
        name: '[_]Uint8',
        byteSize: 1,
      })
      attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array },
      });
      const Uint8Slice = finalizeStructure(sliceStructure);
      const ptrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '[]Uint8',
        byteSize: 16,
        hasPointer: true,
      });
      attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
        slot: 0,
        structure: sliceStructure,
      });
      const Uint8SlicePtr = finalizeStructure(ptrStructure);
      const structure = beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 18,
        hasPointer: true,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: ptrStructure,
      });
      attachMember(structure, {
        name: 'error',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: setStructure,
      });
      const Hello = finalizeStructure(structure);
      const encoder = new TextEncoder();
      const array = encoder.encode('This is a test');
      const object = new Hello(array);
      expect(object.$.string).to.equal('This is a test');
      expect(object.$.typedArray).to.eql(array);
      expect(JSON.stringify(object)).to.eql(JSON.stringify([ ...array ]));
    })
    it('should correctly copy an error union containing a pointer', function() {
      const setStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'Error',
      });
      attachMember(setStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        slot: 16,
      });
      attachMember(setStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        slot: 17,
      });
      finalizeStructure(setStructure);
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const ptrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(ptrStructure);
      const structure = beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 16,
        hasPointer: true,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      attachMember(structure, {
        name: 'error',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: setStructure,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello(new Int32(777));
      const object2 = new Hello(object);
      expect(object.$['*']).to.equal(777);
      expect(object2.$['*']).to.equal(777);
    })
    it('should release pointer when error union is set to an error', function() {
      const setStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'SomeError',
      });
      attachMember(setStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        slot: 16,
      });
      attachMember(setStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        slot: 17,
      });
      const SomeError = finalizeStructure(setStructure);
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const ptrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(ptrStructure);
      const structure = beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 16,
        hasPointer: true,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      attachMember(structure, {
        name: 'error',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: setStructure,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello(new Int32(777));
      const ptr = object.$;
      object.$ = SomeError.UnableToCreateObject;
      expect(ptr[SLOTS][0]).to.be.null;
    })
    it('should throw an error when error number is unknown', function() {
      const setStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'Error',
      });
      attachMember(setStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        slot: 1,
     });
      attachMember(setStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        slot: 2,
      });
      finalizeStructure(setStructure);
      const structure = beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 10,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: {},
      });
      attachMember(structure, {
        name: 'error',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: setStructure,
      });
      const Hello = finalizeStructure(structure);
      const dv = new DataView(new ArrayBuffer(10));
      dv.setInt16(8, 32, true)
      const object = Hello(dv);
      expect(() => object.$).to.throw()
        .with.property('message').that.contains('#32');
    })
    it('should throw when attempting to set an error that is not in the error set', function() {
      const setStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'SomeError',
      });
      attachMember(setStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        slot: 1,
      });
      attachMember(setStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        slot: 2,
      });
      finalizeStructure(setStructure);
      const structure = beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 10,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: {},
      });
      attachMember(structure, {
        name: 'error',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: setStructure,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello(123n);
      expect(object.$).to.equal(123n);
      expect(() => object.$ = new Error('Doh!')).to.throw(TypeError)
        .with.property('message').that.contains('SomeError');
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
          this.index = arg;
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
          structure: {},
        },
        {
          type: MemberType.Uint,
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
      const { get } = getErrorUnionAccessors(members, dv.byteLength, {});
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
          this.index = arg;
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
          type: MemberType.Uint,
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
        [CHILD_VIVIFICATOR]: { 0: () => dummyObject },
      };
      const dummyObject = new DummyClass();
      const { get } = getErrorUnionAccessors(members, dv.byteLength, {});
      expect(() => get.call(object)).to.throw().equal(dummyError);
      expect(errorNumber).to.equal(18);
      dv.setUint16(8, 0, true);
      const result = get.call(object);
      expect(result).to.equal(dummyObject);
    })
    it('should return a function for setting int or error', function() {
      const DummyErrorSet = function(arg) {
        if (this instanceof DummyErrorSet) {
          this.index = arg;
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
          structure: {
            type: StructureType.Primitive,
          }
        },
        {
          type: MemberType.Uint,
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
      const { set } = getErrorUnionAccessors(members, dv.byteLength, {});
      set.call(object, dummyError);
      expect(dv.getUint16(8, true)).to.equal(18);
      expect(dv.getFloat64(0, true)).to.equal(0);
      set.call(object, 1234.5678);
      expect(dv.getUint16(8, true)).to.equal(0);
      expect(dv.getFloat64(0, true)).to.equal(1234.5678);
    })
  })
})