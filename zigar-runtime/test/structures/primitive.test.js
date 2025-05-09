import { expect } from 'chai';
import { MemberType, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { BIT_SIZE, INITIALIZE, PRIMITIVE, SLOTS, TYPED_ARRAY } from '../../src/symbols.js';
import { encodeBase64 } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Structure: primitive', function() {
  describe('definePrimitive', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Primitive,
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
      const constructor = env.definePrimitive(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Primitive,
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
      env.definePrimitive(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
      expect(descriptors[Symbol.toPrimitive]?.value).to.be.a('function');
    })
  })
  describe('finalizePrimitive', function() {
    it('should add static descriptors to the given object', function() {
      const structure = {
        type: StructureType.Primitive,
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
      env.finalizePrimitive(structure, descriptors);
      expect(descriptors[BIT_SIZE]?.value).to.equal(64);
      expect(descriptors[PRIMITIVE]?.value).to.equal(MemberType.Int);
    })
    it('should not add descriptor when one is not available', function() {
      const structure = {
        type: StructureType.Primitive,
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Float,
          bitSize: 16,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      const env = new Env();
      const descriptors = {};
      env.finalizePrimitive(structure, descriptors);
      expect(descriptors[TYPED_ARRAY]).to.be.undefined;
      expect(descriptors[BIT_SIZE]?.value).to.equal(16);
      expect(descriptors[PRIMITIVE]?.value).to.equal(MemberType.Float);
    })
  })
  describe('defineStructure', function() {
    it('should define a structure for holding a type', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 0,
      });
      env.attachMember(structure, {
        type: MemberType.Type,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        slot: 0,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      expect(Hello).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(0));
      const object = Hello(dv);
      object[SLOTS] = { 0: { constructor: String }};
      expect(object.$).to.equal(String);
    })
    it('should cast the same buffer to the same object', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const buffer = new ArrayBuffer(8);
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
    })
    it('should throw when no initializer is provided', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should initialize a structure with a structure of the same type', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(12345n);
      expect(object.$).to.equal(12345n);
      const object2 = new Hello(object);
      expect(object2.valueOf()).to.equal(12345n);
    })
    it('should have special properties', function() {
      const env = new Env();
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
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(12345n);
      expect(object.dataView).to.be.an.instanceOf(DataView);
      expect(object.base64).to.be.a('string');
    })
    it('should accept base64 data as initializer', function() {
      const env = new Env();
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
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: I64 } = structure;
      const str = '\u0001\u0000\u0000\u0000\u0000\u0000\u0000\u0000';
      const base64 = encodeBase64(Buffer.from(str));
      const int = new I64({ base64 });
      expect(int.$).to.equal(1n);
    })
    it('should allow assignment of base64 data', function() {
      const env = new Env();
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
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: I64 } = structure;
      const str = '\u0001\u0000\u0000\u0000\u0000\u0000\u0000\u0000';
      const int = new I64(0n);
      int.base64 = encodeBase64(Buffer.from(str));
      expect(int.$).to.equal(1n);
    })
    it('should not have typedArray prop when it is a 128-bit integer', function() {
      const env = new Env();
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
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(12345n);
      expect(object.dataView).to.be.an.instanceOf(DataView);
      expect(object.typedArray).to.be.undefined;
    })
    it('should allow casting of typed array into primitive', function() {
      const env = new Env();
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
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: I64 } = structure;
      const typedArray = new BigInt64Array([ 1234n ]);
      const int = I64(typedArray);
      expect(int.$).to.equal(typedArray[0]);
      int.$ = 123n;
      expect(int.$).to.equal(typedArray[0]);
    })
    it('should throw when given an object with unrecognized properties', function() {
      const env = new Env();
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
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: I64 } = structure;
      expect(() => new I64({ dogmeat: 5 })).to.throw(TypeError);
    })
    it('should throw when given an empty object', function() {
      const env = new Env();
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
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: I64 } = structure;
      expect(() => new I64({})).to.throw(TypeError);
    })
  })
})
