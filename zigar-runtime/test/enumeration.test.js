import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
} from '../src/member.js';
import {
  StructureType,
  useEnumeration,
  beginStructure,
  attachMember,
  attachTemplate,
  finalizeStructure,
} from '../src/structure.js';
import { MEMORY, SLOTS } from '../src/symbol.js';

describe('Enumeration functions', function() {
  describe('finalizeErrorUnion', function() {
    beforeEach(function() {
      useIntEx();
      useEnumeration();
    })
    it('should define an enum class', function() {
      const structure = beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
      });
      attachMember(structure, {
        name: 'Dog',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = finalizeStructure(structure);
      expect(Number(Hello.Dog)).to.equal(0);
      expect(Number(Hello.Cat)).to.equal(1);
      expect(Hello.Dog === Hello.Dog).to.be.true;
      expect(Hello.Dog === Hello.Cat).to.be.false;
    })
    it('should look up the correct enum object', function() {
      const structure = beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
      });
      attachMember(structure, {
        name: 'Dog',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = finalizeStructure(structure);
      expect(Hello(0)).to.equal(Hello.Dog);
      expect(Hello(1)).to.equal(Hello.Cat);
    })
    it('should look up the correct enum object by name', function() {
      const structure = beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
      });
      attachMember(structure, {
        name: 'Dog',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = finalizeStructure(structure);
      expect(Hello('Dog')).to.equal(Hello.Dog);
      expect(Hello('Cat')).to.equal(Hello.Cat);
    })
    it('should throw when given incompatible input', function() {
      const structure = beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
      });
      attachMember(structure, {
        name: 'Dog',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = finalizeStructure(structure);
      expect(() => Hello({})).to.throw(TypeError);
      expect(() => Hello(undefined)).to.throw(TypeError);
      expect(() => Hello(Symbol.asyncIterator)).to.throw(TypeError);
    })
    it('should look up the correct enum object when values are not sequential', function() {
      const structure = beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello'
      });
      attachMember(structure, {
        name: 'Dog',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 123, true);
          dv.setUint32(4, 456, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = finalizeStructure(structure);
      expect(Hello(123)).to.equal(Hello.Dog);
      expect(Hello(456)).to.equal(Hello.Cat);
      expect(Number(Hello(123))).to.equal(123);
      expect(Number(Hello(456))).to.equal(456);
    })
    it('should look up the correct enum object when they represent bigInts', function() {
      const structure = beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello'
      });
      attachMember(structure, {
        name: 'Dog',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 64,
        byteSize: 8,
      });
      attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 64,
        byteSize: 8,
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8 * 2));
          dv.setBigUint64(0, 1234n, true);
          dv.setBigUint64(8, 4567n, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = finalizeStructure(structure);
      expect(Hello(1234n)).to.equal(Hello.Dog);
      // BigInt suffix missing on purpose
      expect(Hello(4567)).to.equal(Hello.Cat);
    })
    it('should produce the expect output when JSON.stringify() is used', function() {
      const structure = beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello'
      });
      attachMember(structure, {
        name: 'Dog',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = finalizeStructure(structure);
      expect(JSON.stringify(Hello.Dog)).to.equal('0');
      expect(JSON.stringify(Hello.Cat)).to.equal('1');
    })
    it('should throw when the new operator is used on the constructor', function() {
      const structure = beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello'
      });
      attachMember(structure, {
        name: 'Dog',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello(5)).to.throw();
    })
    it('should return undefined when look-up of enum item fails', function() {
      const structure = beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello'
      });
      attachMember(structure, {
        name: 'Dog',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = finalizeStructure(structure);
      expect(Hello(1)).to.be.an('object');
      expect(Hello(5)).to.be.undefined;
    })
  })
})
