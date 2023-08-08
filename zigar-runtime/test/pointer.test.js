import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
  useObject,
} from '../src/member.js';
import {
  StructureType,
  usePrimitive,
  usePointer,
  useStruct,
  useSlice,
  useArray,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';
import { MEMORY } from '../src/symbol.js';

describe('Pointer functions', function() {
  describe('finalizePointer', function() {
    beforeEach(function() {
      useIntEx();
      useObject();
      useStruct();
      usePrimitive();
      usePointer();
      useSlice();
      useArray();
    })
    it('should define a pointer for pointing to integers', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(structure);
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      expect(intPointer['*']).to.equal(1234);
    })
    it('should define a pointer for pointing to a structure', function() {
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8,
        hasPointer: false,
      });
      attachMember(structStructure, {
        type: MemberType.Int,
        name: 'cat',
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structStructure, {
        type: MemberType.Int,
        name: 'dog',
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      const HelloPtr = finalizeStructure(structure);
      const target = new Hello({ cat: 123, dog: 456 });
      const pointer = new HelloPtr(target);
      expect(pointer['*']).to.equal(target);
      expect(pointer.cat).to.equal(123);
      expect(pointer.dog).to.equal(456);
      expect(pointer.cow).to.be.undefined;
      pointer.cat = 777;
      expect(target.cat).to.equal(777);
    })
    it('should copy values over when pointer is dereferenced prior to assignment', function() {
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8,
        hasPointer: false,
      });
      attachMember(structStructure, {
        type: MemberType.Int,
        name: 'cat',
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structStructure, {
        type: MemberType.Int,
        name: 'dog',
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      const HelloPtr = finalizeStructure(structure);
      const object1 = new Hello({ cat: 123, dog: 456 });
      const object2 = new Hello({ cat: 101, dog: 202 });
      const pointer = new HelloPtr(object1);
      pointer['*'] = object2;
      expect(pointer['*']).to.equal(object1);
      expect(object1.cat).to.equal(101);
    })
    it('should point to new object when no dereferencing occurred prior to assignment', function() {
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8,
        hasPointer: false,
      });
      attachMember(structStructure, {
        type: MemberType.Int,
        name: 'cat',
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structStructure, {
        type: MemberType.Int,
        name: 'dog',
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      const HelloPtr = finalizeStructure(structure);
      const object1 = new Hello({ cat: 123, dog: 456 });
      const object2 = new Hello({ cat: 101, dog: 202 });
      const pointer = new HelloPtr(object1);
      pointer.$ = object2;
      expect(pointer['*']).to.equal(object2);
      expect(object1.cat).to.equal(123);
    })
    it('should automatically dereference pointers a single-level only', function() {
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8,
        hasPointer: false,
      });
      attachMember(structStructure, {
        type: MemberType.Int,
        name: 'cat',
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structStructure, {
        type: MemberType.Int,
        name: 'dog',
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structStructure);
      const ptrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        size: 8,
        hasPointer: true,
      });
      attachMember(ptrStructure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      const HelloPtr = finalizeStructure(ptrStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '**Hello',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      const HelloPtrPtr = finalizeStructure(structure);
      const target = new Hello({ cat: 123, dog: 456 });
      const pointer = new HelloPtr(target);
      const ptrPointer = new HelloPtrPtr(pointer);
      expect(ptrPointer['*']).to.equal(pointer);
      expect(ptrPointer.cat).to.be.undefined;
      expect(ptrPointer.dog).to.be.undefined;
    })
    it('should have no setter when pointer is const', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        isConst: true,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(structure);
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      expect(intPointer['*']).to.equal(1234);
      expect(() => intPointer['*'] = 4567).to.throw(TypeError);
    })
    it('should throw when initializer is not of the right type', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(structure);
      // autovivification
      expect(() => new Int32Ptr(1234)).to.not.throw();
      expect(() => new Int32Ptr(1234n)).to.throw();
      const int32 = new Int32(1234);
      expect(() => new Int32Ptr(int32)).to.not.throw();
      const intPtr = new Int32Ptr(int32);
      expect(() => new Int32Ptr(intPtr)).to.not.throw();
    })
    it('should throw when attempting to cast a buffer to a pointer type', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(structure);
      const buffer = new ArrayBuffer(8);
      expect(() => Int32Ptr(buffer)).to.throw();
    })
    it('should automatically create slice object', function() {
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8,
        hasPointer: false,
      });
      attachMember(structStructure, {
        type: MemberType.Int,
        name: 'cat',
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structStructure, {
        type: MemberType.Int,
        name: 'dog',
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structStructure);
      const sliceStructure = beginStructure({
        type: StructureType.Slice,
        name: '[_]Hello',
        size: 8,
        hasPointer: false,
      });
      attachMember(sliceStructure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      const HelloSlice = finalizeStructure(sliceStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '[]Hello',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = finalizeStructure(structure);
      const pointer = new HelloPtr([ { cat: 123, dog: 456 }, { cat: 1230, dog: 4560 }, { cat: 12300, dog: 45600 } ]);
      expect(pointer['*']).to.be.instanceOf(HelloSlice);
      expect({ ...pointer[0] }).to.eql({ cat: 123, dog: 456 });
      expect({ ...pointer[1] }).to.eql({ cat: 1230, dog: 4560 });
      expect({ ...pointer[2] }).to.eql({ cat: 12300, dog: 45600 });
    })
    it('should automatically cast to slice from typed array', function() {
      const intStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Int32',
        size: 4,
        hasPointer: false,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const sliceStructure = beginStructure({
        type: StructureType.Slice,
        name: '[_]Int32',
        size: 8,
        hasPointer: false,
      });
      attachMember(sliceStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32Slice = finalizeStructure(sliceStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '[]Hello',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = finalizeStructure(structure);
      const ta = new Int32Array([ 1, 2, 3, 4 ]);
      const pointer = new HelloPtr(ta);
      expect(pointer['*']).to.be.instanceOf(Int32Slice);
      const { buffer } = pointer['*'][MEMORY];
      expect(buffer).to.equal(ta.buffer);
    })
    it('should throw when given a typed array is of the incorrect type', function() {
      const intStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Int32',
        size: 4,
        hasPointer: false,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const sliceStructure = beginStructure({
        type: StructureType.Slice,
        name: '[_]Int32',
        size: 8,
        hasPointer: false,
      });
      attachMember(sliceStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32Slice = finalizeStructure(sliceStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '[]Hello',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = finalizeStructure(structure);
      const ta = new Uint32Array([ 1, 2, 3, 4 ]);
      expect(() => new HelloPtr(ta)).to.throw(TypeError);
    })
    it('should automatically cast to slice from an array', function() {
      const intStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Int32',
        size: 4,
        hasPointer: false,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const sliceStructure = beginStructure({
        type: StructureType.Slice,
        name: '[_]Int32',
        size: 8,
        hasPointer: false,
      });
      attachMember(sliceStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32Slice = finalizeStructure(sliceStructure);
      const arrayStructure = beginStructure({
        type: StructureType.Array,
        name: '[8]Int32',
        size: 8 * 4,
        hasPointer: false,
      });
      attachMember(arrayStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32Array = finalizeStructure(arrayStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '[]Hello',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = finalizeStructure(structure);
      const array = new Int32Array([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      const pointer = new HelloPtr(array);
      expect(pointer['*']).to.be.instanceOf(Int32Slice);
      const dv = pointer['*'][MEMORY];
      expect(dv).to.equal(array[MEMORY]);
    })
    it('should allow casting of a buffer to a slice', function() {
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8,
        hasPointer: false,
      });
      attachMember(structStructure, {
        type: MemberType.Int,
        name: 'cat',
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structStructure, {
        type: MemberType.Int,
        name: 'dog',
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structStructure);
      const sliceStructure = beginStructure({
        type: StructureType.Slice,
        name: '[_]Hello',
        size: 8,
        hasPointer: false,
      });
      attachMember(sliceStructure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      const HelloSlice = finalizeStructure(sliceStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '[]Hello',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = finalizeStructure(structure);
      const buffer = new ArrayBuffer(8 * 3);
      const dv = new DataView(buffer);
      for (let i = 0, multiplier = 1; i < 3; i++, multiplier *= 10) {
        dv.setUint32(i * 8 + 0, 123 * multiplier, true);
        dv.setUint32(i * 8 + 4, 456 * multiplier, true);
      }
      const pointer = new HelloPtr(buffer);
      expect(pointer['*']).to.be.instanceOf(HelloSlice);
      expect({ ...pointer[0] }).to.eql({ cat: 123, dog: 456 });
      expect({ ...pointer[1] }).to.eql({ cat: 1230, dog: 4560 });
      expect({ ...pointer[2] }).to.eql({ cat: 12300, dog: 45600 });
    })
    it('should permit assignment and delete operations like regular objects', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(structure);
      const int32 = new Int32(1234);
      const intPtr = new Int32Ptr(int32);
      intPtr.hello = "Hello";
      expect(intPtr.hello).to.equal("Hello");
      expect(int32.hello).to.equal("Hello");
      delete intPtr.hello;
      expect(intPtr.hello).to.be.undefined;
      expect(int32.hello).to.be.undefined;
      expect(() => delete intPtr.$).to.not.throw();
      expect(() => delete intPtr['*']).to.not.throw();
    })
  })
})
