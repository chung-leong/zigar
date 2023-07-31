import { expect } from 'chai';

import { compile } from '../src/compiler.js';

describe('Compilation', function() {
  describe('compile', function() {
    it('should compile zig source code', async function() {
      this.timeout(10000);
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const libpath = await compile(pathname);
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('libintegers');
    })
    it('should compile code for WASM (stage 1)', async function() {
      this.timeout(10000);
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const libpath = await compile(pathname, { wasm: { stage: 1 } });
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('integers-exporter.wasm');
    })
    it('should compile code for WASM (stage 2)', async function() {
      this.timeout(10000);
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const libpath = await compile(pathname, { wasm: { stage: 2 } });
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('integers.wasm');
    })
  })
})

