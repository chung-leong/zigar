import { expect } from 'chai';

import {
  MemberType,
  useBool,
  useIntEx,
  useUintEx,
  useFloatEx,
  useObject,
} from '../src/member.js';
import {
  StructureType,
  usePrimitive,
  useStruct,
  useOptional,
  usePointer,
  useSlice,
  beginStructure,
  attachMember,
  attachTemplate,
  finalizeStructure,
  useArray,
} from '../src/structure.js';
import { CHILD_VIVIFICATOR, MEMORY, SLOTS } from '../src/symbol.js';
import {
  getOptionalAccessors,
} from '../src/optional.js';

describe('Optional functions', function() {
  describe('finalizeOptional', function() {
    beforeEach(function() {
      usePrimitive();
      useOptional();
      usePointer();
      useStruct();
      useArray();
      useSlice();
      useBool();
      useIntEx();
      useUintEx();
      useFloatEx();
      useObject();
    })
    it('should define a structure for storing an optional value', function() {
      const structure = beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 18,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Float,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        structure: {
          type: StructureType.Primitive,
        }
      });
      attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
      });
      const Hello = finalizeStructure(structure);
      const object = Hello(new ArrayBuffer(18));
      expect(object.$).to.equal(null);
      object.$ = 3.14;
      expect(object.$).to.equal(3.14);
      object.$ = null;
      expect(object.$).to.equal(null);
    })
    it('should throw when no initializer is provided', function() {
      const structure = beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 18,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Float,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        structure: {
          type: StructureType.Primitive,
        }
      });
      attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should initialize an optional value based on argument given', function() {
      const structure = beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 18,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Float,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        structure: {
          type: StructureType.Primitive,
        }
      });
      attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello(undefined);
      expect(object.$).to.equal(null);
      object.$ = 3.14;
      expect(object.$).to.equal(3.14);
    })
    it('should initialize an optional value from object of same type', function() {
      const structure = beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 18,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Float,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        structure: {
          type: StructureType.Primitive,
        }
      });
      attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({});
      object.$ = 3.14;
      const object2 = new Hello(object);
      expect(object2.$).to.equal(3.14);
    })
    it('should define a structure for storing an optional struct', function() {
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
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 18,
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
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
      });
      const Hello = finalizeStructure(structure);
      const object = Hello(new ArrayBuffer(18));
      expect(object.$).to.equal(null);
      object.$ = { dog: 1, cat: 2 };
      expect(object.$).to.be.instanceOf(Animal);
      object.$ = null;
      expect(object.$).to.equal(null);
    })
    it('should define a structure for storing an optional pointer', function() {
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
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 8,
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
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      const object = Hello(new ArrayBuffer(8));
      expect(object.$).to.equal(null);
      object.$ = new Int32(0);
      object.$['*'] = 5;
      expect(object.$['*']).to.equal(5);
    })
    it('should define a structure for storing an optional slice', function() {
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
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 16,
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
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      const encoder = new TextEncoder();
      const array = encoder.encode('This is a test');
      const object = new Hello(array);
      expect(object.$.string).to.equal('This is a test');
      expect(object.$.typedArray).to.eql(array);
      expect(JSON.stringify(object)).to.eql(JSON.stringify([ ...array ]));
      const object2 = new Hello(null);
      expect(object2.$).to.be.null;
    })
    it('should copy pointers where initialized from an optional of the same type', function() {
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
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 16,
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
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      const encoder = new TextEncoder();
      const array = encoder.encode('This is a test');
      const object = new Hello(array);
      const object2 = new Hello(object);
      expect(object2.$.string).to.equal('This is a test');
    })
    it('should release pointers in struct when it is set to null', function() {
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
        hasPointer: true
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
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8 * 2,
        hasPointer: true
      });
      attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: ptrStructure,
      })
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      const intPtr1 = new Int32Ptr(int1);
      const intPtr2 = new Int32Ptr(int2);
      attachTemplate(structStructure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8 * 2));
          dv.setBigUint64(0, 0xaaaaaaaaaaaaaaaan, true);
          dv.setBigUint64(8, 0xaaaaaaaaaaaaaaaan, true);
          return dv;
        })(),
        [SLOTS]: {
          0: intPtr1,
          1: intPtr2,
        }
      });
      finalizeStructure(structStructure);
      const structure = beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: structStructure.byteSize + 32,
        hasPointer: true,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: structStructure.byteSize * 8,
        byteSize: structStructure.byteSize,
        slot: 0,
        structure: structStructure,
      });
      attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: structStructure.byteSize * 8,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({});
      const ptr = object.$.cat;
      expect(ptr[SLOTS][0]).to.not.be.null;
      object.$ = null;
      expect(ptr[SLOTS][0]).to.be.null;
    })
    it('should release pointers in array when it is set to null', function() {
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
      const arrayStructure = beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 4,
        byteSize: 8 * 4,
        hasPointer: true,
      });
      attachMember(arrayStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: ptrStructure,
      });
      const Int32PtrArray = finalizeStructure(arrayStructure);
      const structure = beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: arrayStructure.byteSize + 32,
        hasPointer: true,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: arrayStructure.byteSize * 8,
        byteSize: arrayStructure.byteSize,
        slot: 0,
        structure: arrayStructure,
      });
      attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: arrayStructure.byteSize * 8,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello([ new Int32(1234), new Int32(4567), new Int32(7890), new Int32(12345) ]);
      const array = object.$;
      for (let i = 0; i < 4; i++) {
        expect(array[SLOTS][i][SLOTS][0]).to.not.be.null;
      }
      object.$ = null;
      for (let i = 0; i < 4; i++) {
        expect(array[SLOTS][i][SLOTS][0]).to.be.null;
      }
    })
  })
  describe('getOptionalAccessors', function() {
    beforeEach(function() {
      useBool();
      useFloatEx();
      useObject();
    })
    it('should return a function for getting optional float', function() {
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
          type: MemberType.Bool,
          bitOffset: 64,
          bitSize: 1,
          byteSize: 1,
        },
      ];
      const dv = new DataView(new ArrayBuffer(10));
      dv.setFloat64(0, 3.14, true);
      dv.setUint8(8, 1, true);
      const object = {
        [MEMORY]: dv,
      };
      const { get } = getOptionalAccessors(members, dv.byteLength, {});
      const result1 = get.call(object);
      expect(result1).to.equal(3.14);
      dv.setUint8(8, 0, true);
      const result2 = get.call(object);
      expect(result2).to.be.null;
    })
    it('should return a function for getting optional object value', function() {
      const DummyClass = function() {};
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
          }
        },
        {
          type: MemberType.Bool,
          bitOffset: 64,
          bitSize: 1,
          byteSize: 1,
        },
      ];
      const dv = new DataView(new ArrayBuffer(10));
      const object = {
        [MEMORY]: dv,
        [CHILD_VIVIFICATOR]: { 0: () => dummyObject },
      };
      const dummyObject = new DummyClass();
      const { get } = getOptionalAccessors(members, dv.byteLength, {});
      const result1 = get.call(object);
      expect(result1).to.equal(null);
      dv.setUint8(8, 1, true);
      const result2 = get.call(object);
      expect(result2).to.equal(dummyObject);
    })
    it('should return a function for setting float or null', function() {
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
          type: MemberType.Bool,
          bitOffset: 64,
          bitSize: 1,
          byteSize: 1,
        },
      ];
      const dv = new DataView(new ArrayBuffer(10));
      dv.setInt8(8, 1, true);
      dv.setFloat64(0, 3.14, true);
      const object = {
        [MEMORY]: dv,
      };
      const { get, set } = getOptionalAccessors(members, dv.byteLength, {});
      expect(get.call(object)).to.equal(3.14);
      set.call(object, null);
      expect(dv.getUint8(8, true)).to.equal(0);
      expect(dv.getFloat64(0, true)).to.equal(0);
      set.call(object, 1234.5678);
      expect(dv.getUint8(8, true)).to.equal(1);
      expect(dv.getFloat64(0, true)).to.equal(1234.5678);
    })
  })
})
