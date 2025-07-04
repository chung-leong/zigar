import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { decodeText, usize, usizeByteSize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Syscall: environ-get', function() {
  it('should copy env variables into given address', function() {
    const env = new Env();
    env.addListener('env', () => {
      return {
        HELLO: 1,
        WORLD: 123,
      };
    });
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
    const le = env.littleEndian;
    const countAddress = usize(0x3000);
    const sizeAddress = usize(0x4000);
    env.environSizesGet(countAddress, sizeAddress);
    const countDV = env.obtainZigView(countAddress, 4);
    const count = countDV.getUint32(0, le);
    const sizeDV = env.obtainZigView(sizeAddress, 4);
    const size = sizeDV.getUint32(0, le);
    expect(count).to.equal(2);
    expect(size).to.equal(18);
    const ptrAddress = usize(0x1000);
    const bufAddress = usize(0x2000);
    const result = env.environGet(ptrAddress, bufAddress);
    const ptrDV = env.obtainZigView(ptrAddress, usizeByteSize * count);
    expect(result).to.equal(0);
    const set = (usizeByteSize === 8) ? ptrDV.getBigUint64 : ptrDV.getUint32;
    const varAddress1 = set.call(ptrDV, usizeByteSize * 0, le);
    const varAddress2 = set.call(ptrDV, usizeByteSize * 1, le);
    const varDV = env.obtainZigView(bufAddress, size);
    expect(varAddress1).to.equal(bufAddress);
    expect(varAddress2).to.equal(bufAddress + usize(8));
    const array1 = new Uint8Array(varDV.buffer, varDV.byteOffset + 0, 7);
    const env1 = decodeText(array1);
    expect(env1).to.equal('HELLO=1');
    const array2 = new Uint8Array(varDV.buffer, varDV.byteOffset + 8, 9);
    const env2 = decodeText(array2);
    expect(env2).to.equal('WORLD=123');
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', function() {
      const env = new Env();
      env.addListener('env', () => {
        return {
          HELLO: 1,
          WORLD: 123,
        };
      });
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const le = env.littleEndian;
      const countAddress = 0x3000;
      const sizeAddress = 0x4000;
      env.environSizesGet(countAddress, sizeAddress);
      const countDV = env.obtainZigView(countAddress, 4);
      const count = countDV.getUint32(0, le);
      const sizeDV = env.obtainZigView(sizeAddress, 4);
      const size = sizeDV.getUint32(0, le);
      expect(count).to.equal(2);
      expect(size).to.equal(18);
      const ptrAddress = 0x1000;
      const bufAddress = 0x2000;
      const result = env.environGet(ptrAddress, bufAddress);
      const ptrDV = env.obtainZigView(ptrAddress, usizeByteSize * count);
      expect(result).to.equal(0);
      const varAddress1 = ptrDV.getUint32(usizeByteSize * 0, le);
      const varAddress2 = ptrDV.getUint32(usizeByteSize * 1, le);
      const varDV = env.obtainZigView(bufAddress, size);
      expect(varAddress1).to.equal(bufAddress);
      expect(varAddress2).to.equal(bufAddress + 8);
      const array1 = new Uint8Array(varDV.buffer, varDV.byteOffset + 0, 7);
      const env1 = decodeText(array1);
      expect(env1).to.equal('HELLO=1');
      const array2 = new Uint8Array(varDV.buffer, varDV.byteOffset + 8, 9);
      const env2 = decodeText(array2);
      expect(env2).to.equal('WORLD=123');
    })
  }
})
