import { expect } from 'chai';
import { PosixDescriptorFlag, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize, usizeByteSize } from '../../src/utils.js';
import { capture, captureError, delay } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-write', function() {
  it('should write to console', async function() {
    const env = new Env();
    if (process.env.TARGET === 'wasm') {
      env.memory = new WebAssembly.Memory({ initial: 1 });
    } else {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
    }
    const iovsAddress = usize(0x1000);
    const stringAddress = usize(0x2000);
    const writtenAddress = usize(0x3000);
    const text = 'ABCDEFG\n'
    const string = new TextEncoder().encode(text);
    env.moveExternBytes(string, stringAddress, true);
    const iovsDV = env.obtainZigView(iovsAddress, usizeByteSize * 4, false);
    const stringLen = usize(string.length);
    const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
    const le = env.littleEndian;
    set.call(iovsDV, usizeByteSize * 0, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 1, stringLen, le);
    set.call(iovsDV, usizeByteSize * 2, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 3, stringLen, le);
    let result;
    const [ line1, line2 ] = await capture(() => {
      result = env.fdWrite(1, iovsAddress, 2, writtenAddress);
    });
    expect(result).to.equal(PosixError.NONE);
    expect(line1).to.equal(text.trim());
    expect(line2).to.equal(text.trim());
    const writtenDV = env.obtainZigView(writtenAddress, 4);
    const written = writtenDV.getUint32(0, le);
    expect(written).to.equal(string.length * 2);
  })
  it('should write to console when call to fd_write is directed at stderr', async function() {
    const env = new Env();
    if (process.env.TARGET === 'wasm') {
      env.memory = new WebAssembly.Memory({ initial: 1 });
    } else {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
    }
    const iovsAddress = usize(0x1000);
    const stringAddress = usize(0x2000);
    const writtenAddress = usize(0x3000);
    const text = 'ABCDEFG\n'
    const string = new TextEncoder().encode(text);
    env.moveExternBytes(string, stringAddress, true);
    const iovsDV = env.obtainZigView(iovsAddress, usizeByteSize * 4, false);
    const stringLen = usize(string.length);
    const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
    const le = env.littleEndian;
    set.call(iovsDV, usizeByteSize * 0, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 1, stringLen, le);
    let result;
    const [ line ] = await capture(() => {
      result = env.fdWrite(2, iovsAddress, 1, writtenAddress);
    });
    expect(result).to.equal(PosixError.NONE);
    expect(line).to.equal(text.trim());
    const writtenDV = env.obtainZigView(writtenAddress, 4);
    const written = writtenDV.getUint32(0, le);
    expect(written).to.equal(string.length);
  })
  it('should return error code when file descriptor is not stdout or stderr', async function() {
    const env = new Env();
    if (process.env.TARGET === 'wasm') {
      env.memory = new WebAssembly.Memory({ initial: 1 });
    } else {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
    }
    const iovsAddress = usize(0x1000);
    const stringAddress = usize(0x2000);
    const writtenAddress = usize(0x3000);
    const text = 'ABCDEFG\n'
    const string = new TextEncoder().encode(text);
    env.moveExternBytes(string, stringAddress, true);
    const iovsDV = env.obtainZigView(iovsAddress, usizeByteSize * 4, false);
    const stringLen = usize(string.length);
    const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
    const le = env.littleEndian;
    set.call(iovsDV, usizeByteSize * 0, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 1, stringLen, le);
    let result;
        result = env.fdWrite(5, iovsAddress, 1, writtenAddress);
    const [ line ] = await capture(async () => {
      const [ error ] = await captureError(async () => {
      })
    });
    expect(result).to.equal(PosixError.ENOTSUP);
  })
  it('should write to an array', async function() {
    const env = new Env();
    if (process.env.TARGET === 'wasm') {
      env.memory = new WebAssembly.Memory({ initial: 1 });
    } else {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }
    const array = [];
    const writer = env.convertWriter(array);
    const fd = env.createStreamHandle(writer, env.getDefaultRights('file'), 0);
    const iovsAddress = usize(0x1000);
    const stringAddress = usize(0x2000);
    const writtenAddress = usize(0x3000);
    const text = 'ABCDEFG\n'
    const string = new TextEncoder().encode(text);
    env.moveExternBytes(string, stringAddress, true);
    const iovsDV = env.obtainZigView(iovsAddress, usizeByteSize * 4, false);
    const stringLen = usize(string.length);
    const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
    const le = env.littleEndian;
    set.call(iovsDV, usizeByteSize * 0, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 1, stringLen, le);
    set.call(iovsDV, usizeByteSize * 2, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 3, stringLen, le);
    const result = env.fdWrite(fd, iovsAddress, 2, writtenAddress);
    expect(result).to.equal(PosixError.NONE);
    expect(array[0]).to.be.an('Uint8Array');
    expect(array[0]).to.have.lengthOf(text.length * 2);
  })
  it('should write to an array in non-blocking mode', async function() {
    const env = new Env();
    if (process.env.TARGET === 'wasm') {
      env.memory = new WebAssembly.Memory({ initial: 1 });
    } else {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }
    const array = [];
    const writer = env.convertWriter(array);
    const fd = env.createStreamHandle(writer, env.getDefaultRights('file'), PosixDescriptorFlag.nonblock);
    const iovsAddress = usize(0x1000);
    const stringAddress = usize(0x2000);
    const writtenAddress = usize(0x3000);
    const text = 'ABCDEFG\n'
    const string = new TextEncoder().encode(text);
    env.moveExternBytes(string, stringAddress, true);
    const iovsDV = env.obtainZigView(iovsAddress, usizeByteSize * 4, false);
    const stringLen = usize(string.length);
    const set = (usizeByteSize === 8) ? iovsDV.setBigUint64 : iovsDV.setUint32;
    const le = env.littleEndian;
    set.call(iovsDV, usizeByteSize * 0, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 1, stringLen, le);
    set.call(iovsDV, usizeByteSize * 2, stringAddress, le);
    set.call(iovsDV, usizeByteSize * 3, stringLen, le);
    const result = env.fdWrite(fd, iovsAddress, 2, writtenAddress);
    expect(result).to.equal(PosixError.NONE);
    expect(array[0]).to.be.an('Uint8Array');
    expect(array[0]).to.have.lengthOf(text.length * 2);
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const iovsAddress = 0x1000;
      const stringAddress = 0x2000;
      const writtenAddress = 0x3000;
      const text = 'ABCDEFG\n'
      const string = new TextEncoder().encode(text);
      env.moveExternBytes(string, stringAddress, true);
      const iovsDV = env.obtainZigView(iovsAddress, 4 * 4, false);
      const stringLen = string.length;
      const le = env.littleEndian;
      iovsDV.setUint32(4 * 0, stringAddress, le);
      iovsDV.setUint32(4 * 1, stringLen, le);
      iovsDV.setUint32(4 * 2, stringAddress, le);
      iovsDV.setUint32(4 * 3, stringLen, le);
      let result;
      const f = env.getWASIHandler('fd_write');
      const [ line1, line2 ] = await capture(() => {
        result = f(1, iovsAddress, 2, writtenAddress);
      });
      expect(result).to.equal(PosixError.NONE);
      expect(line1).to.equal(text.trim());
      expect(line2).to.equal(text.trim());
      const writtenDV = env.obtainZigView(writtenAddress, 4);
      const written = writtenDV.getUint32(0, le);
      expect(written).to.equal(string.length * 2);
    })
  }
  if (process.env.TARGET === 'node') {
    it('should output text to console using a different function', async function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
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
          const copy = this.getCopyFunction(len);
          copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
      }
      const address = usize(0x1000);
      const writtenAddress = usize(0x3000);
      const array = new TextEncoder().encode('Hello world\n');
      const dv = env.obtainZigView(address, array.length, false);
      for (let i = 0; i < array.length; i++) dv.setUint8(i, array[i]);
      const lines = await capture(() => env.fdWrite1(1, address, dv.byteLength, writtenAddress));
      expect(lines).to.eql([ 'Hello world' ]);
    })
    it('should allow addition text to be append to current line', async function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
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
          const copy = this.getCopyFunction(len);
          copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
      }
      const address1 = usize(0x1000);
      const writtenAddress = usize(0x3000);
      const array1 = new TextEncoder().encode('Hello world!');
      const dv1 = env.obtainZigView(address1, array1.length, false);
      for (let i = 0; i < array1.length; i++) dv1.setUint8(i, array1[i]);
      const address2 = usize(0x2000);
      const array2 = new TextEncoder().encode('\n');
      const dv2 = env.obtainZigView(address2, array2.length, false);
      for (let i = 0; i < array2.length; i++) dv2.setUint8(i, array2[i]);
      const lines = await capture(async () => {
        env.fdWrite1(2, address1, dv1.byteLength, writtenAddress);
        await delay(10);
        env.fdWrite1(2, address2, dv2.byteLength, writtenAddress);
      });
      expect(lines).to.eql([ 'Hello world!' ]);
      env.flushStreams();
    })
    it('should eventually output text not ending with newline', async function() {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      const address1 = usize(0x1000);
      const writtenAddress = usize(0x3000);
      const array1 = new TextEncoder().encode('Hi!\nHello world');
      const dv1 = env.obtainZigView(address1, array1.length, false);
      for (let i = 0; i < array1.length; i++) dv1.setUint8(i, array1[i]);
      const address2 = usize(0x2000);
      const array2 = new TextEncoder().encode('!');
      const dv2 = env.obtainZigView(address2, array2.length, false);
      for (let i = 0; i < array2.length; i++) dv2.setUint8(i, array2[i]);
      const lines = await capture(async () => {
        env.fdWrite1(1, address1, dv1.byteLength, writtenAddress);
        await delay(10);
        env.fdWrite1(1, address2, dv2.byteLength, writtenAddress);
        await delay(300);
      });
      expect(lines).to.eql([ 'Hi!', 'Hello world!' ]);
    })
    it('should write to an array using a different function', async function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
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
          const copy = this.getCopyFunction(len);
          copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
        env.setSyscallTrap = () => {};
        env.setRedirectionMask = () => {};
      }
      const array = [];
      const writer = env.convertWriter(array);
      const fd = env.createStreamHandle(writer, env.getDefaultRights('file'), 0);
      const address = usize(0x1000);
      const writtenAddress = usize(0x3000);
      const text = 'ABCDEFG\n'
      const string = new TextEncoder().encode(text);
      env.moveExternBytes(string, address, true);
      const result = env.fdWrite1(fd, address, string.length, writtenAddress);
      expect(result).to.equal(PosixError.NONE);
      expect(array[0]).to.be.an('Uint8Array');
      expect(array[0]).to.have.lengthOf(text.length);
    })
    it('should write to an array using a different function in non-blocking mode', async function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
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
          const copy = this.getCopyFunction(len);
          copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
        env.setSyscallTrap = () => {};
        env.setRedirectionMask = () => {};
      }
      const array = [];
      const writer = env.convertWriter(array);
      const fd = env.createStreamHandle(writer, env.getDefaultRights('file'), PosixDescriptorFlag.nonblock);
      const address = usize(0x1000);
      const writtenAddress = usize(0x3000);
      const text = 'ABCDEFG\n'
      const string = new TextEncoder().encode(text);
      env.moveExternBytes(string, address, true);
      const result = env.fdWrite1(fd, address, string.length, writtenAddress);
      expect(result).to.equal(PosixError.NONE);
      expect(array[0]).to.be.an('Uint8Array');
      expect(array[0]).to.have.lengthOf(text.length);
    })
  }
})
