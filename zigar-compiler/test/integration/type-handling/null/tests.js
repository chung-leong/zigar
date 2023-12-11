import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Null', function() {
    it('should handle null as static variables', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-static-variables');
      expect(module.weird).to.be.null;
    })
    it('should ignore a function accepting @TypeOf(null) as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.undefined;
    })
    it('should ignore a function returning @TypeOf(null)', async function() {
      this.timeout(120000);
      const { getNull } = await importTest('as-function-parameters');
      expect(getNull).to.undefined;
    })
    it('should handle @TypeOf(null) in array', async function() {
      this.timeout(120000);
      const { array } = await importTest('array-of');
      expect([ ...array ]).to.eql([ null, null, null, null ]);
    })
  })
}
