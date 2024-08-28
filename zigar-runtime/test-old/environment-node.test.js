import { expect } from 'chai';

import {
  NodeEnvironment,
} from '../src/environment-node.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import { ALIGN, ATTRIBUTES, MEMORY, POINTER_VISITOR, SLOTS } from '../src/symbol.js';

describe('NodeEnvironment', function() {
  beforeEach(function() {
    useAllMemberTypes();
    useAllStructureTypes();
  })
  describe('init', function() {
    it('should do nothing', async function() {
      const env = new NodeEnvironment();
      await env.init();
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
      const env = new NodeEnvironment();
      env.startContext();
      expect(() => env.freeHostMemory(0x1000, 32, 32)).to.throw(ReferenceError);
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
  describe('getTargetAddress', function() {
    it('should return address when address is correctly aligned', function() {
      const env = new NodeEnvironment();
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
      const env = new NodeEnvironment();
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
      const env = new NodeEnvironment();
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
      const env = new NodeEnvironment();
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
  describe('allocateRelocMemory', function() {
    it('should allocate extra bytes to account for alignment', function() {
      const env = new NodeEnvironment();
      env.getBufferAddress = function(buffer) {
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
    it('should use variadic handler when argument struct has attributes', function() {
      const env = new NodeEnvironment();
      let recv, thunkId, argDV, attrDV;
      env.runVariadicThunk = function(...args) {
        recv = this;
        thunkId = args[0];
        argDV = args[1];
        attrDV = args[2];
      };
      const argAttrs = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
      };
      const argStruct = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
        [SLOTS]: { 0: {} },
        [ATTRIBUTES]: argAttrs,
      };
      env.invokeThunk(100, argStruct);
      expect(recv).to.equal(env);
      expect(thunkId).to.equal(100);
      expect(argDV).to.equal(argStruct[MEMORY]);
      expect(attrDV).to.equal(argAttrs[MEMORY]);
    })
    it('should use variadic handler when argument struct has attributes and pointers', function() {
      const env = new NodeEnvironment();
      let recv, thunkId, argDV, attrDV;
      env.runVariadicThunk = function(...args) {
        recv = this;
        thunkId = args[0];
        argDV = args[1];
        attrDV = args[2];
      };
      const argAttrs = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
      };
      const argStruct = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
        [SLOTS]: { 0: {} },
        [ATTRIBUTES]: argAttrs,
        [POINTER_VISITOR]: () => {},
      };
      env.invokeThunk(100, argStruct);
      expect(recv).to.equal(env);
      expect(thunkId).to.equal(100);
      expect(argDV).to.equal(argStruct[MEMORY]);
      expect(attrDV).to.equal(argAttrs[MEMORY]);
    })
  })
})
