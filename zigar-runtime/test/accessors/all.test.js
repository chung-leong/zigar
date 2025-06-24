import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { AccessorAll } from '../../src/mixins-wasi.js';
import { FALLBACK } from '../../src/symbols.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Accessor: all', function() {
  describe('getAccessor', function() {
    it('should return builtin methods', function() {
      const env = new Env();
      env.trackingMixins = true;
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
    if (process.env.TARGET === 'node') {
      it('should handle buffer fallback', function() {
        const env = new Env();
        env.requireBufferFallback = () => true;
        const method1 = env.getAccessor('get', {
          type: MemberType.Uint,
          bitSize: 8,
          byteSize: 1,
          bitOffset: 0,
        });
        expect(method1).to.not.equal(DataView.prototype.getUint8);
        const buffer = new ArrayBuffer(1);
        const dv = new DataView(buffer);
        dv.setUint8(0, 123);
        expect(method1.call(dv, 0)).to.equal(123);
        buffer[FALLBACK] = usize(0x1000);
        env.getNumericValue = function(type, bits, address) {
          expect(type).to.equal(MemberType.Uint);
          expect(bits).to.equal(8);
          expect(address).to.equal(usize(0x1000));
          return 88;
        };
        expect(method1.call(dv, 0)).to.equal(88);
        expect(() => method1.call(dv, -1)).to.throw();
        expect(() => method1.call(dv, 1)).to.throw();
        const method2 = env.getAccessor('set', {
          type: MemberType.Uint,
          bitSize: 8,
          byteSize: 1,
          bitOffset: 0,
        });
        expect(method2).to.not.equal(DataView.prototype.setUint8);
        env.setNumericValue = function(type, bits, address, value) {
          expect(type).to.equal(MemberType.Uint);
          expect(bits).to.equal(8);
          expect(address).to.equal(usize(0x1000));
          expect(value).to.equal(44);
        };
        method2.call(dv, 0, 44);
        buffer[FALLBACK] = undefined;
        method2.call(dv, 0, 44);
        expect(dv.getUint8(0)).to.equal(44);
      })
    }
  })
})
