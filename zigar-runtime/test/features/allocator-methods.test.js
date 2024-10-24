import { expect } from 'chai';
import 'mocha-skip-if';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { FIXED, MEMORY } from '../../src/symbols.js';
import { defineProperties } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Feature: allocator-methods', function() {
  describe('defineAlloc', function() {
    it('should return descript for the alloc method', function() {
      const env = new Env();
      const struct = {
        ptr: {},
        vtable: {
          alloc(ptr, len, ptrAlign) {
            const dv = new DataView(new ArrayBuffer(len));
            dv[FIXED] = { address: 0x1000, len, align: 1 << ptrAlign };
            return {
              ['*']: {
                [MEMORY]: dv,
              }
            };
          },
          free() {},
        }
      };
      defineProperties(struct, {
        alloc: env.defineAlloc(),
      });
      const dv = struct.alloc(16, 4);
      expect(dv.byteLength).to.equal(16);
      expect(dv[FIXED].align).to.equal(4);
      expect(dv[FIXED].free).to.be.a('function');
    })
  })
  describe('defineFree', function() {
    it('should return descript for the free method', function() {
      const env = new Env();
      let freeArgs = null;
      const struct = {
        ptr: {},
        vtable: {
          alloc(ptr, len, ptrAlign) {
            const dv = new DataView(new ArrayBuffer(len));
            dv[FIXED] = { address: 0x1000, len, align: 1 << ptrAlign };
            return {
              ['*']: {
                [MEMORY]: dv,
              }
            };
          },
          free(ptr, slicePtr, ptrAlign) {
            freeArgs = { ptr, slicePtr, ptrAlign };
          },
        }
      };
      defineProperties(struct, {
        alloc: env.defineAlloc(),
        free: env.defineFree(),
      });
      const dv = struct.alloc(16, 4);
      struct.free(dv);
      expect(freeArgs.slicePtr['*'][MEMORY]).to.equal(dv);
      expect(freeArgs.ptrAlign).to.equal(2);
      expect(() => struct.free()).to.throw(TypeError);
      expect(() => struct.free({})).to.throw(TypeError);
    })
  })
  describe('defineDupe', function() {
    it('should return descript for the dupe method', function() {
      const env = new Env();
      const struct = {
        ptr: {},
        vtable: {
          alloc(ptr, len, ptrAlign) {
            const dv = new DataView(new ArrayBuffer(len));
            dv[FIXED] = { address: 0x1000, len, align: 1 << ptrAlign };
            return {
              ['*']: {
                [MEMORY]: dv,
              }
            };
          },
          free() {},
        }
      };
      defineProperties(struct, {
        alloc: env.defineAlloc(),
        free: env.defineFree(),
        dupe: env.defineDupe(),
      });
      const dv1 = struct.dupe('Hello world!');
      expect(dv1.byteLength).to.equal(12);
      const dv2 = struct.dupe(new DataView(new ArrayBuffer(4)));
      expect(dv2.byteLength).to.equal(4);
      const dv3 = struct.dupe(new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]));
      expect(dv3.byteLength).to.equal(8 * 8);
      expect(dv3.getFloat64(0, true)).to.equal(1);
      expect(dv3.getFloat64(8 * 7, true)).to.equal(8);
      const dv4 = struct.dupe(new ArrayBuffer(17));
      expect(dv4.byteLength).to.equal(17);
      expect(() => struct.dupe(1)).to.throw(TypeError);
      expect(() => struct.dupe({})).to.throw(TypeError);
    })
  })
})
