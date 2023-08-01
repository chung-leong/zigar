import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
} from '../src/member.js';
import {
  StructureType,
  usePrimitive,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';
import {
  getIntRange,
  getPrimitiveClass,
  isExtendedType,
} from '../src/primitive.js';

describe('Primitive functions', function() {
  describe('finalizePrimitive', function() {
    beforeEach(function() {
      usePrimitive();
      useIntEx();
    })
    it('should define a structure for holding a primitive', function() {
      const structure = beginStructure({
        type: StructureType.Primitive,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: false,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigUint64(0, 0x7FFFFFFFFFFFFFFFn, true);
      const object = Hello(dv);
      expect(object.$).to.equal(0x7FFFFFFFFFFFFFFFn);
      expect(BigInt(object)).to.equal(0x7FFFFFFFFFFFFFFFn);
    })
    it('should initialize a structure with a structure of the same type', function() {
      const structure = beginStructure({
        type: StructureType.Primitive,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: true,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello(12345n);
      expect(object.$).to.equal(12345n);
      const object2 = new Hello(object);
      expect(object2.valueOf()).to.equal(12345n);
    })
  })
  describe('getIntRange', function() {
    it('should return expected range for a 8-bit signed integer', function() {
      const { min, max } = getIntRange({ isSigned: true, bitSize: 8 });
      expect(max).to.equal(127);
      expect(min).to.equal(-127 - 1);
    })
    it('should return expected range for a 8-bit unsigned integer', function() {
      const { min, max } = getIntRange({ isSigned: false, bitSize: 8 });
      expect(max).to.equal(255);
      expect(min).to.equal(0);
    })
    it('should return expected range for a 16-bit signed integer', function() {
      const { min, max } = getIntRange({ isSigned: true, bitSize: 16 });
      expect(max).to.equal(32767);
      expect(min).to.equal(-32767 - 1);
    })
    it('should return expected range for a 16-bit unsigned integer', function() {
      const { min, max } = getIntRange({ isSigned: false, bitSize: 16 });
      expect(max).to.equal(65535);
      expect(min).to.equal(0);
    })
    it('should return expected range for a 32-bit signed integer', function() {
      const { min, max } = getIntRange({ isSigned: true, bitSize: 32 });
      expect(max).to.equal(2147483647);
      expect(min).to.equal(-2147483647 - 1);
    })
    it('should return expected range for a 32-bit unsigned integer', function() {
      const { min, max } = getIntRange({ isSigned: false, bitSize: 32 });
      expect(max).to.equal(4294967295);
      expect(min).to.equal(0);
    })
    it('should return expected range for a 64-bit signed integer', function() {
      const { min, max } = getIntRange({ isSigned: true, bitSize: 64 });
      expect(max).to.equal(9223372036854775807n);
      expect(min).to.equal(-9223372036854775807n - 1n);
    })
    it('should return expected range for a 64-bit unsigned integer', function() {
      const { min, max } = getIntRange({ isSigned: false, bitSize: 64 });
      expect(max).to.equal(18446744073709551615n);
      expect(min).to.equal(0n);
    })
    it('should return expected range for a 2-bit signed integer', function() {
      const { min, max } = getIntRange({ isSigned: true, bitSize: 2 });
      expect(max).to.equal(1);
      expect(min).to.equal(-1 - 1);
    })
    it('should return expected range for a 2-bit unsigned integer', function() {
      const { min, max } = getIntRange({ isSigned: false, bitSize: 2 });
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
