import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { parse } from 'path';
import { fileURLToPath } from 'url';

use(chaiAsPromised);

import { writeFile } from 'fs/promises';
import { transpile } from '../src/transpilation.js';

describe('Transpilation', function() {
  const getSamplePath = (name) => {
    const url = new URL(`./zig-samples/basic/${name}.zig`, import.meta.url);
    return fileURLToPath(url);
  };
  const saveWASM = async (path, data) => {
    const { name } = parse(path);
    const url = new URL(`./wasm-samples/${name}.wasm`, import.meta.url);
    const wasmPath = fileURLToPath(url);
    await writeFile(wasmPath, data);
    return `readFile("${name}.wasm")`;
  };
  describe('transpile', function() {
    it('should transpile zig source code containing no methods', async function() {
      this.timeout(600000);
      const path = getSamplePath('integers');
      const options = { optimize: 'Debug' };
      const { code } = await transpile(path, options);
      expect(code).to.be.a('string');
      expect(code).to.contain('integers');
    })
    it('should transpile zig source code contain a method', async function() {
      this.timeout(600000);
      const path = getSamplePath('simple');
      const options = {
        optimize: 'ReleaseSmall',
        embedWASM: false,
        stripWASM: false,
        wasmLoader: saveWASM,
      };
      const { code } = await transpile(path, options);
      expect(code).to.be.a('string');
      expect(code).to.contain('"add"');
    })
    it('should transpile zig source code accessing the file system', async function() {
      this.timeout(600000);
      const path = getSamplePath('read-file');
      const options = {
        optimize: 'ReleaseSmall',
        embedWASM: false,
        wasmLoader: saveWASM,
      };
      const { code } = await transpile(path, options);
      expect(code).to.contain('"readFile"');
    })
    it('should strip out unnecessary code when stripWASM is specified', async function() {
      this.timeout(600000);
      const path = getSamplePath('simple');
      const options1 = { optimize: 'Debug' };
      const options2 = { optimize: 'Debug', stripWASM: true };
      const { code: before } = await transpile(path, options1);
      const { code: after } = await transpile(path, options2);
      expect(after.length).to.be.below(before.length);
    })
    it('should default to strip WASM when optimize is not Debug', async function() {
      this.timeout(600000);
      const path = getSamplePath('simple');
      const options1 = { optimize: 'ReleaseSmall', stripWASM: false };
      const options2 = { optimize: 'ReleaseSmall' };
      const { code: before } = await transpile(path, options1);
      const { code: after } = await transpile(path, options2);
      expect(after.length).to.be.below(before.length);
    })
    it('should call wasmLoader when embedWASM is false', async function() {
      this.timeout(600000);
      const path = getSamplePath('simple');
      let srcPath, wasmDV;
      const wasmLoader = (path, dv) => {
        srcPath = path;
        wasmDV = dv;
        return `loadWASM()`;
      };
      const options = { optimize: 'Debug', embedWASM: false, wasmLoader };
      const { code } = await transpile(path, options);
      expect(srcPath).to.equal(path);
      expect(wasmDV).to.be.instanceOf(DataView);
      expect(code).to.contain(`loadWASM()`);
    })
    it('should throw when embedWASM is false and wasmLoader is not provided', async function() {
      const path = getSamplePath('integers');
      const options = { optimize: 'Debug', embedWASM: false };
      await expect(transpile(path, options)).to.eventually.be.rejected;
    })
    it('should obtain path to zig file from sourceFiles', async function() {
      this.timeout(600000);
      const sourceFiles = {
        'lib/integers.zigar': 'test/zig-samples/basic/integers.zig'
      };
      const url = new URL(`../lib/integers.zigar`, import.meta.url);
      const path = fileURLToPath(url);
      const options = { optimize: 'Debug', sourceFiles };
      const { code } = await transpile(path, options);
      expect(code).to.be.a('string');
      expect(code).to.contain('integers');
    })
    it('should transpile zig source code involving function pointer', async function() {
      this.timeout(600000);
      const path = getSamplePath('fn-pointer');
      /* TODO: set optimize back to ReleaseSmall once #436 is fixed */
      const options = {
        optimize: 'Debug',
        embedWASM: false,
        wasmLoader: saveWASM,
      };
      const { code } = await transpile(path, options);
      expect(code).to.contain('"call"');
    })
  })
})
