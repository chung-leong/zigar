import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError, RootDescriptor } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: path-remove-directory', function() {
  it('should display error when listener does not return a boolean', async function() {
    const env = new Env();
    env.memory = new WebAssembly.Memory({ initial: 1 });
    env.addListener('rmdir', () => undefined);
    const encoder = new TextEncoder();
    const src = encoder.encode('/world');
    const pathAddress = 0x1000;
    const pathLen = src.length;
    const pathArray = env.obtainZigArray(pathAddress, pathLen);
    for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
    let result 
    const [ error ] = await captureError(() => {
      result = env.pathRemoveDirectory(RootDescriptor, pathAddress, pathLen);
    });
    expect(result).to.equal(PosixError.ENOENT);
    expect(error).to.contain('boolean');
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      let event;
      env.addListener('rmdir', (evt) => {
        if (event) return false;
        event = evt;
        return true;
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/world');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_remove_directory');
      const result1 = f(RootDescriptor, pathAddress, pathLen);
      expect(result1).to.equal(0);
      expect(event).to.eql({ 
        parent: null, 
        path: 'world' 
      });
      const result2 = f(RootDescriptor, pathAddress, pathLen);
      expect(result2).to.equal(PosixError.ENOENT);
    })
  }
})
