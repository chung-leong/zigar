import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Undefined', function() {
    it('should handle undefined as static variables', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-static-variables');
      expect(module.weird).to.be.undefined;
    })
    it('should ignore a function accepting undefined as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.be.undefined;
    })
    it('should ignore a function returning undefined', async function() {
      this.timeout(120000);
      const { getUndefined } = await importTest('as-return-value');
      expect(getUndefined).to.be.undefined;
    })
    it('should not compile when there is an array of undefineds', async function() {
      this.timeout(120000);
      await expect(importTest('array-of')).to.eventually.be.rejected;
    })
  })
}
