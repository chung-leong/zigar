import { expect } from 'chai';
import { PosixDescriptorRight, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { copyView, usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-lock-get', function() {
  it('should indicate locking is possible', async function() {
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
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
    }
    const file1 = {
      getlock(lock) {}
    };
    const flockAddress = usize(0x1000);
    const dv = env.obtainZigView(flockAddress, 24, false);
    const le = env.littleEndian;
    dv.setBigUint64(8, 1000n, le);
    dv.setBigUint64(16, 2048n, le);
    const fd1 = env.createStreamHandle(file1, [ PosixDescriptorRight.fd_read, 0 ]);
    const result1 = env.fdLockGet(fd1, flockAddress, false);
    expect(result1).to.equal(0);
    const type = dv.getUint16(0, le);
    expect(type).to.equal(2);   // unlock
    const file2 = {};
    dv.setUint16(0, 0, le);
    const fd2 = env.createStreamHandle(file1, [ PosixDescriptorRight.fd_read, 0 ]);
    const result2 = env.fdLockGet(fd1, flockAddress, false);
    expect(result2).to.equal(0);
  })
  it('should pretend file is not lock when locking is not supported', async function() {
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
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
    }
    const file1 = {};
    const flockAddress = usize(0x1000);
    const dv = env.obtainZigView(flockAddress, 24, false);
    const le = env.littleEndian;
    dv.setBigUint64(8, 1000n, le);
    dv.setBigUint64(16, 2048n, le);
    const fd1 = env.createStreamHandle(file1, [ PosixDescriptorRight.fd_read, 0 ]);
    const result = env.fdLockGet(fd1, flockAddress, false);
    expect(result).to.equal(0);
    const type = dv.getUint16(0, le);
    expect(type).to.equal(2);   // unlock
  })
  it('should copy info about existing lock into memory location', async function() {
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
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
    }
    const file1 = {
      getlock(lock) {
        return {
          type: 1,
          whence: 2,
          start: -100n,
          length: 4096n,
          pid: 123,
        }
      }
    };
    const flockAddress = usize(0x1000);
    const dv = env.obtainZigView(flockAddress, 24, false);
    const le = env.littleEndian;
    dv.setBigUint64(8, 1000n, le);
    dv.setBigUint64(16, 2048n, le);
    const fd1 = env.createStreamHandle(file1, [ PosixDescriptorRight.fd_read, 0 ]);
    const result1 = env.fdLockGet(fd1, flockAddress, false);
    expect(result1).to.equal(PosixError.NONE);
    const lock1 = {
      type: dv.getUint16(0, le),
      whence: dv.getUint16(2, le),
      pid: dv.getUint32(4, le),
      start: dv.getBigInt64(8, le),
      length: dv.getBigUint64(16, le),
    };
    expect(lock1).to.eql({ type: 1, whence: 2, pid: 123, start: -100n, length: 4096n });
    const file2 = {
      getlock() {
        return {};
      }
    };
    const fd2 = env.createStreamHandle(file2, [ PosixDescriptorRight.fd_read, 0 ]);
    const result2 = env.fdLockGet(fd2, flockAddress, false);
    expect(result2).to.equal(PosixError.NONE);
    const lock2 = {
      type: dv.getUint16(0, le),
      whence: dv.getUint16(2, le),
      pid: dv.getUint32(4, le),
      start: dv.getBigInt64(8, le),
      length: dv.getBigUint64(16, le),
    };
    expect(lock2).to.eql({ type: 0, whence: 0, pid: 0, start: 0n, length: 0n });
  })
})
