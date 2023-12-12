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
      expect(module.empty).to.be.null;
    })
    it('should print void arguments', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('as-function-parameters');
      const lines = await capture(() => print(null));
      expect(lines).to.eql([ 'void' ]);
    })
    it('should return void', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-return-value');
      expect(module.getVoid()).to.equal(null);
    })
    it('should handle void in array', async function() {
      this.timeout(120000);
      const { array, print } = await importTest('array-of');      
      expect(array.length).to.equal(4);
      expect([ ...array ]).to.eql([ null, null, null, null ]);
      const [ line ] = await capture(() => print());
      expect(line).to.equal('{ void, void, void, void }');
    })
  })
}
