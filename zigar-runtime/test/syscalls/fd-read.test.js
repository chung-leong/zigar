import { expect } from 'chai';
import { PosixDescriptorFlag, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { copyView, createView, usize, usizeByteSize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-read', function() {
  it('should read from a Uint8Array', async function() {
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
      env.setRedirectionMask = () => {};
    }   
    const array = new TextEncoder().encode('Hello world');
    const reader = env.convertReader(array);
    const fd = env.createStreamHandle(reader, env.getDefaultRights('file'), 0);
    const iovsAddress = usize(0x1000);
    const stringAddress = usize(0x2000);
    const stringLen = usize(32);
    const readAddress = usize(0x3000);
    const iovsDV = createView(usizeByteSize * 4);
    const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
    const le = env.littleEndian;
    set.call(iovsDV, usizeByteSize * 0, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 1, stringLen, le);
    set.call(iovsDV, usizeByteSize * 2, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 3, stringLen, le);
    env.moveExternBytes(iovsDV, iovsAddress, true);
    const result = env.fdRead(fd, iovsAddress, 2, readAddress)
    expect(result).to.equal(PosixError.NONE);
    const readDV = env.obtainZigView(readAddress, 4);
    const read = readDV.getUint32(0, le);
    expect(read).to.equal(array.length);
  })
  it('should read from a Uint8Array in non-blocking mode', async function() {
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
      env.setRedirectionMask = () => {};
    }   
    const array = new TextEncoder().encode('Hello world');
    const reader = env.convertReader(array);
    const fd = env.createStreamHandle(reader, env.getDefaultRights('file'), PosixDescriptorFlag.nonblock);
    const iovsAddress = usize(0x1000);
    const stringAddress = usize(0x2000);
    const stringLen = usize(32);
    const readAddress = usize(0x3000);
    const iovsDV = createView(usizeByteSize * 4);
    const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
    const le = env.littleEndian;
    set.call(iovsDV, usizeByteSize * 0, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 1, stringLen, le);
    set.call(iovsDV, usizeByteSize * 2, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 3, stringLen, le);
    env.moveExternBytes(iovsDV, iovsAddress, true);
    const result = env.fdRead(fd, iovsAddress, 2, readAddress)
    expect(result).to.equal(PosixError.NONE);
    const readDV = env.obtainZigView(readAddress, 4);
    const read = readDV.getUint32(0, le);
    expect(read).to.equal(array.length);
  })
  it('should fail when reading from an async source from the main thread', async function() {
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
      env.setRedirectionMask = () => {};
    }   
    const stream = new ReadableStream({
      async pull(controller) {
        controller.close();
      }
    });
    const reader = env.convertReader(stream.getReader());
    env.redirectStream('stdin', reader);
    const iovsAddress = usize(0x1000);
    const stringAddress = usize(0x2000);
    const stringLen = usize(32);
    const readAddress = usize(0x3000);
    const iovsDV = createView(usizeByteSize * 4);
    const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
    const le = env.littleEndian;
    set.call(iovsDV, usizeByteSize * 0, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 1, stringLen, le);
    let result;
    const [ error ] = await captureError(() => {
      result = env.fdRead(0, iovsAddress, 1, readAddress);
    });
    expect(result).to.equal(PosixError.EDEADLK);
    expect(error).to.contains('Deadlock');
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const array = new TextEncoder().encode('Hello world');
      const reader = env.convertReader(array);
      env.redirectStream('stdin', reader);
      const iovsAddress = 0x1000;
      const stringAddress = 0x2000;
      const stringLen = 32;
      const readAddress = 0x3000;
      const iovsDV = createView(16);
      const le = env.littleEndian;
      iovsDV.setUint32(4 * 0, stringAddress, le);
      iovsDV.setUint32(4 * 1, stringLen, le);
      env.moveExternBytes(iovsDV, iovsAddress, true);
      const f = env.getWASIHandler('fd_read');
      const result = f(0, iovsAddress, 2, readAddress)
      expect(result).to.equal(PosixError.NONE);
      const readDV = env.obtainZigView(readAddress, 4);
      const read = readDV.getUint32(0, le);
      expect(read).to.equal(array.length);
    })
  }
  if (process.env.TARGET === 'node') {
    it('should read data from Uint8Array using a different function', async function() {
      const env = new Env();
      const map = new Map();
      env.obtainExternBuffer = function (address, len) {
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
      env.setRedirectionMask = () => {};
      const array = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
      const reader = env.convertReader(array);
      const fd = env.createStreamHandle(reader, env.getDefaultRights('file'), 0);
      const bufAddress = usize(0x1000);
      const readAddress = usize(0x2000);
      const len = 4;
      const res = env.fdRead1(fd, bufAddress, len, readAddress);
      expect(res).to.equal(PosixError.NONE);
      const dv = env.obtainZigView(bufAddress, len, false);
      const read = env.obtainZigView(readAddress, 4).getUint32(0, env.littleEndian);
      expect(read).to.equal(4);
      expect(dv.getUint8(0)).to.equal(0);
      expect(dv.getUint8(3)).to.equal(3);
    })
    it('should read data from Uint8Array using a different function in non-blocking mode', async function() {
      const env = new Env();
      const map = new Map();
      env.obtainExternBuffer = function (address, len) {
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
      env.setRedirectionMask = () => {};
      const array = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
      const reader = env.convertReader(array);
      const fd = env.createStreamHandle(reader, env.getDefaultRights('file'), PosixDescriptorFlag.nonblock);
      const bufAddress = usize(0x1000);
      const readAddress = usize(0x2000);
      const len = 4;
      const res = env.fdRead1(fd, bufAddress, len, readAddress);
      expect(res).to.equal(PosixError.NONE);
      const dv = env.obtainZigView(bufAddress, len, false);
      const read = env.obtainZigView(readAddress, 4).getUint32(0, env.littleEndian);
      expect(read).to.equal(4);
      expect(dv.getUint8(0)).to.equal(0);
      expect(dv.getUint8(3)).to.equal(3);
    })
  }
})
