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
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';
import { getMemoryCopier } from '../src/memory.js';
import { MEMORY, SLOTS, SOURCE } from '../src/symbol.js';

describe('Pointer functions', function() {
  describe('finalizePointer', function() {
    beforeEach(function() {
      useIntEx();
      useObject();
      useStruct();
      usePrimitive();
      usePointer();
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
      const PInt32 = finalizeStructure(structure);
      const int32 = new Int32(1234);
      const intPointer = new PInt32(int32);
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
  })
})
