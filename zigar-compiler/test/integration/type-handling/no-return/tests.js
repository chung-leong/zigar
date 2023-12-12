import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';

use(ChaiAsPromised);

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('No return', function() {
    it('should handle no return as static variables', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-static-variables');
      expect(module.weird).to.be.undefined;
    })
    it('should not compile a function accepting no return as arguments', async function() {
      this.timeout(120000);
      await expect(importTest('as-function-parameters')).to.eventually.be.rejected;
    })
    it('should not compile a function returning no return', async function() {
      this.timeout(120000);
      await expect(importTest('as-return-value')).to.eventually.be.rejected;
    })
    it('should not compile when there is an array of no returns', async function() {
      this.timeout(120000);
      await expect(importTest('array-of')).to.eventually.be.rejected;
    })
  })
}
