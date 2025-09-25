import { expect } from 'chai';
import { readFile } from 'fs/promises';
import 'mocha-skip-if';
import { fileURLToPath } from 'url';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ALIGN, MEMORY, RESTORE, SIZE, ZIG } from '../../src/symbols.js';
import { copyView, defineProperties, usize } from '../../src/utils.js';
import { captureError, delay } from '../test-utils.js';

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
        expect(exports._createBool).to.be.a('function');
        expect(exports._createObject).to.be.a('function');
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
    describe('getWASIHandler', function() {
      it('should return a handler that return a promise when an event listener returns a promise', async function() {
        const env = new Env();
        if (process.env.TARGET === 'wasm') {
          env.memory = new WebAssembly.Memory({ initial: 1 });
        } else {
          const map = new Map();
          env.obtainExternBuffer = function (address, len) {
            let buffer = map.get(address);
            if (!buffer) {
              buffer = new ArrayBuffer(len);
              map.set(address, buffer);
            }
            return buffer;
          };
          env.moveExternBytes = function(jsDV, address, to) {
            const len = jsDV.byteLength;
            const zigDV = this.obtainZigView(address, len);
            if (!(jsDV instanceof DataView)) {
              jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
            }
            copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
          };
        }
        const pathAddress = usize(0x1000);
        const pathArray = new TextEncoder().encode('/hello.txt');
        env.moveExternBytes(pathArray, pathAddress, true);
        const f = env.getWASIHandler('path_unlink_file');
        env.addListener('unlink', async () => false);
        const result = f(3, pathAddress, pathArray.length, 0x1000);
        expect(result).to.be.a('promise');
      })
      it('should return a handler that display error message when fallback is unavailable', async function() {
        const env = new Env();
        if (process.env.TARGET === 'wasm') {
          env.memory = new WebAssembly.Memory({ initial: 1 });
        } else {
          const map = new Map();
          env.obtainExternBuffer = function (address, len) {
            let buffer = map.get(address);
            if (!buffer) {
              buffer = new ArrayBuffer(len);
              map.set(address, buffer);
            }
            return buffer;
          };
          env.moveExternBytes = function(jsDV, address, to) {
            const len = jsDV.byteLength;
            const zigDV = this.obtainZigView(address, len);
            if (!(jsDV instanceof DataView)) {
              jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
            }
            copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
          };
        }
        const pathAddress = usize(0x1000);
        const pathArray = new TextEncoder().encode('/hello.txt');
        env.moveExternBytes(pathArray, pathAddress, true);
        const f = env.getWASIHandler('path_unlink_file');
        let result;
        const [ error ] = await captureError(() => {
          result = f(3, pathAddress, pathArray.length);
        });
        expect(result).to.equal(PosixError.ENOTSUP);
        expect(error).to.contain('unlink');
      })
      it('should return a handler that display error message when there is no implementation', async function() {
        const env = new Env();
        if (process.env.TARGET === 'wasm') {
          env.memory = new WebAssembly.Memory({ initial: 1 });
        } else {
          const map = new Map();
          env.obtainExternBuffer = function (address, len) {
            let buffer = map.get(address);
            if (!buffer) {
              buffer = new ArrayBuffer(len);
              map.set(address, buffer);
            }
            return buffer;
          };
          env.moveExternBytes = function(jsDV, address, to) {
            const len = jsDV.byteLength;
            const zigDV = this.obtainZigView(address, len);
            if (!(jsDV instanceof DataView)) {
              jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
            }
            copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
          };
        }
        const f = env.getWASIHandler('path_open');
        let result;
        const [ error ] = await captureError(() => {
          result = f(-1);
        });
        expect(result).to.equal(PosixError.ENOTSUP);
        expect(error).to.contain('open');
      })
      it('should not display error message when function is not associated with an event', async function() {
        const env = new Env();
        if (process.env.TARGET === 'wasm') {
          env.memory = new WebAssembly.Memory({ initial: 1 });
        } else {
          const map = new Map();
          env.obtainExternBuffer = function (address, len) {
            let buffer = map.get(address);
            if (!buffer) {
              buffer = new ArrayBuffer(len);
              map.set(address, buffer);
            }
            return buffer;
          };
          env.moveExternBytes = function(jsDV, address, to) {
            const len = jsDV.byteLength;
            const zigDV = this.obtainZigView(address, len);
            if (!(jsDV instanceof DataView)) {
              jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
            }
            copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
          };
        }
        const f = env.getWASIHandler('tip_cow');
        let result;
        const [ error ] = await captureError(() => {
          result = f(-1);
        });
        expect(result).to.equal(PosixError.ENOTSUP);
        expect(error).to.be.undefined;
      })
    })
    describe('setCustomWASI', function() {
      it('should set custom WASI handlers', function() {
        const env = new Env();
        const wasi = {
          wasiImport: {
            path_unlink_file() {}
          }
        };
        env.setCustomWASI(wasi);
      })
      it('should invoke initializeCustomWASI when instance has already been created', function() {
        const env = new Env();
        const wasi = {
          wasiImport: {
            path_unlink_file() {}
          }
        };
        let called = false;
        env.initializeCustomWASI = () => called = true;
        env.instance = {};
        env.setCustomWASI(wasi);
        expect(called).to.be.true;
      })
    })
    describe('initializeCustomWASI', function() {
      it('should call initialize method', function() {
        const env = new Env();
        let initializeArgs, unlinkArgs;
        const wasi = {
          wasiImport: {
            path_unlink_file(...args) {
              unlinkArgs = args;
              return PosixError.ENOENT;
            }
          },
          initialize(...args) {
            initializeArgs = args;
          },
        };
        env.setCustomWASI(wasi);
        env.memory = new WebAssembly.Memory({ initial: 1 });
        env.instance = {
          instanceData: {},
        };
        env.initializeCustomWASI();
        expect(initializeArgs[0].instanceData).to.equal(env.instance.instanceData);
        expect(initializeArgs[0].exports.memory).to.equal(env.memory);
        let handlerCalled = false;
        env.addListener('unlink', () => {
          handlerCalled = true;
          return undefined
        });
        const f = env.getWASIHandler('path_unlink_file');
        const pathAddress = 0x1000;
        const pathArray = new TextEncoder().encode('/hello.txt');
        env.moveExternBytes(pathArray, pathAddress, true);
        const result = f(3, pathAddress, pathArray.length);
        expect(result).to.equal(PosixError.ENOENT);
        expect(handlerCalled).to.be.true;
        expect(unlinkArgs).to.eql([ 3, 4096, 10 ]);
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
          moveExternBytes: () => {},
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
    describe('addPromiseHandling', function() {
      it('should create a function that unlocks a futex on promise fulfillment', async function() {
        const env = new Env();
        let handlerArgs;
        const handler = (a, b, c, futexAddress) => {
          if (a > 0 && futexAddress) {
            handlerArgs = [ a, b, c ];
            return Promise.resolve(PosixError.EEXIST);
          } else {
            return PosixError.EAGAIN;
          }
        };
        const f = env.addPromiseHandling(handler);
        let finalizeArgs;
        env.finalizeAsyncCall = (...args) => finalizeArgs = args;
        const result1 = f.call(env, 1, 2, 3, 0x1000n);
        expect(result1).to.not.be.a('promise');
        await delay(10);
        expect(finalizeArgs).to.eql([ 0x1000n, PosixError.EEXIST ]);
        const result2 = f.call(env, 0, 0, 0, 0x1000n);
        expect(result2).to.not.be.a('promise');
        expect(finalizeArgs).to.eql([ 0x1000n, PosixError.EAGAIN ]);
        const result3 = f.call(env, 0, 0, 0);
        expect(result3).to.equal(PosixError.EAGAIN);
      })
    })
  }
})