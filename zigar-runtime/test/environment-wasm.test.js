import { expect } from 'chai';
import { readFile } from 'fs/promises';

import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import {
  WebAssemblyEnvironment,
} from '../src/environment-wasm.js'
import { ALIGN, MEMORY, SLOTS } from '../src/symbol.js';

describe('WebAssemblyEnvironment', function() {
  beforeEach(function() {
    useAllMemberTypes();
    useAllStructureTypes();
  })
  describe('allocateRelocMemory', function() {
    it('should allocate the relocatable and shadow memory, returning the latter', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      env.allocateShadowMemory = function(len, align) {
        return new DataView(memory.buffer, 128, len);
      };
      env.startContext();
      const dv = env.allocateRelocMemory(64, 32);
      expect(dv.byteLength).to.equal(64);
      expect(dv.buffer).to.equal(memory.buffer);
    })
  })
  describe('freeRelocMemory', function() {
    it('should free shadow memory', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      env.allocateShadowMemory = function(len, align) {
        return new DataView(memory.buffer, 128, len);
      };
      let address, align, len;
      env.freeShadowMemory = function(arg1, arg2, arg3) {
        address = arg1;
        len = arg2;
        align = arg3;
      };
      env.startContext();
      const dv = env.allocateRelocMemory(64, 32);
      env.freeRelocMemory(128, 64, 32);
      expect(address).to.equal(128);
      expect(len).to.equal(64);
      expect(align).to.equal(32);
    })
  })
  describe('getBufferAddress', function() {
    it('should return zero', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      expect(env.getBufferAddress(env.memory.buffer)).to.equal(0);
    })
    it('should throw when buffer is not from WASM memory', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      const buffer = new ArrayBuffer(64);
      expect(() => env.getBufferAddress(buffer)).to.throw();
    })
  })
  describe('allocateFixedMemory', function() {
    it('should call allocateExternMemory to obtain address to allocated block', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      env.allocateExternMemory = function(len, align) {
        return 128;
      };
      env.startContext();
      const dv = env.allocateFixedMemory(64, 32);
      expect(dv.byteLength).to.equal(64);
      expect(dv.buffer).to.equal(memory.buffer);
      expect(dv[ALIGN]).to.equal(32);
    })
  })
  describe('freeFixedMemory', function() {
    it('shoud call freeExternMemory to free allocated block', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      env.allocateExternMemory = function(len, align) {
        return 128;
      };
      let address, align, len;
      env.freeExternMemory = function(arg1, arg2, arg3) {
        address = arg1;
        len = arg2;
        align = arg3;
      };
      env.startContext();
      const dv = env.allocateFixedMemory(64, 32);
      env.freeFixedMemory(128, 64, 32);
      expect(address).to.equal(128);
      expect(len).to.equal(64);
      expect(align).to.equal(32);
    })
  })
  describe('obtainFixedView', function() {
    it('should return a view to WASM memory', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      }); 
      const dv = env.obtainFixedView(128, 16);
      expect(dv.buffer).to.equal(memory.buffer);
      expect(dv.byteLength).to.equal(16);
      expect(dv.byteOffset).to.equal(128);
      expect(dv[ALIGN]).to.be.undefined;
    })
  })
  describe('releaseFixedView', function() {
    it('should free memory from allocatedFixedMemory', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      env.allocateExternMemory = function(len, align) {
        return 128;
      };
      let address, align, len;
      env.freeExternMemory = function(arg1, arg2, arg3) {
        address = arg1;
        len = arg2;
        align = arg3;
      };
      env.startContext();
      const dv = env.allocateFixedMemory(64, 32);
      env.releaseFixedView(dv);
      expect(address).to.equal(128);
      expect(len).to.equal(64);
      expect(align).to.equal(32);
    })
  })
  describe('inFixedMemory', function() {
    it('should return true when view points to a WebAssembly memory', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      const object = {
        [MEMORY]: new DataView(memory.buffer, 0, 8),
      };
      const result = env.inFixedMemory(object);
      expect(result).to.be.true;
    })
  })
  describe('copyBytes', function() {
  })
  describe('findSentinel', function() {
  })
  describe('captureString', function() {
  })
  describe('getTargetAddress', function() {
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
      expect(exports._allocateRelocMemory).to.be.a('function');
      expect(exports._beginStructure).to.be.a('function');
    })
  })
  describe('importFunctions', function() {
    it('should create methods in the environment object', function() {
      const env = new WebAssemblyEnvironment();
      const exports = {
        defineStructures: () => {},
        allocateShadowMemory: () => {},
        freeShadowMemory: () => {},
        runThunk: () => {},
        isRuntimeSafetyActive: () => {},
        garbage: () => {},
      };
      env.importFunctions(exports);
      expect(env.defineStructures).to.be.a('function');
      expect(env.allocateShadowMemory).to.be.a('function');
      expect(env.freeShadowMemory).to.be.a('function');
      expect(env.runThunk).to.be.a('function');
      expect(env.isRuntimeSafetyActive).to.be.a('function');
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
      const url = new URL('./wasm-samples/simple.wasm', import.meta.url);
      const buffer = await readFile(url.pathname);
      const wasm = await env.instantiateWebAssembly(buffer);
    })
  })
  describe('loadModule', function() {
  })
  describe('trackInstance', function() {
  })
  describe('linkVariables', function() {
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
  })
  describe('recreateAddress', function() {
  })
  describe('startCall', function() {
  })
  describe('endCall', function() {
  })
  describe('invokeThunk', function() {
  })
})
