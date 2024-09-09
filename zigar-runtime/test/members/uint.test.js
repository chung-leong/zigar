import { expect } from 'chai';
import { MemberType, StructureType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';
import { MEMORY } from '../../src/symbols.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorUint from '../../src/accessors/uint.js';
import IntConversion from '../../src/features/int-conversion.js';
import All from '../../src/members/all.js';
import Primitive from '../../src/members/primitive.js';
import Uint, {
  isNeededByMember,
  isNeededByStructure,
} from '../../src/members/uint.js';

const Env = defineClass('MemberTest', [
  All, Uint, Primitive, AccessorAll, AccessorUint, IntConversion
]);

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
  describe('isNeededByStructure', function() {
    it('should return true when mixin is needed by a structure', function() {
      const structure = { type: StructureType.Pointer };
      expect(isNeededByStructure(structure)).to.be.true;
    })
    it('should return false when mixin is not needed by a structure', function() {
      const structure = { type: StructureType.Primitive };
      expect(isNeededByStructure(structure)).to.be.false;
    })
  })
  describe('defineMemberUint', function() {
    it('should return descriptor for uint', function() {
      const env = new Env();
      const member = {
        type: MemberType.Uint,
        byteSize: 4,
        bitSize: 24,
        bitOffset: 8,
        structure: {},
      };
      const { get, set } = env.defineMemberUint(member);
      const object = { [MEMORY]: new DataView(new ArrayBuffer(5)) };
      set.call(object, 1234);
      expect(get.call(object)).to.equal(1234);
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Uint,
        byteSize: 1,
        bitSize: 2,
        bitOffset: 0,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

