import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { decodeText } from '../../src/utils.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: env', function() {
    it('should set size of buffer required by env variables', function() {
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
    it('should copy env variables into given address', function() {
      const env = new Env();
      env.addListener('env', () => {
        return {
          HELLO: 1,
          WORLD: 123,
        };
      });
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('environ_get');
      const ptrAddress = 0x1000;
      const bufAddress = 0x2000;
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
  })
}