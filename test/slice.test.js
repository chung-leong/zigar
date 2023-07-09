import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
  useObject,
} from '../src/member.js';
import {
  StructureType,
  useArray,
  useSlice,
  useStruct,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';

describe('Slice functions', function() {
  describe('finalizeSlice', function() {
    beforeEach(function() {
      useArray();
      useStruct();
      useSlice();
      useIntEx();
      useObject();
    })
    it('should define structure for holding an int slice', function() {
      const structure = beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        size: 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const object = Hello(new ArrayBuffer(32));
      object.set(1, 321);
      expect(object.get(1)).to.equal(321);
      expect(object.length).to.equal(8);
    })
    it('should have string property when slice contains Uint8', function() {
      const structure = beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        size: 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 8,
        byteSize: 1,
      });
      const Hello = finalizeStructure(structure);
      const dv = new DataView(new ArrayBuffer(4));
      dv.setUint8(0, 'A'.charCodeAt(0));
      dv.setUint8(1, 'B'.charCodeAt(0));
      dv.setUint8(2, 'C'.charCodeAt(0));
      dv.setUint8(3, 'D'.charCodeAt(0));
      const object = Hello(dv);
      const { string } = object;
      expect(string).to.equal('ABCD');
    })
    it('should have string property when slice contains Uint16', function() {
      const structure = beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 16,
        byteSize: 2,
      });
      const Hello = finalizeStructure(structure);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint16(0, 'A'.charCodeAt(0), true);
      dv.setUint16(2, 'B'.charCodeAt(0), true);
      dv.setUint16(4, 'C'.charCodeAt(0), true);
      dv.setUint16(6, 'D'.charCodeAt(0), true);
      const object = Hello(dv);
      const { string } = object;
      expect(string).to.equal('ABCD');
    })
    it('should accept an array as initializer', function() {
      const structure = beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        size: 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      expect(object.length).to.equal(8);
      for (let i = 0; i < 8; i++) {
        expect(object.get(i)).to.equal(i + 1);
      }
    })
    it('should correctly initialize an slice of structs', function() {
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 4 * 2,
      });
      attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
      });
      attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
      });
      const Hello = finalizeStructure(structStructure);
      const structure = beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      const HelloArray = finalizeStructure(structure);
      const object = new HelloArray([
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
        { dog: 7, cat: 8 },
      ]);
      expect(object.valueOf()).to.eql([
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
        { dog: 7, cat: 8 },
      ]);
    })
    it('should allow reinitialization through the dollar property', function() {
      const structure = beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 64,
        byteSize: 8,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello([ 100n, 200n, 300n, 400n ]);
      expect(object.length).to.equal(4);
      for (let i = 0; i < 4; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 100n);
      }
      object.$ = new BigUint64Array([ 1000n, 2000n, 3000n, 4000n, 5000n, 6000n ]);
      expect(object.length).to.equal(6);
      for (let i = 0; i < 6; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 1000n);
      }
      object.$ = new BigUint64Array([ 10000n, 20000n, 30000n ]);
      expect(object.length).to.equal(3);
      for (let i = 0; i < object.length; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 10000n);
      }
    })
    it('should create additional objects when slice is expanded', function() {
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 4 * 2,
      });
      attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
      });
      attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
      });
      const Hello = finalizeStructure(structStructure);
      const structure = beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      const HelloArray = finalizeStructure(structure);
      const object = new HelloArray([
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
        { dog: 7, cat: 8 },
      ]);
      object.$ = [
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
        { dog: 7, cat: 8 },
        { dog: 9, cat: 10 },
      ];
      expect(object.length).to.equal(5);
      expect(object.valueOf()).to.eql([
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
        { dog: 7, cat: 8 },
        { dog: 9, cat: 10 },
      ]);
      object.$ = [
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
      ];
      expect(object.length).to.equal(3);
      expect(object.valueOf()).to.eql([
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
      ]);
    })

  })
})
