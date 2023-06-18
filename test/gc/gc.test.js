import { expect } from 'chai';
import { createRequire } from 'module';
import { compile } from '../../src/compile.js';

const require = createRequire(import.meta.url);

describe('Garbage collection', function() {
  describe('load', function() {
    it('should hang onto module when variables from it are accessible', async function() {
      const { pathname: zigPath } = new URL('../integration/variables.zig', import.meta.url);
      const pathLib = await compile(zigPath);
      const { pathname: extPath } = new URL('../../build/Release/addon', import.meta.url);
      const { load, getGCStatistics } = require(extPath);      
      let module = load(pathLib);
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      expect(stats1.functions).to.equal(0);
      expect(stats1.buffers).to.be.at.least(1);
      for (let i = 0; i < 2; i++) gc();
      const stats2 = getGCStatistics();
      expect(stats2.modules).to.equal(1);
      expect(stats2.functions).to.equal(0);
      expect(stats2.buffers).to.be.at.least(1);
      module = null;
      for (let i = 0; i < 2; i++) gc();
      const stats3 = getGCStatistics();
      expect(stats3.modules).to.equal(0);
      expect(stats3.functions).to.equal(0);
      expect(stats3.buffers).to.equal(0);
    })

    it('should hang onto module when methods from it are accessible', async function() {
      const { pathname: zigPath } = new URL('../integration/simple.zig', import.meta.url);
      const pathLib = await compile(zigPath);
      const { pathname: extPath } = new URL('../../build/Release/addon', import.meta.url);
      const { load, getGCStatistics } = require(extPath);      
      let module = load(pathLib);
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      expect(stats1.functions).to.equal(1);
      expect(stats1.buffers).to.equal(0);
      for (let i = 0; i < 2; i++) gc();
      const stats2 = getGCStatistics();
      expect(stats2.modules).to.equal(1);
      expect(stats2.functions).to.equal(1);
      expect(stats1.buffers).to.equal(0);
      module = null;
      for (let i = 0; i < 2; i++) gc();
      const stats3 = getGCStatistics();
      expect(stats3.modules).to.equal(0);
      expect(stats3.functions).to.equal(0);
      expect(stats3.buffers).to.equal(0);
    })   
  })
})
