import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import {
  ADDRESS, COPY, LAST_ADDRESS, LAST_LENGTH, LENGTH, MEMORY, RESTORE, SLOTS, TARGET, ZIG,
} from '../../src/symbols.js';
import { adjustAddress, defineProperties, ObjectCache } from '../../src/utils.js';
import { delay, usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: object-linkage', function() {
  describe('linkVariables', function() {
    it('should link variables', function() {
      const env = new Env();
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
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
      env.variables.push({ object, reloc: 128 });
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      }
      env.linkVariables(true);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
    });
    it('should add target location to pointer', function() {
      const env = new Env();
      env.recreateAddress = function(address) {
        return adjustAddress(usize(address), 0x1000);
      };
      env.obtainZigView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv.address = address;
        return dv;
      };
      env.getBufferAddress = function(buffer) {
        return usize(0x4000);
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
        this[SLOTS] = {
          0: {
            [MEMORY]: new DataView(new ArrayBuffer(32)),
          }
        };
      };
      defineProperties(Test.prototype, {
        [COPY]: env.defineCopier(32),
        [TARGET]: {
          get() {
            return {
              [MEMORY]: new DataView(new ArrayBuffer(32)),
              length: 4,
            };
          },
        },
        [ADDRESS]: {
          set(address) {
            object[LAST_ADDRESS] = address;
          },
        },
        [LENGTH]: {
          set(length) {
            object[LAST_LENGTH] = length;
          },
        },
      });
      const object = new Test(new DataView(new ArrayBuffer(4)));
      env.variables.push({ object, reloc: 128 });
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      }
      env.linkVariables(false);
      expect(object[LAST_ADDRESS]).to.equal(usize(0x4000));
      expect(object[LAST_LENGTH]).to.equal(4);
    });
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
        env.variables.push({ object, reloc: 128 });
        env.linkVariables(true);
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        await env.initPromise;
        expect(object[MEMORY]).to.not.equal(dv);
        expect(object[MEMORY].buffer).to.equal(memory.buffer);
        expect(object[MEMORY].byteOffset).to.equal(128);
        expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
      });
    }
  })
  describe('linkObject', function() {
    it('should replace relocatable memory with Zig memory', function() {
      const env = new Env();
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
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
      env.linkObject(object, 0x1000, true);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
    })
    it('should omit copying when writeBack is false', function() {
      const env = new Env();
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
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
      env.linkObject(object, 0x1000, false);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[MEMORY].getUint32(0, true)).to.not.equal(1234);
    })
    it('should ignore object already with Zig memory', function() {
      const env = new Env();
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      const zig = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv[ZIG] = { address, len }
        return dv;
      }
      defineProperties(Test.prototype, {
        [COPY]: env.defineCopier(4),
      });
      const object = new Test(zig(0x1000, 4));
      const dv = object[MEMORY];
      env.linkObject(object, 0x1000, true);
      expect(object[MEMORY]).to.equal(dv);
    })
    it('should link child objects', function() {
      const env = new Env();
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
      env.obtainZigView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv.address = address;
        return dv;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
        this[SLOTS] = {
          0: {
            [MEMORY]: new DataView(dv.buffer, 0, 8),
          }
        }
      };
      defineProperties(Test.prototype, {
        [COPY]: env.defineCopier(4),
      });
      const object = new Test(new DataView(new ArrayBuffer(32)));
      const dv = object[MEMORY];
      env.linkObject(object, 0x1000, true);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[SLOTS][0][MEMORY].buffer).to.equal(object[MEMORY].buffer);
    })
  })
  describe('unlinkVariables', function() {
    it('should pass variables to unlinkObject', function() {
      const env = new Env();
      let nextAddress = usize(0x1000);
      env.allocateExternMemory = function(type, len, align) {
        const address = nextAddress
        nextAddress += usize(len * 0x0F);
        return address;
      };
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[ZIG] = { address, len };
        return this.obtainView(buffer, 0, len);
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      defineProperties(Test.prototype, {
        [COPY]: env.defineCopier(16),
        [RESTORE]: {
          value: function() {},
        }
      });
      env.allocateMemory(16, 8, true);
      const object1 = new Test(env.allocateMemory(16, 8, true));
      const object2 = new Test(env.allocateMemory(16, 8, true));
      env.variables.push({ name: 'a', object: object1 });
      env.variables.push({ name: 'b', object: object2 });
      env.unlinkVariables();
      expect(object1[MEMORY][ZIG]).to.be.undefined;
      expect(object2[MEMORY][ZIG]).to.be.undefined;
    })
  })
  describe('unlinkObject', function() {
    it('should replace buffer in Zig memory with ones in relocatable memory', function() {
      const env = new Env();
      const viewMap = new Map(), addressMap = new Map();
      let nextAddress = usize(0x1000);
      const allocator = {
        alloc(len, align) {
          const address = nextAddress;
          nextAddress += usize(0x1000);
          const dv = new DataView(new ArrayBuffer(len));
          dv[ZIG] = { address, len, allocator: this };
          viewMap.set(address, dv);
          addressMap.set(dv, address);
          return dv;
        },
        free(dv) {
        },
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      defineProperties(Test.prototype, {
        [COPY]: env.defineCopier(16),
        [RESTORE]: {
          value: function() {},
        }
      });

      const object = new Test(env.allocateMemory(16, 8, allocator));
      const dv = object[MEMORY];
      expect(dv[ZIG]).to.be.an('object');
      dv.setUint32(12, 1234, true);
      env.unlinkObject(object);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(dv.getUint32(12, true)).to.equal(1234);
      expect(object[MEMORY][ZIG]).to.be.undefined;
      // should do nothing
      env.unlinkObject(object);
    })
  })
  if (process.env.TARGET === 'wasm') {
    describe('recreateAddress', function() {
      it('should return the same address', function() {
        const env = new Env();
        const address = env.recreateAddress(128);
        expect(address).to.equal(128);
      })
    })
  }
})
