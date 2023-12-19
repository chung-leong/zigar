import { expect } from 'chai';

import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import {
  NodeEnvironment,
} from '../src/environment-node.js'
import { MEMORY, SLOTS, POINTER_VISITOR, CHILD_VIVIFICATOR } from '../src/symbol.js';

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
  describe('allocateRelocMemory', function() {
    it('should create a buffer that can be discovered later', function() {
    const env = new NodeEnvironment();
    env.getBufferAddress = () => 0x10000n;
    env.startContext();
    const dv1 = env.allocateRelocMemory(32, 8);
    expect(dv1).to.be.instanceOf(DataView);
    expect(dv1.byteLength).to.equal(32);
    const dv2 = env.findMemory(0x10000n, 32);
    expect(dv2.buffer).to.equal(dv1.buffer);
    expect(dv2.byteLength).to.equal(32);
    })
  })
  describe('freeRelocMemory', function() {
    it('should remove buffer at indicated address', function() {
      const env = new NodeEnvironment();
      env.obtainFixedView = () => null;
      env.getBufferAddress = () => 0x10010;
      env.startContext();
      const dv = env.allocateRelocMemory(32, 32);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(32);
      expect(dv.byteOffset).to.equal(16);
      const address = env.getViewAddress(dv);
      env.freeRelocMemory(address, 32, 32);
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
      env.allocateExternMemory = function(len, align) {
        return new ArrayBuffer(len);
      };
      env.extractBufferAddress = function() { return 0x1000n };
      const dv = env.allocateFixedMemory(400, 4);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(400);
    })
    it('should return empty data view when len is 0', function() {
      const env = new NodeEnvironment();
      const dv1 = env.allocateFixedMemory(0, 4);
      const dv2 = env.allocateFixedMemory(0, 1);
      expect(dv1.byteLength).to.equal(0);
      expect(dv2.byteLength).to.equal(0);
      expect(dv1).to.equal(dv2);
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
      const dv1 = env.obtainFixedView(0x1000n, 0);
      const dv2 = env.obtainFixedView(0x2000n, 0);
      expect(dv1.byteLength).to.equal(0);
      expect(dv2.byteLength).to.equal(0);
      expect(dv1).to.equal(dv2);
    })
  })
  describe('releaseFixedView', function() {    
    it('should free a data view that was allocated using allocateFixedMemory', function() {
      const env = new NodeEnvironment();
      env.allocateExternMemory = function(len, align) {
        return new ArrayBuffer(len);
      };
      env.extractBufferAddress = function() { return 0x1000n };
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
    it('should return true when view points to a SharedArrayBuffer', function() {
      const env = new NodeEnvironment();
      const object = {
        [MEMORY]: new DataView(new SharedArrayBuffer(16)),
      };
      const result = env.inFixedMemory(object);
      expect(result).to.be.true;
    })
  })
  describe('getTargetAddress', function() {
  })
  describe('createAlignedBuffer', function() {
  })
  describe('invokeThunk', function() {
    it('should invoke the given thunk with the expected arguments', function() {
      const env = new NodeEnvironment();
      const argStruct = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
        [SLOTS]: { 0: {} },
      };
      let recv, arg;
      env.invokeThunk(thunk, argStruct);
      expect(recv).to.equal(env);
      expect(arg).to.equal(argStruct[MEMORY]);
    })
    it('should throw an error if thunk returns a string', function() {
      const env = new NodeEnvironment();
      const argStruct = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
        [SLOTS]: { 0: {} },
      };
      expect(() => env.invokeThunk(thunk, argStruct)).to.throw(Error)
        .with.property('message').that.equals('Jelly donut insurrection') ;
    })
  })
})
