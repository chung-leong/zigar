import { expect } from 'chai';
import { createRequire } from 'module';
import { compile } from '../../src/compile.js';

const require = createRequire(import.meta.url);

describe('Garbage collection', function() {
  describe('load', function() {
    it('should allow module to unload when no functions are imported', async function() {
      const { pathname: zigPath } = new URL('../integration/variables.zig', import.meta.url);
      const pathLib = await compile(zigPath);
      const { pathname: extPath } = new URL('../../build/Release/addon', import.meta.url);
      const { load, getModuleCount, getFunctionCount } = require(extPath);      
      global.hello = "Hello world!";
      const module = load(pathLib);
      console.log(module);
      expect(getModuleCount()).to.equal(1);
    })
  })
})
