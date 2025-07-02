import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { getIntRange } from '../../src/features/runtime-safety.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Feature: runtime-safety', function() {
  describe('addRuntimeCheck', function() {
    it('should put wrapper around setter', function() {
      const env = new Env();
      const getAccessor = env.addRuntimeCheck(function(access, member) {
        return () => {};
      });
      const member1 = {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        bitOffset: 1,
      };
      const set1 = getAccessor('set', member1);
      expect(() => set1(0, 0, true)).to.not.throw();
      expect(() => set1(0, 0xFFFF_FFFF, true)).to.throw(TypeError);
      const member2 = {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        bitOffset: 1,
      };
      const set2 = getAccessor('set', member2);
      expect(() => set2(0, 0n, true)).to.not.throw();
      expect(() => set2(0, -1n, true)).to.throw(TypeError);
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
})