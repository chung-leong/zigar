import { expect } from 'chai';
import { MemberType, StructureType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';
import { SLOTS } from '../../src/symbols.js';

import Baseline from '../../src/features/baseline.js';
import All from '../../src/members/all.js';
import ObjectMixin, {
  isNeededByMember,
} from '../../src/members/object.js';

const Env = defineClass('MemberTest', [ Baseline, All, ObjectMixin ]);

describe('Member: object', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Object, slot: 1 };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Static, slot: 1 };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('defineMemberObject', function() {
    it('should return descriptor for object', function() {
      const env = new Env();
      const member = {
        type: MemberType.Object,
        slot: 1,
        structure: {
          type: StructureType.Struct,
        },
      };
      const { get, set } = env.defineMemberObject(member);
      const struct = {
        value: 1,
      };
      const object = {
        [SLOTS]: {
          1: struct,
        }
      };
      expect(get.call(object)).to.equal(struct);
      set.call(object, { value: 2 });
      expect(struct.value).to.equal(2);
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Object,
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

