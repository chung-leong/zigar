import { expect } from 'chai';
import { createRequire } from 'module';
import '../dist/index.cjs';

describe('CommonJS loader', function() {
  describe('require', function() {
    const require = createRequire(import.meta.url);
    it('should load Zig file', async function() {
      this.timeout(60000);
      const uri = './zig-samples/simple.zig';
      const module = require(uri);
      expect(module.add).to.be.a('function');
    })
    it('should ignore URL without the extension zig', async function() {
      const module = require('module');
      expect(module.createRequire).to.equal(createRequire);
    })
    it('should use query variables', async function() {
      this.timeout(300000);
      const uri = './zig-samples/simple.zig?optimize=ReleaseSafe';
      const module = require(uri);
      expect(module.add).to.be.a('function');
    })
    it('should use config file', async function() {
      this.timeout(300000);
      const uri = './zig-samples/lib/simple.zigar';
      const module = require(uri);
      expect(module.add).to.be.a('function');
    })
  })
})