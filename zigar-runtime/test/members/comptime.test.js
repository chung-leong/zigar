import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import All, { MemberType } from '../../src/members/all.js';
import Comptime, {
  isNeededByMember,
} from '../../src/members/comptime.js';
import { SLOTS } from '../../src/symbols.js';

const Env = defineClass('MemberTest', [ All, Comptime ]);

describe('Member: comptime', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Comptime, slot: 1 };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object, slot: 1 };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('getDescriptorComptime', function() {
    it('should return descriptor for comptime', function() {
      const env = new Env();
      const member = {
        type: MemberType.Comptime,
        slot: 1,
        structure: {},
      };
      const { get } = env.getDescriptorComptime(member);
      const object = {
        [SLOTS]: {
          1: 1234
        }
      };
      expect(get.call(object)).to.equal(1234);
    })
    it('should be invokable through getDescriptor', function() {
      const env = new Env();
      const member = {
        type: MemberType.Comptime,
        slot: 1,
        structure: {},
      };
      env.getDescriptor(member);
      expect(() => env.getDescriptor(member)).to.not.throw();
    })
  })
})

