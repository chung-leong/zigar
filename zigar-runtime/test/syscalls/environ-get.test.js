import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { decodeText } from '../../src/utils.js';

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
    env.memory = new WebAssembly.Memory({ initial: 1 });
    const ptrAddress = 0x1000;
    const bufAddress = 0x2000;
    const countAddress = 0x3000;
    const sizeAddress = 0x4000;
    env.environSizesGet(countAddress, sizeAddress);
    const result = env.environGet(ptrAddress, bufAddress);
    expect(result).to.equal(0);
    const dv = new DataView(env.memory.buffer);
    const varAddress1 = dv.getUint32(ptrAddress + 0, true)
    const varAddress2 = dv.getUint32(ptrAddress + 4, true)
    let len1 = 0;
    while (dv.getUint8(varAddress1 + len1) !== 0) len1++;
    const array1 = env.obtainZigArray(varAddress1, len1);
    const env1 = decodeText(array1);
    expect(env1).to.equal('HELLO=1');
    let len2 = 0;
    while (dv.getUint8(varAddress2 + len2) !== 0) len2++;
    const array2 = env.obtainZigArray(varAddress2, len2);
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
      const ptrAddress = 0x1000;
      const bufAddress = 0x2000;
      const countAddress = 0x3000;
      const sizeAddress = 0x4000;
      env.environSizesGet(countAddress, sizeAddress);
      const f = env.getWASIHandler('environ_get');
      const result = f(ptrAddress, bufAddress);
      expect(result).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const varAddress1 = dv.getUint32(ptrAddress + 0, true)
      const varAddress2 = dv.getUint32(ptrAddress + 4, true)
      let len1 = 0;
      while (dv.getUint8(varAddress1 + len1) !== 0) len1++;
      const array1 = env.obtainZigArray(varAddress1, len1);
      const env1 = decodeText(array1);
      expect(env1).to.equal('HELLO=1');
      let len2 = 0;
      while (dv.getUint8(varAddress2 + len2) !== 0) len2++;
      const array2 = env.obtainZigArray(varAddress2, len2);
      const env2 = decodeText(array2);
      expect(env2).to.equal('WORLD=123');
    })
  }
})
