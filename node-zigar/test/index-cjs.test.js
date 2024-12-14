import { expect } from 'chai';
import { createRequire } from 'module';
import '../dist/index.cjs';

describe('CommonJS loader', function() {
  describe('require', function() {
    const require = createRequire(import.meta.url);
    it('should load Zig file', async function() {
      this.timeout(0);
      const uri = './zig-samples/simple.zig';
      const module = require(uri);
      expect(module.add).to.be.a('function');
    })
    it('should throw when file is missing', async function() {
      this.timeout(0);
      const uri = './zig-samples/missing.zig';
      expect(() => require(uri)).to.throw(Error)
        .with.property('message').that.contains('no such file or directory');
    })
    it('should ignore URL without the extension zig', async function() {
      const module = require('module');
      expect(module.createRequire).to.equal(createRequire);
    })
    it('should use query variables', async function() {
      this.timeout(0);
      const uri = './zig-samples/simple.zig?optimize=ReleaseSafe';
      const module = require(uri);
      expect(module.add).to.be.a('function');
    })
    it('should use config file', async function() {
      this.timeout(0);
      const uri = './zig-samples/lib/simple.zigar';
      const module = require(uri);
      expect(module.add).to.be.a('function');
    })
  })
})
