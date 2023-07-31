import { expect } from 'chai';
import { stat } from 'fs/promises';

import { compile } from '../src/compiler.js';

describe('Compilation', function() {
  describe('compile', function() {
    it('should compile zig source code for C++ extension', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const libpath = await compile(pathname);
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('libintegers');
    })
    it('should compile code for WASM', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const libpath = await compile(pathname, { target: 'wasm' });
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('integers.wasm');
    })
    it('should compile optimized code', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const libpath1 = await compile(pathname, { target: 'wasm' });
      const { size: before } = await stat(libpath1);
      const libpath2 = await compile(pathname, { target: 'wasm', optimize: 'ReleaseSmall' });
      const { size: after } = await stat(libpath2);
      expect(after).to.be.below(before);
    })
  })
})

