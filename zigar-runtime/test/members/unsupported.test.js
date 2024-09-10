import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';

import Baseline from '../../src/features/baseline.js';
import All from '../../src/members/all.js';
import Unsupported, {
  isNeededByMember,
} from '../../src/members/unsupported.js';

const Env = defineClass('MemberTest', [ Baseline, All, Unsupported ]);

describe('Member: unsupported', function() {
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
    it('should return descriptor for unsupported', function() {
      const env = new Env();
      const member = {
        type: MemberType.Unsupported,
        structure: {},
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
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

