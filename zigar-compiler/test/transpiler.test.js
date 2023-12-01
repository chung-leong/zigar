import { expect, use } from 'chai';
import { fileURLToPath } from 'url';
import ChaiAsPromised from 'chai-as-promised';

use(ChaiAsPromised);

import { transpile } from '../src/transpiler.js';

describe('Transpilation', function() {
  const getSamplePath = (name) => {
    const url = new URL(`./zig-samples/basic/${name}.zig`, import.meta.url);
    return fileURLToPath(url);
  };
  describe('transpile', function() {
    it('should transpile zig source code containing no methods', async function() {
      this.timeout(30000);
      const path = getSamplePath('integers');
      const { code } = await transpile(path);
      expect(code).to.be.a('string');
      expect(code).to.contain('integers');
    })
    it('should transpile zig source code contain a method', async function() {
      this.timeout(30000);
      const path = getSamplePath('function-simple');
      const { code } = await transpile(path);
      expect(code).to.be.a('string');
      expect(code).to.contain('"add"');
    })
    it('should strip out unnecessary code when stripWASM is specified', async function() {
      this.timeout(30000);
      const path = getSamplePath('function-simple');
      const { code: before } = await transpile(path);
      const { code: after } = await transpile(path, { stripWASM: true });
      expect(after.length).to.be.below(before.length);
    })
    it('should default to strip WASM when optimize is not Debug', async function() {
      this.timeout(30000);
      const path = getSamplePath('function-simple');
      const { code: before } = await transpile(path, { optimize: 'ReleaseSmall', stripWASM: false });
      const { code: after } = await transpile(path, { optimize: 'ReleaseSmall' });
      expect(after.length).to.be.below(before.length);
    })
    it('should call wasmLoader when embedWASM is false', async function() {
      this.timeout(30000);
      const path = getSamplePath('function-simple');
      let srcPath, wasmDV;
      const wasmLoader = (path, dv) => {
        srcPath = path;
        wasmDV = dv;
        return `loadWASM()`;
      };
      const { code } = await transpile(path, { embedWASM: false, wasmLoader });
      expect(srcPath).to.equal(path);
      expect(wasmDV).to.be.instanceOf(DataView);
      expect(code).to.contain(`loadWASM()`);
    })
    it('should throw when embedWASM is false and wasmLoader is not provided', async function() {
      const path = getSamplePath('integers');
      await expect(transpile(path, { embedWASM: false })).to.eventually.be.rejected;
    })
  })
})
