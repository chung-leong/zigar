import { expect } from 'chai';

import {
  MemberType,
  useBoolEx,
  useIntEx,
  useObject,
} from '../src/member.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import {
  StructureType,
  usePrimitive,
  useStruct,
  usePointer,
  beginStructure,
  attachMember,
  attachTemplate,
  finalizeStructure,
} from '../src/structure.js';

describe('Struct functions', function() {
  describe('finalizeStruct', function() {
    beforeEach(function() {
      usePrimitive();
      useStruct();
      usePointer();
      useBoolEx();
      useIntEx();
      useObject();
    })
    it('should define a simple struct', function() {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 4 * 2,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(4 * 2));
            dv.setInt32(0, 1234, true);
            dv.setInt32(4, 4567, true);
            return dv;
          })(),
          [SLOTS]: {},
        }
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const object = new Hello();
      expect(object).to.be.an.instanceOf(Object);
      expect(object).to.be.an.instanceOf(Hello);
      expect(Object.keys(object)).to.have.lengthOf(2);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
    it('should work correctly with big-endian data', function() {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 4 * 2,
      }, { littleEndian: false });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(4 * 2));
            dv.setInt32(0, 1234, false);
            dv.setInt32(4, 4567, false);
            return dv;
          })(),
          [SLOTS]: {},
        },
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const object = new Hello();
      expect(object).to.be.an.instanceOf(Object);
      expect(object).to.be.an.instanceOf(Hello);
      expect(Object.keys(object)).to.have.lengthOf(2);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
    it('should create functional setters', function() {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 4 * 2,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(4 * 2));
            dv.setInt32(0, 1234, true);
            dv.setInt32(4, 4567, true);
            return dv;
          })(),
          [SLOTS]: {},
        },
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello();
      object.dog = 72;
      expect(object.dog).to.equal(72);
      expect(object.cat).to.equal(4567);
      object.cat = 882;
      expect(object.cat).to.equal(882);
      expect(object.dog).to.equal(72);
    })
    it('should have dataView property', function() {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 4 * 2,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(4 * 2));
            dv.setInt32(0, 1234, true);
            dv.setInt32(4, 4567, true);
            return dv;
          })(),
          [SLOTS]: {},
        },
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello();
      expect(object.dataView).to.be.instanceOf(DataView);
    })
    it('should throw when a value exceed the maximum capability of the type', function () {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 4 * 2,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(4 * 2));
            dv.setInt32(0, 1234, true);
            dv.setInt32(4, 4567, true);
            return dv;
          })(),
          [SLOTS]: {},
        },
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello();
      expect(() => object.dog = 0x1FFFFFFFF).to.throw(TypeError);
    })
    it('should permit overflow when runtime safety is off', function () {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 4 * 2,
      }, { runtimeSafety: false });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(4 * 2));
            dv.setInt32(0, 1234, true);
            dv.setInt32(4, 4567, true);
            return dv;
          })(),
          [SLOTS]: {},
        },
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello();
      expect(() => object.dog = 0x1FFFFFFFF).to.not.throw();
    })
    it('should be able to handle bitfields', function() {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 1,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Bool,
        isStatic: false,
        bitSize: 1,
        bitOffset: 0,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Bool,
        isStatic: false,
        bitSize: 1,
        bitOffset: 1,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(1));
            dv.setInt8(0, 2, true);
            return dv;
          })(),
          [SLOTS]: {},
        },
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello();
      expect(object.dog).to.be.false;
      expect(object.cat).to.be.true;
      expect(object.typedArray).to.be.undefined;
      object.dog = true;
      object.cat = false;
      expect(object.dog).to.be.true;
      expect(object.cat).to.be.false;
    })
    it('should be able to handle small int type', function() {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 1,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 2,
        bitOffset: 0,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 3,
        bitOffset: 2,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(1));
            dv.setInt8(0, 7, true);
            return dv;
          })(),
          [SLOTS]: {},
        },
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello();
      expect(object.dog).to.equal(3);
      expect(object.cat).to.equal(1);
      expect(() => object.dog = 4).to.throw();
      expect(() => object.cat = 4).to.throw();
      expect(() => object.cat = -3).to.not.throw();
      expect(object.cat).to.equal(-3);
      object.cat = 1;
      expect(object.cat).to.equal(1);
      expect(object.dog).to.equal(3);
    })
    it('should be able to handle bit-misalignment', function() {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 5,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 2,
        bitOffset: 0,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 2,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(5));
            dv.setUint32(0, 8, true);
            return dv;
          })(),
          [SLOTS]: {},
        },
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello();
      expect(object.dog).to.equal(0);
      expect(object.cat).to.equal(2);
    })
    it('should complain about missing required initializers', function() {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        isRequired: true,
        bitSize: 32,
        bitOffset: 32,
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello()).to.throw(TypeError)
        .with.property('message').that.contains('dog, cat');
      expect(() => new Hello({ dog: 1234 })).to.throw(TypeError)
        .with.property('message').that.does.not.contain('dog');
      const object = new Hello({ dog: 1234, cat: 4567 });
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
    it('should complain about invalid initializers', function() {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        isRequired: true,
        bitSize: 32,
        bitOffset: 32,
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello(5)).to.throw(TypeError)
        .with.property('message').that.does.not.contains('dog');
    })
    it('should apply default value when only some properties are provided', function() {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        isRequired: true,
        bitSize: 32,
        bitOffset: 32,
      });
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 1234, true);
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: dv,
        },
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello).to.throw();
      const object = new Hello({ cat: 4567 });
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
    it('should allow assignment through the dollar property', function() {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        isRequired: false,
        bitSize: 32,
        bitOffset: 0,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        isRequired: false,
        bitSize: 32,
        bitOffset: 32,
      });
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 1234, true);
      dv.setUint32(4, 4567, true);
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: dv,
        },
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello();
      expect(object).to.eql({ dog: 1234, cat: 4567 });
      object.dog = 777;
      expect(object).to.eql({ dog: 777, cat: 4567 });
      object.$ = { cat: 999 };
      expect(object).to.eql({ dog: 1234, cat: 999 });
      object.$ = {};
      expect(object.$).to.eql({ dog: 1234, cat: 4567 });
    })
    it('should define a struct that contains pointers', function() {
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
      const ptrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true
      });
      attachMember(ptrStructure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const PInt32 = finalizeStructure(ptrStructure);
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8 * 2,
        hasPointer: true
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: ptrStructure,
      })
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(8 * 2));
            dv.setBigUint64(0, 0xaaaaaaaaaaaaaaaan, true);
            dv.setBigUint64(8, 0xaaaaaaaaaaaaaaaan, true);
            return dv;
          })(),
          [SLOTS]: {
            0: new PInt32(int1),
            1: new PInt32(int2),
          }
        },
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello();
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
    it('should expose pointers through special & property', function() {
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
      const ptrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
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
        structure: intStructure,
      });
      const PInt32 = finalizeStructure(ptrStructure);
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8 * 2,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: ptrStructure,
      })
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(8 * 2));
            dv.setBigUint64(0, 0xaaaaaaaaaaaaaaaan, true);
            dv.setBigUint64(8, 0xaaaaaaaaaaaaaaaan, true);
            return dv;
          })(),
          [SLOTS]: {
            0: new PInt32(int1),
            1: new PInt32(int2),
          }
        },
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello();
      const ptr1 = object['&'].dog;
      const ptr2 = object['&'].cat;
      expect(ptr1['*'].$).to.equal(1234);
      expect(ptr2['*'].$).to.equal(4567);
    })
  })
})
