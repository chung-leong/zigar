import { expect } from 'chai';
import { PosixDescriptorRight, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { copyView, usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-lock-set', function() {
  it('should set lock on file', async function() {
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
    const file = {
      setlock(lock) {
        this.lock = lock;
        return true;
      }
    };
    const flockAddress = usize(0x1000);
    const dv = env.obtainZigView(flockAddress, 24, false);
    const le = env.littleEndian;
    dv.setBigUint64(8, 1000n, le);
    dv.setBigUint64(16, 2048n, le);
    const fd = env.createStreamHandle(file, [ PosixDescriptorRight.fd_read, 0 ]);
    const result = env.fdLockSet(fd, flockAddress, false);
    expect(result).to.equal(0);
    expect(file.lock).to.eql({ type: 0, whence: 0, start: 1000, len: 2048, pid: 0 });
  })
  it('should pretend call succeeded when stream does not support locking', async function() {
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
    const file = {};
    const flockAddress = usize(0x1000);
    const dv = env.obtainZigView(flockAddress, 24, false);
    const le = env.littleEndian;
    dv.setBigUint64(8, 1000n, le);
    dv.setBigUint64(16, 2048n, le);
    const fd = env.createStreamHandle(file, [ PosixDescriptorRight.fd_read, 0 ]);
    const result = env.fdLockSet(fd, flockAddress, false);
    expect(result).to.equal(0);
  })
  it('should return EAGAIN on lock conflict', async function() {
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
    const file = {
      setlock(lock) {
        if (!this.lock) {
          this.lock = lock;
          return true;
        } else {
          return false;
        }
      }
    };
    const flockAddress = usize(0x1000);
    const dv = env.obtainZigView(flockAddress, 24, false);
    const le = env.littleEndian;
    dv.setBigUint64(8, 1000n, le);
    dv.setBigUint64(16, 2048n, le);
    const fd = env.createStreamHandle(file, [ PosixDescriptorRight.fd_read, 0 ]);
    env.fdLockSet(fd, flockAddress, false);
    const result = env.fdLockSet(fd, flockAddress, false);
    expect(result).to.equal(PosixError.EAGAIN);
  })
})
