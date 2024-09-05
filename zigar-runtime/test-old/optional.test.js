import { expect } from 'chai';

import { useAllExtendedTypes } from '../src/data-view.js';
import { NodeEnvironment } from '../src/environment-node.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import { MEMORY, POINTER_VISITOR, SLOTS } from '../src/symbol.js';
import { MemberType, StructureType } from '../src/types.js';

describe('Optional functions', function() {
  const env = new NodeEnvironment();
  describe('defineOptional', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
      useAllExtendedTypes();
    })
    it('should define a structure for storing an optional pointer', function() {
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
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*Int32',
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
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 8,
        hasPointer: true,
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
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object = Hello(new ArrayBuffer(8));
      expect(object.$).to.equal(null);
      object.$ = new Int32(0);
      object.$['*'] = 5;
      expect(object.$['*']).to.equal(5);
    })
    it('should define a structure for storing an optional slice', function() {
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Uint8',
        byteSize: 1,
      })
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array },
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.SlicePointer,
        name: '[]Uint8',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
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
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const encoder = new TextEncoder();
      const array = encoder.encode('This is a test');
      const object = new Hello(array);
      expect(object.$.string).to.equal('This is a test');
      expect(object.$.typedArray).to.eql(array);
      object.valueOf();
      expect(JSON.stringify(object)).to.eql(JSON.stringify([ ...array ]));
      const object2 = new Hello(null);
      expect(object2.$).to.be.null;
    })
    it('should copy pointers where initialized from an optional of the same type', function() {
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Uint8',
        byteSize: 1,
      })
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array },
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.SlicePointer,
        name: '[]Uint8',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
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
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const encoder = new TextEncoder();
      const array = encoder.encode('This is a test');
      const object = new Hello(array);
      expect(object.$.string).to.equal('This is a test');
      const object2 = new Hello(object);
      expect(object2.$.string).to.equal('This is a test');
    })
    it('should release pointers in struct when it is set to null', function() {
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
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true
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
      const { constructor: Int32Ptr } = ptrStructure;
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8 * 2,
        hasPointer: true
      });
      env.attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structStructure, {
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
      env.attachTemplate(structStructure, {
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
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: structStructure.byteSize + 32,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: structStructure.byteSize * 8,
        byteSize: structStructure.byteSize,
        slot: 0,
        structure: structStructure,
      });
      env.attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: structStructure.byteSize * 8,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      const ptr = object.$.cat;
      expect(ptr[SLOTS][0]).to.not.be.undefined;
      object.$ = null;
      expect(ptr[SLOTS][0]).to.be.undefined;
      object[POINTER_VISITOR](function({ isActive }) {
        expect(isActive(this)).to.be.false;
      });
    })
    it('should release pointers in struct when it is set to null externally', function() {
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
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true
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
      const { constructor: Int32Ptr } = ptrStructure;
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8 * 2,
        hasPointer: true
      });
      env.attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structStructure, {
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
      env.attachTemplate(structStructure, {
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
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: structStructure.byteSize + 4,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: structStructure.byteSize * 8,
        byteSize: structStructure.byteSize,
        slot: 0,
        structure: structStructure,
      });
      env.attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: structStructure.byteSize * 8,
        bitSize: 1,
        byteSize: 1,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      const ptr = object.$.cat;
      expect(ptr[SLOTS][0]).to.not.be.undefined;
      object[MEMORY].setUint8(structStructure.byteSize, 0);
      expect(object.$).to.be.null;
      expect(ptr[SLOTS][0]).to.be.undefined;
    })

    it('should release pointers in array when it is set to null', function() {
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
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*Int32',
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
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 4,
        byteSize: 8 * 4,
        hasPointer: true,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: ptrStructure,
      });
      env.defineStructure(arrayStructure);
      env.endStructure(arrayStructure);
      const { constructor: Int32PtrArray } = arrayStructure;
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: arrayStructure.byteSize + 32,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: arrayStructure.byteSize * 8,
        byteSize: arrayStructure.byteSize,
        slot: 0,
        structure: arrayStructure,
      });
      env.attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: arrayStructure.byteSize * 8,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello([ new Int32(1234), new Int32(4567), new Int32(7890), new Int32(12345) ]);
      const array = object.$;
      for (let i = 0; i < 4; i++) {
        expect(array[SLOTS][i][SLOTS][0]).to.not.be.undefined;
      }
      object.$ = null;
      for (let i = 0; i < 4; i++) {
        expect(array[SLOTS][i][SLOTS][0]).to.be.undefined;
      }
    })
    it('should do nothing when undefined is assigned to it', function() {
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 18,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Float,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        structure: {
          type: StructureType.Primitive,
        }
      });
      env.attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(3.14);
      expect(object.$).to.equal(3.14);
      object.$ = undefined;
      expect(object.$).to.equal(3.14);
    })
    it('should work correctly when value is void', function() {
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 1,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Void,
        bitOffset: 0,
        bitSize: 0,
        byteSize: 0,
        structure: {
          type: StructureType.Primitive,
        }
      });
      env.attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 1,
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object = Hello(new ArrayBuffer(1));
      expect(object.$).to.equal(null);
      object.$ = undefined;
      expect(object.$).to.equal(undefined);
      expect(object.valueOf()).to.equal(undefined);
      object.$ = null;
      expect(object.$).to.equal(null);
      expect(object.valueOf()).to.equal(null);
    })
  })
})
