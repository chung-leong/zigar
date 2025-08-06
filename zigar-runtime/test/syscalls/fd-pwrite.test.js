import { expect } from 'chai';
import { PosixDescriptorRight, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize, usizeByteSize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-pwrite', function() {
  it('should write to array', async function() {
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
    const array = new Uint8Array(64);
    const writer = env.convertWriter(array);
    const fd = env.createStreamHandle(writer, PosixDescriptorRight.fd_write);
    result = env.fdPwrite(fd, iovsAddress, 2, usize(4), writtenAddress);
    expect(result).to.equal(PosixError.NONE);
    const writtenDV = env.obtainZigView(writtenAddress, 4);
    const written = writtenDV.getUint32(0, le);
    expect(written).to.equal(string.length * 2);
    const subarray1 = array.slice(4, 4 + string.length);
    expect(subarray1).to.eql(string);
    const subarray2 = array.slice(4 + string.length, 4 + string.length + string.length);
    expect(subarray2).to.eql(string);
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
      const f = env.getWASIHandler('fd_pwrite');
      const array = new Uint8Array(64);
      const writer = env.convertWriter(array);
      const fd = env.createStreamHandle(writer, PosixDescriptorRight.fd_write);
      result = f(fd, iovsAddress, 2, usize(4), writtenAddress);
      const writtenDV = env.obtainZigView(writtenAddress, 4);
      const written = writtenDV.getUint32(0, le);
      expect(written).to.equal(string.length * 2);
      const subarray1 = array.slice(4, 4 + string.length);
      expect(subarray1).to.eql(string);
      const subarray2 = array.slice(4 + string.length, 4 + string.length + string.length);
      expect(subarray2).to.eql(string);
    })
  }
  if (process.env.TARGET === 'node') {
    it('should output text to an array using a different function', async function() {
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
      const array = new Uint8Array(64);
      const writer = env.convertWriter(array);
      const fd = env.createStreamHandle(writer, PosixDescriptorRight.fd_write);
      const address = usize(0x1000);
      const writtenAddress = usize(0x3000);
      const string = new TextEncoder().encode('Hello world\n');
      const dv = env.obtainZigView(address, string.length, false);
      for (let i = 0; i < string.length; i++) dv.setUint8(i, string[i]);
      env.fdPwrite1(fd, address, dv.byteLength, usize(4), writtenAddress);
      const subarray = array.slice(4, 4 + string.length);
      expect(subarray).to.eql(string);
    })
  }
})
