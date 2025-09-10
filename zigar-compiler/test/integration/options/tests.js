import { expect } from 'chai';
import 'mocha-skip-if';

export function addTests(importModule, options) {
  const importTest = async (name, options) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url, options);
  };
  describe('Options', function() {
    this.timeout(0);
    skip.if(process.versions.bun).
    it('should omit functions when option is set', async function() {
      const { default: moduleWO } = await importTest('omit-functions', { omitFunctions: true });
      expect(moduleWO.a).to.be.undefined;
      expect(moduleWO.b).to.be.undefined;
      expect(moduleWO.c).to.be.undefined;
    })
    skip.if(process.versions.bun).
    it('should omit variables when option is set', async function() {
      const { default: moduleWO } = await importTest('omit-variables', { omitVariables: true });
      expect(moduleWO.a).to.be.a('number');
      expect(moduleWO.b).to.be.undefined;
      expect(moduleWO.c).to.be.undefined;
    })
  })
}