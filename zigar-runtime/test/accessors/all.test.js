import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { AccessorAll } from '../../src/mixins.js';

const Env = defineEnvironment();

describe('Accessor: all', function() {
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
      expect(env.mixinUsage.get(AccessorAll)).to.be.true;
    })
  })
})
