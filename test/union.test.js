import { expect } from 'chai';

import {
  MemberType,
  useBoolEx,
  useIntEx,
  useObject,
  useEnumerationItem,
} from '../src/member.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import {
  StructureType,
  usePrimitive,
  usePointer,
  useExternUnion,
  useBareUnion,
  useTaggedUnion,
  useEnumeration,
  beginStructure,
  attachMember,
  attachTemplate,
  finalizeStructure,
} from '../src/structure.js';

describe('Union functions', function() {
  describe('finalizeUnion', function() {
    beforeEach(function() {
      usePrimitive();
      useExternUnion();
      useBareUnion();
      useTaggedUnion();
      useEnumeration();
      usePointer();
      useBoolEx();
      useIntEx();
      useEnumerationItem();
      useObject();
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
    it('should define a simple bare union', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
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
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(8));
            dv.setInt32(0, 1234, true);
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
      expect(Object.keys(object)).to.have.lengthOf(1);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.be.null;
      expect(() => object.cat = 567).to.throw(TypeError);
      object[MEMORY].setInt16(4, 1, true);
      object[MEMORY].setInt32(0, 567, true);
      expect(object.dog).to.be.null;
      expect(object.cat).to.equal(567);
    })
    it('should define a simple tagged union', function() {
      const enumStructure = beginStructure({
        type: StructureType.Enumeration,
        name: 'HelloTag',
      });
      attachMember(enumStructure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(enumStructure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(enumStructure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(4 * 2));
            dv.setUint32(0, 100, true);
            dv.setUint32(4, 200, true);
            return dv;
          })(),
          [SLOTS]: {},
        },
      });
      const HelloType = finalizeStructure(enumStructure);
      const structure = beginStructure({
        type: StructureType.TaggedUnion,
        name: 'Hello',
        size: 8,
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
      attachMember(structure, {
        name: 'selector',
        type: MemberType.EnumerationItem,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: enumStructure,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(8));
            dv.setInt32(0, 1234, true);
            dv.setInt32(4, 100, true);
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
      expect(Object.keys(object)).to.have.lengthOf(1);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.be.null;
      expect(() => object.cat = 567).to.throw(TypeError);
      object[MEMORY].setInt32(4, 200, true);
      object[MEMORY].setInt32(0, 567, true);
      expect(object.dog).to.be.null;
      expect(object.cat).to.equal(567);
      expect(HelloType(object)).to.equal(HelloType.cat);
    })
    it('should only have a single enumerable property', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({ dog: 1234 });
      expect(object.dog).to.equal(1234);
      expect({ ...object }).to.eql({ dog: 1234 });
    })
    it('should complain about missing union initializer', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello()).to.throw(TypeError)
        .with.property('message').that.contains('dog, cat')
      const object = new Hello({ cat: 4567 });
      expect(object.cat).to.equal(4567);
    })
    it('should throw when there is more than one initializer', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello({ dog: 1234, cat: 4567 })).to.throw(TypeError);
      const object = new Hello({ dog: 1234 });
      expect(object.dog).to.equal(1234);
      expect({ ...object }).to.eql({ dog: 1234 });
    })
    it('should throw when attempting to set an active property', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({ dog: 1234 });
      expect(() => object.cat = 4567).to.throw(TypeError)
        .with.property('message').that.contains('dog')
    })
    it('should allow switching of active property through dollar property', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({ dog: 1234 });
      object.$ = { cat: 4567 };
      expect(object).to.eql({ cat: 4567 });
      expect({ ...object }).to.eql({ cat: 4567 });
      expect(object.$).to.eql({ cat: 4567 });
    })
  })
})
