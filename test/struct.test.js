import { expect } from 'chai';

import {
  MemberType,
  useBoolEx,
  useIntEx,
} from '../src/member.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import {
  StructureType,
  useStruct,
  useExternUnion,
  beginStructure,
  attachMember,
  attachMethod,
  attachTemplate,
  finalizeStructure,
} from '../src/structure.js';

describe('Struct functions', function() {
  describe('finalizeStruct', function() {
    beforeEach(function() {
      useStruct();
      useExternUnion();
      useBoolEx();
      useIntEx();
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
    it('should define a simple extern union', function() {
      const structure = beginStructure({
        type: StructureType.ExternUnion,
        name: 'Hello',
        size: 4,
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
        bitOffset: 0,
        byteSize: 4,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(4));
            dv.setInt32(0, 1234, true);
            return dv;
          })(),
          [SLOTS]: {},
        },
      })
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const object = new Hello();
      expect(object).to.be.an.instanceOf(Object);
      expect(object).to.be.an.instanceOf(Hello);
      expect(Object.keys(object)).to.have.lengthOf(2);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(1234);
      object.dog = 777;
      expect(object.dog).to.equal(777);
      expect(object.cat).to.equal(777);
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
        byteSize: 0,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Bool,
        isStatic: false,
        bitSize: 1,
        bitOffset: 1,
        byteSize: 0,
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
        byteSize: 0,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 3,
        bitOffset: 2,
        byteSize: 0,
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
        byteSize: 0,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 2,
        byteSize: 0,
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
  })
})
