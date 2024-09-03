import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import DataCopying from '../../src/features/data-copying.js';
import MemoryMapping from '../../src/features/memory-mapping.js';
import ObjectLinkage from '../../src/features/object-linkage.js';
import ViewManagement from '../../src/features/view-management.js';
import StructureAll from '../../src/structures/all.js';
import {
  ADDRESS, COPY, FIXED,
  LAST_ADDRESS,
  LAST_LENGTH,
  MEMORY, RESTORE, SLOTS,
  TARGET
} from '../../src/symbols.js';
import { defineProperties } from '../../src/utils.js';

const Env = defineClass('FeatureTest', [
  ObjectLinkage, StructureAll, DataCopying, ViewManagement, MemoryMapping,
]);

describe('Feature: object-linkage', function() {
  describe('linkVariables', function() {
    it('should link variables', function() {
      const env = new Env();
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
      env.obtainFixedView = function(address, len) {
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
      env.linkVariables(true);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
    });
    it('should add target location to pointer', function() {
      const env = new Env();
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
      env.obtainFixedView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv.address = address;
        return dv;
      };
      env.getBufferAddress = function(buffer) {
        return 0x4000;
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
          get: function() {
            return {
              [MEMORY]: new DataView(new ArrayBuffer(32)),
              length: 4,
            };
          },
        },
        [ADDRESS]: {
          set: function(address) {
            object[LAST_ADDRESS] = address;
          },
        },
        [LENGTH]: {
          value: function(length) {
            object[LAST_LENGTH] = length;
          },
        },
      });
      const object = new Test(new DataView(new ArrayBuffer(4)));
      env.variables.push({ object, reloc: 128 });
      env.linkVariables(false);
      expect(object[LAST_ADDRESS]).to.equal(0x4000);
      expect(object[LAST_LENGTH]).to.equal(4);
    });
  })
  describe('linkObject', function() {
    it('should replace relocatable memory with fixed memory', function() {
      const env = new Env();
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
      env.obtainFixedView = function(address, len) {
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
      env.obtainFixedView = function(address, len) {
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
    it('should ignore object already with fixed memory', function() {
      const env = new Env();
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      const fixed = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv[FIXED] = { address, len }
        return dv;
      }
      defineProperties(Test.prototype, {
        [COPY]: env.defineCopier(4),
      });
      const object = new Test(fixed(0x1000, 4));
      const dv = object[MEMORY];
      env.linkObject(object, 0x1000, true);
      expect(object[MEMORY]).to.equal(dv);
    })
    it('should link child objects', function() {
      const env = new Env();
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
      env.obtainFixedView = function(address, len) {
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
      let nextAddress = 0x1000n;
      env.allocateExternMemory = function(type, len, align) {
        const address = nextAddress
        nextAddress += BigInt(len * 0x0F);
        return address;
      };
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
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
      const object1 = new Test(env.allocateMemory(16, 8, true));
      const object2 = new Test(env.allocateMemory(16, 8, true));
      env.variables.push({ name: 'a', object: object1 });
      env.variables.push({ name: 'b', object: object2 });
      env.unlinkVariables();
      expect(object1[MEMORY][FIXED]).to.be.undefined;
      expect(object2[MEMORY][FIXED]).to.be.undefined;
    })
  })
  describe('unlinkObject', function() {
    it('should replace buffer in fixed memory with ones in relocatable memory', function() {
      const env = new Env();
      let nextAddress = 0x1000n;
      env.allocateExternMemory = function(type, len, align) {
        const address = nextAddress
        nextAddress += BigInt(len * 0x0F);
        return address;
      };
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
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
      const object = new Test(env.allocateMemory(16, 8, true));
      const dv = object[MEMORY];
      expect(dv[FIXED]).to.be.an('object');
      dv.setUint32(12, 1234, true);
      env.unlinkObject(object);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(dv.getUint32(12, true)).to.equal(1234);
      expect(object[MEMORY][FIXED]).to.be.undefined;
      // should do nothing
      env.unlinkObject(object);
    })
  })
})
