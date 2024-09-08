import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import { MemberFlag, MemberType, StructureType } from '../../src/constants.js';
import All from '../../src/members/all.js';
import Size, {
  isNeededByMember,
  isNeededByStructure,
} from '../../src/members/size.js';

const Env = defineClass('MemberTest', [ Size, All, AccessorAll ]);

describe('Member: size', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const members = [
        { type: MemberType.Int, bitSize: 32, byteSize: 4, flags: MemberFlag.IsSize },
        { type: MemberType.Uint, bitSize: 64, byteSize: 8, flags: MemberFlag.IsSize },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.true;
      }
    })
    it('should return false when mixin is not needed by a member', function() {
      const members = [
        { type: MemberType.Bool, bitSize: 1, byteSize: 1, bitOffset: 32 },
        { type: MemberType.Uint, bitSize: 32, byteSize: 4 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.false;
      }
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
  describe('addSizeAdjustment', function() {
    it('should put wrapper around setter', function() {
      const env = new Env();
      const list = [];
      const getAccessor = env.addSizeAdjustment(function(access, member) {
        return function(offset, value) {
          list.push(value)
        };
      });
      const member1 = {
        type: MemberType.Int,
        flags: MemberFlag.IsSize,
        bitSize: 32,
        byteSize: 4,
        bitOffset: 1,
      };
      const set1 = getAccessor('set', member1);
      const member2 = {
        type: MemberType.Uint,
        flags: MemberFlag.IsSize,
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
  })
})