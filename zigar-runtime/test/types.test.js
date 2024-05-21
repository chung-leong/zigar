import { expect } from 'chai';

import {
  MemberType,
  StructureType,
  getIntRange,
  getPrimitiveClass,
  getStructureName,
  getTypeName,
  isExtendedType
} from '../src/types.js';

describe('Data view functions', function() {
  describe('getTypeName', function() {
    it('should return the name for a integer type', function() {
      const members = [
        { type: MemberType.Int, bitSize: 32 },
        { type: MemberType.Int, bitSize: 64 },
        { type: MemberType.Int, bitSize: 33 },
      ];
      expect(getTypeName(members[0])).to.equal('Int32');
      expect(getTypeName(members[1])).to.equal('BigInt64');
      expect(getTypeName(members[2])).to.equal('BigInt33');
    })
    it('should return the correct name for unsigned integers', function() {
      const members = [
        { type: MemberType.Uint, bitSize: 32 },
        { type: MemberType.Uint, bitSize: 64 },
        { type: MemberType.Uint, bitSize: 33 },
      ];
      expect(getTypeName(members[0])).to.equal('Uint32');
      expect(getTypeName(members[1])).to.equal('BigUint64');
      expect(getTypeName(members[2])).to.equal('BigUint33');
    })
    it('should return the correct names for floats', function() {
      const members = [
        { type: MemberType.Float, bitSize: 16 },
        { type: MemberType.Float, bitSize: 32 },
        { type: MemberType.Float, bitSize: 64 },
        { type: MemberType.Float, bitSize: 128 },
      ];
      expect(getTypeName(members[0])).to.equal('Float16');
      expect(getTypeName(members[1])).to.equal('Float32');
      expect(getTypeName(members[2])).to.equal('Float64');
      expect(getTypeName(members[3])).to.equal('Float128');
    })
    it('should return the correct names for boolean', function() {
      const members = [
        { type: MemberType.Bool, bitSize: 1, byteSize: 1 },
        { type: MemberType.Bool, bitSize: 1, byteSize: 8 },
        { type: MemberType.Bool, bitSize: 1 },
      ];
      expect(getTypeName(members[0])).to.equal('Bool8');
      expect(getTypeName(members[1])).to.equal('Bool64');
      expect(getTypeName(members[2])).to.equal('Bool1');
    })
    it('should return "Null" for Void', function() {
      const members = [
        { type: MemberType.Void, bitSize: 0 },
      ];
      expect(getTypeName(members[0])).to.equal('Null');
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
  describe('getStructureName', function() {
    it('should return the name of structure type', function() {
      expect(getStructureName(StructureType.Array)).to.equal('array');
      expect(getStructureName(StructureType.Struct)).to.equal('struct');
      expect(getStructureName(StructureType.PackedStruct)).to.equal('packed struct');
      expect(getStructureName(StructureType.TaggedUnion)).to.equal('tagged union');
      expect(getStructureName(StructureType.Enum)).to.equal('enum');
    })
    it('should return undefined when type id is invalid', function() {
      expect(getStructureName(88)).to.be.undefined;
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
