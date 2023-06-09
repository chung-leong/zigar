import { expect } from 'chai';

import { MemberType, getTypeName, getIntRange } from '../src/types.js';

describe('Type functions', function() {
  describe('getTypeName', function() {
    it('should return the name for a integer type', function() {
      const name = getTypeName(MemberType.Int, 32, true);
      expect(name).to.equal('Int32');
    })
    it('should return the correct name for unsigned integers', function() {
      const name = getTypeName(MemberType.Int, 32, false);
      expect(name).to.equal('Uint32');
    })
    it('should prefix name with "Big" when an integer is bigger than 32-bit', function() {
      const name = getTypeName(MemberType.Int, 33, false);
      expect(name).to.equal('BigUint33');
    })
    it('should return the correct names for floats', function() {
      const name1 = getTypeName(MemberType.Float, 32, false);
      const name2 = getTypeName(MemberType.Float, 64, false);
      const name3 = getTypeName(MemberType.Float, 128, false);
      expect(name1).to.equal('Float32');
      expect(name2).to.equal('Float64');
      expect(name3).to.equal('Float128');
    })
    it('should return the correct names for boolean', function() {
      const name = getTypeName(MemberType.Bool, 1, false);
      expect(name).to.equal('Bool');
    })
    it('should return "Null" for Void', function() {
      const name = getTypeName(MemberType.Void, 0, false);
      expect(name).to.equal('Null');
    })
  })
  describe('getIntRange', function() {
    it('should return expected range for a 8-bit signed integer', function() {
      const { min, max } = getIntRange(8, true);
      expect(max).to.equal(127);
      expect(min).to.equal(-127 - 1);
    })
    it('should return expected range for a 8-bit unsigned integer', function() {
      const { min, max } = getIntRange(8, false);
      expect(max).to.equal(255);
      expect(min).to.equal(0);
    })
    it('should return expected range for a 16-bit signed integer', function() {
      const { min, max } = getIntRange(16, true);
      expect(max).to.equal(32767);
      expect(min).to.equal(-32767 - 1);
    })
    it('should return expected range for a 16-bit unsigned integer', function() {
      const { min, max } = getIntRange(16, false);
      expect(max).to.equal(65535);
      expect(min).to.equal(0);
    })
    it('should return expected range for a 32-bit signed integer', function() {
      const { min, max } = getIntRange(32, true);
      expect(max).to.equal(2147483647);
      expect(min).to.equal(-2147483647 - 1);
    })
    it('should return expected range for a 32-bit unsigned integer', function() {
      const { min, max } = getIntRange(32, false);
      expect(max).to.equal(4294967295);
      expect(min).to.equal(0);
    })
    it('should return expected range for a 64-bit signed integer', function() {
      const { min, max } = getIntRange(64, true);
      expect(max).to.equal(9223372036854775807n);
      expect(min).to.equal(-9223372036854775807n - 1n);
    })
    it('should return expected range for a 64-bit unsigned integer', function() {
      const { min, max } = getIntRange(64, false);
      expect(max).to.equal(18446744073709551615n);
      expect(min).to.equal(0n);
    })
    it('should return expected range for a 2-bit signed integer', function() {
      const { min, max } = getIntRange(2, true);
      expect(max).to.equal(1);
      expect(min).to.equal(-1 - 1);
    })
    it('should return expected range for a 2-bit unsigned integer', function() {
      const { min, max } = getIntRange(2, false);
      expect(max).to.equal(3);
      expect(min).to.equal(0);
    })

  })
})

