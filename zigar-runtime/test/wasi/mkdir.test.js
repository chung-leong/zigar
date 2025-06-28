import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { captureError, RootDescriptor } from '../test-utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: mkdir', function() {
    it('should call listener', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 128 });
      let event;
      env.addListener('mkdir', (evt) => {
        if (event) return true;
        event = evt;
        return new Map();
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/world');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_create_directory');
      const result1 = f(RootDescriptor, pathAddress, pathLen);
      expect(result1).to.equal(0);
      expect(event).to.eql({ 
        parent: null, 
        path: 'world' 
      });
      const result2 = f(RootDescriptor, pathAddress, pathLen);
      expect(result2).to.equal(PosixError.EEXIST);
    })
    it('should return ENOENT when listener returns false', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 128 });
      env.addListener('mkdir', () => false);
      const encoder = new TextEncoder();
      const src = encoder.encode('/world');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_create_directory');
      const result = f(RootDescriptor, pathAddress, pathLen);
      expect(result).to.equal(PosixError.ENOENT);
    })
    it('should display error when listener does not return a boolean', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 128 });
      env.addListener('mkdir', () => undefined);
      const encoder = new TextEncoder();
      const src = encoder.encode('/world');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_create_directory');
      let result 
      const [ error ] = await captureError(() => {
        result = f(RootDescriptor, pathAddress, pathLen);
      });
      expect(result).to.equal(PosixError.ENOENT);
      expect(error).to.contain('boolean');
    })
  })
}