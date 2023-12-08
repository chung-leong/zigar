import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Opaque', function() {
    it('should handle opaque as static variables', async function() {
      this.timeout(120000);
      const { something } = await importTest('as-static-variables');
      expect(something).to.be.a('function');
    })
  })
}
