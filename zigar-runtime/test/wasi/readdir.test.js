import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

if (process.env.TARGET === 'wasm') {
  describe('Wasi: readdir', function() {
    it('should read directory entries from a Map', async function() {
      const env = new Env();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const map = new Map([
        [ 'hello.txt', {} ],
        [ 'hello-world.txt', {} ],
      ]);
      const fd = env.createStreamHandle(map, 'readdir');
      const bufAddress = 0x1000;
      const bufLen = 24 + 1 + 24 + 2;
      const usedAddress = 0x2000;
      const f = env.getWASIHandler('fd_readdir');
      let cookie = 0n;
      for (let i = 0; i < 7; i++) {
        const result = f(fd, bufAddress, bufLen, cookie, usedAddress);
        expect(result).to.equal(0);
        const dv = new DataView(memory.buffer);
        const used = dv.getUint32(usedAddress, true);
        const len = dv.getUint32(bufAddress + 16, true);
        switch (i) {
          case 0:
            expect(used).to.equal(24 + 1 + 24 + 2);
            expect(len).to.equal(1); // .
            break;
          case 1:
            expect(used).to.equal(24 + 9);
            expect(len).to.equal(9); // hello.txt
            break;
          case 2:
            expect(used).to.equal(24 + 15);
            expect(len).to.equal(15); // hello-world.txt
            break;
          case 3:
            expect(used).to.equal(0);
            break;
        }
        cookie = dv.getBigUint64(bufAddress + 0, true);
      }
    })
 })
}