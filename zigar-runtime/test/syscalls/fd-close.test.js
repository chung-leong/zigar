import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-close', function() {
  it('should close previously opened stream', async function() {
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
    env.addListener('open', (evt) => {
      return new Uint8Array(32);
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    const fdAddress = usize(0x2000);
    env.moveExternBytes(path, pathAddress, true);
    const result1 = env.pathOpen(3, 0, pathAddress, pathLen, 0, 2n, 0n, 0, fdAddress);
    expect(result1).to.equal(0);
    const fdDV = env.obtainZigView(fdAddress, 4);
    const fd = fdDV.getUint32(0, env.littleEndian);
    const result2 = env.fdClose(fd); 
    expect(result2).to.equal(0);
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('open', (evt) => {
        return new Uint8Array(32);
      });
      const path = new TextEncoder().encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = path.length;
      const fdAddress = 0x2000;
      env.moveExternBytes(path, pathAddress, true);
      const open = env.getWASIHandler('path_open');
      const result1 = open(3, 0, pathAddress, pathLen, 0, 2n, 0n, 0, fdAddress);
      expect(result1).to.equal(0);
      const fdDV = env.obtainZigView(fdAddress, 4);
      const fd = fdDV.getUint32(0, true);
      const f = env.getWASIHandler('fd_close');
      const result2 = f(fd); 
      expect(result2).to.equal(0);
    })
  }
})
