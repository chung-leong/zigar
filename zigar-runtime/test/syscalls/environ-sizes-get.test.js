import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Syscall: environ-sizes-get', function() {
  it('should set size of buffer required by env variables', function() {
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
    env.setObject('env', {
      HELLO: 1,
      WORLD: 123,
    });
    const countAddress = usize(0x1000);
    const sizeAddress = usize(0x2000);
    const result = env.environSizesGet(countAddress, sizeAddress);
    expect(result).to.equal(0);
    const le = env.littleEndian;
    const countDV = env.obtainZigView(countAddress, 4);
    const count = countDV.getUint32(0, le);
    const sizeDV = env.obtainZigView(sizeAddress, 4);
    const size = sizeDV.getUint32(0, le);
    expect(count).to.equal(2);
    expect(size).to.equal(8 + 10);
  })
  it('should return ENOTSUP when env object is set to null', function() {
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
    const le = env.littleEndian;
    const countAddress = usize(0x1000);
    const sizeAddress = usize(0x2000);
    const countDV = env.obtainZigView(countAddress, 4);
    const sizeDV = env.obtainZigView(sizeAddress, 4);
    countDV.setUint32(0, 0xaaaa_aaaa, le);
    sizeDV.setUint32(0, 0xaaaa_aaaa, le);
    env.setObject('env', null);
    const result = env.environSizesGet(countAddress, sizeAddress);
    expect(result).to.equal(PosixError.ENOTSUP);
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', function() {
      const env = new Env();
      env.setObject('env', {
        HELLO: 1,
        WORLD: 123,
      });
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const le = env.littleEndian;
      const f = env.getWASIHandler('environ_sizes_get');
      const countAddress = 0x1000;
      const sizeAddress = 0x2000;
      const result = f(countAddress, sizeAddress);
      expect(result).to.equal(0);
      const countDV = env.obtainZigView(countAddress, 4);
      const count = countDV.getUint32(0, le);
      const sizeDV = env.obtainZigView(sizeAddress, 4);
      const size = sizeDV.getUint32(0, le);
      expect(count).to.equal(2);
      expect(size).to.equal(8 + 10);
    })
  }
})
