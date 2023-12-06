import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Function', function() {
    it('should handle function as static variables', async function() {
      // no support currently
      this.timeout(120000);
      const { default: module } = await importTest('as-static-variables');
      expect(module.func).to.be.undefined;
    })
  })
}
