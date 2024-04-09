import { expect } from 'chai';

import {
  NodeEnvironment,
} from '../src/environment-node.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import { ALIGN, MEMORY, POINTER_VISITOR, SLOTS } from '../src/symbol.js';

describe('NodeEnvironment', function() {
  beforeEach(function() {
    useAllMemberTypes();
    useAllStructureTypes();
  })
  describe('getBufferAddress', function() {
    it('should obtain address of memory in an ArrayBuffer with the help of Node API', function() {
      const env = new NodeEnvironment();
      env.extractBufferAddress = function() { return 0x1000n };
      const buffer = new ArrayBuffer(1024);
      const address = env.getBufferAddress(buffer);
      expect(address).to.equal(0x1000n);
    })
    it('should return cached address when available', function() {
      const env = new NodeEnvironment();
      let calls = 0;
      const buffer = new ArrayBuffer(1024);
      env.addressMap.set(buffer, 0x1000n);
      const address = env.getBufferAddress(buffer);
      expect(address).to.equal(0x1000n);
    })
  })
  describe('allocateHostMemory', function() {
    it('should create a buffer that can be discovered later', function() {
    const env = new NodeEnvironment();
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
      const env = new NodeEnvironment();
      env.obtainFixedView = () => null;
      env.extractBufferAddress = () => 0x10010;
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
  })
  describe('allocateShadowMemory', function() {    
    it('should allocate memory for dealing with misalignment', function() {
      const env = new NodeEnvironment();
      const dv = env.allocateShadowMemory(16, 4);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(16);
    })
  })
  describe('freeShadowMemory', function() {    
    it('should do nothing', function() {
      const env = new NodeEnvironment();
      env.freeShadowMemory(0x1000n, 16, 4);
    })
  })
  describe('allocateFixedMemory', function() {    
    it('should try to allocate fixed memory from zig', function() {
      const env = new NodeEnvironment();
      const buffers = {};
      env.allocateExternMemory = function(len, align) {
        return 0x1000n;
      };
      env.obtainExternBuffer = function(address, len) {
        return new ArrayBuffer(len);
      };
      const dv = env.allocateFixedMemory(400, 4);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(400);
    })
    it('should return empty data view when len is 0', function() {
      const env = new NodeEnvironment();
      env.allocateExternMemory = function(len, align) {
        return 0x1000n;
      };
      env.obtainExternBuffer = function(address, len) {
        return new ArrayBuffer(len);
      };
      const dv1 = env.allocateFixedMemory(0, 4);
      const dv2 = env.allocateFixedMemory(0, 1);
      expect(dv1.byteLength).to.equal(0);
      expect(dv2.byteLength).to.equal(0);
      expect(dv1).to.not.equal(dv2);
    })
  })
  describe('freeFixedMemory', function() {
    it('should try to free fixed memory through Zig', function() {
      const env = new NodeEnvironment();
      let args;
      env.freeExternMemory = function(address, len, align) {
        args = { address, len, align };
      };
      env.freeFixedMemory(0x1000n, 10, 2);
      expect(args).to.eql({ address: 0x1000n, len: 10, align: 2 });
    })
    it('should do nothing when len is 0', function() {
      const env = new NodeEnvironment();
      env.freeFixedMemory(0x1000n, 0, 0);
    })
  })
  describe('obtainFixedView', function() {    
    it('should return a data view covering fixed memory at given address', function() {
      const env = new NodeEnvironment();
      env.obtainExternBuffer = function(address, len) {
        return new ArrayBuffer(len);
      };
      const dv = env.obtainFixedView(0x1000n, 16);
      expect(dv.byteLength).to.equal(16);
    })
    it('should return empty data view when len is 0', function() {
      const env = new NodeEnvironment();
      env.obtainExternBuffer = function(address, len) {
        return new ArrayBuffer(len);
      };
      const dv1 = env.obtainFixedView(0x1000n, 0);
      const dv2 = env.obtainFixedView(0x2000n, 0);
      expect(dv1.byteLength).to.equal(0);
      expect(dv2.byteLength).to.equal(0);
      expect(dv1).to.not.equal(dv2);
    })
    it('should return a view to the null array when address is 0', function() {
      const env = new NodeEnvironment();
      const dv = env.obtainFixedView(0n, 0);
      expect(dv.buffer).to.equal(env.nullBuffer);
    })
  })
  describe('releaseFixedView', function() {    
    it('should free a data view that was allocated using allocateFixedMemory', function() {
      const env = new NodeEnvironment();
      env.allocateExternMemory = function(len, align) {
        return 0x1000n;
      };
      env.obtainExternBuffer = function(address, len) {  
        return new ArrayBuffer(len);
      };
      let args;
      env.freeExternMemory = function(address, len, align) {
        args = { address, len, align };
      };
      const dv = env.allocateFixedMemory(400, 4);
      env.releaseFixedView(dv);
      expect(args).to.eql({ address: 0x1000n, len: 400, align: 4 });
    })
  })
  describe('inFixedMemory', function() {
    it('should return true when memory is obtained from allocateFixedMemory', function() {
      const env = new NodeEnvironment();
      env.allocateExternMemory = function(len, align) {
        return 0x1000n 
      };
      env.obtainExternBuffer = function(address, len) { 
        return new ArrayBuffer(len);
      };
      const object = {
        [MEMORY]: env.allocateMemory(64, 8, true),
      };
      const result = env.inFixedMemory(object);
      expect(result).to.be.true;
    })
    it('should return true when memory is obtained from obtainFixedView', function() {
      const env = new NodeEnvironment();
      env.obtainExternBuffer = function(address, len) {
        return new ArrayBuffer(len);
      };
      env.extractBufferAddress = function() { return 0x1000n };
      const object = {
        [MEMORY]: env.obtainFixedView(0x1000n, 64),
      };
      const result = env.inFixedMemory(object);
      expect(result).to.be.true;
    })
  })
  describe('getTargetAddress', function() {
    it('should return address when address is correctly aligned', function() {
      const env = new NodeEnvironment();
      env.extractBufferAddress = function(buffer) {
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
    it('should return false when address is misaligned', function() {
      const env = new NodeEnvironment();
      env.extractBufferAddress = function(buffer) {
        return 0x1004;
      };
      env.startContext();
      const Type = function() {};
      Type[ALIGN] = 8;
      const object = new Type();
      object[MEMORY] = new DataView(new ArrayBuffer(64));
      const address = env.getTargetAddress(object);
      expect(address).to.be.false;
    })
    it('should return address when cluster is correctly aligned', function() {
      const env = new NodeEnvironment();
      env.extractBufferAddress = function(buffer) {
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
      const env = new NodeEnvironment();
      env.extractBufferAddress = function(buffer) {
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
      expect(address1).to.be.false;
      expect(cluster.misaligned).to.be.true;
      const address2 = env.getTargetAddress(object2, cluster);
      expect(address2).to.be.false;
    })
  })
  describe('allocateRelocMemory', function() {
    it('should allocate extra bytes to account for alignment', function() {
      const env = new NodeEnvironment();
      env.extractBufferAddress = function(buffer) {
        return 0x1000n;
      };
      const dv = env.allocateRelocMemory(64, 32);
      expect(dv.byteLength).to.equal(64);
      expect(dv.buffer.byteLength).to.equal(96);
    })
  })
  describe('invokeThunk', function() {
    it('should invoke the given thunk with the expected arguments', function() {
      const env = new NodeEnvironment();
      let recv, thunkId, argDV;
      env.runThunk = function(...args) {
        recv = this;
        thunkId = args[0];
        argDV = args[1];
      };
      const argStruct = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
        [SLOTS]: { 0: {} },
      };
      env.invokeThunk(100, argStruct);
      expect(recv).to.equal(env);
      expect(thunkId).to.equal(100);
      expect(argDV).to.equal(argStruct[MEMORY]);
    })
    it('should throw an error if thunk returns a string', function() {
      const env = new NodeEnvironment();
      env.runThunk = function(...args) {
        return 'JellyDonutInsurrection';
      };
      const argStruct = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
        [SLOTS]: { 0: {} },
      };
      expect(() => env.invokeThunk(100, argStruct)).to.throw(Error)
        .with.property('message').that.equals('Jelly donut insurrection') ;
    })
    it('should activate pointer visitor before and after the call', function() {
      const env = new NodeEnvironment();
      let thunkCalled = false;
      let visitorCalledBefore = false;
      let visitorCalledAfter = false;
      env.runThunk = function(...args) {
        thunkCalled = true;
      };
      const argStruct = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
        [SLOTS]: { 0: {} },
        [POINTER_VISITOR]: () => {
          if (thunkCalled) {
            visitorCalledAfter = true;
          } else {
            visitorCalledBefore = true;
          }
        }
      };
      env.invokeThunk(100, argStruct);
      expect(thunkCalled).to.be.true;
      expect(visitorCalledBefore).to.be.true;
      expect(visitorCalledAfter).to.be.true;
    })
  })
})
