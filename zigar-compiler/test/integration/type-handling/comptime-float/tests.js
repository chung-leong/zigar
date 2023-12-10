import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Comptime float', function() {
    it('should import comptime float as variables', async function() {
      this.timeout(120000);
      const { pi } = await importTest('as-static-variables');
      expect(pi.toFixed(4)).to.equal('3.1416');
    })
    it('should ignore a function accepting comptime_float as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.undefined;
    })
  })
}