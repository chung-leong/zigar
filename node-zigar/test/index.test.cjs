const { expect } = require('chai');
require('../dist/index.cjs');

describe('CommonJS loader', function() {
  describe('require', function() {
    it('should load Zig file', async function() {
      this.timeout(60000);
      const uri = './zig-samples/function-simple.zig';
      const module = require(uri);
      expect(module.add).to.be.a('function');
    })
    it('should ignore URL without the extension zig', async function() {
      const module = require('chai');
      expect(module.expect).to.equal(expect);
    })
    it('should use query variables', async function() {
      this.timeout(300000);
      const uri = './zig-samples/function-simple.zig?optimize=ReleaseSmall';
      const module = require(uri);
      expect(module.add).to.be.a('function');
    })
    it('should use config file', async function() {
      this.timeout(300000);
      const uri = './zig-samples/with-config/lib/simple.zigar';
      const module = require(uri);
      expect(module.add).to.be.a('function');
    })
  })
})