import { expect } from 'chai';
import {
    MemberType, PointerFlag, StructureFlag, StructureType, UnionFlag,
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { MEMORY, SLOTS } from '../../src/symbols.js';
import { usize } from '../../src/utils.js';
import { addressByteSize, addressSize, getUsize, setUsize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: pointer-synchronization', function() {
  describe('updatePointerAddresses', function() {
    it('should update pointer addresses', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
        align: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.finishStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*i32',
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
      env.defineStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'ArgStruct',
        byteSize: addressByteSize * 4,
        length: 4,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Void,
        bitOffset: 0,
        bitSize: 0,
        byteSize: 0,
        structure: {},
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        bitOffset: addressSize * 0,
        bitSize: addressSize,
        byteSize: addressByteSize,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Object,
        bitOffset: addressSize * 1,
        bitSize: addressSize,
        byteSize: addressByteSize,
        slot: 1,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: '2',
        type: MemberType.Object,
        bitOffset: addressSize * 2,
        bitSize: addressSize,
        byteSize: addressByteSize,
        slot: 2,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: '3',
        type: MemberType.Object,
        bitOffset: addressSize * 3,
        bitSize: addressSize,
        byteSize: addressByteSize,
        slot: 3,
        structure: ptrStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.finishStructure(structure);
      const object1 = new Int32(123);
      const object2 = new Int32(123);
      const args = new ArgStruct([ object1, object2, object1, object1 ]);
      env.getTargetAddress = function(context, target, cluster, writable) {
        // treat object1 as misaligned
        if (cluster) {
          return env.getShadowAddress(context, target, cluster, writable);
        } else {
          return usize(0x1000);
        }
      };
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function(buffer) {
        return usize(0x2000);
      };
      const context = env.startContext();
      env.updatePointerAddresses(context, args);
      expect(getUsize.call(args[0][MEMORY], 0, true)).to.equal(usize(0x2000));
      expect(getUsize.call(args[1][MEMORY], 0, true)).to.equal(usize(0x1000));
      expect(getUsize.call(args[2][MEMORY], 0, true)).to.equal(usize(0x2000));
      expect(getUsize.call(args[3][MEMORY], 0, true)).to.equal(usize(0x2000));
    })
    it('should update pointer addresses when multiple objects point to the same buffer', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
        align: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.finishStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*i32',
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
      env.defineStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'ArgStruct',
        byteSize: addressByteSize * 4,
        length: 4,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Void,
        bitOffset: 0,
        bitSize: 0,
        byteSize: 0,
        structure: {},
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        bitOffset: addressSize * 0,
        bitSize: addressSize,
        byteSize: addressByteSize,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Object,
        bitOffset: addressSize * 1,
        bitSize: addressSize,
        byteSize: addressByteSize,
        slot: 1,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: '2',
        type: MemberType.Object,
        bitOffset: addressSize * 2,
        bitSize: addressSize,
        byteSize: addressByteSize,
        slot: 2,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: '3',
        type: MemberType.Object,
        bitOffset: addressSize * 3,
        bitSize: addressSize,
        byteSize: addressByteSize,
        slot: 3,
        structure: ptrStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.finishStructure(structure);
      const buffer = new ArrayBuffer(16);
      const object1 = Int32(new DataView(buffer, 0, 4));
      const object2 = Int32(new DataView(buffer, 4, 4));
      const object3 = Int32(new DataView(buffer, 8, 4));
      const object4 = Int32(new DataView(buffer, 12, 4));
      const args = new ArgStruct([ object1, object2, object3, object4 ]);
      let nextFixedAddress = usize(0xf_1000);
      env.getTargetAddress = function(context, target, cluster) {
        const address = nextFixedAddress;
        nextFixedAddress += usize(0x1000);
        return address;
      };
      const context = env.startContext();
      env.updatePointerAddresses(context, args);
      expect(getUsize.call(args[0][MEMORY], 0, true)).to.equal(usize(0xf_1000));
      expect(getUsize.call(args[1][MEMORY], 0, true)).to.equal(usize(0xf_2000));
      expect(getUsize.call(args[2][MEMORY], 0, true)).to.equal(usize(0xf_3000));
      expect(getUsize.call(args[3][MEMORY], 0, true)).to.equal(usize(0xf_4000));
    })
    it('should be able to handle self-referencing structures', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: 12,
      });
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*Hello',
        byteSize: 8,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure,
      });
      env.defineStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const optionalStructure = env.beginStructure({
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasValue,
        name: '?*Hello',
        byteSize: 8,
      });
      env.attachMember(optionalStructure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(optionalStructure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.defineStructure(optionalStructure);
      env.finishStructure(optionalStructure);
      env.attachMember(structure, {
        name: 'sibling',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: optionalStructure,
      });
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
      env.finishStructure(intStructure);
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Hello = env.defineStructure(structure);
      env.finishStructure(structure);
      const object1 = new Hello({ sibling: null });
      const object2 = new Hello({ sibling: object1 });
      const object3 = new Hello({ sibling: object2 });
      object1.sibling = object3;
      expect(object3.sibling['*']).to.equal(object2);
      expect(object3.sibling['*'].sibling['*']).to.equal(object1);
      expect(object3.sibling['*'].sibling['*'].sibling['*']).to.equal(object3);
      const map = new Map([
        [ object1[MEMORY], 0x1000n ],
        [ object2[MEMORY], 0x2000n ],
        [ object3[MEMORY], 0x3000n ],
      ]);
      env.getTargetAddress = function(context, target, cluster) {
        return map.get(target[MEMORY]);
      };
      const context = env.startContext();
      env.updatePointerAddresses(context, object3);
      expect(object1[MEMORY].getBigUint64(0, true)).to.equal(0x3000n);  // obj1 -> obj3
      expect(object2[MEMORY].getBigUint64(0, true)).to.equal(0x1000n);  // obj2 -> obj1
      expect(object3[MEMORY].getBigUint64(0, true)).to.equal(0x2000n);  // obj3 -> obj2
    })
    it('should ignore inactive pointers', function() {
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
      env.finishStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*i32',
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
      env.defineStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasValue,
        byteSize: addressByteSize,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: addressSize,
        byteSize: addressByteSize,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: addressByteSize,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.finishStructure(structure);
      env.getTargetAddress = function(context, target, cluster) {
        return usize(0x1000);
      };
      const context = env.startContext();
      // start now with an active pointer so it gets vivificated in order to ensure code coverage
      const object = new Hello(new Int32(1234));
      env.updatePointerAddresses(context, object);
      expect(getUsize.call(object[MEMORY], 0, true)).to.equal(usize(0x1000));
      // now make the pointer inactive
      object.$ = null;
      env.updatePointerAddresses(context, object);
      expect(getUsize.call(object[MEMORY], 0, true)).to.equal(usize(0));
    })
    it('should ignore pointers pointing to Zig memory', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
        align: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.finishStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*i32',
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
      env.defineStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'ArgStruct',
        byteSize: addressByteSize,
        length: 1,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Void,
        bitOffset: 0,
        bitSize: 0,
        byteSize: 0,
        structure: {},
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        bitOffset: addressSize * 0,
        bitSize: addressSize,
        byteSize: addressByteSize,
        slot: 0,
        structure: ptrStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.finishStructure(structure);
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      env.getTargetAddress = function() {
        throw new Error('Doh');
      }
      const dv = env.obtainZigView(usize(0x100), 4);
      const object = Int32(dv);
      const args = new ArgStruct([ object ]);
      const context = env.startContext();
      expect(() => env.updatePointerAddresses(context, args)).to.not.throw();
    })
    it('should ignore pointers in a bare union', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'Int32',
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
      env.finishStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*Int32',
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
      env.finishStructure(ptrStructure);
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'SomeStruct',
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.defineStructure(structStructure);
      env.finishStructure(structStructure);
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[4]*Int32',
        length: 4,
        byteSize: 8 * 4,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: ptrStructure,
      });
      env.defineStructure(arrayStructure);
      env.finishStructure(arrayStructure);
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | UnionFlag.HasInaccessible,
        byteSize: 8 * 4,
      });
      env.attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'struct',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 1,
        structure: structStructure,
      });
      env.attachMember(structure, {
        name: 'array',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8 * 4,
        slot: 2,
        structure: arrayStructure,
      });
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.finishStructure(structure);
      const object = new Hello(undefined);
      let called = false;
      env.getTargetAddress = function(context, target, cluster) {
        called = true;
        return 0x1000n;
      };
      const context = env.startContext();
      env.updatePointerAddresses(context, object);
      expect(called).to.be.false;
    })
  })
  describe('findTargetClusters', function() {
    it('should find overlapping objects', function() {
      const env = new Env();
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      const buffer1 = new ArrayBuffer(16);
      const buffer2 = new ArrayBuffer(16);
      const object1 = new Test(new DataView(buffer1, 0, 8));
      const object2 = new Test(new DataView(buffer1, 4, 8));
      const object3 = new Test(new DataView(buffer2, 0, 8));
      const object4 = new Test(new DataView(buffer2, 8, 8));
      const object5 = new Test(new DataView(buffer1, 0, 12));
      const clusters = env.findTargetClusters([
        [
          { target: object1, writable: false },
          { target: object2, writable: false },
          { target: object5, writable: false },

        ],
        [
          { target: object3, writable: false },
          { target: object4, writable: false },
        ],
      ]);
      expect(clusters).to.have.lengthOf(1);
      expect(clusters[0].targets).to.contain(object1).and.contain(object2);
      expect(clusters[0].start).to.equal(0);
      expect(clusters[0].end).to.equal(12);
    })
  })
  describe('updatePointerTargets', function() {
    it('should set pointer slot to undefined when pointer is inactive', function() {
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
      env.finishStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*i32',
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
      env.finishStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasValue,
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.finishStructure(structure);
      const object = new Hello(new Int32(123));
      expect(object.$['*']).to.equal(123);
      object[MEMORY].setBigUint64(0, 0n);
      const context = env.startContext();
      env.updatePointerTargets(context, object, true);
      expect(object[SLOTS][0][SLOTS][0]).to.be.undefined;
      expect(object.$).to.be.null;
    })
    it('should ignore argument pointers', function() {
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
      env.finishStructure(intStructure);
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
      env.finishStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: 8,
        length: 1,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      const Hello = env.defineStructure(structure);
      env.finishStructure(structure);
      const object = new Hello([ new Int32(123) ]);
      expect(object[0]['*']).to.equal(123);
      const context = env.startContext();
      env.updatePointerTargets(context, object, true);
      expect(object[0]['*']).to.equal(123);
    })
    it('should flag target of const pointer as immutable', function() {
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
      env.finishStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle | PointerFlag.IsConst,
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
      env.finishStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: 8,
        length: 1,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      const Hello = env.defineStructure(structure);
      env.finishStructure(structure);
      const object = new Hello([ new Int32(123) ]);
      const context = env.startContext();
      env.updatePointerTargets(context, object, true);
    })
    it('should clear slot when pointer has invalid address', function() {
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
      env.finishStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*i32',
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
      env.finishStructure(ptrStructure);
      const ptr = new Int32Ptr(new Int32(123));
      expect(ptr['*']).to.equal(123);
      const invalidAddress = (addressSize == 32) ? 0xaaaa_aaaa : 0xaaaa_aaaa_aaaa_aaaan;
      setUsize.call(ptr[MEMORY], 0, invalidAddress, true);
      const context = env.startContext();
      env.updatePointerTargets(context, ptr, true);
      expect(() => ptr['*']).to.throw(TypeError)
        .with.property('message').that.contains('Null')
    })
    it('should be able to handle self-referencing structures', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: 12,
      });
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*Hello',
        byteSize: 8,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure,
      });
      env.defineStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const optionalStructure = env.beginStructure({
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasValue,
        name: '?*Hello',
        byteSize: 8,
      });
      env.attachMember(optionalStructure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(optionalStructure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.defineStructure(optionalStructure);
      env.finishStructure(optionalStructure);
      env.attachMember(structure, {
        name: 'sibling',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: optionalStructure,
      });
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
      env.finishStructure(intStructure);
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Hello = env.defineStructure(structure);
      env.finishStructure(structure);
      const object1 = new Hello({ sibling: null });
      const object2 = new Hello({ sibling: object1 });
      const object3 = new Hello({ sibling: object2 });
      const object4 = new Hello({ sibling: null });
      const object5 = new Hello({ sibling: object4 });
      object1.sibling = object3;
      expect(object3.sibling['*']).to.equal(object2);
      expect(object3.sibling['*'].sibling['*']).to.equal(object1);
      expect(object3.sibling['*'].sibling['*'].sibling['*']).to.equal(object3);
      const map = new Map([
        [ 0x1000n, object1[MEMORY] ],
        [ 0x2000n, object2[MEMORY] ],
        [ 0x3000n, object3[MEMORY] ],
        [ 0x4000n, object4[MEMORY] ],
        [ 0x5000n, object5[MEMORY] ],
      ]);
      env.obtainZigView = function(address, len) {
        return map.get(address);
      };
      object1[MEMORY].setBigUint64(0, 0x5000n, true); // obj1 -> obj5
      object2[MEMORY].setBigUint64(0, 0x1000n, true); // obj2 -> obj1
      object3[MEMORY].setBigUint64(0, 0x0000n, true); // obj3 -> null
      object5[MEMORY].setBigUint64(0, 0x4000n, true); // obj5 -> obj4
      const context = env.startContext();
      env.updatePointerTargets(context, object3, true);
      expect(object3.sibling).to.be.null;
      expect(object2.sibling['*']).to.equal(object1);
      expect(object1.sibling['*']).to.equal(object5);
      expect(object5.sibling['*']).to.equal(object4);
    })
    it('should acquire missing objects', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: 12,
      });
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*Hello',
        byteSize: 8,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure,
      });
      env.defineStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const optionalStructure = env.beginStructure({
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasValue,
        name: '?*Hello',
        byteSize: 8,
      });
      env.attachMember(optionalStructure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(optionalStructure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.defineStructure(optionalStructure);
      env.finishStructure(optionalStructure);
      env.attachMember(structure, {
        name: 'sibling',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: optionalStructure,
      });
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
      env.finishStructure(intStructure);
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Hello = env.defineStructure(structure);
      env.finishStructure(structure);
      const object1 = new Hello({ sibling: null });
      const object2 = new Hello({ sibling: null });
      const object3 = new Hello({ sibling: null });
      const map = new Map([
        [ 0x1000n, object1[MEMORY] ],
        [ 0x2000n, object2[MEMORY] ],
        [ 0x3000n, object3[MEMORY] ],
      ]);
      env.obtainZigView = function(address, len) {
        return map.get(address);
      };
      object1[MEMORY].setBigUint64(0, 0x3000n, true); // obj1 -> obj3
      object2[MEMORY].setBigUint64(0, 0x1000n, true); // obj2 -> obj1
      object3[MEMORY].setBigUint64(0, 0x2000n, true); // obj3 -> obj2
      const context = env.startContext();
      env.updatePointerTargets(context, object3, true);
      expect(object3.sibling['*']).to.equal(object2);
      expect(object2.sibling['*']).to.equal(object1);
      expect(object1.sibling['*']).to.equal(object3);
    })
    it('should acquire missing opaque structures', function() {
      const env = new Env();
      const opaqueStructure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
      });
      env.defineStructure(opaqueStructure);
      env.finishStructure(opaqueStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*Hello',
        byteSize: addressByteSize,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: opaqueStructure,
      });
      const Ptr = env.defineStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const pointer = new Ptr(undefined);
      const dv = new DataView(new ArrayBuffer(16));
      const map = new Map([
        [ usize(0x1000), dv ],
      ]);
      env.obtainZigView = function(address, len) {
        return map.get(address);
      };
      setUsize.call(pointer[MEMORY], 0, usize(0x1000), true);
      const context = env.startContext();
      env.updatePointerTargets(context, pointer, true);
      expect(pointer.dataView).to.equal(dv);
    })
  })
})