import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import All, { MemberType } from '../../src/members/all.js';
import Undefined, {
  isNeededByMember,
} from '../../src/members/undefined.js';

const Env = defineClass('MemberTest', [ All, Undefined ]);

describe('Member: undefined', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Undefined };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('getDescriptorUndefined', function() {
    it('should return descriptor for undefined', function() {
      const env = new Env();
      const member = {
        type: MemberType.Undefined,
      };
      const { get } = env.getDescriptorUndefined(member);
      const object = {};
      expect(get.call(object)).to.be.undefined;
    })
    it('should be invokable through getDescriptor', function() {
      const env = new Env();
      const member = {
        type: MemberType.Undefined,
      };
      env.getDescriptor(member);
      expect(() => env.getDescriptor(member)).to.not.throw();
    })
  })
})

