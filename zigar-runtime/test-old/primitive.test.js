import { expect } from 'chai';

import { useAllExtendedTypes } from '../src/data-view.js';
import { NodeEnvironment } from '../src/environment-node.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import { SLOTS } from '../src/symbol.js';
import { encodeBase64 } from '../src/text.js';
import { MemberType, StructureType } from '../src/types.js';

describe('Primitive functions', function() {
  const env = new NodeEnvironment();
  describe('definePrimitive', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
      useAllExtendedTypes();
    })
    it('should define a structure for holding a type', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 0,
      });
      env.attachMember(structure, {
        type: MemberType.Type,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        slot: 0,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(Hello).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(0));
      const object = Hello(dv);
      object[SLOTS] = { 0: { constructor: String }};
      expect(object.$).to.equal(String);
    })
    it('should cast the same buffer to the same object', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const buffer = new ArrayBuffer(8);
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
    })
    it('should throw when no initializer is provided', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should initialize a structure with a structure of the same type', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(12345n);
      expect(object.$).to.equal(12345n);
      const object2 = new Hello(object);
      expect(object2.valueOf()).to.equal(12345n);
    })
    it('should have special properties', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(12345n);
      expect(object.dataView).to.be.an.instanceOf(DataView);
      expect(object.typedArray).to.be.an.instanceOf(BigInt64Array);
    })
    it('should not have typedArray prop when it is a 128-bit integer', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i128',
        byteSize: 16,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(12345n);
      expect(object.dataView).to.be.an.instanceOf(DataView);
      expect(object.typedArray).to.be.undefined;
    })
    it('should accept base64 data as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      const str = '\u0001\u0000\u0000\u0000\u0000\u0000\u0000\u0000';
      const base64 = encodeBase64(Buffer.from(str));
      const int = new I64({ base64 });
      expect(int.$).to.equal(1n);
    })
    it('should allow assignment of base64 data', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      const str = '\u0001\u0000\u0000\u0000\u0000\u0000\u0000\u0000';
      const int = new I64(0n);
      int.base64 = encodeBase64(Buffer.from(str));
      expect(int.$).to.equal(1n);
    })
    it('should accept typed array as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      const typedArray = new BigInt64Array([ 1234n ]);
      const int = new I64({ typedArray });
      expect(int.$).to.equal(typedArray[0]);
      int.$ = 123n;
      expect(int.$).to.not.equal(typedArray[0]);
    })
    it('should allow assignment of typed array', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      const int = new I64(77n);
      const typedArray = new BigInt64Array([ 1234n ]);
      int.typedArray = typedArray;
      expect(int.$).to.equal(typedArray[0]);
    })
    it('should allow casting of typed array into primitive', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      const typedArray = new BigInt64Array([ 1234n ]);
      const int = I64(typedArray);
      expect(int.$).to.equal(typedArray[0]);
      int.$ = 123n;
      expect(int.$).to.equal(typedArray[0]);
    })
    it('should throw when given an object with unrecognized properties', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      expect(() => new I64({ dogmeat: 5 })).to.throw(TypeError);
    })
    it('should throw when given an empty object', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      expect(() => new I64({})).to.throw(TypeError);
    })
  })
})
