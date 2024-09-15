import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { Exit } from '../../src/errors.js';
import { CallContext } from '../../src/features/call-marshaling-outbound.js';
import '../../src/mixins.js';
import { ALIGN, ATTRIBUTES, COPY, FIXED, MEMORY, SIZE, SLOTS, VISIT } from '../../src/symbols.js';
import { defineProperties } from '../../src/utils.js';
import { usize } from '../test-utils.js';

use (ChaiAsPromised);

const Env = defineEnvironment();

describe('Feature: call-marshaling-outbound', function() {
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
  describe('createOutboundCallers', function() {
    it('should create a caller for invoking a Zig function', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 4 * 3,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      const thunk = {
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      };
      thunk[MEMORY][FIXED] = { address: usize(0x1004) };
      const { self } = env.createOutboundCallers(thunk, ArgStruct)
      let thunkAddress, fnAddress, argStruct;
      env.runThunk = (...args) => {
        thunkAddress = args[0];
        fnAddress = args[1];
        argStruct = args[2];
        return true;
      };
      self[MEMORY] = new DataView(new ArrayBuffer(0));
      self[MEMORY][FIXED] = { address: usize(0x2008) };
      env.allocateExternMemory = function(address, len) {
        return usize(0x4000);
      };
      env.freeExternMemory = function() {
      }
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      }
      self(1, 2);
      expect(thunkAddress).to.equal(usize(0x1004));
      expect(fnAddress).to.equal(usize(0x2008));
      if (process.env.TARGET === 'wasm') {
        // on the WASM side external memory is used and the address is passed to runThunk()
        expect(argStruct).to.equal(usize(0x4000));
        argStruct = ArgStruct(new DataView(env.memory.buffer, 0x4000, ArgStruct[SIZE]));
      } else if (process.env.TARGET === 'node') {
        // on the Node side the arg struct is accessed directly and the DataView is passed to runThunk()
        expect(argStruct).to.be.instanceOf(DataView);
        argStruct = ArgStruct(argStruct);
      }
      expect(argStruct[0]).to.equal(1);
      expect(argStruct[1]).to.equal(2);
    })
    it('should create a caller that accept a data view as argument', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 4 * 3,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      const thunk = {
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      };
      thunk[MEMORY][FIXED] = { address: usize(0x1004) };
      const { self, binary } = env.createOutboundCallers(thunk, ArgStruct)
      let thunkAddress, fnAddress, argStruct;
      env.runThunk = (...args) => {
        thunkAddress = args[0];
        fnAddress = args[1];
        argStruct = args[2];
        return true;
      };
      self[MEMORY] = new DataView(new ArrayBuffer(0));
      self[MEMORY][FIXED] = { address: usize(0x2008) };
      env.allocateExternMemory = function(address, len) {
        return usize(0x4000);
      };
      env.freeExternMemory = function() {
      }
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      }
      const dv = new ArgStruct([ 1, 2 ], 'hello', 0)[MEMORY];
      binary(dv);
      expect(thunkAddress).to.equal(usize(0x1004));
      expect(fnAddress).to.equal(usize(0x2008));
      if (process.env.TARGET === 'wasm') {
        expect(argStruct).to.equal(usize(0x4000));
        argStruct = ArgStruct(new DataView(env.memory.buffer, 0x4000, ArgStruct[SIZE]));
      } else if (process.env.TARGET === 'node') {
        expect(argStruct).to.equal(dv);
        argStruct = ArgStruct(argStruct);
      }
      expect(argStruct[0]).to.equal(1);
      expect(argStruct[1]).to.equal(2);
    })
    it('should create a caller for method calls', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Struct',
        byteSize: 4 * 2,
      });
      env.attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Struct = env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: 4 * 3,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      const thunk = {
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      };
      thunk[MEMORY][FIXED] = { address: usize(0x1004) };
      const { self, method } = env.createOutboundCallers(thunk, ArgStruct)
      let thunkAddress, fnAddress, argStruct;
      env.runThunk = (...args) => {
        thunkAddress = args[0];
        fnAddress = args[1];
        argStruct = args[2];
        return true;
      };
      self[MEMORY] = new DataView(new ArrayBuffer(0));
      self[MEMORY][FIXED] = { address: usize(0x2008) };
      env.allocateExternMemory = function(address, len) {
        return usize(0x4000);
      };
      env.freeExternMemory = function() {
      }
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      }
      const struct = new Struct({ cat: 123, dog: 456 });
      method.call(struct);
      expect(thunkAddress).to.equal(usize(0x1004));
      expect(fnAddress).to.equal(usize(0x2008));
      if (process.env.TARGET === 'wasm') {
        expect(argStruct).to.equal(usize(0x4000));
        argStruct = ArgStruct(new DataView(env.memory.buffer, 0x4000, ArgStruct[SIZE]));
      } else if (process.env.TARGET === 'node') {
        expect(argStruct).to.be.instanceOf(DataView);
        argStruct = ArgStruct(argStruct);
      }
      expect(argStruct[0].cat).to.equal(123);
      expect(argStruct[0].dog).to.equal(456);
    })
  })
  if (process.env.TARGET === 'wasm') {
    describe('invokeThunk', function() {
      it('should call runThunk', function() {
        const env = new Env();
        let thunkAddress, fnAddress, argAddress;
        env.runThunk = function(...args) {
          thunkAddress = args[0];
          fnAddress = args[1];
          argAddress = args[2];
          return true;
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
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        const args = new Arg();
        env.invokeThunk(100, 200, args);
        expect(thunkAddress).to.equal(100);
        expect(fnAddress).to.equal(200);
        expect(argAddress).to.equal(0x1000);
      })
      it('should attempt to update pointers in argument struct', function() {
        const env = new Env();
        let thunkAddress, fnAddress, argAddress;
        env.runThunk = function(...args) {
          thunkAddress = args[0];
          fnAddress = args[1];
          argAddress = args[2];
          return true;
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
        let called = false;
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
          [VISIT]: {
            value() {
              called = true;
            }
          }
        });
        const args = new Arg();
        env.invokeThunk(100, 100, args);
        expect(called).to.equal(true);
      })
      it('should throw when runThunk returns false', function() {
        const env = new Env();
        env.runThunk = function(...args) {
          return false;
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
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        const args = new Arg();
        expect(() => env.invokeThunk(100, 200, args)).to.throw(Error)
          .with.property('message').that.contains('Zig');
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
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const args = new Arg();
        const promise = env.invokeThunk(100, 200, args);
        expect(promise).to.be.a('promise');
        let thunkAddress, fnAddress, argAddress;
        env.runThunk = function(...args) {
          thunkAddress = args[0];
          fnAddress = args[1];
          argAddress = args[2];
          return true;
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        done();
        const result = await promise;
        expect(result).to.equal(123);
        expect(thunkAddress).to.equal(100);
        expect(fnAddress).to.equal(200);
        expect(argAddress).to.equal(0x1000);
      })
      it('should throw when thunk runner eventually returns a false', async function() {
        const env = new Env();
        let done;
        env.initPromise = new Promise(resolve => done = resolve);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
          this.retval = 123;
        };
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const args = new Arg();
        const promise = env.invokeThunk(100, 100, args);
        expect(promise).to.be.a('promise');
        env.runThunk = function(...args) {
          return false;
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        done();
        await expect(promise).to.eventually.be.rejectedWith();
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
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const args = new Arg();
        const promise = env.invokeThunk(100, 100, args);
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
        await expect(promise).to.eventually.be.rejectedWith(Exit).with.property('code', -1);
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
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const args = new Arg();
        const promise = env.invokeThunk(100, 100, args);
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
        await expect(promise).to.eventually.be.fulfilled;
      })
      it('should use variadic handler when argument struct has attributes', function() {
        const env = new Env();
        let recv, thunkAddress, fnAddress, argAddress, attrAddress;
        env.runThunk = function() {};
        env.runVariadicThunk = function(...args) {
          recv = this;
          thunkAddress = args[0];
          fnAddress = args[1];
          argAddress = args[2];
          attrAddress = args[3];
          return true;
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
        defineProperties(Attributes.prototype, {
          [COPY]: env.defineCopier(undefined),
        });
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(16));
          this[MEMORY][ALIGN] = 4;
          this[SLOTS] = { 0: {} };
          this[ATTRIBUTES] = new Attributes();
          this.retval = 123;
        };
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(16),
        });
        const args = new Arg();
        env.invokeThunk(100, 200, args);
        expect(recv).to.equal(env);
        expect(thunkAddress).to.equal(100);
        expect(fnAddress).to.equal(200);
        expect(argAddress).to.equal(0x1000);
        expect(attrAddress).to.equal(0x2000);
      })
    })
  } else if (process.env.TARGET === 'node') {
    describe('invokeThunk', function() {
      it('should invoke the given thunk with the expected arguments', function() {
        const env = new Env();
        let recv, thunkAddress, fnAddress, argDV;
        env.runThunk = function(...args) {
          recv = this;
          thunkAddress = args[0];
          fnAddress = args[1];
          argDV = args[2];
          return true;
        };
        const argStruct = {
          [MEMORY]: new DataView(new ArrayBuffer(16)),
          [SLOTS]: { 0: {} },
        };
        env.invokeThunk(100, 200, argStruct);
        expect(recv).to.equal(env);
        expect(thunkAddress).to.equal(100);
        expect(fnAddress).to.equal(200);
        expect(argDV).to.equal(argStruct[MEMORY]);
      })
      it('should activate pointer visitor before and after the call', function() {
        const env = new Env();
        let thunkCalled = false;
        let visitorCalledBefore = false;
        let visitorCalledAfter = false;
        env.runThunk = function(...args) {
          thunkCalled = true;
          return true;
        };
        const argStruct = {
          [MEMORY]: new DataView(new ArrayBuffer(16)),
          [SLOTS]: { 0: {} },
          [VISIT]: () => {
            if (thunkCalled) {
              visitorCalledAfter = true;
            } else {
              visitorCalledBefore = true;
            }
          }
        };
        env.invokeThunk(100, 200, argStruct);
        expect(thunkCalled).to.be.true;
        expect(visitorCalledBefore).to.be.true;
        expect(visitorCalledAfter).to.be.true;
      })
      it('should use variadic handler when argument struct has attributes', function() {
        const env = new Env();
        let recv, thunkAddress, fnAddress, argDV, attrDV;
        env.runVariadicThunk = function(...args) {
          recv = this;
          thunkAddress = args[0];
          fnAddress = args[1];
          argDV = args[2];
          attrDV = args[3];
          return true;
        };
        const argAttrs = {
          [MEMORY]: new DataView(new ArrayBuffer(16)),
        };
        const argStruct = {
          [MEMORY]: new DataView(new ArrayBuffer(16)),
          [SLOTS]: { 0: {} },
          [ATTRIBUTES]: argAttrs,
        };
        env.invokeThunk(100, 200, argStruct);
        expect(recv).to.equal(env);
        expect(thunkAddress).to.equal(100);
        expect(fnAddress).to.equal(200);
        expect(argDV).to.equal(argStruct[MEMORY]);
        expect(attrDV).to.equal(argAttrs[MEMORY]);
      })
      it('should use variadic handler when argument struct has attributes and pointers', function() {
        const env = new Env();
        let recv, thunkAddress, fnAddress, argDV, attrDV;
        env.runVariadicThunk = function(...args) {
          recv = this;
          thunkAddress = args[0];
          fnAddress = args[1];
          argDV = args[2];
          attrDV = args[3];
          return true;
        };
        const argAttrs = {
          [MEMORY]: new DataView(new ArrayBuffer(16)),
        };
        const argStruct = {
          [MEMORY]: new DataView(new ArrayBuffer(16)),
          [SLOTS]: { 0: {} },
          [ATTRIBUTES]: argAttrs,
          [VISIT]: () => {},
        };
        env.invokeThunk(100, 200, argStruct);
        expect(recv).to.equal(env);
        expect(thunkAddress).to.equal(100);
        expect(fnAddress).to.equal(200);
        expect(argDV).to.equal(argStruct[MEMORY]);
        expect(attrDV).to.equal(argAttrs[MEMORY]);
      })
    })
  }
})