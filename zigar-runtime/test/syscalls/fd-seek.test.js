import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-seek', function() {
  it('should change the read position', async function() {
    const env = new Env();
    const encoder = new TextEncoder();
    const array = encoder.encode('Hello world');
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
    const posAddress = usize(128);
    env.redirectStream(0, array);
    const result = env.fdSeek(0, -1n, 2, posAddress)
    expect(result).to.equal(PosixError.NONE);
    const posDV = env.obtainZigView(posAddress, 8);
    const pos = posDV.getBigUint64(0, true);
    expect(pos).to.equal(10n);
  })
  it('should return an error code when whence value is invalid', async function() {
    const env = new Env();
    const encoder = new TextEncoder();
    const array = encoder.encode('Hello world');
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
    env.redirectStream(0, array);
    let result;
    const posAddress = usize(128);
    const [ error ] = await captureError(() => { 
      result = env.fdSeek(0, -1n, 4, posAddress)
    });
    expect(result).to.equal(PosixError.EINVAL);
    expect(error).to.contains('Invalid argument');
  })
  if (process.env.TARGET === 'wasm') {
    it('should change the read position', async function() {
      const env = new Env();
      const encoder = new TextEncoder();
      const array = encoder.encode('Hello world');
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_seek');
      const posAddress = 128;
      env.redirectStream(0, array);
      const result = f(0, -1n, 2, posAddress)
      expect(result).to.equal(PosixError.NONE);
      const posDV = env.obtainZigView(posAddress, 8);
      const pos = posDV.getBigUint64(0, true);
      expect(pos).to.equal(10n);
    })
  }
})
