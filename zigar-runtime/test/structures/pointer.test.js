import { expect } from 'chai';
import {
  MemberFlag, MemberType, PointerFlag, SliceFlag, StructureFlag, StructureType,
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { InvalidSliceLength } from '../../src/errors.js';
import '../../src/mixins.js';
import {
  ADDRESS, ENVIRONMENT, INITIALIZE, LAST_ADDRESS, LAST_LENGTH, LENGTH, MEMORY, POINTER, TARGET,
  UPDATE, VISIT, ZIG,
} from '../../src/symbols.js';
import { defineValue, usizeInvalid } from '../../src/utils.js';
import { addressByteSize, addressSize, getUsize, setUsize, usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Structure: pointer', function() {
  describe('definePointer', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Pointer,
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      const env = new Env();
      const descriptors = {
        delete: defineValue(() => {}),
      };
      const constructor = env.definePointer(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Pointer,
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      const env = new Env();
      const descriptors = {
        delete: defineValue(() => {}),
      };
      env.definePointer(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
    })
  })
  describe('finalizePointer', function() {
    it('should add static descriptors to the given object', function() {
      const structure = {
        type: StructureType.Pointer,
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      const env = new Env();
      const descriptors = {};
      env.finalizePointer(structure, descriptors);
    })
  })
  describe('defineStructure', function() {
    it('should define a pointer for pointing to integers', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(structure);
      env.endStructure(structure);
      expect(Int32Ptr.child).to.equal(Int32);
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      expect(intPointer['*']).to.equal(1234);
      expect(intPointer.valueOf()).to.equal(1234);
      expect(Number(intPointer)).to.equal(1234);
      expect(String(intPointer)).to.equal('1234');
      expect(`${intPointer}`).to.equal('1234');
      expect(() => new Int32Ptr(null)).to.throw(TypeError);
    })
    it('should cast the same buffer to the same object', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(structure);
      env.endStructure(structure);
      const buffer = new ArrayBuffer(8);
      const object1 = Int32Ptr.call(ENVIRONMENT, buffer);
      const object2 = Int32Ptr.call(ENVIRONMENT, buffer);
      expect(object2).to.equal(object1);
    })
    it('should copy target when casting from writable to read-only', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(structure);
      env.endStructure(structure);
      const object1 = new Int32Ptr(new Int32(1234));
      expect(object1['*']).to.equal(1234);
      const object2 = Int32Ptr(object1, { writable: false });
      expect(object2['*']).to.equal(1234);
    })
    it('should throw when no initializer is provided', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Int32Ptr } = structure;
      expect(() => new Int32Ptr).to.throw(TypeError);
    })
    it('should throw when a null pointer is dereferenced', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Int32Ptr } = structure;
      expect(Int32Ptr.child).to.equal(Int32);
      const intPointer = new Int32Ptr(undefined);
      expect(() => intPointer['*']).to.throw('Null pointer');
      expect(() => intPointer['*'] = 123).to.throw('Null pointer');
    })
    it('should throw when element of array of null pointers is dereferenced', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Array,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[2]*Int32',
        byteSize: 16,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: ptrStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Int32PtrArray } = structure;
      const ptrArray = new Int32PtrArray(undefined);
      expect(() => ptrArray[0]['*']).to.throw('Null pointer');
    })
    it('should accept a target from a different module', function() {
      const envA = new Env();
      const envB = new Env();
      const intStructureA = envA.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        signature: 0xaaaan,
        byteSize: 4,
      });
      const intStructureB = envB.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        signature: 0xaaaan,
        byteSize: 4,
      });
      envA.attachMember(intStructureA, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructureA,
      });
      envB.attachMember(intStructureB, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructureB,
      });
      const Int32A = envA.defineStructure(intStructureA);
      const Int32B = envB.defineStructure(intStructureB);
      envA.endStructure(intStructureA);
      envB.endStructure(intStructureB);
      const structureA = envA.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      const structureB = envB.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      envA.attachMember(structureA, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructureA,
      });
      envB.attachMember(structureB, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructureB,
      });
      const Int32PtrA = envA.defineStructure(structureA);
      const Int32PtrB = envB.defineStructure(structureB);
      envA.endStructure(structureA);
      envB.endStructure(structureB);
      const int32A = new Int32A(123);
      const int32B = new Int32B(456);
      const int32PtrA = new Int32PtrA(int32A);
      const int32PtrB = new Int32PtrA(int32B);
      const ptr1 = new Int32PtrA(int32B);
      expect(ptr1['*']).to.equal(456);
      const ptr2 = new Int32PtrB(int32PtrA);
      expect(ptr2['*']).to.equal(123);
    })
    it('should define a pointer for pointing to functions', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 4,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        byteSize: 4 * 3,
        length: 2,
      });
      env.attachMember(argStructure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(argStructure);
      env.endStructure(argStructure);
      const fnStructure = env.beginStructure({
        type: StructureType.Function,
        byteSize: 0,
      });
      env.attachMember(fnStructure, {
        type: MemberType.Object,
        structure: argStructure,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(fnStructure, thunk, false);
      const jsThunkController = { [MEMORY]: zig(0x2004) };
      env.attachTemplate(fnStructure, jsThunkController, true);
      const Fn = env.defineStructure(fnStructure);
      env.endStructure(fnStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: fnStructure,
      });
      const FnPtr = env.defineStructure(structure);
      env.endStructure(structure);
      env.createJsThunk = function(...args) {
        return usize(0x100);
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      expect(FnPtr.child).to.equal(Fn);
      let argsReceived;
      const fn = (...args) => { argsReceived = args };
      const ptr = new FnPtr(fn);
      expect(() => ptr(123, 456)).to.not.throw();
      expect(argsReceived).to.eql([ 123, 456 ]);
    })
    it('should define a pointer for pointing to a structure', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
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
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: HelloPtr } = structure;
      const object1 = new Hello({ cat: 123, dog: 456 });
      const object2 = new Hello({ cat: 101, dog: 202 });
      const pointer = new HelloPtr(object1);
      pointer['*'] = object2;
      expect(pointer['*']).to.equal(object1);
      expect(object1.cat).to.equal(101);
    })
    it('should point to new object when no dereferencing occurred prior to assignment', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: HelloPtr } = structure;
      const object1 = new Hello({ cat: 123, dog: 456 });
      const object2 = new Hello({ cat: 101, dog: 202 });
      const pointer = new HelloPtr(object1);
      pointer.$ = object2;
      expect(pointer['*']).to.equal(object2);
      expect(object1.cat).to.equal(123);
    })
    it('should iterate through properties of target', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
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
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsConst,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 0,
        structure: structStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
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
    it('should handle const pointer correct when there is no target', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsConst | PointerFlag.IsNullable,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 0,
        structure: structStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: HelloPtr } = structure;
      const pointer = new HelloPtr(null);
      expect(pointer['*']).to.be.null;
    })
    it('should throw when read-only object is assigned to non-const pointer', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 0,
        structure: structStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: HelloPtr } = structure;
      const constStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsConst,
        byteSize: 4,
      });
      env.attachMember(constStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 0,
        structure: structStructure,
      });
      env.defineStructure(constStructure);
      env.endStructure(constStructure);
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
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const { constructor: HelloPtr } = ptrStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: HelloPtrPtr } = structure;
      const target = new Hello({ cat: 123, dog: 456 });
      const pointer = new HelloPtr(target);
      const ptrPointer = new HelloPtrPtr(pointer);
      expect(ptrPointer['*']).to.equal(pointer);
      expect(ptrPointer.cat).to.be.undefined;
      expect(ptrPointer.dog).to.be.undefined;
    })
    it('should have no setter when pointer is const', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsConst,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Int32Ptr } = structure;
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      expect(intPointer['*']).to.equal(1234);
      expect(() => intPointer['*'] = 4567).to.throw(TypeError);
    })
    it('should auto-vivificate target', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Int32Ptr } = structure;
      const ptr1 = new Int32Ptr(1234);
      expect(ptr1['*']).to.equal(1234);
      const ptr2 = new Int32Ptr(1234n);
      expect(ptr2['*']).to.equal(1234);
      const ptr3 = new Int32Ptr(new Int32(1234));
      expect(ptr3['*']).to.equal(1234);
    })
    it('should throw when initializer is a zig object', function() {
      const env = new Env();
      const boolStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'Bool',
        byteSize: 1,
      });
      env.attachMember(boolStructure, {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 0,
        byteSize: 1,
        structure: {},
      });
      env.defineStructure(boolStructure);
      env.endStructure(boolStructure);
      const { constructor: Bool } = boolStructure;
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Int32Ptr } = structure;
      // autovivification
      const ptr1 = new Int32Ptr(1234);
      const ptr2 = new Int32Ptr(ptr1);
      expect(ptr2['*']).to.equal(1234);
      const bool = new Bool(true);
      expect(() => new Int32Ptr(bool)).to.throw(TypeError);
    })
    it('should throw when attempting to cast a buffer to a pointer type', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Int32Ptr } = structure;
      const buffer = new ArrayBuffer(8);
      expect(() => Int32Ptr(buffer)).to.throw();
    })
    it('should automatically create slice object', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[_]Hello',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const { constructor: HelloSlice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]Hello',
        byteSize: 16,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
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
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 16,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const { constructor: Int32Slice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i32',
        byteSize: 16,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Int32Ptr } = structure;
      const ta = new Int32Array([ 1, 2, 3, 4 ]);
      const pointer = new Int32Ptr(ta);
      expect(pointer['*']).to.be.instanceOf(Int32Slice);
      const { buffer } = pointer['*'][MEMORY];
      expect(buffer).to.equal(ta.buffer);
    })
    it('should throw when given a typed array is of the incorrect type', function() {
      const env = new Env();
      env.runtimeSafety = true;
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 16,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i32',
        byteSize: 16,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Int32SlicePtr } = structure;
      const ta = new Uint32Array([ 1, 2, 3, 4 ]);
      expect(() => new Int32SlicePtr(ta)).to.throw(TypeError);
    })
    it('should automatically cast to slice from an array', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const { constructor: Int32Slice } = sliceStructure;
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        name: '[8]i32',
        length: 8,
        byteSize: 8 * 4,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(arrayStructure);
      env.endStructure(arrayStructure);
      const { constructor: Int32Array } = arrayStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i32',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: HelloPtr } = structure;
      const array = new Int32Array([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      const pointer = new HelloPtr(array);
      expect(pointer['*']).to.be.instanceOf(Int32Slice);
      const dv = pointer['*'][MEMORY];
      expect(dv).to.equal(array[MEMORY]);
    })
    it('should allow casting of a buffer to a slice of u8', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.endStructure(uintStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const { constructor: U8Slice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]u8',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: U8SlicePtr } = structure;
      const buffer = new ArrayBuffer(8);
      const dv = new DataView(buffer);
      for (let i = 0; i < dv.byteLength; i++) {
        dv.setUint8(i, i + 1);
      }
      const pointer = new U8SlicePtr(buffer);
      expect(pointer['*']).to.be.instanceOf(U8Slice);
      expect([ ...pointer ]).to.eql([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      const clampedArray = new Uint8ClampedArray([ 1, 2, 3, 4, 5, 6, 7 ]);
      const pointer2 = new U8SlicePtr(clampedArray);
      expect([ ...pointer2 ]).to.eql([ 1, 2, 3, 4, 5, 6, 7 ]);
    })
    it('should allow casting of a buffer to a slice of i8', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'i8',
        byteSize: 1,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i8',
        byteSize: 1,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 8,
        byteSize: 1,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const { constructor: I8Slice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i8',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const I8SlicePtr = env.defineStructure(structure);
      env.endStructure(structure);
      const buffer = new ArrayBuffer(8);
      const dv = new DataView(buffer);
      for (let i = 0; i < dv.byteLength; i++) {
        dv.setUint8(i, i + 1);
      }
      const pointer = new I8SlicePtr(buffer);
      expect(pointer['*']).to.be.instanceOf(I8Slice);
      expect([ ...pointer ]).to.eql([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
    })
    it('should correctly handle buffer from default allocator', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.endStructure(uintStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const { constructor: U8Slice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]u8',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const U8SlicePtr = env.defineStructure(structure);
      env.endStructure(structure);
      const buffer = new ArrayBuffer(16);
      const dv = env.obtainView(buffer, 0, 16);
      dv[ZIG] = { address: usize(0x1000), len: 16, js: true };
      const pointer = new U8SlicePtr(buffer);
      const targetDV = pointer['*'][MEMORY];
      expect(targetDV).to.equal(dv);
      expect(targetDV[ZIG]).to.be.undefined;
    })
    it('should require explicit casting of a buffer to a slice of structs', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.endStructure(uintStructure);
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: uintStructure,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: uintStructure,
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[_]Hello',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const { constructor: HelloSlice } = sliceStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]Hello',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = env.defineStructure(structure);
      env.endStructure(structure);
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
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.endStructure(uintStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const { constructor: U8Slice } = sliceStructure;
      const constStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength | PointerFlag.IsConst,
        name: '[]const u8',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(constStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const ConstU8SlicePtr = env.defineStructure(constStructure);
      env.endStructure(constStructure);
      const nonConstStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]u8',
        byteSize: 8,
      });
      env.attachMember(nonConstStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const U8SlicePtr = env.defineStructure(nonConstStructure);
      env.endStructure(nonConstStructure);
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
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.endStructure(uintStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const constStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength | PointerFlag.IsConst,
        name: '[]const u8',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(constStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const ConstU8SlicePtr = env.defineStructure(constStructure);
      env.endStructure(constStructure);
      const nonConstStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]u8',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(nonConstStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const U8SlicePtr = env.defineStructure(nonConstStructure);
      env.endStructure(nonConstStructure);
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
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Target',
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cow',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[_]Target',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 32,
        byteSize: 4,
        structure: structStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const constStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength | PointerFlag.IsConst,
        name: '[]const Target',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(constStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const ConstSlicePtr = env.defineStructure(constStructure);
      env.endStructure(constStructure);
      const buffer = new ArrayBuffer(4 * 4);
      const constPointer = ConstSlicePtr(buffer);
      const element = constPointer[0];
      expect(() => element.cow = 123).to.throw(TypeError);
    })
    it('should not make pointers in read-only target const', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Target',
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cow',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: structStructure,
      });
      const TargetPtr = env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const constStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsConst,
        byteSize: addressByteSize,
      });
      env.attachMember(constStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: ptrStructure,
      });
      const ConstPtrPtr = env.defineStructure(constStructure);
      env.endStructure(constStructure);
      const ptr = new TargetPtr({ cow: 1234 });
      const constPointer = new ConstPtrPtr(ptr);
      const ptrRO = constPointer['*'];
      // pointer is read-only so we can't set a new target
      expect(ptrRO).to.be.instanceOf(TargetPtr);
      expect(() => ptrRO.$ = new TargetPtr({ cow: 4567 })).to.throw(TypeError);
      // pointer is not const, however, so we can modify its target
      expect(() => ptrRO.cow = 123).to.not.throw();
      expect(ptrRO.cow).to.equal(123);
      const constPointer2 = ConstPtrPtr(constPointer);

    })
    it('should permit assignment and delete operations like regular objects', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: structStructure,
      });
      const HelloPtr = env.defineStructure(structure);
      env.endStructure(structure);
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
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsConst,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(structure);
      env.endStructure(structure);
      const int32 = new Int32(1234);
      const intPtr = new Int32Ptr(int32);
      expect(() => intPtr.$ = int32).to.not.throw();
    })
    it('should throw when garbage collected object is assigned to a pointer in Zig memory', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsConst,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(structure);
      env.endStructure(structure);
      env.allocateScratchMemory = function(len, align) {
        return usize(0x1000);
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      const dv = env.obtainZigView(usize(0x1000), structure.byteSize);
      const intPtr = Int32Ptr.call(ENVIRONMENT, dv);
      const int32 = new Int32(1234);
      expect(() => intPtr.$ = int32).to.throw(TypeError)
        .with.property('message').that.contains('garbage');
    })
    it('should throw when pointer to garbage collected object is assigned to a pointer in Zig memory', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsConst,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(structure);
      env.endStructure(structure);
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      const dv = env.obtainZigView(usize(0x1000), structure.byteSize);
      const intPtr1 = Int32Ptr.call(ENVIRONMENT, dv);
      const int32 = new Int32(1234);
      const intPtr2 = new Int32Ptr(int32);
      expect(() => intPtr1.$ = intPtr2).to.throw(TypeError)
        .with.property('message').that.contains('garbage');
    })
    it('should immediately write to a pointer in Zig memory', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsConst,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(structure);
      env.endStructure(structure);
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      const dv1 = env.obtainZigView(usize(0x1000), intStructure.byteSize);
      const dv2 = env.obtainZigView(usize(0x2000), structure.byteSize);
      const int32 = Int32.call(ENVIRONMENT, dv1);
      const intPtr = Int32Ptr.call(ENVIRONMENT, dv2);
      intPtr.$ = int32;
      expect(getUsize.call(dv2, 0, true)).to.equal(usize(0x1000));
    })
    it('should immediately write to slice pointer in Zig memory', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Hello',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]Hello',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = env.defineStructure(structure);
      env.endStructure(structure);
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      const dv1 = env.obtainZigView(usize(0x1000), sliceStructure.byteSize * 4);
      const dv2 = env.obtainZigView(usize(0x2000), structure.byteSize);
      const dv3 = env.obtainZigView(usize(0x3000), structure.byteSize);
      const target = HelloPtr.child(dv1);
      const pointer1 = HelloPtr.call(ENVIRONMENT, dv2);
      pointer1.$ = target;
      expect(getUsize.call(dv2, 0, true)).to.equal(usize(0x1000));
      expect(getUsize.call(dv2, addressByteSize, true)).to.equal(usize(4));
      const pointer2 = HelloPtr.call(ENVIRONMENT, dv3);
      pointer2.$ = pointer1;
      expect(getUsize.call(dv3, 0, true)).to.equal(usize(0x1000));
      expect(getUsize.call(dv3, addressByteSize, true)).to.equal(usize(4));
    })
    it('should yield underlying pointer object', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(structure);
      env.endStructure(structure);
      expect(Int32Ptr.child).to.equal(Int32);
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      const actualIntPointer = intPointer[POINTER];
      expect(actualIntPointer).to.be.instanceOf(Int32Ptr);
    })
    it('should detect property of pointer object', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(structure);
      env.endStructure(structure);
      expect(Int32Ptr.child).to.equal(Int32);
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      expect('$' in intPointer).to.be.true;
    })
    it('should get address of pointer from memory', function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else if (process.env.TARGET === 'node') {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(structure);
      env.endStructure(structure);
      const pointer = new Int32Ptr(new Int32(4));
      setUsize.call(pointer[MEMORY], 0, usize(0x1000), true);
      pointer[UPDATE]();
      const address = pointer[LAST_ADDRESS];
      expect(address).to.equal(usize(0x1000));
    })
    it('should write address of pointer into memory', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(structure);
      env.endStructure(structure);
      const pointer = new Int32Ptr(new Int32(4));
      pointer[ADDRESS] = usize(0x1000);
      expect(getUsize.call(pointer[MEMORY], 0, true)).to.equal(usize(0x1000));
    })
    it('should get address and length of slice pointer from memory', function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else if (process.env.TARGET === 'node') {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i32',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Int32SlicePtr } = structure;
      const ta = new Int32Array([ 1, 2, 3, 4 ]);
      const pointer = new Int32SlicePtr(ta);
      setUsize.call(pointer[MEMORY], 0, usize(0x1000), true);
      setUsize.call(pointer[MEMORY], addressByteSize, usize(4), true);
      pointer[UPDATE]();
      const address = pointer[LAST_ADDRESS];
      expect(address).to.equal(usize(0x1000));
    })
    it('should write address and length of slice pointer into memory', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i32',
        byteSize: 16,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Int32SlicePtr } = structure;
      const ta = new Int32Array([ 1, 2, 3, 4 ]);
      const pointer = new Int32SlicePtr(ta);
      pointer[ADDRESS] = 0x1000n;
      pointer[LENGTH] = 4;
      expect(pointer[MEMORY].getBigUint64(0, true)).to.equal(0x1000n);
      expect(pointer[MEMORY].getBigUint64(8, true)).to.equal(4n);
    })
    it('should get address and length of slice pointer with sentinel from memory', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.HasSentinel,
        name: '[_:0]Int32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        flags: MemberFlag.IsRequired | MemberFlag.IsSentinel,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachTemplate(sliceStructure, {
        [MEMORY]: new DataView(new ArrayBuffer(4)),
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple,
        name: '[*:0]Int32',
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32SlicePtr = env.defineStructure(structure);
      env.endStructure(structure);
      const ta = new Int32Array([ 1, 2, 3, 4, 0 ]);
      const pointer = new Int32SlicePtr(ta);
      pointer[ADDRESS] = usize(0x1000);
      pointer[LENGTH] = 5;
      setUsize.call(pointer[MEMORY], 0, usize(0x1000), true);
      let findSentinelCalled = false;
      env.findSentinel = function(address) {
        findSentinelCalled = true;
        return (address) ? 4 : -1;
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else if (process.env.TARGET === 'node') {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      pointer[UPDATE]();
      expect(findSentinelCalled).to.be.true;
      setUsize.call(pointer[MEMORY], 0, usize(0), true);
      pointer[UPDATE]();
      const address = pointer[LAST_ADDRESS];
      const length = pointer[LAST_LENGTH];
      expect(address).to.equal(usize(0));
      expect(length).to.equal(0);
    })
    it('should update target of zig-memory pointer on dereferencing', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i32',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: addressSize * 2,
        bitOffset: 0,
        byteSize: addressByteSize * 2,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: addressByteSize * 2,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        name: 'ptr',
        bitSize: addressSize * 2,
        bitOffset: 0,
        byteSize: addressByteSize * 2,
        slot: 0,
        structure: ptrStructure,
      });
      const Struct = env.defineStructure(structure);
      env.endStructure(structure);
      const viewMap = new Map(), addressMap = new Map();
      let nextAddress = usize(0x1000);
      const bufferMap = new Map();
      const allocator = {
        alloc(len, align) {
          const address = nextAddress;
          nextAddress += usize(0x1000);
          let dv;
          if (process.env.TARGET === 'wasm') {
            dv = new DataView(env.memory.buffer, address, len);
          } else {
            const buffer = new ArrayBuffer(len);
            buffer[ZIG] = { address, len };
            bufferMap.set(address, buffer);
            dv = new DataView(buffer);
          }
          dv[ZIG] = { address, len };
          viewMap.set(address, dv);
          addressMap.set(dv, address);
          return dv;
        },
        free(dv) {
        },
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          let buffer = bufferMap.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            bufferMap.set(address, buffer);
          }
          return buffer;
        };
      }
      const struct = new Struct({ ptr: [ 1, 2, 3, 4 ] }, { allocator });
      const pointer = struct.ptr;
      expect([ ...pointer ]).to.eql([ 1, 2, 3, 4 ]);
      const beforeDV = pointer['*'][MEMORY];
      const beforeAddress = beforeDV[ZIG].address;
      const afterDV = allocator.alloc(4 * 4, 4);
      const afterAddress = afterDV[ZIG].address;
      // put 4 '8' into afterDV
      for (let i = 0; i < afterDV.byteLength; i += 4) {
        afterDV.setInt32(i, 8, true);
      }
      setUsize.call(pointer[MEMORY], 0, afterAddress, true);
      setUsize.call(pointer[MEMORY], addressByteSize, usize(4), true);
      pointer['*'];
      expect([ ...pointer ]).to.eql([ 8, 8, 8, 8 ]);
      setUsize.call(pointer[MEMORY], 0, beforeAddress, true);
      setUsize.call(pointer[MEMORY], addressByteSize, usize(4), true);
      pointer['*'];
      expect([ ...pointer ]).to.eql([ 1, 2, 3, 4 ]);
      setUsize.call(pointer[MEMORY], addressByteSize, usize(3), true);
      pointer['*'];
      expect([ ...pointer ]).to.eql([ 1, 2, 3 ]);
    })
    it('should allow modification of the length of a slice pointer', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[_]Hello',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]Hello',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize * 2,
        bitOffset: 0,
        byteSize: addressByteSize * 2,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = env.defineStructure(structure);
      env.endStructure(structure);
      const pointer = new HelloPtr([ { cat: 123, dog: 456 }, { cat: 1230, dog: 4560 }, { cat: 12300, dog: 45600 } ]);
      const slice1 = pointer['*'];
      expect(slice1.length).to.equal(3);
      expect(() => slice1.length = 1).to.throw(TypeError);
      expect(() => pointer.length = 2).to.not.throw();
      expect(getUsize.call(pointer[MEMORY], addressByteSize, true)).to.equal(usize(2));
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
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[_]Hello',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      const HelloSlice = env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple,
        name: '[*]Hello',
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = env.defineStructure(structure);
      env.endStructure(structure);
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
    it('should allow modification of the length of a multi pointer in Zig memory', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Hello',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple,
        name: '[*]Hello',
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = env.defineStructure(structure);
      env.endStructure(structure);
      const viewMap = new Map(), addressMap = new Map();
      let nextAddress = usize(0x1000);
      const allocator = {
        alloc(len, align) {
          const address = nextAddress;
          nextAddress += usize(0x1000);
          let dv;
          if (process.env.TARGET === 'wasm') {
            dv = new DataView(env.memory.buffer, address, len);
          } else {
            const buffer = new ArrayBuffer(len);
            buffer[ZIG] = { address, len };
            dv = new DataView(buffer);
          }
          dv[ZIG] = { address, len };
          viewMap.set(address, dv);
          addressMap.set(dv, address);
          return dv;
        },
        free(dv) {
        },
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.obtainExternBuffer = function(address, len)  {
          return new ArrayBuffer(len);
        };
      }
      const pointer = new HelloPtr(5, { allocator });
      expect(() => pointer.length = 6).to.not.throw();
    })
    it('should allow anyopaque pointer to point at anything', function() {
      const env = new Env();
      const byteStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 1,
      });
      env.attachMember(byteStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: {},
      });
      const U8 = env.defineStructure(byteStructure);
      env.endStructure(byteStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: byteStructure,
      });
      const PtrU8 = env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsOpaque,
        byteSize: 1,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: byteStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = env.defineStructure(structure);
      env.endStructure(structure);
      const pointer = new HelloPtr(undefined);
      expect(() => pointer.$ = new DataView(new ArrayBuffer(8))).to.not.throw();
      expect(() => pointer.$ = new ArrayBuffer(8)).to.not.throw();
      expect(() => pointer.$ = new Float32Array(8)).to.not.throw();
      expect(() => pointer.$ = new U8(123)).to.not.throw();
      expect(() => pointer.$ = new PtrU8(123)).to.not.throw();
    })
    it('should allow C pointer to point at a single object', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const cpStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsMultiple | PointerFlag.IsNullable,
        name: '[*c]i32',
        byteSize: addressByteSize,
      });
      env.attachMember(cpStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32CPtr = env.defineStructure(cpStructure);
      env.endStructure(cpStructure);
      const int32 = new Int32(1234);
      const intCPointer = new Int32CPtr(int32);
      expect(intCPointer['*'][0]).to.equal(1234);
    })
    it('should allow C pointer to be initialized with a single pointer', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const spStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(spStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(spStructure);
      env.endStructure(spStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_c]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const cpStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsMultiple | PointerFlag.IsNullable,
        name: '[*c]i32',
        byteSize: addressByteSize,
      });
      env.attachMember(cpStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32CPtr = env.defineStructure(cpStructure);
      env.endStructure(cpStructure);
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      const intCPointer = new Int32CPtr(intPointer);
      expect(intCPointer['*'][0]).to.equal(1234);
    })
    it('should allow C pointer to be initialized with an object', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[_]Hello',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsMultiple | PointerFlag.IsNullable,
        name: '[*c]Hello',
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = env.defineStructure(structure);
      env.endStructure(structure);
      const pointer = new HelloPtr({ cat: 123, dog: 456 });
      expect(pointer[0].cat).to.equal(123);
      expect(pointer[0].dog).to.equal(456);
    })
    it('should allow C pointer to be initialized with an object containg a special prop', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'cat',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structStructure, {
        type: MemberType.Uint,
        name: 'dog',
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Hello',
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsMultiple | PointerFlag.IsNullable,
        name: '[*c]Hello',
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const HelloPtr = env.defineStructure(structure);
      env.endStructure(structure);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 123, true);
      dv.setUint32(4, 456, true);
      const pointer = new HelloPtr({ dataView: dv });
      expect(pointer[0].cat).to.equal(123);
      expect(pointer[0].dog).to.equal(456);
    })
    it('should allow C pointer to be cast from a single pointer', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const spStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(spStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(spStructure);
      env.endStructure(spStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const cpStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsMultiple | PointerFlag.IsNullable,
        name: '[*c]i32',
        byteSize: addressByteSize,
      });
      env.attachMember(cpStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32CPtr = env.defineStructure(cpStructure);
      env.endStructure(cpStructure);
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      const intCPointer = Int32CPtr(intPointer);
      expect(intCPointer['*'][0]).to.equal(1234);
      expect(intCPointer.length).to.equal(1);
    })
    it('should allow C pointer to be initialized with a slice pointer', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const spStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i32',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(spStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32SPtr = env.defineStructure(spStructure);
      env.endStructure(spStructure);
      const cpStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsMultiple | PointerFlag.IsNullable,
        name: '[*c]i32',
        byteSize: addressByteSize,
      });
      env.attachMember(cpStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32CPtr = env.defineStructure(cpStructure);
      env.endStructure(cpStructure);
      const intSPointer = new Int32SPtr([ 1, 2, 3, 4 ]);
      const intCPointer = new Int32CPtr(intSPointer);
      expect(intCPointer['*']).to.equal(intSPointer['*']);
      intCPointer.length = 3;
      expect([ ...intCPointer['*'] ]).to.eql([ 1, 2, 3 ]);
      expect(intSPointer.length).to.equal(4);
    })
    it('should allow C pointer to be cast from with a slice pointer', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const spStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i32',
        byteSize: 16,
      });
      env.attachMember(spStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32SPtr = env.defineStructure(spStructure);
      env.endStructure(spStructure);
      const cpStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsMultiple | PointerFlag.IsNullable,
        name: '[*c]i32',
        byteSize: addressByteSize,
      });
      env.attachMember(cpStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32CPtr = env.defineStructure(cpStructure);
      env.endStructure(cpStructure);
      const intSPointer = new Int32SPtr([ 1, 2, 3, 4 ]);
      const intCPointer = Int32CPtr(intSPointer);
      expect(intCPointer['*']).to.equal(intSPointer['*']);
      intCPointer.length = 3;
      expect([ ...intCPointer['*'] ]).to.eql([ 1, 2, 3 ]);
      expect(intSPointer.length).to.equal(4);
    })
    it('should allow C pointer to accept an array', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const spStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i32',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(spStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32SPtr = env.defineStructure(spStructure);
      env.endStructure(spStructure);
      const cpStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsMultiple | PointerFlag.IsNullable,
        name: '[*c]i32',
        byteSize: addressByteSize,
      });
      env.attachMember(cpStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32CPtr = env.defineStructure(cpStructure);
      env.endStructure(cpStructure);
      const intSPointer = new Int32SPtr([ 1, 2, 3, 4 ]);
      const intCPointer = Int32CPtr(intSPointer);
      expect(intCPointer['*']).to.equal(intSPointer['*']);
      intCPointer.length = 3;
      expect([ ...intCPointer['*'] ]).to.eql([ 1, 2, 3 ]);
      expect(intSPointer.length).to.equal(4);
    })
    it('should allow C pointer to be set to null', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const cpStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsMultiple | PointerFlag.IsNullable,
        name: '[*c]i32',
        byteSize: addressByteSize,
      });
      env.attachMember(cpStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32CPtr = env.defineStructure(cpStructure);
      env.endStructure(cpStructure);
      const intCPointer = new Int32CPtr(null);
      expect(intCPointer['*']).to.be.null;
      expect(intCPointer.length).to.equal(0);
      expect(() => intCPointer.length = 0).to.not.throw();
      expect(() => intCPointer.length = 3).to.throw(InvalidSliceLength);
    })
    it('should allow pointer with no sentinel to be initialized with a pointer that uses one', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const sliceStructureWS = env.beginStructure({
        type: StructureType.Slice,
        name: '[_:0]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructureWS, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(sliceStructureWS, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const template = {
        [MEMORY]: new DataView(new ArrayBuffer(4)),
      };
      env.attachTemplate(sliceStructureWS, template);
      env.defineStructure(sliceStructureWS);
      env.endStructure(sliceStructureWS);
      const spStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i32',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(spStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32SPtr = env.defineStructure(spStructure);
      env.endStructure(spStructure);
      const muStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple,
        name: '[*:0]i32',
        byteSize: addressByteSize,
      });
      env.attachMember(muStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructureWS,
      });
      const Int32MPtr = env.defineStructure(muStructure);
      env.endStructure(muStructure);
      const intMPointer = new Int32MPtr([ 1, 2, 3, 4 ]);
      const intSPointer = new Int32SPtr(intMPointer);
      expect(intSPointer.length).to.equal(4);
      expect([ ...intSPointer['*'] ]).to.eql([ ...intMPointer['*'] ]);
    })
    it('should immediately update a pointer in Zig memory', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: addressByteSize
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        name: 'ptr',
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: ptrStructure,
      });
      const Struct = env.defineStructure(structure);
      env.endStructure(structure);
      const viewMap = new Map(), addressMap = new Map();
      let nextAddress = usize(0x1000);
      const allocator = {
        alloc(len, align) {
          const address = nextAddress;
          nextAddress += usize(0x1000);
          let dv;
          if (process.env.TARGET === 'wasm') {
            dv = new DataView(env.memory.buffer, address, len);
          } else {
            const buffer = new ArrayBuffer(len);
            buffer[ZIG] = { address, len };
            dv = new DataView(buffer);
          }
          dv[ZIG] = { address, len };
          viewMap.set(address, dv);
          addressMap.set(dv, address);
          return dv;
        },
        free(dv) {
        },
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      expect(Int32Ptr.child).to.equal(Int32);
      const int1 = new Int32(1234, { allocator });
      const struct = new Struct({ ptr: int1 }, { allocator });
      const dv = struct[MEMORY];
      expect(getUsize.call(dv, 0, true)).to.equal(usize(0x1000));
      const int2 = new Int32(4567, { allocator });
      struct.ptr = int2;
      expect(getUsize.call(dv, 0, true)).to.equal(usize(0x3000));
    })
    it('should immediately update a slice pointer in Zig memory', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const spStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i32',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(spStructure, {
        type: MemberType.Object,
        bitSize: addressSize * 2,
        bitOffset: 0,
        byteSize: addressByteSize * 2,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32SPtr = env.defineStructure(spStructure);
      env.endStructure(spStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: addressByteSize * 2
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        name: 'ptr',
        bitSize: addressSize * 2,
        bitOffset: 0,
        byteSize: addressByteSize * 2,
        slot: 0,
        structure: spStructure,
      });
      const Struct = env.defineStructure(structure);
      env.endStructure(structure);
      const viewMap = new Map(), addressMap = new Map();
      let nextAddress = usize(0x1000);
      const allocator = {
        alloc(len, align) {
          const address = nextAddress;
          nextAddress += usize(0x1000);
          let dv;
          if (process.env.TARGET === 'wasm') {
            dv = new DataView(env.memory.buffer, address, len);
          } else {
            const buffer = new ArrayBuffer(len);
            buffer[ZIG] = { address, len };
            dv = new DataView(buffer);
          }
          dv[ZIG] = { address, len };
          viewMap.set(address, dv);
          addressMap.set(dv, address);
          return dv;
        },
        free(dv) {
        },
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const struct1 = new Struct({ ptr: [ 1, 2, 3, 4 ] }, { allocator });
      const struct2 = new Struct(undefined, { allocator });
      const dv = struct2[MEMORY];
      expect(getUsize.call(dv, 0, true)).to.equal(usize(0));
      expect(getUsize.call(dv, addressByteSize, true)).to.equal(usize(0));
      struct2.$ = struct1;
      expect(getUsize.call(dv, 0, true)).to.equal(usize(0x2000));
      expect(getUsize.call(dv, addressByteSize, true)).to.equal(usize(4));
      // can't actually set slice pointer to null, but there's code for that just in case
      struct2.ptr[TARGET] = null;
      expect(getUsize.call(dv, 0, true)).to.equal(usize(0));
      expect(getUsize.call(dv, addressByteSize, true)).to.equal(usize(0));
    })
    it('should immediately update a C pointer in Zig memory', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const cpStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsMultiple | PointerFlag.IsNullable,
        name: '[*c]i32',
        byteSize: addressByteSize,
      });
      env.attachMember(cpStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      const Int32CPtr = env.defineStructure(cpStructure);
      env.endStructure(cpStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: addressByteSize * 2
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        name: 'ptr',
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: cpStructure,
      });
      const Struct = env.defineStructure(structure);
      env.endStructure(structure);
      const viewMap = new Map(), addressMap = new Map();
      let nextAddress = usize(0x1000);
      const allocator = {
        alloc(len, align) {
          const address = nextAddress;
          nextAddress += usize(0x1000);
          let dv;
          if (process.env.TARGET === 'wasm') {
            dv = new DataView(env.memory.buffer, address, len);
          } else {
            const buffer = new ArrayBuffer(len);
            buffer[ZIG] = { address, len };
            dv = new DataView(buffer);
          }
          dv[ZIG] = { address, len };
          viewMap.set(address, dv);
          addressMap.set(dv, address);
          return dv;
        },
        free(dv) {
        },
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const struct1 = new Struct({ ptr: [ 1, 2, 3, 4 ] }, { allocator });
      const struct2 = new Struct(undefined, { allocator });
      const dv = struct2[MEMORY];
      expect(getUsize.call(dv, 0, true)).to.equal(usize(0));
      struct2.$ = struct1;
      expect(getUsize.call(dv, 0, true)).to.equal(usize(0x2000));
      struct2.ptr = null;
      expect(getUsize.call(dv, 0, true)).to.equal(usize(0));
    })
    it('should throw when given a previously freed object', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(structure);
      env.endStructure(structure);
      const dv = new DataView(new ArrayBuffer(4));
      dv[ZIG] = { address: usize(-1), len: 4 };
      const int32 = Int32(dv);
      expect(() => new Int32Ptr(int32)).to.throw(TypeError)
        .with.property('message').that.contains('freed').and.contains('u32');
    })
  })
  it('should should when visitor specified is unrecognized or invalid', function() {
    const env = new Env();
    const intStructure = env.beginStructure({
      type: StructureType.Primitive,
      flags: StructureFlag.HasValue,
      byteSize: 4,
    });
    env.attachMember(intStructure, {
      type: MemberType.Uint,
      bitSize: 32,
      bitOffset: 0,
      byteSize: 4,
      structure: intStructure,
    });
    const Int32 = env.defineStructure(intStructure);
    env.endStructure(intStructure);
    const structure = env.beginStructure({
      type: StructureType.Pointer,
      flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
      byteSize: 8,
    });
    env.attachMember(structure, {
      type: MemberType.Object,
      bitSize: 64,
      bitOffset: 0,
      byteSize: 8,
      slot: 0,
      structure: intStructure,
    });
    const Int32Ptr = env.defineStructure(structure);
    env.endStructure(structure);
    expect(Int32Ptr.child).to.equal(Int32);
    const int32 = new Int32(1234);
    const intPointer = new Int32Ptr(int32);
    expect(() => intPointer[VISIT]('reset')).to.not.throw();
    expect(() => intPointer[VISIT]('evil')).to.throw();
    expect(() => intPointer[VISIT](1234)).to.throw();
  })
})

function zig(address, len = 0) {
  const dv = new DataView(new ArrayBuffer(len));
  dv[ZIG] = { address: usize(address), len };
  return dv;
}
