import { expect } from 'chai';
import { readFile } from 'fs/promises';
import 'mocha-skip-if';
import { fileURLToPath } from 'url';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Feature: thunk-allocation', function() {
    describe('addJsThunkSource', function() {
      it('should add a new instance of the WebAssembly module', async function() {
        const wasmPath = absolute('./wasm-samples/fn-pointer.wasm');
        const binary = await readFile(wasmPath);
        const env = new Env();
        await env.loadModule(binary, {
          memoryInitial: 1024,
          tableInitial: 100,
          multithreaded: false,
        });
        const source = env.addJsThunkSource();
        expect(source.createJsThunk).to.be.a('function');
        expect(source.destroyJsThunk).to.be.a('function');
      })
    })
    describe('allocateJsThunk', function() {
      it('should allocate a JavaScript thunk', async function() {
        const wasmPath = absolute('./wasm-samples/fn-pointer.wasm');
        const binary = await readFile(wasmPath);
        const env = new Env();
        await env.loadModule(binary, {
          memoryInitial: 1024,
          tableInitial: 100,
          multithreaded: false,
        });
        env.acquireStructures({});
        const { Fn } = env.useStructures();
        let thunkControllerAddress;
        let fnId;
        env.createJsThunk = function(address, id) {
          thunkControllerAddress = address;
          fnId = id;
          return usize(100);
        };
        new Fn(() => {});
        const thunkAddress1 = env.allocateJsThunk(thunkControllerAddress, fnId);
        expect(thunkAddress1).to.equal(100);
        const thunkAddress2 = env.allocateJsThunk(thunkControllerAddress, fnId + 1);
        expect(thunkAddress2).to.be.above(100);
      })
    })
    describe('freeJsThunk', function() {
      it('should free a JavaScript thunk', async function() {
        const wasmPath = absolute('./wasm-samples/fn-pointer.wasm');
        const binary = await readFile(wasmPath);
        const env = new Env();
        await env.loadModule(binary, {
          memoryInitial: 1024,
          tableInitial: 100,
          multithreaded: false,
        });
        env.acquireStructures({});
        const { Fn } = env.useStructures();
        let thunkControllerAddress;
        let fnId;
        env.createJsThunk = function(address, id) {
          thunkControllerAddress = address;
          fnId = id;
          return usize(100);
        };
        new Fn(() => {});
        const thunkAddress1 = env.allocateJsThunk(thunkControllerAddress, fnId);
        const thunkAddress2 = env.allocateJsThunk(thunkControllerAddress, fnId + 1);
        const freedFnId1 = env.freeJsThunk(thunkControllerAddress, thunkAddress1);
        const freedFnId2 = env.freeJsThunk(thunkControllerAddress, thunkAddress2);
        expect(freedFnId1).to.equal(fnId);
        expect(freedFnId2).to.equal(fnId + 1);
      })
    })
  })
}

function absolute(relpath) {
  return fileURLToPath(new URL(relpath, import.meta.url));
}
