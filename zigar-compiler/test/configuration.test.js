import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { fileURLToPath } from 'url';

use(ChaiAsPromised);

import {
  extractOptions,
  findConfigFile,
  findConfigFileSync,
  findSourceFile,
  loadConfigFile,
  loadConfigFileSync,
  optionsForCompile
} from '../src/configuration.js';

describe('Configuration', function() {
  describe('extractOptions', function() {
    it('should extract options from query string', function() {
      const { searchParams } = new URL('file:///home/someone/hello.zig?build-dir=/tmp&clean=0&stale-time=50000');
      const options = extractOptions(searchParams, optionsForCompile);
      expect(options).to.eql({
        buildDir: '/tmp',
        clean: false,
        staleTime: 50000
      });
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
  describe('findConfigFileSync', function () {
    it('should find config file', function() {
      const path = findConfigFileSync('node-zigar.config.json', absolute('./config-samples/correct'));
      expect(path).to.equal(absolute('./config-samples/correct/node-zigar.config.json'));
    })
    it('should find config file in parent folder', function() {
      const path = findConfigFileSync('node-zigar.config.json', absolute('./config-samples/correct/hello/world'));
      expect(path).to.equal(absolute('./config-samples/correct/node-zigar.config.json'));
    })
    it('should return undefined when config file is absent', function() {
      const path = findConfigFileSync('node-zigar.config.json', absolute('./config-samples/missing/hello/world'));
      expect(path).to.be.undefined;
    })
  })
  describe('loadConfigFile', function () {
    it('should load config file', async function() {
      const path = await findConfigFile('node-zigar.config.json', absolute('./config-samples/correct/hello/world'));
      const options = await loadConfigFile(path, optionsForCompile);
      const cfgPath = absolute('./config-samples/correct');
      const soPath = `${cfgPath}/hello.zigar`;
      const srcPath = `${cfgPath}/src/hello.zig`;
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
  describe('loadConfigFileSync', function () {
    it('should load config file', async function() {
      const path = findConfigFileSync('node-zigar.config.json', absolute('./config-samples/correct/hello/world'));
      const options = loadConfigFileSync(path, optionsForCompile);
      const cfgPath = absolute('./config-samples/correct');
      const soPath = `${cfgPath}/hello.zigar`;
      const srcPath = `${cfgPath}/src/hello.zig`;
      expect(options).to.eql({ optimize: 'Debug', sourceFiles: { [soPath]: srcPath } });
    })
    it('should throw when config file is malformed', async function() {
      const path = findConfigFileSync('node-zigar.config.json', absolute('./config-samples/malformed/hello/world'));
      expect(() => loadConfigFileSync(path, optionsForCompile)).to.throw();
    })
    it('should throw when config file has unrecognized fields', async function() {
      const path = findConfigFileSync('node-zigar.config.json', absolute('./config-samples/unrecognized/hello/world'));
      expect(() => loadConfigFileSync(path, optionsForCompile)).to.throw();
    })
    it('should throw when config file has a type mismatch', async function() {
      const path = findConfigFileSync('node-zigar.config.json', absolute('./config-samples/mismatch/hello/world'));
      expect(() => loadConfigFileSync(path, optionsForCompile)).to.throw();
    })
  })
  describe('findSourceFile', function () {
    it('should find source file for Zigar module', function() {
      const cfgPath = absolute('./config-samples/overlapping');
      const options = loadConfigFileSync(`${cfgPath}/node-zigar.config.json`, optionsForCompile);
      const src1 = findSourceFile(`${cfgPath}/lib/world.zigar`, options);
      const src2 = findSourceFile(`${cfgPath}/lib/hello/world.zigar`, options);
      const src3 = findSourceFile(`${cfgPath}/lib/hello.zigar`, options);
      expect(src1).to.equal(`${absolute('./config-samples/overlapping')}/src/world.zig`);
      expect(src2).to.equal(`${absolute('./config-samples/overlapping')}/src/hello-world.zig`);
      expect(src3).to.be.undefined;
    })
  })
})

function absolute(relpath) {
  return fileURLToPath(new URL(relpath, import.meta.url));
}
