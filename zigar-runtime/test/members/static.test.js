import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import All, { MemberType } from '../../src/members/all.js';
import Static, {
  isNeededByMember,
} from '../../src/members/static.js';
import { StructureType } from '../../src/structures/all.js';
import { SLOTS } from '../../src/symbols.js';

const Env = defineClass('MemberTest', [ All, Static ]);

describe('Member: static', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Static, slot: 1 };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object, slot: 1 };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('defineMemberStatic', function() {
    it('should return descriptor for static', function() {
      const env = new Env();
      const member = {
        type: MemberType.Static,
        slot: 1,
        structure: {
          type: StructureType.Primitive,
        },
      };
      const { get, set } = env.defineMemberStatic(member);
      let value;
      const object = {
        [SLOTS]: {
          1: {
            [SELF]: { get: () => 124, set: v => value = v },
          }
        }
      };
      expect(get.call(object)).to.equal(124);
      set.call(object, 777);
      expect(value).to.equal(777);
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Static,
        slot: 1,
        structure: {
          type: StructureType.Primitive,
        },
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

