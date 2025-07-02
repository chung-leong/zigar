import { expect } from 'chai';
import { readFile } from 'fs/promises';
import 'mocha-skip-if';
import { fileURLToPath } from 'url';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ALIGN, COPY, MEMORY, RESTORE, SIZE, ZIG } from '../../src/symbols.js';
import { defineProperties } from '../../src/utils.js';
import { captureError, usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: module-loading', function() {
  describe('abandonModule', function() {
    it('should release imported functions and variables', function() {
      const env = new Env();
      const exports = {
        runThunk: function() {},
      };
      env.importFunctions(exports);
      expect(() => env.runThunk()).to.not.throw();
      env.abandonModule();
      expect(() => env.runThunk()).to.throw();
      expect(env.abandoned).to.be.true;
    })
    it('should replace buffer in Zig memory with ones in JS memory', function() {
      const env = new Env();
      const viewMap = new Map(), addressMap = new Map();
      let nextAddress = usize(0x1000);
      const allocator = {
        alloc(len, align) {
          const address = nextAddress;
          nextAddress += usize(0x1000);
          const dv = new DataView(new ArrayBuffer(len));
          dv[ZIG] = { address, len, allocator: this };
          viewMap.set(address, dv);
          addressMap.set(dv, address);
          return dv;
        },
        free(dv) {
        },
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      defineProperties(Test.prototype, {
        [COPY]: env.defineCopier(16),
        [RESTORE]: {
          value: function() {},
        }
      });
      const object = new Test(env.allocateMemory(16, 8, allocator));
      const dv = object[MEMORY];
      expect(dv[ZIG]).to.be.an('object');
      dv.setUint32(12, 1234, true);
      env.variables.push({ object, handle: 128 });
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
        env.recreateAddress = function(handle) {
          return usize(handle);
        };
      }
      env.linkVariables(false);
      env.abandonModule();
      expect(object[MEMORY]).to.not.equal(dv);
      expect(dv.getUint32(12, true)).to.equal(1234);
      expect(object[MEMORY][ZIG]).to.be.undefined;
    })
    it('should free allocator vtable', function() {
      const env = new Env();
      const args = {};
      const constructor = function({ vtable, ptr }) {
        this.vtable = vtable;
        this.ptr = {
          ['*']: {
            [MEMORY]: ptr
          },
        };
      };
      const VTable = constructor.VTable = function(dv) {
        const self = {};
        self[MEMORY] = dv;
        return self;
      };
      VTable[SIZE] = 3 * 8;
      VTable[ALIGN] = 8;     
      const structure = { constructor };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          const buffer = new ArrayBuffer(len);
          buffer[ZIG] = { address, len };
          return buffer;
        };
        env.getBufferAddress = function(buffer) {
          return buffer[ZIG]?.address ?? usize(0xf_0000);
        };
      }
      let releaseCount = 0;
      env.releaseFunction = () => releaseCount++;
      env.createDefaultAllocator(args, structure);
      env.abandonModule();
      expect(releaseCount).to.be.at.least(2);
    })
  })
  if (process.env.TARGET === 'wasm') {
    describe('initialize', function() {
      skip.if(process.version <= 'v18').
      it('should accept a WASI object', async function() {
        const env = new Env();
        const url = new URL('./wasm-samples/read-file.wasm', import.meta.url);
        const buffer = await readFile(fileURLToPath(url));
        env.loadModule(buffer, {
          memoryInitial: 257,
          memoryMax: undefined,
          tableInitial: 320,
          multithreaded: false,
        });
        const { WASI } = await import('wasi');
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
      skip.if(process.version <= 'v18').
      it('should throw when WASM source has already been obtained', async function() {
        const env = new Env();
        const url = new URL('./wasm-samples/read-file.wasm', import.meta.url);
        const buffer = await readFile(fileURLToPath(url));
        await env.instantiateWebAssembly(buffer, {
          memoryInitial: 257,
          memoryMax: undefined,
          tableInitial: 320,
          multithreaded: false,
        });
        const { WASI } = await import('wasi');
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
    describe('displayPanic', function() {
      it('should output panic message to console', async function() {
        const env = new Env();
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const address = 0x1000;
        const dv = new DataView(env.memory.buffer, address, 4);
        dv.setUint8(0, 'D'.charCodeAt(0));
        dv.setUint8(1, 'o'.charCodeAt(0));
        dv.setUint8(2, 'h'.charCodeAt(0));
        dv.setUint8(3, '!'.charCodeAt(0));
        const [ line ] = await captureError(() => {
          env.displayPanic(address, 4);
        });
        expect(line).to.equal('Zig panic: Doh!');
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
          initialize: () => {},
          allocateScratchMemory: () => {},
          freeScratchMemory: (address, len, align) => {
            freed = { address, len, align };
          },
          runThunk: () => {},
          runVariadicThunk: () => {},
          getFactoryThunk: () => {},
          finalizeAsyncCall: () => {},
          flushStdout: () => {},
          garbage: () => {},
          createJsThunk: () => {},
          destroyJsThunk: () => {},
          getModuleAttributes: () => {},
        };
        env.importFunctions(exports);
        expect(env.allocateScratchMemory).to.be.a('function');
        expect(env.freeScratchMemory).to.be.a('function');
        expect(env.runThunk).to.be.a('function');
        expect(env.runVariadicThunk).to.be.a('function');
        expect(() => env.freeScratchMemory(123, 4, 2)).to.not.throw();
        expect(freed).to.eql({ address: 123, len: 4, align: 2 });
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
            memoryInitial: 257,
            memoryMax: undefined,
            tableInitial: 210,
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
          memoryInitial: 257,
          memoryMax: undefined,
          tableInitial: 210,
          multithreaded: false,
        });
      })
    })
    describe('loadModule', function() {
      it('should load a module', async function() {
        const env = new Env();
        const url = new URL('./wasm-samples/simple.wasm', import.meta.url);
        const buffer = await readFile(fileURLToPath(url));
        expect(env.getFactoryThunk).to.be.undefined;
        await env.loadModule(buffer, {
          memoryInitial: 257,
          memoryMax: undefined,
          tableInitial: 210,
          multithreaded: false,
        });
        expect(env.allocateScratchMemory).to.be.a('function');
        expect(env.freeScratchMemory).to.be.a('function');
        expect(env.runThunk).to.be.a('function');
      })
    })
  } else if (process.env.TARGET === 'node') {
    describe('exportFunctions', function() {
      it('should export functions of the class needed by Zig code', function() {
        const env = new Env();
        const exports = env.exportFunctions();
        expect(exports.getViewAddress).to.be.a('function');
      })
    })
    describe('importFunctions', function() {
      it('should attach methods to environment', function() {
        const env = new Env();
        const exports = {
          runThunk: () => {},
          runVariadicThunk: () => {},
          finalizeAsyncCall: () => {},
          getBufferAddress: () => {},
          copyExternBytes: () => {},
          getFactoryThunk: () => {},
          flushStdout: () => {},
          garbage: () => {},
          createJsThunk: () => {},
          destroyJsThunk: () => {},
          findSentinel: () => {},
          obtainExternBuffer: () => {},
          loadModule: () => {},
          getMemoryOffset: () => {},
          getNumericValue: () => {},
          setNumericValue: () => {},
          requireBufferFallback: () => {},
          syncExternalBuffer: () => {},
        };
        env.importFunctions(exports);
        expect(env.runThunk).to.be.a('function');
        expect(env.runVariadicThunk).to.be.a('function');
      })
    })
  }
})