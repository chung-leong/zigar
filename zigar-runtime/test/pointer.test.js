import { expect } from 'chai';

import { MemberType, useAllMemberTypes } from '../src/member.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import { ENVIRONMENT, MEMORY, POINTER_SELF } from '../src/symbol.js';
import { NodeEnvironment } from '../src/environment-node.js';

describe('Pointer functions', function() {
  const env = new NodeEnvironment();
  describe('finalizePointer', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
    })
    it('should define a pointer for pointing to integers', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      expect(Int32Ptr.child).to.equal(Int32);
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      expect(intPointer['*']).to.equal(1234);
      expect(intPointer.valueOf()).to.equal(1234);
    })
    it('should cast the same buffer to the same object', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      const buffer = new ArrayBuffer(8);
      const object1 = Int32Ptr.call(ENVIRONMENT, buffer);
      const object2 = Int32Ptr.call(ENVIRONMENT, buffer);
      expect(object2).to.equal(object1);
    })
    it('should throw when no initializer is provided', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      expect(() => new Int32Ptr).to.throw(TypeError);
    })
    it('should define a pointer for pointing to a structure', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtr } = structure;
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
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtr } = structure;
      const object1 = new Hello({ cat: 123, dog: 456 });
      const object2 = new Hello({ cat: 101, dog: 202 });
      const pointer = new HelloPtr(object1);
      pointer['*'] = object2;
      expect(pointer['*']).to.equal(object1);
      expect(object1.cat).to.equal(101);
    })
    it('should point to new object when no dereferencing occurred prior to assignment', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtr } = structure;
      const object1 = new Hello({ cat: 123, dog: 456 });
      const object2 = new Hello({ cat: 101, dog: 202 });
      const pointer = new HelloPtr(object1);
      pointer.$ = object2;
      expect(pointer['*']).to.equal(object2);
      expect(object1.cat).to.equal(123);
    })
    it('should iterate through properties of target', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtr } = structure;
      const pointer = new HelloPtr(new Hello({ cat: 123, dog: 456 }));
      const entries = [];
      for (const entry of pointer) {
        entries.push(entry);
      }
      expect(entries).to.eql([ [ 'cat', 123 ], [ 'dog', 456 ] ]);
      expect(entries.valueOf()).to.eql([ [ 'cat', 123 ], [ 'dog', 456 ] ]);
    })
    it('should convert target of pointer to read-only when it is const', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*const Hello',
        byteSize: 4,
        isConst: true,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 0,
        structure: structStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtr } = structure;
      const object = new Hello({ cat: 123, dog: 456 });
      const pointer = new HelloPtr(object);
      const target = pointer['*'];
      expect(target).to.not.equal(object);
      expect(target.cat).to.equal(123);
      object.cat = 777;
      expect(target.cat).to.equal(777);
    })
    it('should throw when read-only object is assigned to non-const pointer', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        byteSize: 4,
        isConst: false,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 0,
        structure: structStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtr } = structure;
      const object1 = new Hello({ cat: 123, dog: 456 });
      const object2 = new Hello({ cat: 123, dog: 456 }, { writable: false });
      const pointer = new HelloPtr(object1);
      expect(() => pointer.$ = object2).to.throw(TypeError)
        .with.property('message').that.contains('read-only');
        expect(() => new HelloPtr(object2)).to.throw(TypeError)
        .with.property('message').that.contains('read-only');
    })
    it('should automatically dereference pointers a single-level only', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const { constructor: HelloPtr } = ptrStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '**Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtrPtr } = structure;
      const target = new Hello({ cat: 123, dog: 456 });
      const pointer = new HelloPtr(target);
      const ptrPointer = new HelloPtrPtr(pointer);
      expect(ptrPointer['*']).to.equal(pointer);
      expect(ptrPointer.cat).to.be.undefined;
      expect(ptrPointer.dog).to.be.undefined;
    })
    it('should have no setter when pointer is const', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        isConst: true,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      expect(intPointer['*']).to.equal(1234);
      expect(() => intPointer['*'] = 4567).to.throw(TypeError);
    })
    it('should throw when initializer is not of the right type', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      // no autovivification
      expect(() => new Int32Ptr(1234)).to.throw();
      expect(() => new Int32Ptr(1234n)).to.throw();
      const int32 = new Int32(1234);
      expect(() => new Int32Ptr(int32)).to.not.throw();
      const intPtr = new Int32Ptr(int32);
      expect(() => new Int32Ptr(intPtr)).to.not.throw();
    })
    it('should throw when attempting to cast a buffer to a pointer type', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      const buffer = new ArrayBuffer(8);
      expect(() => Int32Ptr(buffer)).to.throw();
    })
    it('should automatically create slice object', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Hello',
        byteSize: 16,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: HelloSlice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]Hello',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtr } = structure;
      const pointer = new HelloPtr([ { cat: 123, dog: 456 }, { cat: 1230, dog: 4560 }, { cat: 12300, dog: 45600 } ]);
      expect(pointer['*']).to.be.instanceOf(HelloSlice);
      expect(pointer[0].valueOf()).to.eql({ cat: 123, dog: 456 });
      expect(pointer[1].valueOf()).to.eql({ cat: 1230, dog: 4560 });
      expect(pointer[2].valueOf()).to.eql({ cat: 12300, dog: 45600 });
    })
    it('should automatically cast to slice from typed array', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
        hasPointer: false,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Int32',
        byteSize: 16,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: Int32Slice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]Hello',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtr } = structure;
      const ta = new Int32Array([ 1, 2, 3, 4 ]);
      const pointer = new HelloPtr(ta);
      expect(pointer['*']).to.be.instanceOf(Int32Slice);
      const { buffer } = pointer['*'][MEMORY];
      expect(buffer).to.equal(ta.buffer);
    })
    it('should show a warning when given a typed array is of the incorrect type', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
        hasPointer: false,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Int32',
        byteSize: 16,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: Int32Slice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]Int32',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32SlicePtr } = structure;
      const origFn = console.warn;
      let message;
      try {
        console.warn = (msg) => message = msg;
        const ta = new Uint32Array([ 1, 2, 3, 4 ]);
        expect(() => new Int32SlicePtr(ta)).to.not.throw(TypeError);
      } finally {
        console.warn = origFn;
      }
      expect(message).to.be.a('string');
    })
    it('should not show warning when runtime safety is off', function() {
      const env = new NodeEnvironment();
      env.runtimeSafety = false;
      const intStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Int32',
        byteSize: 4,
        hasPointer: false,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Int32',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]Int32',
        byteSize: 8,
        hasPointer: true,
      }, { runtimeSafety: false });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      try {
        env.finalizeShape(structure);
        env.finalizeStructure(structure);
        const { constructor: Int32SlicePtr } = structure;
        const origFn = console.warn;
        let message;
        try {
          console.warn = (msg) => message = msg;
          const ta = new Uint32Array([ 1, 2, 3, 4 ]);
          expect(() => new Int32SlicePtr(ta)).to.not.throw(TypeError);
        } finally {
          console.warn = origFn;
        }
        expect(message).to.be.undefined;
      } finally {
        process.env.NODE_ENV = before;
      }
    })
    it('should show no warning when target slice is not compatiable with any typed array', function() {
      const boolStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Bool',
        byteSize: 1,
        hasPointer: false,
      });
      env.attachMember(boolStructure, {
        type: MemberType.Bool,
        bitSize: 1,
        byteSize: 8,
      });
      env.finalizeShape(boolStructure);
      env.finalizeStructure(boolStructure);
      const { constructor: Bool } = boolStructure;
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Bool',
        byteSize: 1,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Bool,
        bitSize: 1,
        byteSize: 1,
        structure: boolStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: BoolSlice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]Bool',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: BoolSlicePtr } = structure;
      const origFn = console.warn;
      let message;
      try {
        console.warn = (msg) => message = msg;
        const ta = new Uint32Array([ 1, 2, 3, 4 ]);
        expect(() => new BoolSlicePtr(ta)).to.not.throw(TypeError);
      } finally {
        console.warn = origFn;
      }
      expect(message).to.be.undefined;
    })
    it('should automatically cast to slice from an array', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Int32',
        byteSize: 4,
        hasPointer: false,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Int32',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: Int32Slice } = sliceStructure;
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        name: '[8]Int32',
        length: 8,
        byteSize: 8 * 4,
        hasPointer: false,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.finalizeShape(arrayStructure);
      env.finalizeStructure(arrayStructure);
      const { constructor: Int32Array } = arrayStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtr } = structure;
      const array = new Int32Array([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      const pointer = new HelloPtr(array);
      expect(pointer['*']).to.be.instanceOf(Int32Slice);
      const dv = pointer['*'][MEMORY];
      expect(dv).to.equal(array[MEMORY]);
    })
    it('should allow casting of a buffer to a slice of u8', function() {
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u8',
        byteSize: 1,
        hasPointer: false,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
      });
      env.finalizeShape(uintStructure);
      env.finalizeStructure(uintStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: U8Slice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]u8',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8SlicePtr } = structure;
      const buffer = new ArrayBuffer(8);
      const dv = new DataView(buffer);
      for (let i = 0; i < dv.byteLength; i++) {
        dv.setUint8(i, i + 1);
      }
      const pointer = new U8SlicePtr(buffer);
      expect(pointer['*']).to.be.instanceOf(U8Slice);
      expect([ ...pointer ]).to.eql([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
    })
    it('should allow casting of a buffer to a slice of i8', function() {
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i8',
        byteSize: 1,
        hasPointer: false,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Int,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
      });
      env.finalizeShape(uintStructure);
      env.finalizeStructure(uintStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i8',
        byteSize: 1,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: I8Slice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]i8',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I8SlicePtr } = structure;
      const buffer = new ArrayBuffer(8);
      const dv = new DataView(buffer);
      for (let i = 0; i < dv.byteLength; i++) {
        dv.setUint8(i, i + 1);
      }
      const pointer = new I8SlicePtr(buffer);
      expect(pointer['*']).to.be.instanceOf(I8Slice);
      expect([ ...pointer ]).to.eql([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
    })

    it('should require explicit casting of a buffer to a slice of structs', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Hello',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: HelloSlice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtr } = structure;
      const buffer = new ArrayBuffer(8 * 3);
      const dv = new DataView(buffer);
      for (let i = 0, multiplier = 1; i < 3; i++, multiplier *= 10) {
        dv.setUint32(i * 8 + 0, 123 * multiplier, true);
        dv.setUint32(i * 8 + 4, 456 * multiplier, true);
      }
      expect(() => new HelloPtr(buffer)).to.throw(TypeError);
      const pointer = HelloPtr(buffer);
      expect(pointer['*']).to.be.instanceOf(HelloSlice);
      expect(pointer[0].valueOf()).to.eql({ cat: 123, dog: 456 });
      expect(pointer[1].valueOf()).to.eql({ cat: 1230, dog: 4560 });
      expect(pointer[2].valueOf()).to.eql({ cat: 12300, dog: 45600 });
      const pointer2 = new HelloPtr(HelloPtr.child(buffer));
      expect(pointer2['*']).to.be.instanceOf(HelloSlice);
      expect(pointer2[0].valueOf()).to.eql({ cat: 123, dog: 456 });
      expect(pointer2[1].valueOf()).to.eql({ cat: 1230, dog: 4560 });
      expect(pointer2[2].valueOf()).to.eql({ cat: 12300, dog: 45600 });
    })
    it('should automatically convert non-const pointer to const pointer', function() {
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u8',
        byteSize: 1,
        hasPointer: false,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
      });
      env.finalizeShape(uintStructure);
      env.finalizeStructure(uintStructure);
      const { constructor: U8 } = uintStructure;
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: U8Slice } = sliceStructure;
      const constStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]const u8',
        byteSize: 8,
        isConst: true,
        hasPointer: true,
      });
      env.attachMember(constStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(constStructure);
      env.finalizeStructure(constStructure);
      const { constructor: ConstU8SlicePtr } = constStructure;
      const nonConstStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]u8',
        byteSize: 8,
        isConst: false,
        hasPointer: true,
      });
      env.attachMember(nonConstStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(nonConstStructure);
      env.finalizeStructure(nonConstStructure);
      const { constructor: U8SlicePtr } = nonConstStructure;
      const buffer = new ArrayBuffer(8);
      const dv = new DataView(buffer);
      for (let i = 0; i < dv.byteLength; i++) {
        dv.setUint8(i, i + 1);
      }
      const nonConstPointer = new U8SlicePtr(buffer);
      const constPointer = ConstU8SlicePtr(nonConstPointer);
      expect(constPointer['*']).to.not.equal(nonConstPointer['*']);
      expect(constPointer['*']).to.equal(U8Slice(nonConstPointer['*'], { writable: false }));
      nonConstPointer[2] = 3;
      expect(() => nonConstPointer[2] = 3).to.not.throw();
      expect(() => constPointer[2] = 3).to.throw(TypeError);
      const constPointer2 = new ConstU8SlicePtr(nonConstPointer);
      expect(constPointer2['*']).to.equal(U8Slice(nonConstPointer['*'], { writable: false }));
    })
    it('should require explicit cast to convert const pointer to non-const pointer', function() {
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u8',
        byteSize: 1,
        hasPointer: false,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
      });
      env.finalizeShape(uintStructure);
      env.finalizeStructure(uintStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const constStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]const u8',
        byteSize: 8,
        isConst: true,
        hasPointer: true,
      });
      env.attachMember(constStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(constStructure);
      env.finalizeStructure(constStructure);
      const { constructor: ConstU8SlicePtr } = constStructure;
      const nonConstStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]u8',
        byteSize: 8,
        isConst: false,
        hasPointer: true,
      });
      env.attachMember(nonConstStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(nonConstStructure);
      env.finalizeStructure(nonConstStructure);
      const { constructor: U8SlicePtr } = nonConstStructure;
      const buffer = new ArrayBuffer(8);
      const dv = new DataView(buffer);
      for (let i = 0; i < dv.byteLength; i++) {
        dv.setUint8(i, i + 1);
      }
      const constPointer = new ConstU8SlicePtr(buffer);
      expect(() => new U8SlicePtr(constPointer)).to.throw(TypeError);
      const nonConstPointer = U8SlicePtr(constPointer);
      nonConstPointer[2] = 123;
      expect(constPointer[2]).to.equal(123);
    })
    it('should permit assignment and delete operations like regular objects', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
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
    it('should permit assignment to a const pointer', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        isConst: true,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      const int32 = new Int32(1234);
      const intPtr = new Int32Ptr(int32);
      expect(() => intPtr.$ = int32).to.not.throw();
    })
    it('should throw when garbage collected object is assigned to a pointer in fixed memory', function() {
      const env = new NodeEnvironment();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        isConst: true,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      env.allocateExternMemory = function(len, align) {
        return new ArrayBuffer(len);
      };
      env.extractBufferAddress = function(buffer) {
        return 0x1000n;
      };
      const dv = env.allocateFixedMemory(structure.byteSize, 0);
      const intPtr = Int32Ptr.call(ENVIRONMENT, dv);
      const int32 = new Int32(1234);
      expect(() => intPtr.$ = int32).to.throw(TypeError)
        .with.property('message').that.contains('garbage');
    })
    it('should throw when pointer to garbage collected object is assigned to a pointer in fixed memory', function() {
      const env = new NodeEnvironment();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.obtainFixedView = (address, len) => {
        return new DataView(new ArrayBuffer(4));
      };
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        isConst: true,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);     
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      env.allocateExternMemory = function(len, align) {
        return new ArrayBuffer(len);
      };
      env.extractBufferAddress = function(buffer) {
        return 0x1000n;
      };
      const dv = env.allocateFixedMemory(structure.byteSize, 0);
      const intPtr1 = Int32Ptr.call(ENVIRONMENT, dv);
      const int32 = new Int32(1234);
      const intPtr2 = new Int32Ptr(int32);
      expect(() => intPtr1.$ = intPtr2).to.throw(TypeError)
        .with.property('message').that.contains('garbage');
    })
    it('should immediately write to a pointer in fixed memory', function() {
      const env = new NodeEnvironment();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        isConst: true,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      env.allocateExternMemory = function(len, align) {
        return new ArrayBuffer(len);
      };
      let address = 0n;
      env.extractBufferAddress = function(buffer) {
        address += 1000n;
        return address;
      };
      const dv1 = env.allocateFixedMemory(intStructure.byteSize, 0);
      const dv2 = env.allocateFixedMemory(structure.byteSize, 0);
      const int32 = Int32.call(ENVIRONMENT, dv1);
      const intPtr = Int32Ptr.call(ENVIRONMENT, dv2);
      intPtr.$ = int32;
      expect(dv2.getBigUint64(0, true)).to.equal(1000n);
    })
    it('should immediately write to slice pointer in fixed memory', function() {
      const env = new NodeEnvironment();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Hello',
        byteSize: 8,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]Hello',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtr } = structure;
      env.allocateExternMemory = function(len, align) {
        return new ArrayBuffer(len);
      };
      let nextAddress = 1000n;
      const bufferAddresses = new Map();
      env.extractBufferAddress = function(buffer) {
        let address = bufferAddresses.get(buffer);
        if (address === undefined) {
          address = nextAddress;
          bufferAddresses.set(buffer, address);
          nextAddress += 1000n;
        }
        return address;
      };
      const dv1 = env.allocateFixedMemory(sliceStructure.byteSize * 4, 0);
      const dv2 = env.allocateFixedMemory(structure.byteSize, 0);
      const dv3 = env.allocateFixedMemory(structure.byteSize, 0);
      const target = HelloPtr.child(dv1);
      const pointer1 = HelloPtr.call(ENVIRONMENT, dv2);
      pointer1.$ = target;
      expect(dv2.getBigUint64(0, true)).to.equal(1000n);
      expect(dv2.getBigUint64(8, true)).to.equal(4n);
      const pointer2 = HelloPtr.call(ENVIRONMENT, dv3);
      pointer2.$ = pointer1;
      expect(dv3.getBigUint64(0, true)).to.equal(1000n);
      expect(dv3.getBigUint64(8, true)).to.equal(4n);
    })
    it('should be able to create read-only object', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      expect(Int32Ptr.child).to.equal(Int32);
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32, { writable: false });
      expect(() => intPointer.$ = int32).to.throw(TypeError);
    }) 
    it('should yield underlying pointer object', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      expect(Int32Ptr.child).to.equal(Int32);
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      const actualIntPointer = intPointer[POINTER_SELF];      
      expect(actualIntPointer).to.be.instanceOf(Int32Ptr);
    }) 
    it('should detect property of pointer object', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32Ptr } = structure;
      expect(Int32Ptr.child).to.equal(Int32);
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      expect('$' in intPointer).to.be.true;
    }) 
  })
})
