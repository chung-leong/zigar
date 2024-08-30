import { expect } from 'chai';
import { defineClass } from '../../../src/environment/class.js';

import AccessorAll from '../../../src/environment/accessors/all.js';
import AccessorFloat16 from '../../../src/environment/accessors/float16.js';
import All, { MemberType } from '../../../src/environment/members/all.js';
import Float, {
  isNeededByMember,
} from '../../../src/environment/members/float.js';
import Primitive from '../../../src/environment/members/primitive.js';
import { MEMORY } from '../../../src/symbol.js';

const Env = defineClass('MemberTest', [ All, Float, Primitive, AccessorAll, AccessorFloat16 ]);

describe('Member: float', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Float, bitSize: 16, byteSize: 2, bitOffset: 8 };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object, slot: 1 };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('getDescriptorFloat', function() {
    it('should return descriptor for float', function() {
      const env = new Env();
      const member = {
        type: MemberType.Float,
        byteSize: 2,
        bitSize: 16,
        bitOffset: 8,
        structure: {},
      };
      const { get, set } = env.getDescriptorFloat(member);
      const object = { [MEMORY]: new DataView(new ArrayBuffer(3)) };
      set.call(object, 3.25);
      expect(get.call(object)).to.equal(3.25);
    })
    it('should be invokable through getDescriptor', function() {
      const env = new Env();
      const member = {
        type: MemberType.Float,
        byteSize: 2,
        bitSize: 16,
        bitOffset: 8,
        structure: {},
      };
      env.getDescriptor(member);
      expect(() => env.getDescriptor(member)).to.not.throw();
    })
  })
})

