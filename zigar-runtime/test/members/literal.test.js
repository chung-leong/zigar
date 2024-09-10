import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';
import { SLOTS } from '../../src/symbols.js';

import Baseline from '../../src/features/baseline.js';
import All from '../../src/members/all.js';
import Literal, {
  isNeededByMember,
} from '../../src/members/literal.js';

const Env = defineClass('MemberTest', [ Baseline, All, Literal ]);

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
  describe('defineMemberLiteral', function() {
    it('should return descriptor for literal', function() {
      const env = new Env();
      const member = {
        type: MemberType.Literal,
        slot: 1,
        structure: {},
      };
      const { get } = env.defineMemberLiteral(member);
      const object = {
        [SLOTS]: {
          1: { string: 'hello' }
        }
      };
      expect(get.call(object)).to.equal('hello');
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Literal,
        slot: 1,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

