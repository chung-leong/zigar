import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

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
    env.memory = new WebAssembly.Memory({ initial: 1 });
    const countAddress = 0x1000;
    const sizeAddress = 0x2000;
    const result = env.environSizesGet(countAddress, sizeAddress);
    expect(result).to.equal(0);
    const dv = new DataView(env.memory.buffer);
    const count = dv.getUint32(countAddress, true);
    expect(count).to.equal(2);
    const size = dv.getUint32(sizeAddress, true);
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
      const dv = new DataView(env.memory.buffer);
      const count = dv.getUint32(countAddress, true);
      expect(count).to.equal(2);
      const size = dv.getUint32(sizeAddress, true);
      expect(size).to.equal(8 + 10);
    })

  }
})
