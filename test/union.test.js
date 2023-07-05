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
      expect(Object.keys(object)).to.have.lengthOf(2);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.be.null;
      object.cat = 567;
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
      expect(Object.keys(object)).to.have.lengthOf(2);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.be.null;
      object.cat = 567;
      expect(object.dog).to.be.null;
      expect(object.cat).to.equal(567);
      expect(HelloType(object)).to.equal(HelloType.cat);
    })
  })
})
