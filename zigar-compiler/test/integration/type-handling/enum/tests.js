import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Enum', function() {
    it('should handle enum as static variables', async function() {
      this.timeout(120000);
      const { Pet, Donut } = await importTest('as-static-variables');
      expect.fail('TODO');
    })
  })
}

