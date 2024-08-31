import { expect } from 'chai';
import { defineClass } from '../../../src/environment/class.js';

import All, { MemberType } from '../../../src/environment/members/all.js';
import Obj, {
  isNeededByMember,
} from '../../../src/environment/members/object.js';
import { StructureType } from '../../../src/environment/structures/all.js';
import { SETTER, SLOTS } from '../../../src/symbol.js';

const Env = defineClass('MemberTest', [ All, Obj ]);

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
  describe('getDescriptorObject', function() {
    it('should return descriptor for object', function() {
      const env = new Env();
      const member = {
        type: MemberType.Object,
        slot: 1,
        structure: {
          type: StructureType.Struct,
        },
      };
      const { get, set } = env.getDescriptorObject(member);
      const struct = {
        value: 1,
        [SETTER]: function(arg) {
          Object.assign(this, arg);
        }
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
    it('should be invokable through getDescriptor', function() {
      const env = new Env();
      const member = {
        type: MemberType.Object,
        slot: 1,
        structure: {
          type: StructureType.Primitive,
        },
      };
      env.getDescriptor(member);
      expect(() => env.getDescriptor(member)).to.not.throw();
    })
  })
})

