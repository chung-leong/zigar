import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorUint from '../../src/accessors/uint.js';
import All, { MemberType } from '../../src/members/all.js';
import Primitive from '../../src/members/primitive.js';
import Uint, {
  isNeededByMember,
} from '../../src/members/uint.js';
import { MEMORY } from '../../src/symbols.js';

const Env = defineClass('MemberTest', [ All, Uint, Primitive, AccessorAll, AccessorUint ]);

describe('Member: uint', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Uint, bitSize: 24, byteSize: 4, bitOffset: 8 };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object, slot: 1 };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('getDescriptorUint', function() {
    it('should return descriptor for uint', function() {
      const env = new Env();
      const member = {
        type: MemberType.Uint,
        byteSize: 4,
        bitSize: 24,
        bitOffset: 8,
        structure: {},
      };
      const { get, set } = env.getDescriptorUint(member);
      const object = { [MEMORY]: new DataView(new ArrayBuffer(5)) };
      set.call(object, 1234);
      expect(get.call(object)).to.equal(1234);
    })
    it('should be invokable through getDescriptor', function() {
      const env = new Env();
      const member = {
        type: MemberType.Uint,
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

