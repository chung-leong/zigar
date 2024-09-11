import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';
import { InvalidDeallocation } from '../../src/errors.js';
import { ALIGN, COPY, FIXED, MEMORY } from '../../src/symbols.js';
import { defineProperties, defineProperty } from '../../src/utils.js';

import Baseline from '../../src/features/baseline.js';
import CallMarshalingOutbound from '../../src/features/call-marshaling-outbound.js';
import DataCopying from '../../src/features/data-copying.js';
import MemoryMapping from '../../src/features/memory-mapping.js';
import ViewManagement from '../../src/features/view-management.js';

const Env = defineClass('FeatureTest', [
  Baseline, MemoryMapping, DataCopying, CallMarshalingOutbound, ViewManagement,
]);

describe('Feature: memory-mapping', function() {
  describe('getShadowAddress', function() {
    it('should create a shadow of an object and return the its address', function() {
      const env = new Env();
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      defineProperty(Test.prototype, COPY, env.defineCopier(8))
      const object = new Test(new DataView(new ArrayBuffer(8)));
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      const address = env.getShadowAddress(object);
      expect(address).to.equal(0x1000);
    })
    it('should return shadow addresses of objects in a cluster', function() {
      const env = new Env();
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      defineProperty(Test.prototype, COPY, env.defineCopier(8))
      Test[ALIGN] = 4;
      const buffer = new ArrayBuffer(16);
      const object1 = new Test(new DataView(buffer, 0, 8));
      const object2 = new Test(new DataView(buffer, 4, 8));
      const cluster = {
        targets: [ object1, object2 ],
        start: 0,
        end: 12,
        address: undefined,
      };
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      const address1 = env.getShadowAddress(object1, cluster);
      const address2 = env.getShadowAddress(object2, cluster);
      expect(address1).to.equal(0x1000);
      expect(address2).to.equal(0x1004);
    })
  })
  describe('createShadow', function() {
    it('should create a shadow of an object', function() {
      const env = new Env();
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      defineProperty(Test.prototype, COPY, env.defineCopier(8))
      const object = new Test(new DataView(new ArrayBuffer(8)));
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      const shadow = env.createShadow(object);
      expect(shadow).to.be.instanceOf(Test);
      expect(shadow[MEMORY].byteLength).to.equal(8);
    })
  })
  describe('createClusterShadow', function() {
    it('should create a shadow for a cluster of objects', function() {
      const env = new Env();
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      defineProperty(Test.prototype, COPY, env.defineCopier(8))
      Test[ALIGN] = 4;
      const buffer = new ArrayBuffer(32);
      const object1 = new Test(new DataView(buffer, 3, 8));
      const object2 = new Test(new DataView(buffer, 7, 8));
      const object3 = new Test(new DataView(buffer, 11, 8));
      const cluster = {
        targets: [ object1, object2, object3 ],
        start: 3,
        end: 19,
      };
      object1[MEMORY].setUint32(0, 1234, true);
      env.startContext();
      const shadow = env.createClusterShadow(cluster);
      expect(shadow[MEMORY].byteLength).to.equal(16);
      expect(shadow[MEMORY].buffer.byteLength).to.equal(20);
      env.updateShadows();
      expect(shadow[MEMORY].getUint32(0, true)).to.equal(1234);
    })
    it('should use alignment attached to data views', function() {
      const env = new Env();
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
        dv[ALIGN] = 4;
      };
      defineProperty(Test.prototype, COPY, env.defineCopier(8))
      Test[ALIGN] = undefined;
      const buffer = new ArrayBuffer(32);
      const object1 = new Test(new DataView(buffer, 3, 8));
      const object2 = new Test(new DataView(buffer, 7, 8));
      const object3 = new Test(new DataView(buffer, 11, 8));
      const cluster = {
        targets: [ object1, object2, object3 ],
        start: 3,
        end: 19,
      };
      object1[MEMORY].setUint32(0, 1234, true);
      env.startContext();
      const shadow = env.createClusterShadow(cluster);
      expect(shadow[MEMORY].byteLength).to.equal(16);
      expect(shadow[MEMORY].buffer.byteLength).to.equal(20);
      env.updateShadows();
      expect(shadow[MEMORY].getUint32(0, true)).to.equal(1234);
    })

    it('should throw when objects have incompatible alignments', function() {
      const env = new Env();
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      defineProperty(Test.prototype, COPY, env.defineCopier(8))
      Test[ALIGN] = 4;
      const buffer = new ArrayBuffer(32);
      const object1 = new Test(new DataView(buffer, 4, 8));
      const object2 = new Test(new DataView(buffer, 7, 8));
      const object3 = new Test(new DataView(buffer, 13, 8));
      const cluster = {
        targets: [ object1, object2, object3 ],
        start: 4,
        end: 21,
      };
      env.startContext();
      expect(() => env.createClusterShadow(cluster)).to.throw(TypeError);
    })
  })
  describe('addShadow', function() {
    it('should add a shadow', function() {
      const env = new Env();
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(4))
      };
      const shadow = {
        [MEMORY]: new DataView(new ArrayBuffer(4))
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      expect(env.context.shadowMap).to.be.null;
      env.addShadow(shadow, object);
      expect(env.context.shadowMap.size).to.equal(1);
    })
  })
  describe('removeShadow', function() {
    it('should remove a previously added shadow', function() {
      const env = new Env();
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(4))
      };
      const shadow = {
        [MEMORY]: new DataView(new ArrayBuffer(4))
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      env.addShadow(shadow, object);
      env.removeShadow(shadow[MEMORY]);
      expect(env.context.shadowMap.size).to.equal(0);
    })
  })
  describe('updateShadows', function() {
    it('should do nothing where there are no shadows', function() {
      const env = new Env();
      env.startContext();
      env.updateShadows();
    })
    it('should copy data from targets to shadows', function() {
      const env = new Env();
      const size = 4;
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(size)),
      };
      const shadow = defineProperties({}, {
        [MEMORY]: { value: new DataView(new ArrayBuffer(size)) },
        [COPY]: env.defineCopier(size),
      });
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      env.addShadow(shadow, object);
      object[MEMORY].setUint32(0, 1234, true);
      env.updateShadows();
      expect(shadow[MEMORY].getUint32(0, true)).to.equal(1234);
    })
  })
  describe('updateShadowTargets', function() {
    it('should do nothing where there are no shadows', function() {
      const env = new Env();
      env.startContext();
      env.updateShadowTargets();
    })
    it('should copy data from shadows to targets', function() {
      const env = new Env();
      const size = 4;
      const object = defineProperties({}, {
        [MEMORY]: { value: new DataView(new ArrayBuffer(size)) },
        [COPY]: env.defineCopier(size),
      });
      const shadow = {
        [MEMORY]: new DataView(new ArrayBuffer(size)),
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      env.addShadow(shadow, object);
      shadow[MEMORY].setUint32(0, 1234, true);
      env.updateShadowTargets();
      expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
    })
  })
  describe('releaseShadows', function() {
    it('should do nothing where there are no shadows', function() {
      const env = new Env();
      env.startContext();
      env.releaseShadows();
    })
    it('should free the memory of shadows', function() {
      const env = new Env();
      const size = 4;
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(size)),
      };
      const shadow = {
        [MEMORY]: new DataView(new ArrayBuffer(size)),
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      let freed;
      env.freeShadowMemory = function(dv) {
        freed = dv;
      };
      env.startContext();
      env.addShadow(shadow, object);
      env.releaseShadows();
      expect(freed).to.equal(shadow[MEMORY]);
    })
  })
  describe('allocateFixedMemory', function() {
    it('should try to allocate fixed memory from zig', function() {
      const env = new Env();
      env.allocateExternMemory = function(type, len, align) {
        return 0x1000n;
      };
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
        return this.obtainView(buffer, 0, len);
      };
      const dv = env.allocateFixedMemory(400, 4);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(400);
      expect(dv[FIXED]).to.be.an('object');
    })
    it('should return empty data view when len is 0', function() {
      const env = new Env();
      env.allocateExternMemory = function(type, len, align) {
        return 0x1000n;
      };
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
        const dv = this.obtainView(buffer, 0, len);
        return dv;
      };
      const dv1 = env.allocateFixedMemory(0, 4);
      const dv2 = env.allocateFixedMemory(0, 1);
      expect(dv1.byteLength).to.equal(0);
      expect(dv2.byteLength).to.equal(0);
      expect(dv1[FIXED]).to.be.an('object')
    })
  })
  describe('freeFixedMemory', function() {
    it('should try to free fixed memory through Zig', function() {
      const env = new Env();
      let args;
      env.freeExternMemory = function(type, address, len, align) {
        args = { type, address, len, align };
      };
      const dv = new DataView(new ArrayBuffer(16));
      dv[FIXED] = {
        type: 0,
        address: 0x1000n,
        len: 16,
        align: 4,
      };
      env.freeFixedMemory(dv);
      expect(args).to.eql({ type: 0, address: 0x1000n, len: 16, align: 4 });
    })
    it('should try to free fixed memory with unaligned address through Zig', function() {
      const env = new Env();
      let args;
      env.freeExternMemory = function(type, address, len, align) {
        args = { type, address, len, align };
      };
      const dv = new DataView(new ArrayBuffer(16));
      dv[FIXED] = {
        type: 0,
        unalignedAddress: 0x1000n,
        address: 0x1004n,
        len: 16,
        align: 4,
      };
      env.freeFixedMemory(dv);
      expect(args).to.eql({ type: 0, address: 0x1000n, len: 16, align: 4 });
    })
    it('should do nothing when len is 0', function() {
      const env = new Env();
      let called = false;
      env.freeExternMemory = function(address, len, align) {
        called = true;
      };
      const dv = new DataView(new ArrayBuffer(0));
      dv[FIXED] = {
        type: 0,
        address: 0x1000n,
        len: 0,
        align: 0,
      };
      env.freeFixedMemory(dv);
      expect(called).to.equal(false);
    })
  })
  describe('obtainFixedView', function() {
    it('should return a data view covering fixed memory at given address', function() {
      const env = new Env();
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
        const dv = this.obtainView(buffer, 0, len);
        return dv;
      };
      const dv = env.obtainFixedView(0x1000n, 16);
      expect(dv.byteLength).to.equal(16);
      expect(dv[FIXED]).to.be.an('object')
    })
    it('should return empty data view when len is 0', function() {
      const env = new Env();
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
        const dv = this.obtainView(buffer, 0, len);
        return dv;
      };
      const dv1 = env.obtainFixedView(0x1000n, 0);
      const dv2 = env.obtainFixedView(0x2000n, 0);
      expect(dv1.byteLength).to.equal(0);
      expect(dv2.byteLength).to.equal(0);
      expect(dv1).to.not.equal(dv2);
      expect(dv1[FIXED]).to.be.an('object')
      expect(dv2[FIXED]).to.be.an('object')
    })
    it('should return a view to the empty buffer when len is zero and address is 0', function() {
      const env = new Env();
      const dv = env.obtainFixedView(0n, 0);
      expect(dv.buffer).to.equal(env.emptyBuffer);
    })
  })
  describe('releaseFixedView', function() {
    it('should free a data view that was allocated using allocateFixedMemory', function() {
      const env = new Env();
      env.allocateExternMemory = function(type, len, align) {
        return 0x1000n;
      };
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
        const dv = this.obtainView(buffer, 0, len);
        return dv;
      };
      let args;
      env.freeExternMemory = function(type, address, len, align) {
        args = { type, address, len, align };
      };
      const dv = env.allocateFixedMemory(400, 4);
      env.releaseFixedView(dv);
      expect(args).to.eql({ type: 0, address: 0x1000n, len: 400, align: 4 });
    })
  })
  describe('registerMemory', function() {
    it('should return address of data view', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x1000n;
      const dv = new DataView(new ArrayBuffer(16), 8, 8);
      env.startContext();
      const address = env.registerMemory(dv);
      expect(address).to.equal(0x1000n + 8n);
    })
    it('should return address as number when address is number', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x1000;
      const dv = new DataView(new ArrayBuffer(16), 8, 8);
      env.startContext();
      const address = env.registerMemory(dv);
      expect(address).to.equal(0x1000 + 8);
    })
  })
  describe('unregisterMemory', function() {
  })
  describe('findMemory', function() {
    it('should find previously imported buffer', function() {
      const env = new Env();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv1 = new DataView(new ArrayBuffer(32));
      env.startContext();
      const address = env.registerMemory(dv1);
      const dv2 = env.findMemory(address, dv1.byteLength, 1);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteOffset).to.equal(dv1.byteOffset);
    })
    it('should find previously imported buffer when size is undefined', function() {
      const env = new Env();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv1 = new DataView(new ArrayBuffer(32));
      env.startContext();
      const address = env.registerMemory(dv1);
      const dv2 = env.findMemory(address, 1, undefined);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteOffset).to.equal(dv1.byteOffset);
    })
    it('should find a subslice of previously imported buffer', function() {
      const env = new Env();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv1 = new DataView(new ArrayBuffer(32));
      env.startContext();
      const address = env.registerMemory(dv1);
      const dv2 = env.findMemory(address + 8n, 8, 1);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteOffset).to.equal(8);
    })
    it('should return data view of shared memory if address is not known', function() {
      const env = new Env();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv1 = new DataView(new ArrayBuffer(32));
      env.startContext();
      const address = env.registerMemory(dv1);
      const dv2 = env.findMemory(0xFF0000n, 8, 1);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.be.instanceOf(SharedArrayBuffer);
    })
    it('should return data view of shared memory if address is not known and size, is undefined', function() {
      const env = new Env();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv1 = new DataView(new ArrayBuffer(32));
      env.startContext();
      const address = env.registerMemory(dv1);
      const dv2 = env.findMemory(0xFF0000n, 4, undefined);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.be.instanceOf(SharedArrayBuffer);
    })
    it('should return null when address is invalid and count is above 0', function() {
      const env = new Env();
      const dv = env.findMemory(0xaaaaaaaa, 14, 5);
      expect(dv).to.be.null;
    })
    it('should return null when address is 0 and count is above 0', function() {
      const env = new Env();
      const dv = env.findMemory(0, 14, 5);
      expect(dv).to.be.null;
    })
    it('should return empty view when address is invalid and count is 0', function() {
      const env = new Env();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv = env.findMemory(0xaaaaaaaa, 0, 5);
      expect(dv.byteLength).to.equal(0);
    })
  })
  describe('getViewAddress', function() {
    it('should return address of data view', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x1000n;
      const dv = new DataView(new ArrayBuffer(32), 8, 8);
      const address = env.getViewAddress(dv);
      expect(address).to.equal(0x1008n);
    })
  })
  if (process.env.TARGET === 'wasm') {
    describe('allocateHostMemory', function() {
      it('should allocate the relocatable and shadow memory, returning the latter', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        env.allocateShadowMemory = function(len, align) {
          return new DataView(memory.buffer, 128, len);
        };
        env.startContext();
        const dv = env.allocateHostMemory(64, 32);
        expect(dv.byteLength).to.equal(64);
        expect(dv.buffer).to.equal(memory.buffer);
      })
    })
    describe('freeHostMemory', function() {
      it('should free shadow memory', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        env.allocateShadowMemory = function(len, align) {
          return new DataView(memory.buffer, 128, len);
        };
        let freed;
        env.freeShadowMemory = function(dv) {
          freed = dv;
        };
        env.startContext();
        const dv = env.allocateHostMemory(64, 32);
        env.freeHostMemory(128, 64, 32);
        expect(freed).to.equal(dv);
      })
      it('should throw when given invalid address', function() {
        const env = new Env();
        env.startContext();
        expect(() => env.freeHostMemory(128, 64, 32)).to.throw(InvalidDeallocation);
      })
    })
    describe('obtainExternView', function() {
      it('should return a view to WASM memory', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        const dv = env.obtainExternView(128, 16);
        expect(dv.buffer).to.equal(memory.buffer);
        expect(dv.byteLength).to.equal(16);
        expect(dv.byteOffset).to.equal(128);
      })
      it('should handle reference to zero-length slice', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        const dv = env.obtainExternView(0, 0);
        expect(dv.buffer).to.equal(memory.buffer);
        expect(dv.byteLength).to.equal(0);
        expect(dv.byteOffset).to.equal(0);
      })
      // it('should correctly handle negative address', function() {
      //   const env = new Env();
      //   const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      //   const dv = env.obtainExternView(-5000, 0);
      //   expect(dv.byteLength).to.equal(0);
      //   expect(dv.byteOffset).to.equal(0);
      // })
    })
    describe('getBufferAddress', function() {
      it('should return zero', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        expect(env.getBufferAddress(env.memory.buffer)).to.equal(0);
      })
      it('should throw when buffer is not from WASM memory', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        const buffer = new ArrayBuffer(64);
        expect(() => env.getBufferAddress(buffer)).to.throw();
      })
    })
    describe('copyExternBytes', function() {
      it('should copy bytes from specified address', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        const src = new DataView(memory.buffer, 128, 4);
        src.setUint32(0, 1234);
        const dest = new DataView(new ArrayBuffer(4));
        env.copyExternBytes(dest, 128, 4);
        expect(dest.getUint32(0)).to.equal(1234);
      })
    })
    describe('getTargetAddress', function() {
      it('should return false when object is located in relocatable memory', function() {
        const env = new Env();
        const object = {
          [MEMORY]: env.allocateMemory(16, 8, false)
        };
        const address = env.getTargetAddress(object);
        expect(address).to.be.undefined;
      })
      it('should return zero when object has no bytes', function() {
        const env = new Env();
        const object = {
          [MEMORY]: env.allocateMemory(0, 0, false)
        };
        const address = env.getTargetAddress(object);
        expect(address).to.equal(0);
      })
      it('should return the address when object is in fixed memory', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        env.allocateExternMemory = function(type, len, align) {
          return 256;
        };
        env.startContext();
        const object = {
          [MEMORY]: env.allocateMemory(64, 16, true)
        };
        const address = env.getTargetAddress(object);
        expect(address).to.equal(256);
      })
    })
  } else if (process.env.TARGET === 'node') {
    describe('allocateHostMemory', function() {
      it('should create a buffer that can be discovered later', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000n;
      env.startContext();
      const dv1 = env.allocateHostMemory(32, 8);
      expect(dv1).to.be.instanceOf(DataView);
      expect(dv1.byteLength).to.equal(32);
      const dv2 = env.findMemory(0x10000n, 32);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteLength).to.equal(32);
      })
    })
    describe('freeHostMemory', function() {
      it('should remove buffer at indicated address', function() {
        const env = new Env();
        env.obtainFixedView = () => null;
        env.getBufferAddress = () => 0x10010;
        env.startContext();
        const dv = env.allocateHostMemory(32, 32);
        expect(dv).to.be.instanceOf(DataView);
        expect(dv.byteLength).to.equal(32);
        expect(dv.byteOffset).to.equal(16);
        const address = env.getViewAddress(dv);
        env.freeHostMemory(address, 32, 32);
        const bad = env.findMemory(address, 32);
        expect(bad).to.be.null;
      })
      it('should throw when address is invalid', function() {
        const env = new Env();
        env.startContext();
        expect(() => env.freeHostMemory(0x1000, 32, 32)).to.throw(ReferenceError);
      })
    })
    describe('allocateShadowMemory', function() {
      it('should allocate memory for dealing with misalignment', function() {
        const env = new Env();
        const dv = env.allocateShadowMemory(16, 4);
        expect(dv).to.be.instanceOf(DataView);
        expect(dv.byteLength).to.equal(16);
      })
    })
    describe('freeShadowMemory', function() {
      it('should do nothing', function() {
        const env = new Env();
        env.freeShadowMemory(0x1000n, 16, 4);
      })
    })
    describe('getTargetAddress', function() {
      it('should return address when address is correctly aligned', function() {
        const env = new Env();
        env.getBufferAddress = function(buffer) {
          return 0x1000n;
        };
        env.startContext();
        const Type = function() {};
        Type[ALIGN] = 8;
        const object = new Type();
        object[MEMORY] = new DataView(new ArrayBuffer(64));
        const address = env.getTargetAddress(object);
        expect(address).to.equal(0x1000n);
      })
      it('should return undefined when address is misaligned', function() {
        const env = new Env();
        env.getBufferAddress = function(buffer) {
          return 0x1004;
        };
        env.startContext();
        const Type = function() {};
        Type[ALIGN] = 8;
        const object = new Type();
        object[MEMORY] = new DataView(new ArrayBuffer(64));
        const address = env.getTargetAddress(object);
        expect(address).to.be.undefined;
      })
      it('should return address when cluster is correctly aligned', function() {
        const env = new Env();
        env.getBufferAddress = function(buffer) {
          return 0x1006n;
        };
        env.startContext();
        const Type = function() {};
        Type[ALIGN] = 8;
        const object1 = new Type();
        const object2 = new Type();
        const buffer = new ArrayBuffer(64);
        object1[MEMORY] = new DataView(buffer, 2, 32);
        object2[MEMORY] = new DataView(buffer, 10, 8);
        const cluster = {
          targets: [ object1, object2 ],
          start: 2,
          end: 32,
          address: undefined,
          misaligned: undefined,
        };
        const address1 = env.getTargetAddress(object1, cluster);
        expect(address1).to.equal(0x1008n);
        expect(cluster.misaligned).to.be.false;
        const address2 = env.getTargetAddress(object2, cluster);
        expect(address2).to.equal(0x1010n);
      })
      it('should return false when cluster is misaligned', function() {
        const env = new Env();
        env.getBufferAddress = function(buffer) {
          return 0x1000n;
        };
        env.startContext();
        const Type = function() {};
        Type[ALIGN] = 8;
        const object1 = new Type();
        const object2 = new Type();
        const buffer = new ArrayBuffer(64);
        object1[MEMORY] = new DataView(buffer, 2, 32);
        object2[MEMORY] = new DataView(buffer, 10, 8);
        const cluster = {
          targets: [ object1, object2 ],
          start: 2,
          end: 32,
          address: undefined,
          misaligned: undefined,
        };
        const address1 = env.getTargetAddress(object1, cluster);
        expect(address1).to.be.undefined;
        expect(cluster.misaligned).to.be.true;
        const address2 = env.getTargetAddress(object2, cluster);
        expect(address2).to.be.undefined;
      })
    })
  }
})
