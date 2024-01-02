import { expect } from 'chai';

import { MemberType, useAllMemberTypes } from '../src/member.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import {
  getIntRange,
  getPrimitiveClass,
  isExtendedType,
} from '../src/primitive.js';
import { NodeEnvironment } from '../src/environment-node.js';
import { encodeBase64 } from '../src/text.js';
import { SLOTS } from '../src/symbol.js';

describe('Primitive functions', function() {
  const env = new NodeEnvironment();
  describe('definePrimitive', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
    })
    it('should define a structure for holding a integer', function() {
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
      expect(Hello).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigUint64(0, 0x7FFFFFFFFFFFFFFFn, true);
      const object = Hello(dv);
      expect(object.$).to.equal(0x7FFFFFFFFFFFFFFFn);
      expect(BigInt(object)).to.equal(0x7FFFFFFFFFFFFFFFn);
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
    it('should be able to create read-only object', function() {
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
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigUint64(0, 0x7FFFFFFFFFFFFFFFn, true);
      const object = Hello(dv, { writable: false });
      expect(() => object.$ = 100n).to.throw(TypeError);
    })
    it('should cast read-only object to writable and vice-versa', function() {
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
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigUint64(0, 0x7FFFFFFFFFFFFFFFn, true);
      const object = Hello(dv, { writable: false });
      expect(() => object.$ = 100n).to.throw(TypeError);
      const writable = Hello(object);
      expect(() => writable.$ = 100n).to.not.throw();
      expect(object.$).to.equal(100n);
      const readOnly = Hello(writable, { writable: false });
      expect(readOnly).to.equal(object);
    })
  })
  describe('getIntRange', function() {
    it('should return expected range for a 8-bit signed integer', function() {
      const { min, max } = getIntRange({ type: MemberType.Int, bitSize: 8 });
      expect(max).to.equal(127);
      expect(min).to.equal(-127 - 1);
    })
    it('should return expected range for a 8-bit unsigned integer', function() {
      const { min, max } = getIntRange({ type: MemberType.Uint, bitSize: 8 });
      expect(max).to.equal(255);
      expect(min).to.equal(0);
    })
    it('should return expected range for a 16-bit signed integer', function() {
      const { min, max } = getIntRange({ type: MemberType.Int, bitSize: 16 });
      expect(max).to.equal(32767);
      expect(min).to.equal(-32767 - 1);
    })
    it('should return expected range for a 16-bit unsigned integer', function() {
      const { min, max } = getIntRange({ type: MemberType.Uint, bitSize: 16 });
      expect(max).to.equal(65535);
      expect(min).to.equal(0);
    })
    it('should return expected range for a 32-bit signed integer', function() {
      const { min, max } = getIntRange({ type: MemberType.Int, bitSize: 32 });
      expect(max).to.equal(2147483647);
      expect(min).to.equal(-2147483647 - 1);
    })
    it('should return expected range for a 32-bit unsigned integer', function() {
      const { min, max } = getIntRange({ type: MemberType.Uint, bitSize: 32 });
      expect(max).to.equal(4294967295);
      expect(min).to.equal(0);
    })
    it('should return expected range for a 64-bit signed integer', function() {
      const { min, max } = getIntRange({ type: MemberType.Int, bitSize: 64 });
      expect(max).to.equal(9223372036854775807n);
      expect(min).to.equal(-9223372036854775807n - 1n);
    })
    it('should return expected range for a 64-bit unsigned integer', function() {
      const { min, max } = getIntRange({ type: MemberType.Uint, bitSize: 64 });
      expect(max).to.equal(18446744073709551615n);
      expect(min).to.equal(0n);
    })
    it('should return expected range for a 2-bit signed integer', function() {
      const { min, max } = getIntRange({ type: MemberType.Int, bitSize: 2 });
      expect(max).to.equal(1);
      expect(min).to.equal(-1 - 1);
    })
    it('should return expected range for a 2-bit unsigned integer', function() {
      const { min, max } = getIntRange({ type: MemberType.Uint, bitSize: 2 });
      expect(max).to.equal(3);
      expect(min).to.equal(0);
    })
  })
  describe('getPrimitiveClass', function() {
    it('should return Number for floats', function() {
      const members = [
        { type: MemberType.Float, bitSize: 16 },
        { type: MemberType.Float, bitSize: 32 },
        { type: MemberType.Float, bitSize: 64 },
        { type: MemberType.Float, bitSize: 128 },
      ];
      for (const member of members) {
        expect(getPrimitiveClass(member)).to.equal(Number);
      }
    })
    it('should return Number for small integers', function() {
      const members = [
        { type: MemberType.Int, bitSize: 4 },
        { type: MemberType.Int, bitSize: 16 },
        { type: MemberType.Int, bitSize: 32 },
      ];
      for (const member of members) {
        expect(getPrimitiveClass(member)).to.equal(Number);
      }
    })
    it('should return BigInt for larger integers', function() {
      const members = [
        { type: MemberType.Int, bitSize: 64 },
        { type: MemberType.Int, bitSize: 33 },
        { type: MemberType.Int, bitSize: 128 },
      ];
      for (const member of members) {
        expect(getPrimitiveClass(member)).to.equal(BigInt);
      }
    })
    it('should return Boolean for bool', function() {
      const members = [
        { type: MemberType.Bool, bitSize: 1 },
      ];
      for (const member of members) {
        expect(getPrimitiveClass(member)).to.equal(Boolean);
      }
    })
    it('should return undefined for void', function() {
      const members = [
        { type: MemberType.Void, bitSize: 0 },
      ];
      for (const member of members) {
        expect(getPrimitiveClass(member)).to.be.undefined;
      }
    })
  })
  describe('isExtendedType', function() {
    it('should return true when int or float has non-standard number of bits', function() {
      const members = [
        { type: MemberType.Int, bitSize: 15, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 128, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 4, bitOffset: 0 },
        { type: MemberType.Float, bitSize: 16, bitOffset: 0 },
        { type: MemberType.Float, bitSize: 80, bitOffset: 0 },
        { type: MemberType.EnumerationItem, bitSize: 4, bitOffset: 0 },
      ];
      for (const member of members) {
        expect(isExtendedType(member)).to.be.true;
      }
    })
    it('should return false when int or float is standard size', function() {
      const members = [
        { type: MemberType.Int, bitSize: 8, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 16, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 32, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 64, bitOffset: 0 },
        { type: MemberType.Float, bitSize: 32, bitOffset: 0 },
        { type: MemberType.Float, bitSize: 64, bitOffset: 0 },
        { type: MemberType.EnumerationItem, bitSize: 16, bitOffset: 0 },
      ];
      for (const member of members) {
        expect(isExtendedType(member)).to.be.false;
      }
    })
    it('should return true when int or float is unaligned', function() {
      const members = [
        { type: MemberType.Int, bitSize: 8, bitOffset: 1 },
        { type: MemberType.Int, bitSize: 16, bitOffset: 1 },
        { type: MemberType.Int, bitSize: 32, bitOffset: 1 },
        { type: MemberType.Int, bitSize: 64, bitOffset: 1 },
        { type: MemberType.Float, bitSize: 32, bitOffset: 1 },
        { type: MemberType.Float, bitSize: 64, bitOffset: 1 },
        { type: MemberType.EnumerationItem, bitSize: 16, bitOffset: 1 },
      ];
      for (const member of members) {
        expect(isExtendedType(member)).to.be.true;
      }
    })
    it('should return false with other types', function() {
      const members = [
        { type: MemberType.Object, bitSize: 8 },
        { type: MemberType.Void, bitSize: 0 },
        { type: MemberType.Type, bitSize: 0 },
      ];
      for (const member of members) {
        expect(isExtendedType(member)).to.be.false;
      }
    })
  })
})
