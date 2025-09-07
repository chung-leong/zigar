import { expect } from 'chai';
import { PosixDescriptorFlag, PosixDescriptorRight, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { createView, usize, usizeByteSize } from '../../src/utils.js';
import { captureError, delay } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-fdstat-set-flags', function() {
  it('should set no-blocking flag', async function() {
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
      env.setSyscallTrap = () => {};
    }
    const blob = new Blob([ 
      new Uint8Array([ 0, 1, 2, 3, 4, 6, 7, 8 ])
    ]);
    const reader = env.convertReader(blob);
    const fd = env.createStreamHandle(reader, [ PosixDescriptorRight.fd_read, 0 ]);
    const result1 = env.fdFdstatSetFlags(fd, PosixDescriptorFlag.nonblock);
    expect(result1).to.equal(0);
    const iovsAddress = usize(0x1000);
    const bufAddress = usize(0x2000);
    const bufLen = usize(4);
    const readAddress = usize(0x3000);
    const iovsDV = createView(usizeByteSize * 2);
    const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
    const le = env.littleEndian;
    set.call(iovsDV, usizeByteSize * 0, bufAddress, le);
    set.call(iovsDV, usizeByteSize * 1, bufLen, le);
    env.moveExternBytes(iovsDV, iovsAddress, true);
    const result2 = await env.fdRead(fd, iovsAddress, 1, readAddress, true);
    expect(result2).to.equal(PosixError.EAGAIN);
    await delay(10);
    const result3 = await env.fdRead(fd, iovsAddress, 1, readAddress, true);
    expect(result3).to.equal(PosixError.NONE);
    const buf = env.obtainZigView(bufAddress, bufLen, false);
    for (let i = 0; i < 4; i++) {
      expect(buf.getUint8(i)).to.equal(i);
    }
  })
  it('should fail when stream does not support no-blocking operation', async function() {
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
      env.setSyscallTrap = () => {};
    }
    const reader = {
      read() {}
    };
    const fd = env.createStreamHandle(reader, [ PosixDescriptorRight.fd_read, 0 ]);
    let result;
    const [ error ] = await captureError(() => {
      result = env.fdFdstatSetFlags(fd, PosixDescriptorFlag.nonblock);
    });
    expect(result).to.equal(PosixError.EBADF);
  })
})