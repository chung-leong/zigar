import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import { StructureType } from '../../src/constants.js';
import CallMarshalingOutbound, {
  CallContext,
  isNeededByStructure,
} from '../../src/features/call-marshaling-outbound.js';

const Env = defineClass('FeatureTest', [ CallMarshalingOutbound ]);

describe('Feature: call-marshaling-outbound', function() {
  describe('isNeededByStructure', function() {
    it('should return true when structure is a function', function() {
      const structure = {
        type: StructureType.Function,
        instance: {}
      };
      it('should return true when structure is not a function', function() {
        const structure = {
          type: StructureType.SinglePointer,
          instance: {
            members: [
              {
                type: MemberType.Object,
                structure: {
                  type: StructureType.Function,
                }
              }
            ]
          }
        };
        expect(isNeededByStructure(structure)).to.be.false;
      })
    })
  })
  describe('startContext', function() {
    it('should start a new context', function() {
      const env = new Env();
      env.startContext();
      try {
        expect(env.context).to.be.an.instanceOf(CallContext);
      } finally {
        env.endContext();
      }
    })
    it('should push existing context onto stack', function() {
      const env = new Env();
      env.startContext();
      const ctx1 = env.context;
      env.startContext();
      const ctx2 = env.context;
      try {
        expect(ctx2).to.not.equal(ctx1);
        expect(env.contextStack).to.be.an('array').with.lengthOf(1);
        expect(env.contextStack[0]).to.equal(ctx1);
      } finally {
        env.endContext();
        env.endContext();
      }
    })
  })
  describe('endContext', function() {
    it('should end current context', function() {
      const env = new Env();
      env.startContext();
      try {
        expect(env.context).to.be.an.instanceOf(CallContext);
      } finally {
        env.endContext();
      }
      expect(env.context).to.be.undefined;
    })
    it('should restore previous context', function() {
      const env = new Env();
      env.startContext();
      const ctx1 = env.context;
      env.startContext();
      const ctx2 = env.context;
      try {
        expect(ctx2).to.not.equal(ctx1);
      } finally {
        env.endContext();
      }
      try {
        expect(env.context).to.equal(ctx1);
      } finally {
        env.endContext();
      }
    })
  })
  if (process.env.TARGET === 'wasm') {
    describe('invokeThunk', function() {
      it('should call runThunk', function() {
        const env = new Env();
        let thunkId, argAddress;
        env.runThunk = function(...args) {
          thunkId = args[0];
          argAddress = args[1];
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
        };
        Arg.prototype[COPIER] = getMemoryCopier(4);
        const args = new Arg();
        env.invokeThunk(100, args);
        expect(thunkId).to.equal(100);
        expect(argAddress).to.equal(0x1000);
      })
      it('should attempt to update pointers in argument struct', function() {
        const env = new Env();
        let thunkId, argAddress;
        env.runThunk = function(...args) {
          thunkId = args[0];
          argAddress = args[1];
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
        };
        Arg.prototype[COPIER] = getMemoryCopier(4);
        let called = false;
        Arg.prototype[POINTER_VISITOR] = function() {
          called = true;
        };
        const args = new Arg();
        env.invokeThunk(100, args);
        expect(called).to.equal(true);
      })
      it('should throw when runThunk returns a string', function() {
        const env = new Env();
        env.runThunk = function(...args) {
          return 'NoDonut';
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
        };
        Arg.prototype[COPIER] = getMemoryCopier(4);
        const args = new Arg();
        expect(() => env.invokeThunk(100, args)).to.throw(Error)
          .with.property('message', 'No donut');
      })
      it('should return promise when thunk runner is not ready', async function() {
        const env = new Env();
        let done;
        env.initPromise = new Promise(resolve => done = resolve);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
          this.retval = 123;
        };
        Arg.prototype[COPIER] = getMemoryCopier(4);
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const args = new Arg();
        const promise = env.invokeThunk(100, args);
        expect(promise).to.be.a('promise');
        let thunkId, argAddress;
        env.runThunk = function(...args) {
          thunkId = args[0];
          argAddress = args[1];
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        done();
        const result = await promise;
        expect(result).to.equal(123);
        expect(thunkId).to.equal(100);
        expect(argAddress).to.equal(0x1000);
      })
      it('should throw when thunk runner eventually returns a string', async function() {
        const env = new Env();
        let done;
        env.initPromise = new Promise(resolve => done = resolve);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
          this.retval = 123;
        };
        Arg.prototype[COPIER] = getMemoryCopier(4);
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const args = new Arg();
        const promise = env.invokeThunk(100, args);
        expect(promise).to.be.a('promise');
        env.runThunk = function(...args) {
          return 'TooManyDonuts';
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        done();
        try {
          await promise;
          expect.fail('Not throwing');
        } catch (err) {
          expect(err).to.have.property('message', 'Too many donuts');
        }
      })
      it('should throw when function exits with non-zero code', async function() {
        const env = new Env();
        let done;
        env.initPromise = new Promise(resolve => done = resolve);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
          this.retval = 123;
        };
        Arg.prototype[COPIER] = getMemoryCopier(4);
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const args = new Arg();
        const promise = env.invokeThunk(100, args);
        expect(promise).to.be.a('promise');
        env.runThunk = function(...args) {
          throw new Exit(-1);
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        done();
        try {
          await promise;
          expect.fail('Not throwing');
        } catch (err) {
          expect(err).to.have.property('message', 'Program exited');
          expect(err.code).to.equal(-1);
        }
      })
      it('should not throw when function exits with zero', async function() {
        const env = new Env();
        let done;
        env.initPromise = new Promise(resolve => done = resolve);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
          this.retval = 123;
        };
        Arg.prototype[COPIER] = getMemoryCopier(4);
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const args = new Arg();
        const promise = env.invokeThunk(100, args);
        expect(promise).to.be.a('promise');
        env.runThunk = function(...args) {
          throw new Exit(0);
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        done();
        await promise;
      })
      it('should use variadic handler when argument struct has attributes', function() {
        const env = new Env();
        let recv, thunkId, argAddress, attrAddress;
        env.runThunk = function() {};
        env.runVariadicThunk = function(...args) {
          recv = this;
          thunkId = args[0];
          argAddress = args[1];
          attrAddress = args[2];
        };
        let nextAddress = 0x1000;
        env.allocateExternMemory = function(type, len, align) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return address;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const Attributes = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(16));
        };
        Attributes.prototype[COPIER] = getMemoryCopier(undefined);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(16));
          this[MEMORY][ALIGN] = 4;
          this[SLOTS] = { 0: {} };
          this[ATTRIBUTES] = new Attributes();
          this.retval = 123;
        };
        Arg.prototype[COPIER] = getMemoryCopier(16);
        const args = new Arg();
        env.invokeThunk(100, args);
        expect(recv).to.equal(env);
        expect(thunkId).to.equal(100);
        expect(argAddress).to.equal(0x1000);
        expect(attrAddress).to.equal(0x2000);
      })
    })
  } else if (process.env.TARGET === 'node') {
    describe('invokeThunk', function() {
      it('should invoke the given thunk with the expected arguments', function() {
        const env = new Env();
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
        const env = new Env();
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
        const env = new Env();
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
        const env = new Env();
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
        const env = new Env();
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
  }
})