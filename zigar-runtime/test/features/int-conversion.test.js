import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import { MemberFlag, MemberType, StructureType } from '../../src/constants.js';
import IntConversion, {
  isNeededByMember,
  isNeededByStructure,
} from '../../src/features/int-conversion.js';

const Env = defineClass('MemberTest', [ IntConversion ]);

describe('Feature: int-conversion', function() {
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
  describe('addIntConversion', function() {
    it('should put wrapper around setter', function() {
      const env = new Env();
      const list = [];
      const getAccessor = env.addIntConversion(function(access, member) {
        return function(offset, value) {
          list.push(value)
        };
      });
      const member1 = {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        bitOffset: 1,
      };
      const set1 = getAccessor('set', member1);
      const member2 = {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        bitOffset: 1,
      };
      const set2 = getAccessor('set', member2);
      set1.call(null, 1, 1234n);
      set1.call(null, 1, 1234);
      set2.call(null, 1, 1234n);
      set2.call(null, 1, 1234);
      expect(list).to.eql([ 1234, 1234, 1234n, 1234n ]);
    })
    it('should put wrapper around setter', function() {
      const env = new Env();
      const getAccessor = env.addIntConversion(function(access, member) {
        return () => 1234n;
      });
      const member = {
        type: MemberType.Uint,
        flags: MemberFlag.IsSize,
        bitSize: 64,
        byteSize: 8,
        bitOffset: 1,
      };
      const get = getAccessor('get', member);
      expect(get.call(null, 1, true)).to.equal(1234);
    })

  })
})

