import { expect } from 'chai';
import { defineClass } from '../../../src/environment/class.js';

import All, { MemberType } from '../../../src/environment/members/all.js';
import Literal, {
  isNeededByMember,
} from '../../../src/environment/members/literal.js';
import { SLOTS } from '../../../src/symbol.js';

const Env = defineClass('MemberTest', [ All, Literal ]);

describe('Member: literal', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Literal, slot: 1 };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object, slot: 1 };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('getDescriptorLiteral', function() {
    it('should return descriptor for literal', function() {
      const env = new Env();
      const member = {
        type: MemberType.Literal,
        slot: 1,
        structure: {},
      };
      const { get } = env.getDescriptorLiteral(member);
      const object = {
        [SLOTS]: {
          1: { string: 'hello' }
        }
      };
      expect(get.call(object)).to.equal('hello');
    })
    it('should be invokable through getDescriptor', function() {
      const env = new Env();
      const member = {
        type: MemberType.Literal,
        slot: 1,
        structure: {},
      };
      env.getDescriptor(member);
      expect(() => env.getDescriptor(member)).to.not.throw();
    })
  })
})

