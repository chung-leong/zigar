import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { join } from 'path';
import { fileURLToPath } from 'url';

use(chaiAsPromised);

import {
  extractOptions,
  findConfigFile,
  findSourceFile,
  loadConfigFile,
  optionsForCompile,
  optionsForTranspile,
} from '../src/configuration.js';

describe('Configuration', function() {
  describe('extractOptions', function() {
    it('should extract options in kebab-case from query string', function() {
      const { searchParams } = new URL('file:///home/someone/hello.zig?build-dir=/tmp&optimize=release-small&clean=0&embed-wasm=1');
      const options = extractOptions(searchParams, { ...optionsForCompile, ...optionsForTranspile });
      expect(options).to.eql({
        buildDir: '/tmp',
        optimize: 'ReleaseSmall',
        clean: false,
        embedWASM: true,
      });
    })
    it('should extract options in snake_case from query string', function() {
      const { searchParams } = new URL('file:///home/someone/hello.zig?build-dir=/tmp&optimize=release_fast&clean=0&embed_wasm=1');
      const options = extractOptions(searchParams, { ...optionsForCompile, ...optionsForTranspile });
      expect(options).to.eql({
        buildDir: '/tmp',
        optimize: 'ReleaseFast',
        clean: false,
        embedWASM: true,
      });
    })
    it('should extract options in camelCase from query string', function() {
      const { searchParams } = new URL('file:///home/someone/hello.zig?build-dir=/tmp&optimize=ReleaseSafe&clean=0&embedWASM=1');
      const options = extractOptions(searchParams, { ...optionsForCompile, ...optionsForTranspile });
      expect(options).to.eql({
        buildDir: '/tmp',
        optimize: 'ReleaseSafe',
        clean: false,
        embedWASM: true,
      });
    })
    it('should extract numeric options', function() {
      const { searchParams } = new URL('file:///home/someone/hello.zig?boo=100');
      const fakeOptions = {
        boo: {
          type: 'number',
        }
      };
      const options = extractOptions(searchParams, fakeOptions);
      expect(options.boo).to.equal(100);
    })
    it('should throw when option is not recognized', function() {
      const { searchParams } = new URL('file:///home/someone/hello.zig?build-folder=/tmp');
      expect(() => extractOptions(searchParams, optionsForCompile)).to.throw(Error)
        .with.property('message').that.contains('Unrecognized') ;
    })
    it('should throw when option is not available', function() {
      const { searchParams } = new URL('file:///home/someone/hello.zig?optimize=Debug');
      expect(() => extractOptions(searchParams, {})).to.throw(Error)
        .with.property('message').that.contains('Unavailable') ;
    })
  })
  describe('findConfigFile', function () {
    it('should find config file', async function() {
      const path = await findConfigFile('node-zigar.config.json', absolute('./config-samples/correct'));
      expect(path).to.equal(absolute('./config-samples/correct/node-zigar.config.json'));
    })
    it('should find config file in parent folder', async function() {
      const path = await findConfigFile('node-zigar.config.json', absolute('./config-samples/correct/hello/world'));
      expect(path).to.equal(absolute('./config-samples/correct/node-zigar.config.json'));
    })
    it('should return undefined when config file is absent', async function() {
      const path = await findConfigFile('node-zigar.config.json', absolute('./config-samples/missing/hello/world'));
      expect(path).to.be.undefined;
    })
  })
  describe('loadConfigFile', function () {
    it('should load config file', async function() {
      const path = await findConfigFile('node-zigar.config.json', absolute('./config-samples/correct/hello/world'));
      const options = await loadConfigFile(path, optionsForCompile);
      const cfgPath = absolute('./config-samples/correct');
      const soPath = join(cfgPath, 'hello.zigar');
      const srcPath = join(cfgPath, 'src', 'hello.zig');
      expect(options).to.eql({ optimize: 'Debug', sourceFiles: { [soPath]: srcPath } });
    })
    it('should throw when config file is malformed', async function() {
      const path = await findConfigFile('node-zigar.config.json', absolute('./config-samples/malformed/hello/world'));
      await expect(loadConfigFile(path, optionsForCompile)).to.eventually.be.rejected;
    })
    it('should throw when config file has unrecognized fields', async function() {
      const path = await findConfigFile('node-zigar.config.json', absolute('./config-samples/unrecognized/hello/world'));
      await expect(loadConfigFile(path, optionsForCompile)).to.eventually.be.rejected;
    })
    it('should throw when config file has a type mismatch', async function() {
      const path = await findConfigFile('node-zigar.config.json', absolute('./config-samples/mismatch/hello/world'));
      await expect(loadConfigFile(path, optionsForCompile)).to.eventually.be.rejected;
    })
  })
  describe('findSourceFile', function () {
    it('should find source file for Zigar module', async function() {
      const cfgPath = absolute('./config-samples/overlapping');
      const options = await loadConfigFile(`${cfgPath}/node-zigar.config.json`, optionsForCompile);
      const src1 = findSourceFile(join(cfgPath, 'lib', 'world.zigar'), options);
      const src2 = findSourceFile(join(cfgPath, 'lib', 'hello', 'world.zigar'), options);
      const src3 = findSourceFile(join(cfgPath, 'lib', 'hello.zigar'), options);
      expect(src1).to.equal(join(absolute('./config-samples/overlapping'), 'src', 'world.zig'));
      expect(src2).to.equal(join(absolute('./config-samples/overlapping'), 'src', 'hello-world.zig'));
      expect(src3).to.be.undefined;
    })
  })
})

function absolute(relpath) {
  return fileURLToPath(new URL(relpath, import.meta.url));
}
