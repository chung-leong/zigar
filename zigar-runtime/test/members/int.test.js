import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';
import { MEMORY } from '../../src/symbols.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorInt from '../../src/accessors/int.js';
import Baseline from '../../src/features/baseline.js';
import IntConversion from '../../src/features/int-conversion.js';
import All from '../../src/members/all.js';
import Int, {
  isNeededByMember,
} from '../../src/members/int.js';
import Primitive from '../../src/members/primitive.js';

const Env = defineClass('MemberTest', [
  Baseline, All, Int, Primitive, AccessorAll, AccessorInt, IntConversion,
]);

describe('Member: int', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Int, bitSize: 24, byteSize: 4, bitOffset: 8 };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object, slot: 1 };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('defineMemberInt', function() {
    it('should return descriptor for int', function() {
      const env = new Env();
      const member = {
        type: MemberType.Int,
        byteSize: 4,
        bitSize: 24,
        bitOffset: 8,
        structure: {},
      };
      const { get, set } = env.defineMemberInt(member);
      const object = { [MEMORY]: new DataView(new ArrayBuffer(5)) };
      set.call(object, -1234);
      expect(get.call(object)).to.equal(-1234);
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Int,
        byteSize: 1,
        bitSize: 2,
        bitOffset: 0,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

