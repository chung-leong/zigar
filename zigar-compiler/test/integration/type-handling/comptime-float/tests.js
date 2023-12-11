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
    it('should ignore a function accepting comptime float as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.undefined;
    })
    it('should ignore a function returning comptime float', async function() {
      this.timeout(120000);
      const { getComptimeFloat } = await importTest('as-function-parameters');
      expect(getComptimeFloat).to.undefined;
    })
    it('should handle comptime float in array', async function() {
      this.timeout(120000);
      const { array } = await importTest('array-of');
      expect([ ...array ]).to.eql([ 1.1, 2.1, 3.1, 4.1 ]);
    })
  })
}