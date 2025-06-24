import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { CACHE, COPY, MEMORY, RESTORE, SLOTS, VISIT } from '../../src/symbols.js';
import { defineProperties, ObjectCache } from '../../src/utils.js';
import { delay, usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: object-linkage', function() {
  describe('linkVariables', function() {
    it('should link variables', function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.recreateAddress = function(handle) {
          return usize(handle);
        };
      }
      env.obtainZigView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv.address = address;
        return dv;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      defineProperties(Test.prototype, {
        [COPY]: env.defineCopier(4),
      });
      const object = new Test(new DataView(new ArrayBuffer(4)));
      const dv = object[MEMORY];
      dv.setUint32(0, 1234, true);
      env.variables.push({ object, handle: 128 });
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      }
      env.linkVariables(true);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
    });
    it('should replace JS memory with Zig memory', function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.recreateAddress = function(handle) {
          return usize(handle);
        };
      }
      env.obtainZigView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv.address = address;
        return dv;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      defineProperties(Test.prototype, {
        [COPY]: env.defineCopier(4),
      });
      const object = new Test(new DataView(new ArrayBuffer(4)));
      const dv = object[MEMORY];
      dv.setUint32(0, 1234, true);
      env.variables.push({ object, handle: 0x1000 })
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      }
      env.linkVariables(true);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
    })
    it('should omit copying when writeBack is false', function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.recreateAddress = function(handle) {
          return usize(handle);
        };
      }
      env.obtainZigView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv.address = address;
        return dv;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      defineProperties(Test.prototype, {
        [COPY]: env.defineCopier(4),
      });
      const object = new Test(new DataView(new ArrayBuffer(4)));
      const dv = object[MEMORY];
      dv.setUint32(0, 1234, true);
      env.variables.push({ object, handle: 0x1000 })
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      }
      env.linkVariables(false);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[MEMORY].getUint32(0, true)).to.not.equal(1234);
    })
    it('should link child objects', function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.recreateAddress = function(handle) {
          return usize(handle);
        };
      }
      env.obtainZigView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv.address = address;
        return dv;
      };
      const Child = function(dv) {
        this[MEMORY] = dv;
      }
      defineProperties(Child.prototype, {
        [COPY]: env.defineCopier(4),
      });
      defineProperties(Child, {
        [CACHE]: { value: new ObjectCache() },
      });
      const Test = function(dv) {
        this[MEMORY] = dv;
        this[SLOTS] = {
          0: new Child(new DataView(dv.buffer, 0, 8)),
        }
      };
      let visited = false;
      defineProperties(Test.prototype, {
        [COPY]: env.defineCopier(4),
        [VISIT]: { value: function() { visited = true } },
      });
      defineProperties(Test, {
        [CACHE]: { value: new ObjectCache() },
      });
      const dv = new DataView(new ArrayBuffer(32));
      const object = new Test(dv);
      env.variables.push({ object, handle: 0x1000 })
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      }
      env.linkVariables(true);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[SLOTS][0][MEMORY].buffer).to.equal(object[MEMORY].buffer);
      expect(visited).to.be.true;
    })
    if (process.env.TARGET === 'wasm') {
      it('should link variables after initialization promise is fulfilled', async function() {
        const env = new Env();
        env.initPromise = delay(25);
        const cache = new ObjectCache();
        const Type = function() {};
        defineProperties(Type.prototype, {
          [COPY]: env.defineCopier(4),
          [RESTORE]: env.defineRestorer(cache),
        });
        const object = new Type();
        const dv = object[MEMORY] = new DataView(new ArrayBuffer(4));
        dv.setUint32(0, 1234, true);
        env.variables.push({ object, handle: 128 });
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        env.linkVariables(true);
        await env.initPromise;
        expect(object[MEMORY]).to.not.equal(dv);
        expect(object[MEMORY].buffer).to.equal(memory.buffer);
        expect(object[MEMORY].byteOffset).to.equal(128);
        expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
      });
    }
  })
})
