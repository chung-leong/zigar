import { expect } from 'chai';
import { createRequire } from 'module';
import { compile } from '../../../zigar-compiler/src/compiler.js';

const require = createRequire(import.meta.url);

describe('Garbage collection', function() {
  // NOTE: if one test fails, then all subsequent tests will fail as well
  describe('load', function() {
    const { pathname: extPath } = new URL('../../build/Release/node-zigar-addon', import.meta.url);
    it('should hang onto module when variables from it are accessible', async function() {
      this.timeout(60000);
      const { pathname: zigPath } = new URL('../zig-samples/integers.zig', import.meta.url);
      const pathLib = await compile(zigPath);
      const { load, getGCStatistics } = require(extPath);
      let module = load(pathLib);
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      // the factory function
      expect(stats1.functions).to.equal(1);
      expect(stats1.buffers).to.be.at.least(1);
      // initiate garbage collection
      await collectGarbage();
      const stats2 = getGCStatistics();
      expect(stats2.modules).to.equal(1);
      // factory function got gc'ed
      expect(stats2.functions).to.equal(0);
      expect(stats2.buffers).to.be.at.least(1);
      module = null;
      await collectGarbage();
      const stats3 = getGCStatistics();
      expect(stats3.modules).to.equal(0);
      expect(stats3.functions).to.equal(0);
      expect(stats3.buffers).to.equal(0);
    })
    it('should hang onto module when methods from it are accessible', async function() {
      this.timeout(60000);
      const { pathname: zigPath } = new URL('../zig-samples/function-simple.zig', import.meta.url);
      const pathLib = await compile(zigPath);
      const { load, getGCStatistics } = require(extPath);
      let module = load(pathLib);
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      // actual exported function plus factory function
      expect(stats1.functions).to.equal(2);
      expect(stats1.buffers).to.equal(0);
      await collectGarbage();
      const stats2 = getGCStatistics();
      // script unloaded after import is done
      expect(stats2.modules).to.equal(1);
      // factory function got gc'ed
      expect(stats2.functions).to.equal(1);
      expect(stats2.buffers).to.equal(0);
      module = null;
      await collectGarbage();
      const stats3 = getGCStatistics();
      expect(stats3.modules).to.equal(0);
      expect(stats3.functions).to.equal(0);
      expect(stats3.buffers).to.equal(0);
    })
    it('should allow module to unload when only constants are exported', async function() {
      this.timeout(60000);
      const { pathname: zigPath } = new URL('../zig-samples/comptime-numbers.zig', import.meta.url);
      const pathLib = await compile(zigPath);
      const { load, getGCStatistics } = require(extPath);
      let module = load(pathLib);
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      expect(stats1.functions).to.equal(1);
      expect(stats1.buffers).to.equal(0);
      await collectGarbage();
      const stats2 = getGCStatistics();
      expect(stats2.modules).to.equal(0);
      expect(stats2.functions).to.equal(0);
    })
    it('should allow module with static variables to unload when __zigar.abandon is called', async function() {
      this.timeout(60000);
      const { pathname: zigPath } = new URL('../zig-samples/integers.zig', import.meta.url);
      const pathLib = await compile(zigPath);
      const { load, getGCStatistics } = require(extPath);
      let module = load(pathLib);
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      expect(stats1.buffers).to.be.at.least(1);
      await module.__zigar.abandon();
      await collectGarbage();
      const stats2 = getGCStatistics();
      expect(stats2.modules).to.equal(0);
      expect(stats2.buffers).to.equal(0);
    })
    it('should allow module with function to unload when __zigar.abandon is called', async function() {
      this.timeout(60000);
      const { pathname: zigPath } = new URL('../zig-samples/function-simple.zig', import.meta.url);
      const pathLib = await compile(zigPath);
      const { load, getGCStatistics } = require(extPath);
      let module = load(pathLib);
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      expect(stats1.functions).to.be.at.least(1);
      await module.__zigar.abandon();
      await collectGarbage();
      const stats2 = getGCStatistics();
      expect(stats2.modules).to.equal(0);
      expect(stats2.functions).to.equal(0);
      expect(() => module.add(1, 2)).to.throw(Error)
        .with.property('message').that.contains('abandoned');
    })
  })
})

async function collectGarbage() {
  // start gc process
  gc();
  // give finalizers a chance to run
  await new Promise(r => setTimeout(r, 0));
}
