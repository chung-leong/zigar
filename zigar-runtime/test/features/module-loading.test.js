import { expect } from 'chai';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { WASI } from 'wasi';
import { defineClass } from '../../src/environment.js';
import { capture } from '../test-utils.js';

import Baseline from '../../src/features/baseline.js';
import CallMarshalingOutbound from '../../src/features/call-marshaling-outbound.js';
import DataCopying from '../../src/features/data-copying.js';
import MemoryMapping from '../../src/features/memory-mapping.js';
import ModuleLoading from '../../src/features/module-loading.js';
import StreamRedirection from '../../src/features/stream-redirection.js';
import StructureAcquisition from '../../src/features/structure-acquisition.js';
import ViewManagement from '../../src/features/view-management.js';
import WasiSupport from '../../src/features/wasi-support.js';

debugger;
const Env = defineClass('FeatureTest', [
  Baseline, ModuleLoading, DataCopying, CallMarshalingOutbound, ViewManagement, WasiSupport,
  StreamRedirection, StructureAcquisition, MemoryMapping,
]);

describe('Feature: module-loading', function() {
  describe('releaseFunctions', function() {
    it('should make all imported functions throw', function() {
      debugger;
      const env = new Env();
      env.imports = {
        runThunk: function() {},
      };
      for (const [ name, f ] of Object.entries(env.imports)) {
        env[name] = f;
      }
      expect(() => env.runThunk()).to.not.throw();
      env.releaseFunctions();
      expect(() => env.runThunk()).to.throw();
    })
  })
  describe('abandonModule', function() {
    it('should release imported functions and variables', function() {
      const env = new Env();
      env.imports = {
        runThunk: function() {},
      };
      for (const [ name, f ] of Object.entries(env.imports)) {
        env[name] = f;
      }
      expect(() => env.runThunk()).to.not.throw();
      env.abandonModule();
      expect(() => env.runThunk()).to.throw();
      expect(env.abandoned).to.be.true;
    })
  })
  if (process.env.TARGET === 'wasm') {
    describe('initialize', function() {
      it('should accept a WASI object', async function() {
        const env = new Env();
        const url = new URL('./wasm-samples/read-file.wasm', import.meta.url);
        const buffer = await readFile(fileURLToPath(url));
        env.loadModule(buffer, {
          memoryInitial: 128,
          memoryMax: undefined,
          tableInitial: 18,
          multithreaded: false,
        });
        const wasi = new WASI({
          version: 'preview1',
          args: [],
          env: {},
          preopens: {
            '/local': fileURLToPath(new URL('.', import.meta.url)),
          },
        });
        await env.initialize(wasi);
      })
      it('should throw when WASM source has already been obtained', async function() {
        const env = new Env();
        const url = new URL('./wasm-samples/read-file.wasm', import.meta.url);
        const buffer = await readFile(fileURLToPath(url));
        await env.instantiateWebAssembly(buffer, {
          memoryInitial: 128,
          memoryMax: undefined,
          tableInitial: 18,
          multithreaded: false,
        });
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
    describe('clearExchangeTable', function() {
      it('should release objects stored in value table', function() {
        const env = new Env();
        const index = env.getObjectIndex({});
        expect(env.valueMap.get(index)).to.be.an('object');
        env.clearExchangeTable();
        expect(env.valueMap.get(index)).to.be.undefined;
      })
    })
    describe('getObjectIndex', function() {
      it('should create index from new object', function() {
        const env = new Env();
        const object1 = {};
        const object2 = {};
        const index1 = env.getObjectIndex(object1);
        const index2 = env.getObjectIndex(object2);
        expect(index1).to.equal(1);
        expect(index2).to.equal(2);
      })
      it('should return index of object already in table', function() {
        const env = new Env();
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
        const env = new Env();
        const index1 = env.getObjectIndex(undefined);
        const index2 = env.getObjectIndex(null);
        expect(index1).to.equal(0);
        expect(index2).to.equal(0);
      })
    })
    describe('fromWebAssembly', function() {
      it('should return object stored in value table', function() {
        const env = new Env();
        const object = {};
        const index = env.getObjectIndex(object);
        const result = env.fromWebAssembly('v', index);
        expect(result).to.equal(object);
      })
      it('should return string stored in value table', function() {
        const env = new Env();
        const object = 'hello world';
        const index = env.getObjectIndex(object);
        const result = env.fromWebAssembly('s', index);
        expect(result).to.equal('hello world');
      })
      it('should return number given', function() {
        const env = new Env();
        const result = env.fromWebAssembly('i', 72);
        expect(result).to.equal(72);
      })
      it('should return number as boolean', function() {
        const env = new Env();
        const result1 = env.fromWebAssembly('b', 72);
        const result2 = env.fromWebAssembly('b', 0);
        expect(result1).to.be.true;
        expect(result2).to.be.false;
      })
    })
    describe('toWebAssembly', function() {
      it('should store object in value table', function() {
        const env = new Env();
        const object = {};
        const index = env.toWebAssembly('v', object);
        const result = env.fromWebAssembly('v', index);
        expect(result).to.equal(object);
      })
      it('should store string in value table', function() {
        const env = new Env();
        const string = 'hello world';
        debugger;
        const index = env.toWebAssembly('s', string);
        const result = env.fromWebAssembly('s', index);
        expect(result).to.equal(string);
      })
      it('should return number given', function() {
        const env = new Env();
        const result = env.toWebAssembly('i', 72);
        expect(result).to.equal(72);
      })
      it('should return boolean as number', function() {
        const env = new Env();
        const result1 = env.toWebAssembly('b', true);
        const result2 = env.toWebAssembly('b', false);
        expect(result1).to.equal(1);
        expect(result2).to.equal(0);
      })
    })
    describe('exportFunction', function() {
      it('should create function that convert indices to correct values', function() {
        const env = new Env();
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
        const env = new Env();
        const fnEX = env.exportFunction(undefined, 'vsib', 's');
        expect(fnEX).to.be.a('function');
      })
    })
    describe('importFunction', function() {
      it('should create function that convert arguments to indices', function() {
        const env = new Env();
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
        const env = new Env();
        const exports = env.exportFunctions();
        expect(exports._captureString).to.be.a('function');
        expect(exports._beginStructure).to.be.a('function');
      })
    })
    describe('importFunctions', function() {
      it('should attach methods to environment', function() {
        const env = new Env();
        let freed;
        const exports = {
          allocateExternMemory: () => {},
          freeExternMemory: (type, address, len, align) => {
            freed = { type, address, len, align };
          },
          runThunk: () => {},
          runVariadicThunk: () => {},
          getFactoryThunk: () => {},
          flushStdout: () => {},
          garbage: () => {},
        };
        env.importFunctions(exports);
        expect(env.allocateExternMemory).to.be.a('function');
        expect(env.freeExternMemory).to.be.a('function');
        expect(env.runThunk).to.be.a('function');
        expect(env.runVariadicThunk).to.be.a('function');
        expect(() => env.freeExternMemory(0, 123, 4, 2)).to.not.throw();
        expect(freed).to.eql({ type: 0, address: 123, len: 4, align: 2 });
      })
      it('should throw when a function is missing', function() {
        const env = new Env();
        expect(() => env.importFunctions({})).to.throw(Error);
      })
    })
    describe('instantiateWebAssembly', function() {
      it('should attempt to stream in a WASM instance', async function() {
        const env = new Env();
        const response = {
          [Symbol.toStringTag]: 'Response',
        };
        try {
          const wasm = await env.instantiateWebAssembly(response, {
            memoryInitial: 128,
            memoryMax: undefined,
            tableInitial: 18,
            multithreaded: false,
          });
        } catch (err) {
        }
      })
      it('should initiate a WASM instance from a buffer', async function() {
        const env = new Env();
        const url = new URL('./wasm-samples/read-file.wasm', import.meta.url);
        const buffer = await readFile(fileURLToPath(url));
        const wasm = await env.instantiateWebAssembly(buffer, {
          memoryInitial: 128,
          memoryMax: undefined,
          tableInitial: 18,
          multithreaded: false,
        });
      })
    })
    describe('loadModule', function() {
      it('should load a module', async function() {
        const env = new Env();
        const url = new URL('./wasm-samples/read-file.wasm', import.meta.url);
        const buffer = await readFile(fileURLToPath(url));
        expect(env.getFactoryThunk).to.be.undefined;
        await env.loadModule(buffer, {
          memoryInitial: 128,
          memoryMax: undefined,
          tableInitial: 18,
          multithreaded: false,
        });
        expect(env.allocateExternMemory).to.be.a('function');
        expect(env.freeExternMemory).to.be.a('function');
        expect(env.runThunk).to.be.a('function');
      })
    })
    describe('trackInstance', function() {
      it('should make released a dynamic property', function() {
        const env = new Env();
        const instance = {};
        env.trackInstance(instance);
        const { get } = Object.getOwnPropertyDescriptor(env, 'released');
        expect(get).to.be.an('function');
        expect(env.released).to.be.false;
      })
    })
    describe('getWASIImport', function() {
      it('should write to console when fd_write is invoked', async function() {
        const env = new Env();
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
        const env = new Env();
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
        const env = new Env();
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
        const env = new Env();
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
        const env = new Env();
        const wasi = env.getWASIImport();
        expect(() => wasi.path_open()).to.not.throw();
        expect(() => wasi.fd_read()).to.not.throw();
        expect(() => wasi.fd_close()).to.not.throw();
        expect(() => wasi.fd_prestat_get()).to.not.throw();
      })
      it('should throw exit error when proc_exit is called', async function() {
        const env = new Env();
        const wasi = env.getWASIImport();
        expect(() => wasi.proc_exit()).to.throw(Error)
          .with.property('message', 'Program exited');
      })
    })
  } else if (process.env.TARGET === 'node') {
    describe('exportFunctions', function() {
      it('should export functions of the class needed by Zig code', function() {
        const env = new Env();
        const exports = env.exportFunctions();
        expect(exports.allocateHostMemory).to.be.a('function');
        expect(exports.getViewAddress).to.be.a('function');
      })
    })
    describe('importFunctions', function() {
      it('should attach methods to environment', function() {
        const env = new Env();
        let freed;
        const exports = {
          allocateExternMemory: () => {},
          freeExternMemory: (type, address, len, align) => {
            freed = { type, address, len, align };
          },
          runThunk: () => {},
          runVariadicThunk: () => {},
          getBufferAddress: () => {},
          copyExternBytes: () => {},
          getFactoryThunk: () => {},
          flushStdout: () => {},
          garbage: () => {},
        };
        env.importFunctions(exports);
        expect(env.allocateExternMemory).to.be.a('function');
        expect(env.freeExternMemory).to.be.a('function');
        expect(env.runThunk).to.be.a('function');
        expect(env.runVariadicThunk).to.be.a('function');
        expect(() => env.freeExternMemory(0, 123, 4, 2)).to.not.throw();
        expect(freed).to.eql({ type: 0, address: 123, len: 4, align: 2 });
      })
      it('should throw when a function is missing', function() {
        const env = new Env();
        expect(() => env.importFunctions({})).to.throw(Error);
      })
    })
  }
})