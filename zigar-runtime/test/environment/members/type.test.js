import { expect } from 'chai';
import { defineClass } from '../../../src/environment/class.js';

import All, { MemberType } from '../../../src/environment/members/all.js';
import Type, {
  isNeededByMember,
} from '../../../src/environment/members/type.js';
import { SLOTS } from '../../../src/symbol.js';

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
  describe('getDescriptorType', function() {
    it('should return descriptor for type', function() {
      const env = new Env();
      const member = {
        type: MemberType.Type,
        slot: 1,
        structure: {},
      };
      const { get } = env.getDescriptorType(member);
      const constructor = function() {};
      const object = {
        [SLOTS]: {
          1: { constructor },
        }
      };
      expect(get.call(object)).to.equal(constructor);
    })
    it('should be invokable through getDescriptor', function() {
      const env = new Env();
      const member = {
        type: MemberType.Type,
        slot: 1,
        structure: {},
      };
      env.getDescriptor(member);
      expect(() => env.getDescriptor(member)).to.not.throw();
    })
  })
})

