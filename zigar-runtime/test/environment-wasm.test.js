import { expect } from 'chai';
import { readFile } from 'fs/promises';
import { WASI } from 'wasi';

import { fileURLToPath } from 'url';
import {
  WebAssemblyEnvironment,
} from '../src/environment-wasm.js';
import { Exit, InvalidDeallocation } from '../src/error.js';
import { useAllMemberTypes } from '../src/member.js';
import { getMemoryCopier } from '../src/memory.js';
import { ObjectCache, getMemoryRestorer } from '../src/object.js';
import { useAllStructureTypes } from '../src/structure.js';
import { ALIGN, ATTRIBUTES, COPIER, MEMORY, MEMORY_RESTORER, POINTER_VISITOR, SLOTS } from '../src/symbol.js';

describe('WebAssemblyEnvironment', function() {
  beforeEach(function() {
    useAllMemberTypes();
    useAllStructureTypes();
  })
  describe('init', function() {
    it('should accept a WASI object', async function() {
      const env = new WebAssemblyEnvironment();
      const url = new URL('./wasm-samples/read-file.wasm', import.meta.url);
      const buffer = await readFile(fileURLToPath(url));
      env.loadModule(buffer);
      const wasi = new WASI({
        version: 'preview1',
        args: [],
        env: {},
        preopens: {
          '/local': fileURLToPath(new URL('.', import.meta.url)),
        },
      });
      await env.init(wasi);
    })
    it('should throw when WASM source has already been obtained', async function() {
      const env = new WebAssemblyEnvironment();
      const url = new URL('./wasm-samples/read-file.wasm', import.meta.url);
      const buffer = await readFile(fileURLToPath(url));
      await env.instantiateWebAssembly(buffer);
      const wasi = new WASI({
        version: 'preview1',
        args: [],
        env: {},
        preopens: {
          '/local': fileURLToPath(new URL('.', import.meta.url)),
        },
      });
      let error;
      try {
        await env.init(wasi);
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error');
    })
  })
  describe('allocateHostMemory', function() {
    it('should allocate the relocatable and shadow memory, returning the latter', function() {
      const env = new WebAssemblyEnvironment();
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
      const env = new WebAssemblyEnvironment();
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
      const env = new WebAssemblyEnvironment();
      env.startContext();
      expect(() => env.freeHostMemory(128, 64, 32)).to.throw(InvalidDeallocation);
    })
  })
  describe('getBufferAddress', function() {
    it('should return zero', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      expect(env.getBufferAddress(env.memory.buffer)).to.equal(0);
    })
    it('should throw when buffer is not from WASM memory', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const buffer = new ArrayBuffer(64);
      expect(() => env.getBufferAddress(buffer)).to.throw();
    })
  })
  describe('obtainExternView', function() {
    it('should return a view to WASM memory', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const dv = env.obtainExternView(128, 16);
      expect(dv.buffer).to.equal(memory.buffer);
      expect(dv.byteLength).to.equal(16);
      expect(dv.byteOffset).to.equal(128);
    })
    it('should handle reference to zero-length slice', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const dv = env.obtainExternView(0, 0);
      expect(dv.buffer).to.equal(memory.buffer);
      expect(dv.byteLength).to.equal(0);
      expect(dv.byteOffset).to.equal(0);
    })
    // it('should correctly handle negative address', function() {
    //   const env = new WebAssemblyEnvironment();
    //   const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
    //   const dv = env.obtainExternView(-5000, 0);
    //   expect(dv.byteLength).to.equal(0);
    //   expect(dv.byteOffset).to.equal(0);
    // })
  })
  describe('copyBytes', function() {
    it('should copy bytes from specified address', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const src = new DataView(memory.buffer, 128, 4);
      src.setUint32(0, 1234);
      const dest = new DataView(new ArrayBuffer(4));
      env.copyBytes(dest, 128, 4);
      expect(dest.getUint32(0)).to.equal(1234);
    })
  })
  describe('findSentinel', function() {
    it('should find length of zero-terminated string at address', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const text = 'Hello';
      const src = new DataView(memory.buffer, 128, 16);
      for (let i = 0; i < text.length; i++) {
        src.setUint8(i, text.charCodeAt(i));
      }
      const byte = new DataView(new ArrayBuffer(1));
      const len = env.findSentinel(128, byte);
      expect(len).to.equal(5);
    })
    it('should return undefined upon hitting end of memory', function() {
      const env = new WebAssemblyEnvironment();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const text = 'Hello';
      const byte = new DataView(new ArrayBuffer(1));
      byte.setUint8(0, 0xFF);
      const len = env.findSentinel(128, byte);
      expect(len).to.be.undefined;
    })
  })
  describe('captureString', function() {
    it('should return string located at address', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const text = 'Hello';
      const src = new DataView(memory.buffer, 128, 16);
      for (let i = 0; i < text.length; i++) {
        src.setUint8(i, text.charCodeAt(i));
      }
      const string = env.captureString(128, 5);
      expect(string).to.equal('Hello');
    })
  })
  describe('getTargetAddress', function() {
    it('should return false when object is located in relocatable memory', function() {
      const env = new WebAssemblyEnvironment();
      const object = {
        [MEMORY]: env.allocateMemory(16, 8, false)
      };
      const address = env.getTargetAddress(object);
      expect(address).to.be.undefined;
    })
    it('should return zero when object has no bytes', function() {
      const env = new WebAssemblyEnvironment();
      const object = {
        [MEMORY]: env.allocateMemory(0, 0, false)
      };
      const address = env.getTargetAddress(object);
      expect(address).to.equal(0);
    })
    it('should return the address when object is in fixed memory', function() {
      const env = new WebAssemblyEnvironment();
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
  describe('clearExchangeTable', function() {
    it('should release objects stored in value table', function() {
      const env = new WebAssemblyEnvironment();
      const index = env.getObjectIndex({});
      expect(env.valueTable[index]).to.be.an('object');
      env.clearExchangeTable();
      expect(env.valueTable[index]).to.be.undefined;
    })
  })
  describe('getObjectIndex', function() {
    it('should create index from new object', function() {
      const env = new WebAssemblyEnvironment();
      const object1 = {};
      const object2 = {};
      const index1 = env.getObjectIndex(object1);
      const index2 = env.getObjectIndex(object2);
      expect(index1).to.equal(1);
      expect(index2).to.equal(2);
    })
    it('should return index of object already in table', function() {
      const env = new WebAssemblyEnvironment();
      const object1 = {};
      const object2 = {};
      const index1 = env.getObjectIndex(object1);
      const index2 = env.getObjectIndex(object2);
      const index3 = env.getObjectIndex(object1);
      const index4 = env.getObjectIndex(object2);
      expect(index3).to.equal(index1);
      expect(index4).to.equal(index2);
    })
    it('should return 0 for undefined and null', function() {
      const env = new WebAssemblyEnvironment();
      const index1 = env.getObjectIndex(undefined);
      const index2 = env.getObjectIndex(null);
      expect(index1).to.equal(0);
      expect(index2).to.equal(0);
    })
  })
  describe('fromWebAssembly', function() {
    it('should return object stored in value table', function() {
      const env = new WebAssemblyEnvironment();
      const object = {};
      const index = env.getObjectIndex(object);
      const result = env.fromWebAssembly('v', index);
      expect(result).to.equal(object);
    })
    it('should return string stored in value table', function() {
      const env = new WebAssemblyEnvironment();
      const object = 'hello world';
      const index = env.getObjectIndex(object);
      const result = env.fromWebAssembly('s', index);
      expect(result).to.equal('hello world');
    })
    it('should return number given', function() {
      const env = new WebAssemblyEnvironment();
      const result = env.fromWebAssembly('i', 72);
      expect(result).to.equal(72);
    })
    it('should return number as boolean', function() {
      const env = new WebAssemblyEnvironment();
      const result1 = env.fromWebAssembly('b', 72);
      const result2 = env.fromWebAssembly('b', 0);
      expect(result1).to.be.true;
      expect(result2).to.be.false;
    })
  })
  describe('toWebAssembly', function() {
    it('should store object in value table', function() {
      const env = new WebAssemblyEnvironment();
      const object = {};
      const index = env.toWebAssembly('v', object);
      const result = env.fromWebAssembly('v', index);
      expect(result).to.equal(object);
    })
    it('should store string in value table', function() {
      const env = new WebAssemblyEnvironment();
      const string = 'hello world';
      const index = env.toWebAssembly('s', string);
      const result = env.fromWebAssembly('s', index);
      expect(result).to.equal(string);
    })
    it('should return number given', function() {
      const env = new WebAssemblyEnvironment();
      const result = env.toWebAssembly('i', 72);
      expect(result).to.equal(72);
    })
    it('should return boolean as number', function() {
      const env = new WebAssemblyEnvironment();
      const result1 = env.toWebAssembly('b', true);
      const result2 = env.toWebAssembly('b', false);
      expect(result1).to.equal(1);
      expect(result2).to.equal(0);
    })
  })
  describe('exportFunction', function() {
    it('should create function that convert indices to correct values', function() {
      const env = new WebAssemblyEnvironment();
      let recv, args;
      const fn = function(...a) {
        recv = this;
        args = a;
        return 'Hello world';
      };
      const fnEX = env.exportFunction(fn, 'vsib', 's');
      const object = {}, string = 'Cow', number = 1234, boolean = true;
      const indices = [ object, string, number, boolean ].map((a, i) => {
        return env.toWebAssembly('vsib'.charAt(i), a);
      });
      const result = fnEX(...indices);
      expect(result).to.be.a('number');
      expect(env.fromWebAssembly('s', result)).to.equal('Hello world');
      expect(recv).to.equal(env);
      expect(args[0]).to.equal(object);
      expect(args[1]).to.equal(string);
      expect(args[2]).to.equal(number);
      expect(args[3]).to.equal(boolean);
    })
    it('should return a empty function when the function given does not exist', function() {
      const env = new WebAssemblyEnvironment();
      const fnEX = env.exportFunction(undefined, 'vsib', 's');
      expect(fnEX).to.be.a('function');
    })
  })
  describe('importFunction', function() {
    it('should create function that convert arguments to indices', function() {
      const env = new WebAssemblyEnvironment();
      let args;
      const fn = function(...a) {
        args = a;
        return env.getObjectIndex('Hello world');
      };
      const fnIM = env.importFunction(fn, 'vsib', 's');
      const object = {}, string = 'Cow', number = 1234, boolean = true;
      const result = fnIM(object, string, number, boolean);
      expect(result).to.equal('Hello world');
      expect(args[0]).to.be.a('number');
      expect(args[1]).to.be.a('number');
      expect(args[2]).to.be.a('number');
      expect(args[3]).to.be.a('number');
      expect(env.fromWebAssembly('v', args[0])).to.equal(object);
      expect(env.fromWebAssembly('s', args[1])).to.equal(string);
      expect(env.fromWebAssembly('i', args[2])).to.equal(number);
      expect(env.fromWebAssembly('b', args[3])).to.equal(boolean);
    })
  })
  describe('exportFunctions', function() {
    it('should export functions of the class needed by Zig code', function() {
      const env = new WebAssemblyEnvironment();
      const exports = env.exportFunctions();
      expect(exports._allocateHostMemory).to.be.a('function');
      expect(exports._beginStructure).to.be.a('function');
    })
  })
  describe('importFunctions', function() {
    it('should create methods in the environment object', function() {
      const env = new WebAssemblyEnvironment();
      let freed;
      const exports = {
        allocateExternMemory: () => {},
        freeExternMemory: (type, address, len, align) => {
          freed = { type, address, len, align };
        },
        runThunk: () => {},
        runVariadicThunk: () => {},
        isRuntimeSafetyActive: () => {},
        getFactoryThunk: () => {},
        flushStdout: () => {},
        garbage: () => {},
      };
      env.importFunctions(exports);
      expect(env.allocateExternMemory).to.be.a('function');
      expect(env.freeExternMemory).to.be.a('function');
      expect(env.runThunk).to.be.a('function');
      expect(env.runVariadicThunk).to.be.a('function');
      expect(env.isRuntimeSafetyActive).to.be.a('function');
      expect(() => env.freeExternMemory(0, 123, 4, 2)).to.not.throw();
      expect(freed).to.eql({ type: 0, address: 123, len: 4, align: 2 });
    })
    it('should throw when a function is missing', function() {
      const env = new WebAssemblyEnvironment();
      expect(() => env.importFunctions({})).to.throw(Error);
    })
  })
  describe('instantiateWebAssembly', function() {
    it('should attempt to stream in a WASM instance', async function() {
      const env = new WebAssemblyEnvironment();
      const response = {
        [Symbol.toStringTag]: 'Response',
      };
      try {
        const wasm = await env.instantiateWebAssembly(response);
      } catch (err) {
      }
    })
    it('should initiate a WASM instance from a buffer', async function() {
      const env = new WebAssemblyEnvironment();
      const url = new URL('./wasm-samples/read-file.wasm', import.meta.url);
      const buffer = await readFile(fileURLToPath(url));
      const wasm = await env.instantiateWebAssembly(buffer);
    })
  })
  describe('loadModule', function() {
    it('should load a module', async function() {
      const env = new WebAssemblyEnvironment();
      const url = new URL('./wasm-samples/read-file.wasm', import.meta.url);
      const buffer = await readFile(fileURLToPath(url));
      expect(env.getFactoryThunk).to.be.undefined;
      await env.loadModule(buffer);
      expect(env.allocateExternMemory).to.be.a('function');
      expect(env.freeExternMemory).to.be.a('function');
      expect(env.runThunk).to.be.a('function');
    })
  })
  describe('trackInstance', function() {
    it('should make released a dynamic property', function() {
      const env = new WebAssemblyEnvironment();
      const instance = {};
      env.trackInstance(instance);
      const { get } = Object.getOwnPropertyDescriptor(env, 'released');
      expect(get).to.be.an('function');
      expect(env.released).to.be.false;
    })
  })
  describe('linkVariables', function() {
    it('should link variables after initialization promise is fulfilled', async function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      env.initPromise = Promise.resolve();
      const cache = new ObjectCache();
      const Type = function() {};
      Type.prototype[COPIER] = getMemoryCopier(4);
      Type.prototype[MEMORY_RESTORER] = getMemoryRestorer(cache, env);
      const object = new Type();
      const dv = object[MEMORY] = new DataView(new ArrayBuffer(4));
      dv.setUint32(0, 1234, true);
      env.variables.push({ object, reloc: 128 });
      env.linkVariables(true);
      await env.initPromise;
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[MEMORY].buffer).to.equal(memory.buffer);
      expect(object[MEMORY].byteOffset).to.equal(128);
      expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
    });
  })
  describe('beginDefinition', function() {
    it('should return an empty object', function() {
      const env = new WebAssemblyEnvironment();
      const def1 = env.beginDefinition();
      expect(def1).to.be.an('object');
      const { _beginDefinition } = env.exportFunctions();
      const def2 = env.fromWebAssembly('v', _beginDefinition());
      expect(def2).to.be.an('object');
    })
  })
  describe('insertProperty', function() {
    it('should insert value into object', function() {
      const env = new WebAssemblyEnvironment();
      const def1 = env.beginDefinition();
      env.insertProperty(def1, 'hello', 1234);
      expect(def1).to.have.property('hello', 1234);
      const {
        _beginDefinition,
        _insertInteger,
        _insertBoolean,
        _insertString,
        _insertObject,
      } = env.exportFunctions();
      const object = {};
      const defIndex = _beginDefinition();
      _insertInteger(defIndex, env.toWebAssembly('s', 'number'), 4567);
      _insertBoolean(defIndex, env.toWebAssembly('s', 'boolean'), 1);
      _insertString(defIndex, env.toWebAssembly('s', 'string'), env.toWebAssembly('s', 'holy cow'));
      _insertObject(defIndex, env.toWebAssembly('s', 'object'), env.toWebAssembly('v', object));
      const def2 = env.fromWebAssembly('v', defIndex);
      expect(def2).to.have.property('number', 4567);
      expect(def2).to.have.property('boolean', true);
      expect(def2).to.have.property('string', 'holy cow');
      expect(def2).to.have.property('object', object);
    })
  })
  describe('getMemoryOffset', function() {
    it('should return the same address', function() {
      const env = new WebAssemblyEnvironment();
      const offset = env.getMemoryOffset(128);
      expect(offset).to.equal(128);
    })
  })
  describe('recreateAddress', function() {
    it('should return the same address', function() {
      const env = new WebAssemblyEnvironment();
      const address = env.recreateAddress(128);
      expect(address).to.equal(128);
    })
  })
  describe('invokeThunk', function() {
    it('should call runThunk', function() {
      const env = new WebAssemblyEnvironment();
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
      const env = new WebAssemblyEnvironment();
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
      const env = new WebAssemblyEnvironment();
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
      const env = new WebAssemblyEnvironment();
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
      const env = new WebAssemblyEnvironment();
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
      const env = new WebAssemblyEnvironment();
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
      const env = new WebAssemblyEnvironment();
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
      const env = new WebAssemblyEnvironment();
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
  describe('getWASIImport', function() {
    it('should write to console when fd_write is invoked', async function() {
      const env = new WebAssemblyEnvironment();
      const wasi = env.getWASIImport();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const bufferAddress = 16;
      const stringAddress = 64;
      const writtenAddress = 128;
      const dv = new DataView(memory.buffer);
      const text = 'ABC\n';
      for (let i = 0; i < text.length; i++) {
        dv.setUint8(stringAddress + i, text.charCodeAt(i));
      }
      dv.setUint32(bufferAddress, stringAddress, true);
      dv.setUint32(bufferAddress + 4, text.length, true);
      const [ line ] = await capture(() => {
        wasi.fd_write(1, bufferAddress, 1, writtenAddress);
      });
      expect(line).to.equal(text.trim());
      const written = dv.getUint32(writtenAddress, true);
      expect(written).to.equal(4);
    })
    it('should write to console when call to fd_write is directed at stderr', async function() {
      const env = new WebAssemblyEnvironment();
      const wasi = env.getWASIImport();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const bufferAddress = 16;
      const stringAddress = 64;
      const writtenAddress = 128;
      const dv = new DataView(memory.buffer);
      const text = 'ABC\n';
      for (let i = 0; i < text.length; i++) {
        dv.setUint8(stringAddress + i, text.charCodeAt(i));
      }
      dv.setUint32(bufferAddress, stringAddress, true);
      dv.setUint32(bufferAddress + 4, text.length, true);
      const [ line ] = await capture(() => {
        wasi.fd_write(2, bufferAddress, 1, writtenAddress);
      });
      expect(line).to.equal(text.trim());
      const written = dv.getUint32(writtenAddress, true);
      expect(written).to.equal(4);
    })
    it('should return error code when file descriptor is not stdout or stderr', async function() {
      const env = new WebAssemblyEnvironment();
      const wasi = env.getWASIImport();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const bufferAddress = 16;
      const stringAddress = 64;
      const writtenAddress = 128;
      const dv = new DataView(memory.buffer);
      const text = 'ABC\n';
      for (let i = 0; i < text.length; i++) {
        dv.setUint8(stringAddress + i, text.charCodeAt(i));
      }
      dv.setUint32(bufferAddress, stringAddress, true);
      dv.setUint32(bufferAddress + 4, text.length, true);
      let result;
      const [ line ] = await capture(() => {
        result = wasi.fd_write(3, bufferAddress, 1, writtenAddress);
      });
      expect(result).to.not.equal(0);
      expect(line).to.be.undefined;
    })
    it('should fill a buffer with random bytes when random_get is invoked', async function() {
      const env = new WebAssemblyEnvironment();
      const wasi = env.getWASIImport();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const bufferAddress = 16;
      const bufferLength = 8;
      const dv = new DataView(memory.buffer);
      wasi.random_get(bufferAddress, bufferLength);
      let allZeroes = true;
      for (let i = 0; i < bufferLength; i++) {
        const byte = dv.getUint8(bufferAddress + i);
        if (byte !== 0) {
          allZeroes = false;
        }
      }
      expect(allZeroes).to.be.false;
    })
    it('should do nothing when when unsupported functions are invoked', async function() {
      const env = new WebAssemblyEnvironment();
      const wasi = env.getWASIImport();
      expect(() => wasi.path_open()).to.not.throw();
      expect(() => wasi.fd_read()).to.not.throw();
      expect(() => wasi.fd_close()).to.not.throw();
      expect(() => wasi.fd_prestat_get()).to.not.throw();
    })
    it('should throw exit error when proc_exit is called', async function() {
      const env = new WebAssemblyEnvironment();
      const wasi = env.getWASIImport();
      expect(() => wasi.proc_exit()).to.throw(Error)
        .with.property('message', 'Program exited');
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

