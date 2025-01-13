import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import { MemoryType } from '../../src/features/memory-mapping.js';
import '../../src/mixins.js';
import { ALIGN, COPY, MEMORY, ZIG } from '../../src/symbols.js';
import { adjustAddress, defineProperty } from '../../src/utils.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: memory-mapping', function() {
  describe('startContext', function() {
    it('should create a new context', function() {
      const env = new Env();
      const context = env.startContext();
      expect(context).to.be.an('object');
      expect(context.shadowList).to.be.an('array');
    })
  })
  describe('endContext', function() {
    it('should decrement context count', function() {
      const env = new Env();
      const context = env.startContext();
      expect(env.contextCount).to.equal(1);
      env.endContext();
      expect(env.contextCount).to.equal(0);
    })
    it('should free shadow memory when context count reaches zero', function() {
      const env = new Env();
      const freed = [];
      env.freeExternMemory = function(type, address, len, align) {
        freed.push(address);
      };
      const context1 = env.startContext();
      const address1 = usize(0x1000);
      const len = 32;
      const dv1 = new DataView(new ArrayBuffer(len));
      const shadowDV = new DataView(new ArrayBuffer(len));
      shadowDV[ZIG] = { address: address1, len, align: 4, type: MemoryType.Scratch };
      env.registerMemory(address1, len, 4, true, dv1, shadowDV);
      const context2 = env.startContext();
      const address2 = usize(0x2000);
      const dv2 = new DataView(new ArrayBuffer(len));
      env.registerMemory(address2, len, 4, false, dv2);
      env.endContext();
      expect(env.memoryList).to.have.lengthOf(2);
      env.endContext();
      expect(env.memoryList).to.have.lengthOf(0);
      if (process.env.TARGET === 'wasm') {
        expect(freed).to.contain(address1);
      }
    })
  })
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
        return usize(0x1000);
      };
      const context = env.startContext();
      const address = env.getShadowAddress(context, object, null, true);
      expect(address).to.equal(usize(0x1000));
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
        return usize(0x1000);
      };
      const context = env.startContext();
      const address1 = env.getShadowAddress(context, object1, cluster, null, true);
      const address2 = env.getShadowAddress(context, object2, cluster, null, false);
      expect(address1).to.equal(usize(0x1000));
      expect(address2).to.equal(usize(0x1004));
    })
    it('should use alignment attached to data views', function() {
      const env = new Env();
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return usize(0x1000);
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
      const context = env.startContext();
      const address1 = env.getShadowAddress(context, object1, cluster, null, true);
      const { shadowDV } = env.memoryList[0];
      expect(shadowDV.byteLength).to.equal(16);
      expect(shadowDV.buffer.byteLength).to.equal(20);
      env.updateShadows(context);
      expect(shadowDV.getUint32(0, true)).to.equal(1234);
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
      Test[ALIGN] = 4;
      const buffer = new ArrayBuffer(32);
      const object1 = new Test(new DataView(buffer, 4, 8));
      const object2 = new Test(new DataView(buffer, 7, 8));
      const object3 = new Test(new DataView(buffer, 13, 8));
      const cluster = {
        targets: [ object1, object2 ],
        start: 0,
        end: 12,
        address: undefined,
      };
      const context = env.startContext();
      expect(() => env.getShadowAddress(context, object1, cluster, null, true)).to.throw(TypeError);
    })
  })
  describe('findShadowView', function() {
    it('should find shadow of data view', function() {
      const env = new Env();
      const len = 5;
      const targetDV = new DataView(new ArrayBuffer(len));
      const shadowDV = new DataView(new ArrayBuffer(len));
      const address = usize(0x1000);
      env.registerMemory(address, len, 1, false, targetDV, shadowDV);
      const result = env.findShadowView(targetDV)
      expect(result).to.equal(shadowDV);
    })
    it('should return undefined when no shadow is found', function() {
      const env = new Env();
      const len = 5;
      const targetDV = new DataView(new ArrayBuffer(len));
      const shadowDV = new DataView(new ArrayBuffer(len));
      const address = usize(0x1000);
      env.registerMemory(address, len, 1, false, targetDV, shadowDV);
      const result = env.findShadowView(new DataView(new ArrayBuffer(0)));
      expect(result).to.be.undefined;
    })
  })
  describe('updateShadows', function() {
    it('should copy data from targets to shadows', function() {
      const env = new Env();
      const len = 5;
      const targetDV = new DataView(new ArrayBuffer(len));
      const shadowDV = new DataView(new ArrayBuffer(len));
      const address = usize(0x1000);
      const context = env.startContext();
      const entry = env.registerMemory(address, len, 1, false, targetDV, shadowDV);
      context.shadowList.push(entry);
      targetDV.setUint32(1, 1234, true);
      env.updateShadows(context);
      expect(shadowDV.getUint32(1, true)).to.equal(1234);
    })
  })
  describe('updateShadowTargets', function() {
    it('should copy data from shadows to targets', function() {
      const env = new Env();
      const len = 5;
      const targetDV = new DataView(new ArrayBuffer(len));
      const shadowDV = new DataView(new ArrayBuffer(len));
      if (process.env.TARGET === 'wasm') {
        shadowDV[ZIG] = { address: usize(0x4000), len };
      }
      const address = usize(0x1000);
      const context = env.startContext();
      const entry = env.registerMemory(address, len, 1, true, targetDV, shadowDV);
      context.shadowList.push(entry);
      shadowDV.setUint32(1, 1234, true);
      env.updateShadowTargets(context);
      expect(targetDV.getUint32(1, true)).to.equal(1234);
    })
    it('should not copy data when shadow is not writable', function() {
      const env = new Env();
      const len = 5;
      const targetDV = new DataView(new ArrayBuffer(len));
      const shadowDV = new DataView(new ArrayBuffer(len));
      const address = usize(0x1000);
      const context = env.startContext();
      const entry = env.registerMemory(address, len, 1, false, targetDV, shadowDV);
      context.shadowList.push(entry);
      shadowDV.setUint32(1, 1234, true);
      env.updateShadowTargets(context);
      expect(targetDV.getUint32(1, true)).to.not.equal(1234);
    })
  })
  describe('endContext', function() {
    it('should free the memory of shadows', function() {
      const env = new Env();
      const len = 4;
      const targetDV = new DataView(new ArrayBuffer(len));
      const shadowDV = new DataView(new ArrayBuffer(len));
      const address = usize(0x1000);
      let freed;
      env.freeShadowMemory = function(dv) {
        freed = dv;
      };
      env.startContext();
      env.registerMemory(address, len, 1, false, targetDV, shadowDV);
      env.endContext();
      expect(freed).to.equal(shadowDV);
    })
  })
  describe('allocateZigMemory', function() {
    it('should try to allocate Zig memory from zig', function() {
      const env = new Env();
      env.allocateExternMemory = function(type, len, align) {
        return usize(0x1000);
      };
      env.obtainZigView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv[ZIG] = { address, len };
        return dv;
      };
      const dv = env.allocateZigMemory(400, 4);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(400);
      expect(dv[ZIG]).to.be.an('object');
    })
    it('should return empty data view when len is 0', function() {
      const env = new Env();
      env.allocateExternMemory = function(type, len, align) {
        return usize(0x1000);
      };
      env.obtainZigView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv[ZIG] = { address, len };
        return dv;
      };
      const dv1 = env.allocateZigMemory(0, 4);
      const dv2 = env.allocateZigMemory(0, 1);
      expect(dv1.byteLength).to.equal(0);
      expect(dv2.byteLength).to.equal(0);
      expect(dv1[ZIG]).to.be.an('object')
    })
    it('should throw when request for memory yields null ', function() {
      const env = new Env();
      env.allocateExternMemory = function(type, len, align) {
        return usize(0);
      };
      expect(() => env.allocateZigMemory(400, 4)).to.throw();
    })
  })
  describe('freeZigMemory', function() {
    it('should try to free Zig memory through Zig', function() {
      const env = new Env();
      let args;
      env.freeExternMemory = function(type, address, len, align) {
        args = { type, address, len, align };
      };
      const dv = new DataView(new ArrayBuffer(16));
      dv[ZIG] = {
        type: 0,
        address: usize(0x1000),
        len: 16,
        align: 4,
      };
      env.freeZigMemory(dv);
      expect(args).to.eql({ type: 0, address: usize(0x1000), len: 16, align: 4 });
    })
    it('should try to free Zig memory with unaligned address through Zig', function() {
      const env = new Env();
      let args;
      env.freeExternMemory = function(type, address, len, align) {
        args = { type, address, len, align };
      };
      const dv = new DataView(new ArrayBuffer(16));
      dv[ZIG] = {
        type: 0,
        unalignedAddress: usize(0x1000),
        address: usize(0x1004),
        len: 16,
        align: 4,
      };
      env.freeZigMemory(dv);
      expect(args).to.eql({ type: 0, address: usize(0x1000), len: 16, align: 4 });
    })
    it('should do nothing when len is 0', function() {
      const env = new Env();
      let called = false;
      env.freeExternMemory = function(address, len, align) {
        called = true;
      };
      const dv = new DataView(new ArrayBuffer(0));
      dv[ZIG] = {
        type: 0,
        address: usize(0x1000),
        len: 0,
        align: 0,
      };
      env.freeZigMemory(dv);
      expect(called).to.equal(false);
    })
  })
  describe('obtainZigView', function() {
    it('should return a data view covering Zig memory at given address', function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      env.obtainZigView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv[ZIG] = { address, len };
        return dv;
      };
      const dv = env.obtainZigView(usize(0x1000), 16);
      expect(dv.byteLength).to.equal(16);
      expect(dv[ZIG]).to.be.an('object')
    })
    it('should return empty data view when len is 0', function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      env.obtainZigView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv[ZIG] = { address, len };
        return dv;
      };
      const dv1 = env.obtainZigView(usize(0x1000), 0);
      const dv2 = env.obtainZigView(usize(0x2000), 0);
      expect(dv1.byteLength).to.equal(0);
      expect(dv2.byteLength).to.equal(0);
      expect(dv1).to.not.equal(dv2);
      expect(dv1[ZIG]).to.be.an('object')
      expect(dv2[ZIG]).to.be.an('object')
    })
    it('should return a view when len is zero and address is 0', function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const dv = env.obtainZigView(usize(0), 0);
      expect(dv).to.be.a('DataView');;
    })
    it('should return view for null when address is invalid and len is 0', function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const address = (process.env.BITS === '32') ? 0xaaaa_aaaa : 0xaaaa_aaaa_aaaa_aaaan;
      const dv = env.obtainZigView(address, 0);
      expect(dv).to.be.a('DataView');
    })
    it('should return null when address is invalid and len is not 0', function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const address = (process.env.BITS === '32') ? 0xaaaa_aaaa : 0xaaaa_aaaa_aaaa_aaaan;
      const dv = env.obtainZigView(address, 5);
      expect(dv).to.be.null;
    })
  })
  describe('releaseZigView', function() {
    it('should invoke set address to invalid value', function() {
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(8));
      dv[ZIG] = { address: 0x1000, len: 8 };
      env.releaseZigView(dv);
      expect(dv[ZIG].address).to.equal(usize(-1));
    })
    it('should remove view from empty buffer map', function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const dv1 = env.obtainZigView(0x1000, 0);
      const dv2 = env.obtainZigView(0x1000, 0);
      expect(dv2).to.equal(dv1);
      env.releaseZigView(dv1);
      const dv3 = env.obtainZigView(0x1000, 0);
      expect(dv3).to.not.equal(dv1);
    })
  })
  describe('registerMemory', function() {
    it('should return memory entry', function() {
      const env = new Env();
      const address = usize(0x1000);
      const len = 8;
      const align = 4;
      const dv = new DataView(new ArrayBuffer(len + 8), 8, len);
      const entry = env.registerMemory(address, len, align, false, dv);
      expect(entry).to.be.an('object');
      expect(entry.address).to.equal(address);
      expect(entry.len).to.equal(len);
      expect(entry.align).to.equal(align);
      expect(entry.writable).to.be.false;
      expect(entry.targetDV).to.equal(dv);
      expect(entry.shadowDV).to.be.undefined;
    })
    it('should return address as number when address is number', function() {
    })
    it('should set access flag of existing entry', function() {
      const env = new Env();
      const address = usize(0x1000);
      const len = 8;
      const align = 4;
      const dv = new DataView(new ArrayBuffer(len + 8), 8, len);
      const entry = env.registerMemory(address, len, align, false, dv);
      expect(entry).to.be.an('object');
      expect(entry.address).to.equal(address);
      expect(entry.len).to.equal(len);
      expect(entry.align).to.equal(align);
      expect(entry.writable).to.be.false;
      expect(entry.targetDV).to.equal(dv);
      expect(entry.shadowDV).to.be.undefined;
      const after = env.registerMemory(address, len, align, true, dv);
      expect(after).to.equal(entry);
      expect(entry.writable).to.be.true;
    })
  })
  describe('unregisterMemory', function() {
    it('should remove memory entry', function() {
      const env = new Env();
      const address = usize(0x1000);
      const len = 8;
      const align = 4;
      const dv = new DataView(new ArrayBuffer(len + 8), 8, len);
      const entry = env.registerMemory(address, len, align, false, dv);
      expect(entry).to.be.an('object');
      expect(entry.address).to.equal(address);
      const after = env.unregisterMemory(address, len);
      expect(after).to.equal(entry);
      expect(env.memoryList).to.have.lengthOf(0);
    })
  })
  describe('findMemory', function() {
    it('should find previously imported buffer', function() {
      const env = new Env();
      const address = usize(0x1000);
      const len = 32;
      const dv1 = new DataView(new ArrayBuffer(len));
      const context = env.startContext();
      env.registerMemory(address, len, 4, true, dv1);
      const dv2 = env.findMemory(context, address, len, 1);
      expect(dv2).to.equal(dv1);
    })
    it('should find subslice of previously imported buffer', function() {
      const env = new Env();
      const address = usize(0x1000);
      const len = 32;
      const dv1 = new DataView(new ArrayBuffer(len));
      const context = env.startContext();
      env.registerMemory(address, len, 4, true, dv1);
      const dv2 = env.findMemory(context, adjustAddress(address, 4), len / 2, 1);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteOffset).to.equal(dv1.byteOffset + 4);
      expect(dv2.byteLength).to.equal(len / 2);
    })
    it('should find previously imported buffer when size is undefined', function() {
      const env = new Env();
      const address = usize(0x1000);
      const len = 32;
      const dv1 = new DataView(new ArrayBuffer(len));
      const context = env.startContext();
      env.registerMemory(address, len, 4, true, dv1);
      const dv2 = env.findMemory(context, adjustAddress(address, 4), len / 2, undefined);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteOffset).to.equal(dv1.byteOffset + 4);
      expect(dv2.byteLength).to.equal(dv1.byteLength - 4);
    })
    it('should return data view of shared memory if address is not known', function() {
      const env = new Env();
      const address = usize(0x1000);
      const len = 32;
      const dv1 = new DataView(new ArrayBuffer(len));
      const context = env.startContext();
      env.registerMemory(address, len, 4, true, dv1);
      env.obtainZigView = (address, len) => {
        const dv = new DataView(new ArrayBuffer(len));
        dv[ZIG] = { address, len };
        return dv;
      };
      const dv2 = env.findMemory(context, usize(0xFF0000), 8, 1);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2).to.not.equal(dv1);
      expect(dv2[ZIG]).to.be.an('object');
    })
    it('should return data view of shared memory if address is not known and size, is undefined', function() {
      const env = new Env();
      const address = usize(0x1000);
      const len = 32;
      const dv1 = new DataView(new ArrayBuffer(len));
      const context = env.startContext();
      env.registerMemory(address, len, 4, true, dv1);
      env.obtainZigView = (address, len) => {
        const dv = new DataView(new ArrayBuffer(len));
        dv[ZIG] = { address, len };
        return dv;
      };
      const dv2 = env.findMemory(context, usize(0xFF0000), 4, undefined);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2).to.not.equal(dv1);
      expect(dv2.byteLength).to.equal(0);
      expect(dv2[ZIG]).to.be.an('object');
    })
    it('should return null when address is invalid and count is above 0', function() {
      const env = new Env();
      const address = (process.env.BITS === '64') ? 0xaaaa_aaaa_aaaa_aaaan : 0xaaaa_aaaa;
      const context = env.startContext();
      const dv = env.findMemory(context, address, 14, 5);
      expect(dv).to.be.null;
    })
    it('should return null when address is 0 and count is above 0', function() {
      const env = new Env();
      const dv = env.findMemory(null, 0, 14, 5);
      expect(dv).to.be.null;
    })
    it('should return empty view when address is invalid and count is 0', function() {
      const env = new Env();
      env.obtainZigView = (address, len) => new DataView(new ArrayBuffer(len));
      env.getBufferAddress = () => usize(0x1000);
      const context = env.startContext();
      const dv = env.findMemory(context, 0xaaaaaaaa, 0, 5);
      expect(dv.byteLength).to.equal(0);
    })
    it('should copy content from shadow when memory is not on list of shadows', function() {
      const env = new Env();
      const address = usize(0x1000);
      const len = 32;
      const dv1 = new DataView(new ArrayBuffer(len));
      const shadowDV = new DataView(new ArrayBuffer(len));
      const context = env.startContext();
      const entry = env.registerMemory(address, len, 4, true, dv1, shadowDV);
      shadowDV.setUint32(1, 1234, true);
      const dv2 = env.findMemory(context, adjustAddress(address, 1), 1, 16);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.getUint32(0, true)).to.equal(1234);
    })
  })
  describe('getViewAddress', function() {
    it('should return address of data view', function() {
      const env = new Env();
      env.getBufferAddress = () => usize(0x1000);
      const dv = new DataView(new ArrayBuffer(32), 8, 8);
      const address = env.getViewAddress(dv);
      expect(address).to.equal(usize(0x1000 + 8));
    })
  })
  if (process.env.TARGET === 'wasm') {
    describe('obtainZigView', function() {
      it('should return a view to WASM memory', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        const dv = env.obtainZigView(128, 16);
        expect(dv.buffer).to.equal(memory.buffer);
        expect(dv.byteLength).to.equal(16);
        expect(dv.byteOffset).to.equal(128);
      })
      it('should handle reference to zero-length slice', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        const dv = env.obtainZigView(0, 0);
        expect(dv.buffer).to.equal(memory.buffer);
        expect(dv.byteLength).to.equal(0);
        expect(dv.byteOffset).to.equal(0);
      })
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
      it('should return zero when object has no bytes', function() {
        const env = new Env();
        const object = {
          [MEMORY]: env.allocateMemory(0, 0, false)
        };
        const context = env.startContext();
        const address = env.getTargetAddress(context, object);
        expect(address).to.equal(0);
      })
      it('should return the address when object is in Zig memory', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        const object = {
          [MEMORY]: env.obtainZigView(256, 0),
        };
        const context = env.startContext();
        const address = env.getTargetAddress(context, object);
        expect(address).to.equal(256);
      })
      it('should create when object is located misaligned position in JS memory', function() {
        const env = new Env();
        const object = {
          [MEMORY]: env.allocateMemory(16, 8, false)
        };
        env.allocateExternMemory = function(type, address, len, align) {
          return usize(0x1234);
        };
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const context = env.startContext();
        const address = env.getTargetAddress(context, object);
        expect(address).to.equal(usize(0x1234));
      })
    })
  } else if (process.env.TARGET === 'node') {
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
        env.freeShadowMemory(usize(0x1000), 16, 4);
      })
    })
    describe('getTargetAddress', function() {
      it('should return address when address is correctly aligned', function() {
        const env = new Env();
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
        };
        const Type = function() {};
        Type[ALIGN] = 8;
        const object = new Type();
        object[MEMORY] = new DataView(new ArrayBuffer(64));
        const context = env.startContext();
        const address = env.getTargetAddress(context, object);
        expect(address).to.equal(usize(0x1000));
      })
      it('should return address of a shadow buffer when address is misaligned', function() {
        const env = new Env();
        if (process.env.TARGET === 'node') {
          env.getBufferAddress = function(arg) {
            if (arg === buffer) {
              return usize(0x1004);
            } else {
              return usize(0x1000);
            }
          };
        }
        const Type = function() {};
        Type[ALIGN] = 8;
        const object = new Type();
        const buffer = new ArrayBuffer(64);
        object[MEMORY] = new DataView(buffer);
        const context = env.startContext();
        const address = env.getTargetAddress(context, object);
        expect(address).to.equal(usize(0x1000));
      })
      it('should return address when cluster is correctly aligned', function() {
        const env = new Env();
        env.getBufferAddress = function(buffer) {
          return usize(0x1006);
        };
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
        const context = env.startContext();
        const address1 = env.getTargetAddress(context, object1, cluster);
        expect(address1).to.equal(usize(0x1008));
        expect(cluster.misaligned).to.be.false;
        const address2 = env.getTargetAddress(context, object2, cluster);
        expect(address2).to.equal(usize(0x1010));
      })
      it('should return address of shadow buffer when cluster is misaligned', function() {
        const env = new Env();
        if (process.env.TARGET === 'node') {
          env.getBufferAddress = function(arg) {
            if (arg === buffer) {
              return usize(0x1005);
            } else {
              return usize(0x2000);
            }
          };
        }
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
        const context = env.startContext();
        const address1 = env.getTargetAddress(context, object1, cluster);
        expect(address1).to.equal(usize(0x2000));
        expect(cluster.misaligned).to.be.true;
        const address2 = env.getTargetAddress(context, object2, cluster);
        expect(address2).to.equal(usize(0x2008));
      })

    })
  }
})
