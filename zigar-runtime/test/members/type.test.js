import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import { MemberType } from '../../src/constants.js';
import All from '../../src/members/all.js';
import Type, {
  isNeededByMember,
} from '../../src/members/type.js';
import { SLOTS } from '../../src/symbols.js';

const Env = defineClass('MemberTest', [ All, Type ]);

describe('Member: type', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Type, slot: 1 };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object, slot: 1 };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('defineMemberType', function() {
    it('should return descriptor for type', function() {
      const env = new Env();
      const member = {
        type: MemberType.Type,
        slot: 1,
        structure: {},
      };
      const { get } = env.defineMemberType(member);
      const constructor = function() {};
      const object = {
        [SLOTS]: {
          1: { constructor },
        }
      };
      expect(get.call(object)).to.equal(constructor);
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Type,
        slot: 1,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

