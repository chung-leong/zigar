import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import All, { MemberType } from '../../src/members/all.js';
import Unsupported, {
  isNeededByMember,
} from '../../src/members/unsupported.js';

const Env = defineClass('MemberTest', [ All, Unsupported ]);

describe('Member: comptime', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Unsupported };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('defineMemberUndefined', function() {
    it('should return descriptor for comptime', function() {
      const env = new Env();
      const member = {
        type: MemberType.Unsupported,
      };
      const { get } = env.defineMemberUnsupported(member);
      const object = {};
      expect(() => get.call(object)).to.throw(TypeError)
        .with.property('message').that.contains('Unsupported');
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Unsupported,
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

