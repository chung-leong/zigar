import { expect } from 'chai';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { compile } from '../../../zigar-compiler/src/compiler.js';
import { exportStructures, getGCStatistics, importModule, loadModule } from '../../dist/index.js';

const require = createRequire(import.meta.url);

describe('Garbage collection', function() {
  // NOTE: if one test fails, then all subsequent tests will fail as well
  describe('loadModule', function() {
    it('should release module when environment is released', async function() {
      this.timeout(60000);
      const zigPath = fileURLToPath(new URL('../zig-samples/integers.zig', import.meta.url));
      const pathLib = await compile(zigPath);
      let env = await loadModule(pathLib);
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      expect(stats1.functions).to.be.at.least(1);
      expect(stats1.buffers).to.equal(0);
      env = undefined;
      await collectGarbage();
      const stats2 = getGCStatistics();
      expect(stats2.modules).to.equal(0);
      expect(stats2.functions).to.equal(0);
      expect(stats2.buffers).to.equal(0);
    })
    it('should release module when abandon is called', async function() {
      this.timeout(60000);
      const zigPath = fileURLToPath(new URL('../zig-samples/integers.zig', import.meta.url));
      const pathLib = await compile(zigPath);
      let env = await loadModule(pathLib);
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      expect(stats1.functions).to.be.at.least(1);
      expect(stats1.buffers).to.equal(0);
      env.abandon();
      await collectGarbage();
      const stats2 = getGCStatistics();
      expect(stats2.modules).to.equal(0);
      expect(stats2.functions).to.equal(0);
      expect(stats2.buffers).to.equal(0);
    })
  })
  describe('exportStructures', function() {
    it('should release module after export is completed', async function() {
      this.timeout(60000);
      const zigPath = fileURLToPath(new URL('../zig-samples/integers.zig', import.meta.url));
      const pathLib = await compile(zigPath);
      const def = await exportStructures(pathLib);
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      expect(stats1.functions).to.be.at.least(1);
      expect(stats1.buffers).to.be.at.least(1);
      await collectGarbage();
      const stats2 = getGCStatistics();
      expect(stats2.modules).to.equal(0);
      expect(stats2.functions).to.equal(0);
      expect(stats2.buffers).to.equal(0);
    })
  })
  describe('importModule', function() {
    it('should hang onto module when variables from it are accessible', async function() {
      const zigPath = fileURLToPath(new URL('../zig-samples/integers.zig', import.meta.url));
      const pathLib = await compile(zigPath);
      let module = await importModule(pathLib);
      await collectGarbage();
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      expect(stats1.functions).to.be.at.least(1);
      expect(stats1.buffers).to.be.at.least(1);
      module = null;
      await collectGarbage();
      const stats2 = getGCStatistics();
      expect(stats2.modules).to.equal(0);
      expect(stats2.functions).to.equal(0);
      expect(stats2.buffers).to.equal(0);
    })
    it('should hang onto module when functions from it are accessible', async function() {
      const zigPath = fileURLToPath(new URL('../zig-samples/function-simple.zig', import.meta.url));
      const pathLib = await compile(zigPath);
      let { add } = await importModule(pathLib);
      await collectGarbage();
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      expect(stats1.functions).to.be.at.least(1);
      expect(stats1.buffers).to.equal(0);
      add = null;
      await collectGarbage();
      const stats2 = getGCStatistics();
      expect(stats2.modules).to.equal(0);
      expect(stats2.functions).to.equal(0);
      expect(stats2.buffers).to.equal(0);
    })
    it('should release module when abandon is called', async function() {
      const zigPath = fileURLToPath(new URL('../zig-samples/function-simple.zig', import.meta.url));
      const pathLib = await compile(zigPath);
      const { add, __zigar } = await importModule(pathLib);
      await collectGarbage();
      const stats1 = getGCStatistics();
      expect(stats1.modules).to.equal(1);
      expect(stats1.functions).to.be.at.least(1);
      expect(stats1.buffers).to.equal(0);
      __zigar.abandon();
      expect(__zigar.released()).to.be.false;
      await collectGarbage();
      const stats2 = getGCStatistics();
      expect(stats2.modules).to.equal(0);
      expect(stats2.functions).to.equal(0);
      expect(stats2.buffers).to.equal(0);
      expect(__zigar.released()).to.be.true;
    })
  })
})

async function collectGarbage() {
  // run it twice to ensure all garbage get collected
  for (let i = 0; i < 2; i++) {
    // start gc process
    gc();
    // give finalizers a chance to run
    await new Promise(r => setTimeout(r, 0));
  }
}
