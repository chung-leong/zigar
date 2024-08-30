import { expect } from 'chai';
import { defineClass } from '../../../src/environment/class.js';

import AccessorAll from '../../../src/environment/accessors/all.js';
import AccessorInt from '../../../src/environment/accessors/int.js';
import All, { MemberType } from '../../../src/environment/members/all.js';
import Int, {
  isNeededByMember,
} from '../../../src/environment/members/int.js';
import Primitive from '../../../src/environment/members/primitive.js';
import { MEMORY } from '../../../src/symbol.js';

const Env = defineClass('MemberTest', [ All, Int, Primitive, AccessorAll, AccessorInt ]);

describe('Member: int', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Int, bitSize: 24, byteSize: 4, bitOffset: 8 };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object, slot: 1 };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('getDescriptorInt', function() {
    it('should return descriptor for int', function() {
      const env = new Env();
      const member = {
        type: MemberType.Int,
        byteSize: 4,
        bitSize: 24,
        bitOffset: 8,
        structure: {},
      };
      const { get, set } = env.getDescriptorInt(member);
      const object = { [MEMORY]: new DataView(new ArrayBuffer(5)) };
      set.call(object, -1234);
      expect(get.call(object)).to.equal(-1234);
    })
    it('should be invokable through getDescriptor', function() {
      const env = new Env();
      const member = {
        type: MemberType.Int,
        byteSize: 1,
        bitSize: 2,
        bitOffset: 0,
        structure: {},
      };
      env.getDescriptor(member);
      expect(() => env.getDescriptor(member)).to.not.throw();
    })
  })
})

