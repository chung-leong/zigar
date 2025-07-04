import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Syscall: fd-filestat-set-times', function() {
  it('should call listener', async function() {
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
    const array = new Uint8Array(32);
    env.addListener('open', () => {
      return array;
    });
    let event;
    env.addListener('set_times', (evt) => {
      if (event) return false;
      event = evt;
      return true;
    });
    const encoder = new TextEncoder();
    const src = encoder.encode('/hello.txt');
    const pathAddress = 0x1000;
    const pathLen = src.length;
    const fdAddress = 0x2000;
    const pathArray = env.obtainZigArray(pathAddress, pathLen);
    for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
    const open = env.getWASIHandler('path_open');
    const result1 = open(3, 0, pathAddress, pathLen, 0, 2n, 0n, 0, fdAddress);
    expect(result1).to.equal(0);
    const dv = new DataView(env.memory.buffer);
    const fd = dv.getUint32(fdAddress, true);
    const f = env.getWASIHandler('fd_filestat_set_times');
    const result2 = f(fd, 123n, 456n, 1 << 0 | 1 << 2);
    expect(result2).to.equal(0);
    expect(event).to.eql({
      parent: null,
      target: array,
      path: 'hello.txt', 
      times: { atime: 123n, mtime: 456n } 
    });
  })
  it('should call listener even when file descriptor does not have a path', async function() {
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
    let event;
    env.addListener('set_times', (evt) => {
      if (event) return false;
      event = evt;
      return true;
    });
    const array = new Uint8Array(32);
    const file = env.convertReader(array);
    const fd = env.createStreamHandle(file);
    const f = env.getWASIHandler('fd_filestat_set_times');
    const result = f(fd, 123n, 456n, 1 << 0 | 1 << 2);
    expect(result).to.equal(PosixError.NONE);
    expect(event).to.eql({
      target: array,
      times: { atime: 123n, mtime: 456n } 
    });
  })
})