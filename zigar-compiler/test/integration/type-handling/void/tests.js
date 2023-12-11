import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Void', function() {
    it('should handle void as static variables', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-static-variables');
      expect(module.weird).to.be.null;
    })
    it('should print void arguments', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('as-function-parameters');
      const lines = await capture(() => print(null));
      expect(lines).to.eql([ 'void' ]);
    })
  })
}
