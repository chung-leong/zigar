import { expect } from 'chai';

import { MemberType, getTypeName, getIntRange } from '../src/type.js';

describe('Type functions', function() {
  describe('getTypeName', function() {
    it('should return the name for a integer type', function() {
      const name = getTypeName(MemberType.Int, true, 32);
      expect(name).to.equal('Int32');
    })
    it('should return the correct name for unsigned integers', function() {
      const name = getTypeName(MemberType.Int, false, 32);
      expect(name).to.equal('Uint32');
    })
    it('should prefix name with "Big" when an integer is bigger than 32-bit', function() {
      const name = getTypeName(MemberType.Int, false, 33);
      expect(name).to.equal('BigUint33');
    })
    it('should return the correct names for floats', function() {
      const name1 = getTypeName(MemberType.Float, false, 32);
      const name2 = getTypeName(MemberType.Float, false, 64);
      const name3 = getTypeName(MemberType.Float, false, 128);
      expect(name1).to.equal('Float32');
      expect(name2).to.equal('Float64');
      expect(name3).to.equal('Float128');
    })
    it('should return the correct names for boolean', function() {
      const name = getTypeName(MemberType.Bool, false, 1);
      expect(name).to.equal('Bool');
    })
    it('should return "Null" for Void', function() {
      const name = getTypeName(MemberType.Void, false, 0);
      expect(name).to.equal('Null');
    })
  })
  describe('getIntRange', function() {
    it('should return expected range for a 8-bit signed integer', function() {
      const { min, max } = getIntRange(true, 8);
      expect(max).to.equal(127);
      expect(min).to.equal(-127 - 1);
    })
    it('should return expected range for a 8-bit unsigned integer', function() {
      const { min, max } = getIntRange(false, 8);
      expect(max).to.equal(255);
      expect(min).to.equal(0);
    })
    it('should return expected range for a 16-bit signed integer', function() {
      const { min, max } = getIntRange(true, 16);
      expect(max).to.equal(32767);
      expect(min).to.equal(-32767 - 1);
    })
    it('should return expected range for a 16-bit unsigned integer', function() {
      const { min, max } = getIntRange(false, 16);
      expect(max).to.equal(65535);
      expect(min).to.equal(0);
    })
    it('should return expected range for a 32-bit signed integer', function() {
      const { min, max } = getIntRange(true, 32);
      expect(max).to.equal(2147483647);
      expect(min).to.equal(-2147483647 - 1);
    })
    it('should return expected range for a 32-bit unsigned integer', function() {
      const { min, max } = getIntRange(false, 32);
      expect(max).to.equal(4294967295);
      expect(min).to.equal(0);
    })
    it('should return expected range for a 64-bit signed integer', function() {
      const { min, max } = getIntRange(true, 64);
      expect(max).to.equal(9223372036854775807n);
      expect(min).to.equal(-9223372036854775807n - 1n);
    })
    it('should return expected range for a 64-bit unsigned integer', function() {
      const { min, max } = getIntRange(false, 64);
      expect(max).to.equal(18446744073709551615n);
      expect(min).to.equal(0n);
    })
    it('should return expected range for a 2-bit signed integer', function() {
      const { min, max } = getIntRange(true, 2);
      expect(max).to.equal(1);
      expect(min).to.equal(-1 - 1);
    })
    it('should return expected range for a 2-bit unsigned integer', function() {
      const { min, max } = getIntRange(false, 2);
      expect(max).to.equal(3);
      expect(min).to.equal(0);
    })

  })
})

