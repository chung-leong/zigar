import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: environ-sizes-get', function() {
  it('should set size of buffer required by env variables', function() {
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
