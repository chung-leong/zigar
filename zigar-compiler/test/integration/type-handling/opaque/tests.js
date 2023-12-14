import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { capture } from '../../capture.js';

use(ChaiAsPromised);

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Opaque', function() {
    it('should not compile code with opaque as static variable', async function() {
      this.timeout(120000);
      await expect(importTest('as-static-variables')).to.eventually.be.rejected;      
    })

    it('should not compile code containing opaque vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;      
    })
  })
}
