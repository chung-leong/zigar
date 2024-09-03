import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorFloat16 from '../../src/accessors/float16.js';
import All, { MemberType } from '../../src/members/all.js';
import Float, {
  isNeededByMember,
} from '../../src/members/float.js';
import Primitive from '../../src/members/primitive.js';
import { MEMORY } from '../../src/symbols.js';

const Env = defineClass('MemberTest', [ All, Float, Primitive, AccessorAll, AccessorFloat16 ]);

describe('Member: float', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Float, bitSize: 16, byteSize: 2, bitOffset: 8 };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object, slot: 1 };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('defineMemberFloat', function() {
    it('should return descriptor for float', function() {
      const env = new Env();
      const member = {
        type: MemberType.Float,
        byteSize: 2,
        bitSize: 16,
        bitOffset: 8,
        structure: {},
      };
      const { get, set } = env.defineMemberFloat(member);
      const object = { [MEMORY]: new DataView(new ArrayBuffer(3)) };
      set.call(object, 3.25);
      expect(get.call(object)).to.equal(3.25);
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Float,
        byteSize: 2,
        bitSize: 16,
        bitOffset: 8,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

