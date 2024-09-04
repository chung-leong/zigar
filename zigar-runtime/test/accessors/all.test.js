import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';

import All, {
  isNeededByMember,
} from '../../src/accessors/all.js';

const Env = defineClass('AccessorTest', [ All ]);

describe('Accessor: all', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const members = [
        { type: MemberType.Bool, bitSize: 1, byteSize: 1, bitOffset: 32 },
        { type: MemberType.Int, bitSize: 8, byteSize: 1, bitOffset: 9 },
        { type: MemberType.Uint, bitSize: 64, byteSize: 8, bitOffset: 64 },
        { type: MemberType.Float, bitSize: 32, byteSize: 4, bitOffset: 0 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.true;
      }
    })
    it('should return false when mixin is not needed by a member', function() {
      const members = [
        { type: MemberType.Literal, slot: 1 },
        { type: MemberType.Comptime, slot: 1 },
        { type: MemberType.Object, slot: 1 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.false;
      }
    })
  })
  describe('getAccessor', function() {
    it('should return builtin methods', function() {
      const env = new Env();
      const method1 = env.getAccessor('get', {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        bitOffset: 0,
      });
      expect(method1).to.equal(DataView.prototype.getUint8);
      const method2 = env.getAccessor('set', {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        bitOffset: 0,
      });
      expect(method2).to.equal(DataView.prototype.setUint8);
      const method3 = env.getAccessor('get', {
        type: MemberType.Int,
        bitSize: 64,
        byteSize: 8,
        bitOffset: 0,
      });
      expect(method3).to.equal(DataView.prototype.getBigInt64);
      const method4 = env.getAccessor('set', {
        type: MemberType.Int,
        bitSize: 64,
        byteSize: 8,
        bitOffset: 0,
      });
      expect(method4).to.equal(DataView.prototype.setBigInt64);
    })
  })
})
