import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-tell', function() {
  it('should return the read position', async function() {
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
        if (to) {
          map.set(address, jsDV.buffer);
        } else {
          const len = Number(jsDV.byteLength);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const zigDV = this.obtainZigView(address, len);
          const copy = this.getCopyFunction(len);
          copy(jsDV, zigDV);
        }
      };
    }   
    const posAddress = usize(0x1000);
    env.redirectStream(0, array);
    env.fdSeek(0, 1n, 1, posAddress)
    env.fdSeek(0, 1n, 1, posAddress)
    const result = env.fdTell(0);
    expect(result).to.equal(PosixError.NONE);
    const posDV = env.obtainZigView(posAddress, 8);
    const pos = posDV.getBigUint64(0, env.littleEndian);
    expect(pos).to.equal(2n);
  })
  it('should return an error code when handle is invalid', async function() {
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
        if (to) {
          map.set(address, jsDV.buffer);
        } else {
          const len = Number(jsDV.byteLength);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const zigDV = this.obtainZigView(address, len);
          const copy = this.getCopyFunction(len);
          copy(jsDV, zigDV);
        }
      };
    }   
    let result;
    const [ error ] = await captureError(() => { 
      result = env.fdTell(4)
    });
    expect(result).to.equal(PosixError.EBADF);
    expect(error).to.contains('file descriptor');
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      const encoder = new TextEncoder();
      const array = encoder.encode('Hello world');
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const seek = env.getWASIHandler('fd_seek');
      const f = env.getWASIHandler('fd_tell');
      const posAddress = 128;
      const dv = new DataView(memory.buffer);
      env.redirectStream(0, array);
      seek(0, 1n, 1, posAddress)
      seek(0, 1n, 1, posAddress)
      const result = f(0);
      expect(result).to.equal(PosixError.NONE);
      const pos = dv.getUint32(posAddress, true);
      expect(pos).to.equal(2);
    })
  }
})
