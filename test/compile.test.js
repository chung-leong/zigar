import { expect } from 'chai';

import { compile } from '../src/compile.js';

describe('Zig file compilation', function() {
  describe('compile', function() {
    it('should compile zig source code', async function() {
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const libpath = await compile(pathname);
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('libintegers');
    })
  })
})

