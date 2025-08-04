import { expect } from 'chai';
import { PosixDescriptor, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: path-remove-directory', function() {
  it('should display error when listener does not return a boolean', async function() {
    const env = new Env();
    if (process.env.TARGET === 'wasm') {
      env.memory = new WebAssembly.Memory({ initial: 1 });
    } else {
      const map = new Map();
      env.obtainExternBuffer = function(address, len) {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
    }   
    env.addListener('rmdir', () => undefined);
    const path = new TextEncoder().encode('/world');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    env.moveExternBytes(path, pathAddress, pathLen);
    let result 
    const [ error ] = await captureError(() => {
      result = env.pathRemoveDirectory(PosixDescriptor.root, pathAddress, pathLen);
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
      const path = new TextEncoder().encode('/world');
      const pathAddress = usize(0x1000);
      const pathLen = path.length;
      env.moveExternBytes(path, pathAddress, pathLen);
      const f = env.getWASIHandler('path_remove_directory');
      const result1 = f(PosixDescriptor.root, pathAddress, pathLen);
      expect(result1).to.equal(0);
      expect(event).to.eql({ 
        parent: null, 
        path: 'world' 
      });
      const result2 = f(PosixDescriptor.root, pathAddress, pathLen);
      expect(result2).to.equal(PosixError.ENOENT);
    })
  }
})
