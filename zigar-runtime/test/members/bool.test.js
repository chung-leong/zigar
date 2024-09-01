import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorBool from '../../src/accessors/bool.js';
import All, { MemberType } from '../../src/members/all.js';
import Bool, {
  isNeededByMember,
} from '../../src/members/bool.js';
import Primitive from '../../src/members/primitive.js';
import { MEMORY } from '../../src/symbols.js';

const Env = defineClass('MemberTest', [ All, Bool, Primitive, AccessorAll, AccessorBool ]);

describe('Member: bool', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Bool, bitSize: 1, byteSize: 1, bitOffset: 0 };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object, slot: 1 };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('getDescriptorBool', function() {
    it('should return descriptor for bool', function() {
      const env = new Env();
      const member = {
        type: MemberType.Bool,
        byteSize: 1,
        bitSize: 1,
        bitOffset: 8,
        structure: {},
      };
      const { get, set } = env.getDescriptorBool(member);
      const object = { [MEMORY]: new DataView(new ArrayBuffer(2)) };
      set.call(object, true);
      expect(get.call(object)).to.equal(true);
    })
    it('should be invokable through getDescriptor', function() {
      const env = new Env();
      const member = {
        type: MemberType.Bool,
        byteSize: 1,
        bitSize: 1,
        bitOffset: 0,
        structure: {},
      };
      env.getDescriptor(member);
      expect(() => env.getDescriptor(member)).to.not.throw();
    })
  })
})

