import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import { MemberType } from '../../src/constants.js';
import All from '../../src/members/all.js';
import Null, {
  isNeededByMember,
} from '../../src/members/null.js';

const Env = defineClass('MemberTest', [ All, Null ]);

describe('Member: null', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Null };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('defineMemberNull', function() {
    it('should return descriptor for comptime', function() {
      const env = new Env();
      const member = {
        type: MemberType.Null,
        structure: {},
      };
      const { get } = env.defineMemberNull(member);
      const object = {};
      expect(get.call(object)).to.null;
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Null,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

