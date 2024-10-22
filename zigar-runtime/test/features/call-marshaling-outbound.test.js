import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { Exit } from '../../src/errors.js';
import '../../src/mixins.js';
import { ALIGN, ATTRIBUTES, CONTEXT, COPY, FIXED, MEMORY, SLOTS, VISIT } from '../../src/symbols.js';
import { defineProperties, usizeMin } from '../../src/utils.js';
import { usize } from '../test-utils.js';

use (ChaiAsPromised);

const Env = defineEnvironment();

describe('Feature: call-marshaling-outbound', function() {
  describe('createOutboundCaller', function() {
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
        length: 2,
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
      const self = env.createOutboundCaller(thunk, ArgStruct)
      let thunkAddress, fnAddress, argAddress;
      env.runThunk = (...args) => {
        thunkAddress = args[0];
        fnAddress = args[1];
        argAddress = args[2];
        return true;
      };
      self[MEMORY] = new DataView(new ArrayBuffer(0));
      self[MEMORY][FIXED] = { address: usize(0x2008) };
      env.allocateExternMemory = function(address, len) {
        return usize(0x4000);
      };
      env.freeExternMemory = function() {
      }
      const bufferMap = new Map(), addressMap = new Map();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else if (process.env.TARGET === 'node') {
        let nextAddress = usize(0xf000_1000);
        env.getBufferAddress = function(buffer) {
          let address = addressMap.get(buffer);
          if (!address) {
            address = nextAddress;
            nextAddress += usize(0x1000);
            bufferMap.set(address, buffer);
            addressMap.set(buffer, address);
          }
          return address;
        }
      }
      self(1, 2);
      expect(thunkAddress).to.equal(usize(0x1004));
      expect(fnAddress).to.equal(usize(0x2008));
      let argDV;
      if (process.env.TARGET === 'wasm') {
        expect(argAddress).to.equal(usize(0x4000));
        argDV = new DataView(env.memory.buffer, 0x4000, 12);
      } else if (process.env.TARGET === 'node') {
        expect(argAddress).to.equal(usize(0xf000_1000));
        argDV = new DataView(bufferMap.get(argAddress));
      }
      const argStruct = ArgStruct(argDV);
      expect(argStruct[0]).to.equal(1);
      expect(argStruct[1]).to.equal(2);
    })
    if (process.env.TARGET === 'wasm') {
      it('should return promise when thunk runner is not ready', async function() {
        const env = new Env();
        let done;
        env.initPromise = new Promise(resolve => done = resolve);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
          this[CONTEXT] = { memoryList: [], shadowMap: null, id: usizeMin };
          this.retval = 123;
        };
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const thunk = { [MEMORY]: env.obtainFixedView(usize(100), 0) };
        const self = env.createOutboundCaller(thunk, Arg);
        self[MEMORY] = env.obtainFixedView(usize(200), 0);
        const promise = self();
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
      it('should not throw when an Exit error with zero is encountered', async function() {
        const env = new Env();
        let done;
        env.initPromise = new Promise(resolve => done = resolve);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
          this[CONTEXT] = { memoryList: [], shadowMap: null, id: usizeMin };
          this.retval = 123;
        };
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const thunk = { [MEMORY]: env.obtainFixedView(usize(100), 0) };
        const self = env.createOutboundCaller(thunk, Arg);
        self[MEMORY] = env.obtainFixedView(usize(200), 0);
        const promise = self();
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
      it('should throw when thunk runner eventually returns a false', async function() {
        const env = new Env();
        let done;
        env.initPromise = new Promise(resolve => done = resolve);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
          this[CONTEXT] = { memoryList: [], shadowMap: null, id: usizeMin };
          this.retval = 123;
        };
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const thunk = { [MEMORY]: env.obtainFixedView(usize(100), 0) };
        const self = env.createOutboundCaller(thunk, Arg);
        self[MEMORY] = env.obtainFixedView(usize(200), 0);
        const promise = self();
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
          this[CONTEXT] = { memoryList: [], shadowMap: null, id: usizeMin };
          this.retval = 123;
        };
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const thunk = { [MEMORY]: env.obtainFixedView(usize(100), 0) };
        const self = env.createOutboundCaller(thunk, Arg);
        self[MEMORY] = env.obtainFixedView(usize(200), 0);
        const promise = self();
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
    }
  })
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
      if (process.env.TARGET === 'wasm') {
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
        }
      }
      env.flushStdout = function() {};
      const Arg = function() {
        this[MEMORY] = new DataView(new ArrayBuffer(4));
        this[MEMORY][ALIGN] = 4;
        this[CONTEXT] = { memoryList: [], shadowMap: null, id: usizeMin };
      };
      defineProperties(Arg.prototype, {
        [COPY]: env.defineCopier(4),
      });
      const args = new Arg();
      const thunk = { [MEMORY]: env.obtainFixedView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainFixedView(usize(200), 0) };
      env.invokeThunk(thunk, fn, args);
      expect(thunkAddress).to.equal(usize(100));
      expect(fnAddress).to.equal(usize(200));
      expect(argAddress).to.equal(usize(0x1000));
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
      if (process.env.TARGET === 'wasm') {
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
        };
      }
      env.flushStdout = function() {};
      const Arg = function() {
        this[MEMORY] = new DataView(new ArrayBuffer(4));
        this[MEMORY][ALIGN] = 4;
        this[CONTEXT] = { memoryList: [], shadowMap: null, id: usizeMin };
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
      const thunk = { [MEMORY]: env.obtainFixedView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainFixedView(usize(200), 0) };
      env.invokeThunk(thunk, fn, args);
      expect(called).to.equal(true);
    })
    it('should throw when runThunk returns false', function() {
      const env = new Env();
      env.runThunk = function(...args) {
        return false;
      };
      if (process.env.TARGET === 'wasm') {
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
        };
      }
      env.flushStdout = function() {};
      const Arg = function() {
        this[MEMORY] = new DataView(new ArrayBuffer(4));
        this[MEMORY][ALIGN] = 4;
        this[CONTEXT] = { memoryList: [], shadowMap: null, id: usizeMin };
      };
      defineProperties(Arg.prototype, {
        [COPY]: env.defineCopier(4),
      });
      const args = new Arg();
      const thunk = { [MEMORY]: env.obtainFixedView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainFixedView(usize(200), 0) };
      expect(() => env.invokeThunk(thunk, fn, args)).to.throw(Error)
        .with.property('message').that.contains('Zig');
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
      if (process.env.TARGET === 'wasm') {
        env.allocateExternMemory = function(type, len, align) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return address;
        };
        env.freeExternMemory = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.getBufferAddress = function(buffer) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return usize(address);
        };
      }
      env.flushStdout = function() {};
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
        this[CONTEXT] = { memoryList: [], shadowMap: null, id: usizeMin };
        this.retval = 123;
      };
      defineProperties(Arg.prototype, {
        [COPY]: env.defineCopier(16),
      });
      const args = new Arg();
      const thunk = { [MEMORY]: env.obtainFixedView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainFixedView(usize(200), 0) };
      env.invokeThunk(thunk, fn, args);
      expect(recv).to.equal(env);
      expect(thunkAddress).to.equal(usize(100));
      expect(fnAddress).to.equal(usize(200));
      expect(argAddress).to.equal(usize(0x1000));
      expect(attrAddress).to.equal(usize(0x2000));
    })
  })
})