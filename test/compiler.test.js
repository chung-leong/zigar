import { expect } from 'chai';

import { compile } from '../src/compiler.js';

describe('Zig file compilation', function() {
  describe('compile', function() {
    it('should compile zig source code', async function() {
      this.timeout(10000);
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const libpath = await compile(pathname);
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('libintegers');
    })
  })
})
