import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { AccessorAll } from '../../src/mixins.js';
import { FALLBACK } from '../../src/symbols.js';
import { createView } from '../../src/utils.js';

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
          bitSize: 32,
          byteSize: 4,
        });
        const le = env.littleEndian;
        expect(method1).to.not.equal(DataView.prototype.getUint8);
        const dv = createView(8);
        dv.setUint32(4, 123, le);
        let called1 = false;
        dv[FALLBACK] = (to, offset, len) => {
          expect(to).to.be.false;
          expect(len).to.equal(4);
          called1 = true;
        };
        expect(method1.call(dv, 4, le)).to.equal(123);
        expect(called1).to.be.true;
        expect(() => method1.call(dv, -1, le)).to.throw();
        expect(() => method1.call(dv, 9, le)).to.throw();
        const method2 = env.getAccessor('set', {
          type: MemberType.Uint,
          bitSize: 32,
          byteSize: 4,
        });
        expect(method2).to.not.equal(DataView.prototype.setUint8);
        let called2 = false;
        dv[FALLBACK] = (to, offset, len) => {
          expect(to).to.be.true;
          expect(len).to.equal(4);
          called2 = true;
        };
        method2.call(dv, 0, 44, le);
        expect(called2).to.be.true;
        expect(dv.getUint32(0, le)).to.equal(44);
      })
    }
  })
})
