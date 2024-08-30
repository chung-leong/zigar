import { expect } from 'chai';
import { defineClass } from '../../../src/environment/class.js';

import All, { MemberType } from '../../../src/environment/members/all.js';
import Null, {
  isNeededByMember,
} from '../../../src/environment/members/null.js';

const Env = defineClass('MemberTest', [ All, Null ]);

describe('Member: comptime', function() {
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
  describe('getDescriptorNull', function() {
    it('should return descriptor for comptime', function() {
      const env = new Env();
      const member = {
        type: MemberType.Null,
      };
      const { get } = env.getDescriptorNull(member);
      const object = {};
      expect(get.call(object)).to.null;
    })
    it('should be invokable through getDescriptor', function() {
      const env = new Env();
      const member = {
        type: MemberType.Null,
      };
      env.getDescriptor(member);
      expect(() => env.getDescriptor(member)).to.not.throw();
    })
  })
})

