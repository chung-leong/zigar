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
  describe('allocateRelocatableMemory', function() {
    it('should create a buffer that can be discovered later', function() {
    const env = new NodeEnvironment();
    env.getBufferAddress = () => 0x10000n;
    env.startContext();
    const dv1 = env.allocateRelocatableMemory(32, 8);
    expect(dv1).to.be.instanceOf(DataView);
    expect(dv1.byteLength).to.equal(32);
    const dv2 = env.findMemory(0x10000n, 32);
    expect(dv2.buffer).to.equal(dv1.buffer);
    expect(dv2.byteLength).to.equal(32);
    })
  })
  describe('freeRelocatableMemory', function() {
    it('should remove buffer at indicated address', function() {
      const env = new NodeEnvironment();
      env.obtainFixedView = () => null;
      env.getBufferAddress = () => 0x10010;
      env.startContext();
      const dv = env.allocateRelocatableMemory(32, 32);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(32);
      expect(dv.byteOffset).to.equal(16);
      const address = env.getViewAddress(dv);
      env.freeRelocatableMemory(address, 32, 32);
      const bad = env.findMemory(address, 32);
      expect(bad).to.be.null;
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
  describe('invokeFactory', function() {
    it('should run the given thunk function with the expected arguments and return a constructor', function() {
      const env = new NodeEnvironment();
      let recv;
      const constructor = function() {};
      function thunk(...args) {
        recv = this;
        return constructor
      };
      const result = env.invokeFactory(thunk);
      expect(recv).to.be.equal(env);
      expect(result).to.equal(constructor);
      expect(result).to.have.property('__zigar');
    })
    it('should throw if the thunk function returns a string', function() {
      const env = new NodeEnvironment();
      function thunk(...args) {
        return 'TotalBrainFart';
      }
      expect(() => env.invokeFactory(thunk)).to.throw(Error)
        .with.property('message').that.equal('Total brain fart');
    })
    it('should allow abandonment of library', async function() {
      const env = new NodeEnvironment();
      const constructor = function() {};
      function thunk(...args) {
        return constructor
      }
      const result = env.invokeFactory(thunk);
      await result.__zigar.init();
      const promise = result.__zigar.abandon();
      expect(promise).to.be.a('promise');
      const released = await result.__zigar.released();
      expect(released).to.be.true;
    })
    it('should replace abandoned functions with placeholders that throw', async function() {
      const env = new NodeEnvironment();
      const constructor = function() {};
      function thunk(...args) {
        return constructor
      }
      let t = () => console.log('hello');
      constructor.hello = function() { t() };
      const constructor2 = function() {};
      Object.defineProperty(constructor, 'submodule', { get: () => constructor2 });
      Object.defineProperty(constructor, 'self', { get: () => constructor });
      const result = env.invokeFactory(thunk);
      await capture(() => {
        expect(constructor.hello).to.not.throw();
      });
      await result.__zigar.abandon();
      expect(constructor.hello).to.throw(Error)
        .with.property('message').that.contains('was abandoned');
    })
    it('should release variable of abandoned module', async function() {
      const env = new NodeEnvironment();
      const constructor = function() {};
      function thunk(...args) {
        return constructor
      }
      const obj1 = {
        [MEMORY]: new DataView(new SharedArrayBuffer(8)),
        [POINTER_VISITOR]: () => {},
        [SLOTS]: {
          0: {
            [MEMORY]: new DataView(new SharedArrayBuffer(4))
          }
        },
      };
      obj1[SLOTS][0][MEMORY].setInt32(0, 1234, true);
      const obj2 = {
        [MEMORY]: new DataView(new SharedArrayBuffer(8)),
        [POINTER_VISITOR]: () => {},
        [SLOTS]: {
          0: {
            [MEMORY]: new DataView(new SharedArrayBuffer(32)),
            [SLOTS]: {}
          }
        },
      };
      constructor[CHILD_VIVIFICATOR] = {
        hello: () => { return obj1 },
        world: () => { return obj2 },
      };
      const result = env.invokeFactory(thunk);
      await result.__zigar.abandon();
      expect(obj1[SLOTS][0][MEMORY].buffer).to.be.an.instanceOf(ArrayBuffer);
      expect(obj1[SLOTS][0][MEMORY].getInt32(0, true)).to.equal(1234);
    })
  })
  describe('invokeThunk', function() {
    it('should invoke the given thunk with the expected arguments', function() {
      const env = new NodeEnvironment();
      const argStruct = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
        [SLOTS]: { 0: {} },
      };
      let recv, arg;
      function thunk(...args) {
        recv = this;
        arg = args[0];
      }
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
      function thunk(...args) {
        return `JellyDonutInsurrection`;
      }
      expect(() => env.invokeThunk(thunk, argStruct)).to.throw(Error)
        .with.property('message').that.equals('Jelly donut insurrection') ;
    })
  })
})

async function capture(cb) {
  const logFn = console.log;
  const lines = [];
  try {
    console.log = (text) => {
      if (typeof(text) === 'string') {
        for (const line of text.split(/\r?\n/)) {
          lines.push(line)
        }
      } else {
        logFn.call(console, text);
      }
    };
    await cb();
  } finally {
    console.log = logFn;
  }
  return lines;
}
