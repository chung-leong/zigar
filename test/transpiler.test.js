import { expect } from 'chai';

import { transpile } from '../src/transpiler.js';

describe('Transpilation', function() {
  describe('transpile', function() {
    beforeEach(function() {
      process.env.NODE_ZIG_TARGET = 'WASM-STAGE1';
    })
    it('should transpile zig source code', async function() {
      this.timeout(10000);
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const code = await transpile(pathname);
      expect(code).to.be.a('string');
      expect(code).to.contain('integers');
      console.log(code);
    })
  })
})
