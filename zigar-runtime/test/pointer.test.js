import { expect } from 'chai';

import { useAllExtendedTypes } from '../src/data-view.js';
import { NodeEnvironment } from '../src/environment-node.js';
import { InvalidSliceLength } from '../src/error.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import { ADDRESS, ADDRESS_SETTER, ENVIRONMENT, LENGTH, LENGTH_SETTER, MEMORY, POINTER, TARGET_UPDATER, WRITE_DISABLER } from '../src/symbol.js';
import { MemberType, StructureType } from '../src/types.js';

describe('Pointer functions', function() {
  const env = new NodeEnvironment();
  beforeEach(function() {
    useAllMemberTypes();
    useAllStructureTypes();
    useAllExtendedTypes();
  })
  describe('definePointer', function() {
    it('should define a pointer for pointing to integers', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        type: StructureType.SinglePointer,
        name: '*i32',
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
      expect(Number(intPointer)).to.equal(1234);
      expect(String(intPointer)).to.equal('1234');
      expect(`${intPointer}`).to.equal('1234');
      expect(() => intPointer.delete()).to.not.throw();
    })
    it('should cast the same buffer to the same object', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
      const structure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*i32',
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
    it('should copy target when casting from writable to read-only', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
      const structure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*i32',
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
      const { constructor: Int32 } = intStructure;
      const object1 = new Int32Ptr(new Int32(1234));
      expect(object1['*']).to.equal(1234);
      const object2 = Int32Ptr(object1, { writable: false });
      expect(object2['*']).to.equal(1234);
    })
    it('should throw when no initializer is provided', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
      const structure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*i32',
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
    it('should throw when a null pointer is dereferenced', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        type: StructureType.SinglePointer,
        name: '*i32',
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
      const intPointer = new Int32Ptr(undefined);
      expect(() => intPointer['*']).to.throw('Null pointer');
      expect(() => intPointer['*'] = 123).to.throw('Null pointer');
    })
    it('should throw when element of array of null pointers is dereferenced', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
      const ptrStructure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*i32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[2]*Int32',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: ptrStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32PtrArray } = structure;
      const ptrArray = new Int32PtrArray(undefined);
      expect(() => ptrArray[0]['*']).to.throw('Null pointer');
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
        type: StructureType.SinglePointer,
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
      expect('cat' in pointer).to.be.true;
      expect('cow' in pointer).to.be.false;
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
        type: StructureType.SinglePointer,
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
        type: StructureType.SinglePointer,
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
        type: StructureType.SinglePointer,
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
    it('should prevent modification of target when pointer is const', function() {
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
        type: StructureType.SinglePointer,
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
      expect(() => pointer['*'] = { cat: 111, dog: 222 }).to.throw(TypeError)
        .with.property('message').that.contains('read-only');
      const target = pointer['*'];
      expect(target).to.not.equal(object);
      expect(() => target.cat = 999).to.throw(TypeError);
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
        type: StructureType.SinglePointer,
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
      const constStructure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*Hello',
        byteSize: 4,
        isConst: true,
        hasPointer: true,
      });
      env.attachMember(constStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 0,
        structure: structStructure,
      });
      env.finalizeShape(constStructure);
      env.finalizeStructure(constStructure);
      const { constructor: HelloConstPtr } = constStructure;
      const constPointer = new HelloConstPtr({ cat: 123, dog: 456 });
      const constTarget = constPointer['*'];
      expect(() => new HelloPtr(constTarget)).to.throw(TypeError)
        .with.property('message').that.contains('read-only');
      const nonconstPointer = HelloPtr(constPointer);
      const nonconstTarget = nonconstPointer['*'];
      expect(() => new HelloPtr(nonconstTarget)).to.not.throw();
      expect(() => nonconstTarget.cat = 777).to.not.throw();
      expect(() => nonconstPointer.cat = 777).to.not.throw();
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
        type: StructureType.SinglePointer,
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
        type: StructureType.SinglePointer,
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
        name: 'i32',
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
        type: StructureType.SinglePointer,
        name: '*i32',
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
    it('should auto-vivificate target', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        type: StructureType.SinglePointer,
        name: '*i32',
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
      const ptr1 = new Int32Ptr(1234);
      expect(ptr1['*']).to.equal(1234);
      const ptr2 = new Int32Ptr(1234n);
      expect(ptr2['*']).to.equal(1234);
      const ptr3 = new Int32Ptr(new Int32(1234));
      expect(ptr3['*']).to.equal(1234);
    })
    it('should throw when initializer is a zig object', function() {
      const boolStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Bool',
        byteSize: 1,
      });
      env.attachMember(boolStructure, {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 0,
        byteSize: 1,
      });
      env.finalizeShape(boolStructure);
      env.finalizeStructure(boolStructure);
      const { constructor: Bool } = boolStructure;
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        type: StructureType.SinglePointer,
        name: '*i32',
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
      // autovivification
      const ptr1 = new Int32Ptr(1234);
      const ptr2 = new Int32Ptr(ptr1);
      expect(ptr2['*']).to.equal(1234);
      const bool = new Bool(true);
      expect(() => new Int32Ptr(bool)).to.throw(TypeError);
    })
    it('should throw when attempting to cast a buffer to a pointer type', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
      const structure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*i32',
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
        type: StructureType.SlicePointer,
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
      const pointer2 = pointer.subarray();
      expect(pointer2).to.not.equal(pointer);
      expect(pointer2['*']).to.equal(pointer['*']);
      const pointer3 = pointer.subarray(1, -1);
      expect(pointer3.length).to.equal(1);
      expect(pointer3.valueOf()).to.eql([ { cat: 1230, dog: 4560 } ]);
      pointer3[0] = { cat: 777, dog: 888 };
      expect(pointer[1].valueOf()).to.eql({ cat: 777, dog: 888 });
      const pointer4 = pointer.slice();
      pointer4[0] = { cat: 1, dog: 2 };
      expect(pointer4.valueOf()).to.eql([ { cat: 1, dog: 2 }, { cat: 777, dog: 888 }, { cat: 12300, dog: 45600 } ])
      expect(pointer.valueOf()).to.eql([ { cat: 123, dog: 456 }, { cat: 777, dog: 888 }, { cat: 12300, dog: 45600 } ])
    })
    it('should automatically cast to slice from typed array', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        name: '[_]i32',
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
        type: StructureType.SlicePointer,
        name: '[]i32',
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
      const { constructor: Int32Ptr } = structure;
      const ta = new Int32Array([ 1, 2, 3, 4 ]);
      const pointer = new Int32Ptr(ta);
      expect(pointer['*']).to.be.instanceOf(Int32Slice);
      const { buffer } = pointer['*'][MEMORY];
      expect(buffer).to.equal(ta.buffer);
    })
    it('should show a warning when given a typed array is of the incorrect type', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        name: '[_]i32',
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
      const structure = env.beginStructure({
        type: StructureType.SlicePointer,
        name: '[]i32',
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
        name: 'i32',
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
        name: '[_]i32',
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
        type: StructureType.SlicePointer,
        name: '[]i32',
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
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]bool',
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
      const structure = env.beginStructure({
        type: StructureType.SlicePointer,
        name: '[]bool',
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
        name: 'i32',
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
        name: '[_]i32',
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
        name: '[8]i32',
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
        type: StructureType.SlicePointer,
        name: '[]i32',
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
        type: StructureType.SlicePointer,
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
        type: StructureType.SlicePointer,
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
        type: StructureType.SlicePointer,
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
        type: StructureType.SlicePointer,
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
        type: StructureType.SlicePointer,
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
      nonConstPointer[2] = 3;
      Object.keys(constPointer['*']);
      expect(() => nonConstPointer[2] = 3).to.not.throw();
      expect(() => constPointer[2] = 3).to.throw(TypeError);
      const constPointer2 = new ConstU8SlicePtr(nonConstPointer);
      expect(constPointer2['*']).to.equal(constPointer['*']);
      const constPointer3 = new ConstU8SlicePtr(constPointer['*']);
      expect(constPointer3['*']).to.equal(constPointer['*']);
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
        type: StructureType.SlicePointer,
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
        type: StructureType.SlicePointer,
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
    it('should return read-only target when pointer is const', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Target',
        byteSize: 4,
        hasPointer: false,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cow',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Target',
        byteSize: 4,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 32,
        byteSize: 4,
        structure: structStructure,
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const constStructure = env.beginStructure({
        type: StructureType.SlicePointer,
        name: '[]const Target',
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
      const { constructor: ConstSlicePtr } = constStructure;
      const buffer = new ArrayBuffer(4 * 4);
      const constPointer = ConstSlicePtr(buffer);
      const element = constPointer[0];
      expect(() => element.cow = 123).to.throw(TypeError);
    })
    it('should not make pointers in read-only target const', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Target',
        byteSize: 4,
        hasPointer: false,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cow',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*Target',
        byteSize: 8,
        isConst: false,
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
      const { constructor: TargetPtr } = ptrStructure;
      const constStructure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*const *Target',
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
        structure: ptrStructure,
      });
      env.finalizeShape(constStructure);
      env.finalizeStructure(constStructure);
      const { constructor: ConstPtrPtr } = constStructure;
      const ptr = new TargetPtr({ cow: 1234 });
      const constPointer = new ConstPtrPtr(ptr);
      const ptrRO = constPointer['*'];
      // pointer is read-only so we can't set a new target
      expect(ptrRO).to.be.instanceOf(TargetPtr);
      expect(() => ptrRO.$ = 123).to.throw(TypeError);
      // pointer is not const, however, so we can modify its target
      expect(() => ptrRO.cow = 123).to.not.throw();
      expect(ptrRO.cow).to.equal(123);
      const constPointer2 = ConstPtrPtr(constPointer);

    })
    it('should permit assignment and delete operations like regular objects', function() {
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
        type: StructureType.SinglePointer,
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
      const hello = new Hello({ cat: 1, dog: 2 });
      const helloPtr = new HelloPtr(hello);
      helloPtr.world = "World";
      expect(helloPtr.world).to.equal("World");
      expect(hello.world).to.equal("World");
      delete helloPtr.hello;
      expect(helloPtr.hello).to.be.undefined;
      expect(hello.hello).to.be.undefined;
      expect(() => delete helloPtr.$).to.not.throw();
      expect(() => delete helloPtr['*']).to.not.throw();
    })
    it('should permit assignment to a const pointer', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        type: StructureType.SinglePointer,
        name: '*i32',
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
        name: 'i32',
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
        type: StructureType.SinglePointer,
        name: '*i32',
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
        return 0x1000n;
      };
      env.obtainExternBuffer = function(address, len) {
        return new ArrayBuffer(len);
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
        name: 'i32',
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
        type: StructureType.SinglePointer,
        name: '*i32',
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
        return 0x1000n;
      };
      env.obtainExternBuffer = function(address, len) {
        return new ArrayBuffer(len);
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
        name: 'i32',
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
        type: StructureType.SinglePointer,
        name: '*i32',
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
      let address = 0n;
      env.allocateExternMemory = function(len, align) {
        address += 1000n;
        return address;
      };
      env.obtainExternBuffer = function(address, len) {
        return new ArrayBuffer(len);
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
        type: StructureType.SlicePointer,
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
      let nextAddress = 1000n;
      const bufferMap = new Map();
      const addressMap = new Map();
      env.allocateExternMemory = function(len, align) {
        const address = nextAddress;
        nextAddress += 1000n;
        const buffer = new ArrayBuffer(len);
        bufferMap.set(address, buffer);
        addressMap.set(buffer, address);
        return address;
      };
      env.obtainExternBuffer = function(address, len) {
        return bufferMap.get(address);
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
    it('should yield underlying pointer object', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        type: StructureType.SinglePointer,
        name: '*i32',
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
      const actualIntPointer = intPointer[POINTER];
      expect(actualIntPointer).to.be.instanceOf(Int32Ptr);
    })
    it('should detect property of pointer object', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        type: StructureType.SinglePointer,
        name: '*i32',
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
    it('should get address of pointer from memory', function() {
      const env = new NodeEnvironment();
      env.obtainExternBuffer = function(address, len) {
        return new ArrayBuffer(len);
      };
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
        hasPointer: false,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*i32',
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
      const pointer = new Int32Ptr(new Int32(4));
      pointer[MEMORY].setBigUint64(0, 0x1000n, true);
      pointer[TARGET_UPDATER]();
      const address = pointer[ADDRESS];
      expect(address).to.equal(0x1000n);
    })
    it('should write address of pointer into memory', function() {
      const env = new NodeEnvironment();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
        hasPointer: false,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*i32',
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
      const pointer = new Int32Ptr(new Int32(4));
      pointer[ADDRESS_SETTER](0x1000n);
      expect(pointer[MEMORY].getBigUint64(0, true)).to.equal(0x1000n);
    })
    it('should get address and length of slice pointer from memory', function() {
      const env = new NodeEnvironment();
      env.obtainExternBuffer = function(address, len) {
        return new ArrayBuffer(len);
      };
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        name: '[_]i32',
        byteSize: 4,
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
        type: StructureType.SlicePointer,
        name: '[]i32',
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
      const ta = new Int32Array([ 1, 2, 3, 4 ]);
      const pointer = new Int32SlicePtr(ta);
      pointer[MEMORY].setBigUint64(0, 0x1000n, true);
      pointer[MEMORY].setBigUint64(8, 4n, true);
      pointer[TARGET_UPDATER]();
      const address = pointer[ADDRESS];
      expect(address).to.equal(0x1000n);
    })
    it('should write address and length of slice pointer into memory', function() {
      const env = new NodeEnvironment();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
        hasPointer: false,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
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
        type: StructureType.SlicePointer,
        name: '[]i32',
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
      const ta = new Int32Array([ 1, 2, 3, 4 ]);
      const pointer = new Int32SlicePtr(ta);
      pointer[ADDRESS_SETTER](0x1000n);
      pointer[LENGTH_SETTER](4);
      expect(pointer[MEMORY].getBigUint64(0, true)).to.equal(0x1000n);
      expect(pointer[MEMORY].getBigUint64(8, true)).to.equal(4n);
    })
    it('should get address and length of slice pointer with sentinel from memory', function() {
      const env = new NodeEnvironment();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        name: '[_:0]Int32',
        byteSize: 4,
        hasPointer: false,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachTemplate(sliceStructure, {
        [MEMORY]: new DataView(new ArrayBuffer(4)),
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.MultiPointer,
        name: '[*:0]Int32',
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
      const ta = new Int32Array([ 1, 2, 3, 4, 0 ]);
      const pointer = new Int32SlicePtr(ta);
      pointer[ADDRESS] = 0x1000n;
      pointer[LENGTH] = 5;
      pointer[MEMORY].setBigUint64(0, 0x1000n, true);
      let findSentinelCalled = false;
      env.findSentinel = function(address) {
        findSentinelCalled = true;
        return (address) ? 4 : -1;
      }
      pointer[TARGET_UPDATER]();
      expect(findSentinelCalled).to.be.true;
      pointer[MEMORY].setBigUint64(0, 0n, true);
      pointer[TARGET_UPDATER]();
      const address = pointer[ADDRESS];
      const length = pointer[LENGTH];
      expect(address).to.equal(0n);
      expect(length).to.equal(0);
    })
    it('should update target of fixed-memory pointer on dereferencing', function() {
      const env = new NodeEnvironment();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        name: '[_]i32',
        byteSize: 4,
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
        type: StructureType.SlicePointer,
        name: '[]i32',
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
      const bufferMap = new Map();
      const addressMap = new Map();
      let nextAddress = 0x1000n;
      env.allocateExternMemory = function(len, align) {
        const address = nextAddress;
        nextAddress += 0x1000n;
        const buffer = new ArrayBuffer(len);
        bufferMap.set(address, buffer);
        addressMap.set(buffer, address);
        return address;
      };
      env.extractBufferAddress = function(buffer) {
        return addressMap.get(buffer);
      };
      env.obtainExternBuffer = function(address, len) {
        let buffer = bufferMap.get(address);
        if (!buffer && address === 0x30000n) {
          buffer = new ArrayBuffer(len);
          // fill with byte value 8
          const dv = new DataView(buffer);
          for (let i = 0; i < dv.byteLength; i += 4) {
            dv.setInt32(i, 8, true);
          }
          bufferMap.set(address, buffer);
          addressMap.set(buffer, address);
        }
        return buffer;
      }
      const pointer = new Int32SlicePtr([ 1, 2, 3, 4 ], { fixed: true });
      expect([ ...pointer ]).to.eql([ 1, 2, 3, 4 ]);
      pointer[MEMORY].setBigUint64(0, 0x30000n, true);
      pointer[MEMORY].setBigUint64(8, 4n, true);
      pointer['*'];
      expect([ ...pointer ]).to.eql([ 8, 8, 8, 8 ]);
      pointer[MEMORY].setBigUint64(0, 0x2000n, true);
      pointer[MEMORY].setBigUint64(8, 4n, true);
      pointer['*'];
      expect([ ...pointer ]).to.eql([ 1, 2, 3, 4 ]);
      pointer[MEMORY].setBigUint64(8, 3n, true);
      pointer['*'];
      expect([ ...pointer ]).to.eql([ 1, 2, 3 ]);
    })
    it('should allow modification of the length of a slice pointer', function() {
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
        type: StructureType.SlicePointer,
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
      const slice1 = pointer['*'];
      expect(slice1.length).to.equal(3);
      expect(() => slice1.length = 1).to.throw(TypeError);
      expect(() => pointer.length = 2).to.not.throw();
      expect(pointer[MEMORY].getBigUint64(8, true)).to.equal(2n);
      expect(slice1.length).to.equal(3);
      const slice2 = pointer['*'];
      expect(slice2.length).to.equal(2);
      expect(slice2.valueOf()).to.eql([ { cat: 123, dog: 456 }, { cat: 1230, dog: 4560 } ]);
      expect(() => pointer.length = 4).to.throw(InvalidSliceLength);
      expect(() => pointer.length = -1).to.throw(InvalidSliceLength);
      expect(() => pointer.length = 0).to.not.throw();
      const slice3 = pointer['*'];
      expect(slice3.valueOf()).to.eql([]);
      expect(() => pointer.length = 3).to.not.throw();
      const slice4 = pointer['*'];
      expect(slice4.valueOf()).to.eql([ { cat: 123, dog: 456 }, { cat: 1230, dog: 4560 }, { cat: 12300, dog: 45600 } ]);
      expect(slice4).to.equal(slice1);
    })
    it('should allow modification of the length of a multi pointer', function() {
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
      const { constructor: HelloSlice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.MultiPointer,
        name: '[*]Hello',
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
      const buffer = new ArrayBuffer(8 * 5);
      const dv1 = new DataView(buffer);
      for (let i = 1, j = 0; i <= 5; i++, j += 8) {
        dv1.setUint32(j, i, true);
        dv1.setUint32(j + 4, i * 10, true);
      }
      const dv2 = new DataView(buffer, 0, 8 * 3);
      const pointer = new HelloPtr(HelloSlice(dv2));
      const slice1 = pointer['*'];
      expect(slice1.length).to.equal(3);
      expect(slice1.valueOf()).to.eql([ { cat: 1, dog: 10 }, { cat: 2, dog: 20 }, { cat: 3, dog: 30 } ]);
      expect(() => slice1.length = 1).to.throw(TypeError);
      pointer.length = 2;
      expect(() => pointer.length = 2).to.not.throw();
      expect(slice1.length).to.equal(3);
      const slice2 = pointer['*'];
      expect(slice2.length).to.equal(2);
      expect(slice2.valueOf()).to.eql([ { cat: 1, dog: 10 }, { cat: 2, dog: 20 } ]);
      expect(() => pointer.length = 4).to.not.throw();
      const slice3 = pointer['*'];
      expect(slice3.valueOf()).to.eql([ { cat: 1, dog: 10 }, { cat: 2, dog: 20 }, { cat: 3, dog: 30 }, { cat: 4, dog: 40 } ]);
      expect(() => pointer.length = 6).to.throw(InvalidSliceLength);
      expect(() => pointer.length = -1).to.throw(InvalidSliceLength);
      expect(() => pointer.length = 0).to.not.throw();
      const slice4 = pointer['*'];
      expect(slice4.valueOf()).to.eql([]);
      pointer.length = 3;
      expect(() => pointer.length = 3).to.not.throw();
      const slice5 = pointer['*'];
      expect(slice5.valueOf()).to.eql([ { cat: 1, dog: 10 }, { cat: 2, dog: 20 }, { cat: 3, dog: 30 } ]);
      expect(slice5).to.equal(slice1);
    })
  })
  describe('makePointerReadOnly', function() {
    it('should make pointer read-only', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        type: StructureType.SinglePointer,
        name: '*i32',
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
      const pointer = new Int32Ptr(1234);
      pointer[WRITE_DISABLER]();
      expect(() => pointer['*'] = 5).to.not.throw(TypeError);
      expect(() => pointer.$ = 123).to.throw(TypeError);
    })
  })
})
