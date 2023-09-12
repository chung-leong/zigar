import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';

use(ChaiAsPromised);

import { transpile } from '../src/transpiler.js';

describe('Transpilation', function() {
  describe('transpile', function() {
    beforeEach(function() {
      process.env.ZIGAR_TARGET = 'WASM-COMPTIME';
    })
    it('should transpile zig source code containing no methods', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./zig-samples/basic/integers.zig', import.meta.url);
      const code = await transpile(pathname);
      expect(code).to.be.a('string');
      expect(code).to.contain('integers');
    })
    it('should transpile zig source code contain a method', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./zig-samples/basic/function-simple.zig', import.meta.url);
      const code = await transpile(pathname);
      expect(code).to.be.a('string');
      expect(code).to.contain('"add"');
    })
    it('should strip out unnecessary code when stripWASM is specified', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./zig-samples/basic/function-simple.zig', import.meta.url);
      const before = await transpile(pathname);
      const after = await transpile(pathname, { stripWASM: true });
      expect(after.length).to.be.below(before.length);
    })
    it('should default to strip WASM when optimize is not Debug', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./zig-samples/basic/function-simple.zig', import.meta.url);
      const before = await transpile(pathname, { optimize: 'ReleaseSmall', stripWASM: false });
      const after = await transpile(pathname, { optimize: 'ReleaseSmall' });
      expect(after.length).to.be.below(before.length);
    })
    it('should call wasmLoader when embedWASM is false', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./zig-samples/basic/function-simple.zig', import.meta.url);
      let wasmName, wasmDV;
      const wasmLoader = (name, dv) => {
        wasmName = name;
        wasmDV = dv;
        return `loadWASM()`;
      };
      const code = await transpile(pathname, { embedWASM: false, wasmLoader });
      expect(wasmName).to.equal('function-simple.wasm');
      expect(wasmDV).to.be.instanceOf(DataView);
      expect(code).to.contain(`loadWASM()`);
    })
    it('should throw when embedWASM is false and wasmLoader is not provided', async function() {
      const { pathname } = new URL('./zig-samples/basic/integers.zig', import.meta.url);
      await expect(transpile(pathname, { embedWASM: false })).to.eventually.be.rejected;
    })
  })
})
