import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ALIGN, COPY, FIXED, MEMORY } from '../../src/symbols.js';
import { adjustAddress, CallContext, defineProperties, defineProperty } from '../../src/utils.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

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
        return usize(0x1000);
      };
      const context = new CallContext();
      const address = env.getShadowAddress(context, object);
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
      const context = new CallContext();
      const address1 = env.getShadowAddress(context, object1, cluster);
      const address2 = env.getShadowAddress(context, object2, cluster);
      expect(address1).to.equal(usize(0x1000));
      expect(address2).to.equal(usize(0x1004));
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
        return usize(0x1000);
      };
      const context = new CallContext();
      const shadow = env.createShadow(context, object);
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
        return usize(0x1000);
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
      const context = new CallContext();
      const shadow = env.createClusterShadow(context, cluster);
      expect(shadow[MEMORY].byteLength).to.equal(16);
      expect(shadow[MEMORY].buffer.byteLength).to.equal(20);
      env.updateShadows(context);
      expect(shadow[MEMORY].getUint32(0, true)).to.equal(1234);
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
      const context = new CallContext();
      const shadow = env.createClusterShadow(context, cluster);
      expect(shadow[MEMORY].byteLength).to.equal(16);
      expect(shadow[MEMORY].buffer.byteLength).to.equal(20);
      env.updateShadows(context);
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
      const context = new CallContext();
      expect(() => env.createClusterShadow(context, cluster)).to.throw(TypeError);
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
        return usize(0x1000);
      };
      const context = new CallContext();
      env.addShadow(context, shadow, object);
      expect(context.shadowMap.size).to.equal(1);
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
        return usize(0x1000);
      };
      const context = new CallContext();
      env.addShadow(context, shadow, object);
      env.removeShadow(context, shadow[MEMORY]);
      expect(context.shadowMap.size).to.equal(0);
    })
  })
  describe('updateShadows', function() {
    it('should do nothing where there are no shadows', function() {
      const env = new Env();
      const context = new CallContext();
      env.updateShadows(context);
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
        return usize(0x1000);
      };
      const context = new CallContext();
      env.addShadow(context, shadow, object);
      object[MEMORY].setUint32(0, 1234, true);
      env.updateShadows(context);
      expect(shadow[MEMORY].getUint32(0, true)).to.equal(1234);
    })
  })
  describe('updateShadowTargets', function() {
    it('should do nothing where there are no shadows', function() {
      const env = new Env();
      const context = new CallContext();
      env.updateShadowTargets(context);
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
        return usize(0x1000);
      };
      const context = new CallContext();
      env.addShadow(context, shadow, object);
      shadow[MEMORY].setUint32(0, 1234, true);
      env.updateShadowTargets(context);
      expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
    })
  })
  describe('releaseShadows', function() {
    it('should do nothing where there are no shadows', function() {
      const env = new Env();
      const context = new CallContext();
      env.releaseShadows(context);
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
        return usize(0x1000);
      };
      let freed;
      env.freeShadowMemory = function(dv) {
        freed = dv;
      };
      const context = new CallContext();
      env.addShadow(context, shadow, object);
      env.releaseShadows(context);
      expect(freed).to.equal(shadow[MEMORY]);
    })
  })
  describe('allocateFixedMemory', function() {
    it('should try to allocate fixed memory from zig', function() {
      const env = new Env();
      env.allocateExternMemory = function(type, len, align) {
        return usize(0x1000);
      };
      env.obtainExternView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv[FIXED] = { address, len };
        return dv;
      };
      const dv = env.allocateFixedMemory(400, 4);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(400);
      expect(dv[FIXED]).to.be.an('object');
    })
    it('should return empty data view when len is 0', function() {
      const env = new Env();
      env.allocateExternMemory = function(type, len, align) {
        return usize(0x1000);
      };
      env.obtainExternView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv[FIXED] = { address, len };
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
        address: usize(0x1000),
        len: 16,
        align: 4,
      };
      env.freeFixedMemory(dv);
      expect(args).to.eql({ type: 0, address: usize(0x1000), len: 16, align: 4 });
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
        unalignedAddress: usize(0x1000),
        address: usize(0x1004),
        len: 16,
        align: 4,
      };
      env.freeFixedMemory(dv);
      expect(args).to.eql({ type: 0, address: usize(0x1000), len: 16, align: 4 });
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
        address: usize(0x1000),
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
        const dv = new DataView(new ArrayBuffer(len));
        dv[FIXED] = { address, len };
        return dv;
      };
      const dv = env.obtainFixedView(usize(0x1000), 16);
      expect(dv.byteLength).to.equal(16);
      expect(dv[FIXED]).to.be.an('object')
    })
    it('should return empty data view when len is 0', function() {
      const env = new Env();
      env.obtainExternView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv[FIXED] = { address, len };
        return dv;
      };
      const dv1 = env.obtainFixedView(usize(0x1000), 0);
      const dv2 = env.obtainFixedView(usize(0x2000), 0);
      expect(dv1.byteLength).to.equal(0);
      expect(dv2.byteLength).to.equal(0);
      expect(dv1).to.not.equal(dv2);
      expect(dv1[FIXED]).to.be.an('object')
      expect(dv2[FIXED]).to.be.an('object')
    })
    it('should return a view to the empty buffer when len is zero and address is 0', function() {
      const env = new Env();
      const dv = env.obtainFixedView(usize(0), 0);
      expect(dv.buffer).to.equal(env.emptyBuffer);
    })
  })
  describe('releaseFixedView', function() {
    it('should invoke free method attached to fixed view', function() {
      const env = new Env();
      let called = false;
      const dv = new DataView(new ArrayBuffer(8));
      dv[FIXED] = { address: 0x1000, len: 8, free: () => called = true };
      env.releaseFixedView(dv);
      expect(called).to.be.true;
    })
    it('should remove view from empty buffer map', function() {
      const env = new Env();
      const dv1 = env.obtainFixedView(0x1000, 0);
      const dv2 = env.obtainFixedView(0x1000, 0);
      expect(dv2).to.equal(dv1);
      env.releaseFixedView(dv1);
      const dv3 = env.obtainFixedView(0x1000, 0);
      expect(dv3).to.not.equal(dv1);
    })
  })
  describe('registerMemory', function() {
    it('should return address of data view', function() {
      const env = new Env();
      env.getBufferAddress = () => usize(0x1000);
      const dv = new DataView(new ArrayBuffer(16), 8, 8);
      const context = new CallContext();
      const address = env.registerMemory(context, dv);
      expect(address).to.equal(usize(0x1000 + 8));
    })
    it('should return address as number when address is number', function() {
      const env = new Env();
      env.getBufferAddress = () => usize(0x1000);
      const dv = new DataView(new ArrayBuffer(16), 8, 8);
      const context = new CallContext();
      const address = env.registerMemory(context, dv);
      expect(address).to.equal(usize(0x1000 + 8));
    })
  })
  describe('unregisterMemory', function() {
  })
  describe('findMemory', function() {
    it('should find previously imported buffer', function() {
      const env = new Env();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => usize(0x1000);
      const dv1 = new DataView(new ArrayBuffer(32));
      const context = new CallContext();
      const address = env.registerMemory(context, dv1);
      const dv2 = env.findMemory(context, address, dv1.byteLength, 1);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteOffset).to.equal(dv1.byteOffset);
    })
    it('should find previously imported buffer when size is undefined', function() {
      const env = new Env();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => usize(0x1000);
      const dv1 = new DataView(new ArrayBuffer(32));
      const context = new CallContext();
      const address = env.registerMemory(context, dv1);
      const dv2 = env.findMemory(context, address, 1, undefined);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteOffset).to.equal(dv1.byteOffset);
    })
    it('should find a subslice of previously imported buffer', function() {
      const env = new Env();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => usize(0x1000);
      const dv1 = new DataView(new ArrayBuffer(32));
      const context = new CallContext();
      const address = env.registerMemory(context, dv1);
      const dv2 = env.findMemory(context, adjustAddress(address, 8), 8, 1);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteOffset).to.equal(8);
    })
    it('should return data view of shared memory if address is not known', function() {
      const env = new Env();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => usize(0x1000);
      const dv1 = new DataView(new ArrayBuffer(32));
      const context = new CallContext();
      const address = env.registerMemory(context, dv1);
      const dv2 = env.findMemory(context, usize(0xFF0000), 8, 1);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.be.instanceOf(SharedArrayBuffer);
    })
    it('should return data view of shared memory if address is not known and size, is undefined', function() {
      const env = new Env();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => usize(0x1000);
      const dv1 = new DataView(new ArrayBuffer(32));
      const context = new CallContext();
      const address = env.registerMemory(context, dv1);
      const dv2 = env.findMemory(context, usize(0xFF0000), 4, undefined);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.be.instanceOf(SharedArrayBuffer);
    })
    it('should return null when address is invalid and count is above 0', function() {
      const env = new Env();
      const address = (process.env.BITS === '64') ? 0xaaaa_aaaa_aaaa_aaaan : 0xaaaa_aaaa;
      const context = new CallContext();
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
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => usize(0x1000);
      const context = new CallContext();
      const dv = env.findMemory(context, 0xaaaaaaaa, 0, 5);
      expect(dv.byteLength).to.equal(0);
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
        const context = new CallContext();
        const address = env.getTargetAddress(context, object);
        expect(address).to.be.undefined;
      })
      it('should return zero when object has no bytes', function() {
        const env = new Env();
        const object = {
          [MEMORY]: env.allocateMemory(0, 0, false)
        };
        const context = new CallContext();
        const address = env.getTargetAddress(context, object);
        expect(address).to.equal(0);
      })
      it('should return the address when object is in fixed memory', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        const object = {
          [MEMORY]: env.obtainFixedView(256, 0),
        };
        const context = new CallContext();
        const address = env.getTargetAddress(context, object);
        expect(address).to.equal(256);
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
        const context = new CallContext();
        const address = env.getTargetAddress(context, object);
        expect(address).to.equal(usize(0x1000));
      })
      it('should return undefined when address is misaligned', function() {
        const env = new Env();
        env.getBufferAddress = function(buffer) {
          return usize(0x1004);
        };
        const Type = function() {};
        Type[ALIGN] = 8;
        const object = new Type();
        object[MEMORY] = new DataView(new ArrayBuffer(64));
        const context = new CallContext();
        const address = env.getTargetAddress(context, object);
        expect(address).to.be.undefined;
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
        const context = new CallContext();
        const address1 = env.getTargetAddress(context, object1, cluster);
        expect(address1).to.equal(usize(0x1008));
        expect(cluster.misaligned).to.be.false;
        const address2 = env.getTargetAddress(context, object2, cluster);
        expect(address2).to.equal(usize(0x1010));
      })
      it('should return false when cluster is misaligned', function() {
        const env = new Env();
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
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
        const context = new CallContext();
        const address1 = env.getTargetAddress(context, object1, cluster);
        expect(address1).to.be.undefined;
        expect(cluster.misaligned).to.be.true;
        const address2 = env.getTargetAddress(context, object2, cluster);
        expect(address2).to.be.undefined;
      })
    })
  }
})
