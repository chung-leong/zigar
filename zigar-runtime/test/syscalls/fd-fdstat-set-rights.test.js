import { expect } from 'chai';
import { PosixDescriptorRight, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { createView, usize, usizeByteSize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-fdstat-set-rights', function() {
  it('should add writable right', async function() {
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
    const array = new Uint8Array(256);
    const reader = env.convertReader(array);
    const fd = env.createStreamHandle(reader, PosixDescriptorRight.fd_read);
    const iovsAddress = usize(0x1000);
    const bufAddress = usize(0x2000);
    const bufLen = usize(4);
    const writtenAddress = usize(0x3000);
    const iovsDV = createView(usizeByteSize * 2);
    const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
    const le = env.littleEndian;
    set.call(iovsDV, usizeByteSize * 0, bufAddress, le);
    set.call(iovsDV, usizeByteSize * 1, bufLen, le);
    env.moveExternBytes(iovsDV, iovsAddress, true);
    let result1;
    const [ error ] = await captureError(async () => {
      result1 = await env.fdWrite(fd, iovsAddress, 1, writtenAddress, true);
    });
    const result2 = env.fdFdstatSetRights(fd, PosixDescriptorRight.fd_read | PosixDescriptorRight.fd_write);
    expect(result2).to.equal(PosixError.NONE);
    const result3 = await env.fdWrite(fd, iovsAddress, 1, writtenAddress, true);
    expect(result3).to.equal(PosixError.NONE);
  })
  it('should fail when stream does not support write operation', async function() {
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
    const reader = {
      read() {}
    };
    const fd = env.createStreamHandle(reader, PosixDescriptorRight.fd_read);
    let result;
    const [ error ] = await captureError(() => {
      result = env.fdFdstatSetRights(fd, PosixDescriptorRight.fd_write);
    });
    expect(result).to.equal(PosixError.EBADF);
  })
})