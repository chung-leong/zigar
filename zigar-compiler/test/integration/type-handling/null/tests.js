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
    it('should ignore a function accepting null as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.undefined;
    })
    it('should ignore a function returning null', async function() {
      this.timeout(120000);
      const { getNull } = await importTest('as-function-parameters');
      expect(getNull).to.undefined;
    })
    it('should handle null in array', async function() {
      this.timeout(120000);
      const { array } = await importTest('array-of');
      expect([ ...array ]).to.eql([ null, null, null, null ]);
    })
    it('should not compile code with null in struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-struct')).to.eventually.be.rejected;
    })
    it('should not compile code with null in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle null as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA } = await importTest('as-comptime-field');
      expect(module.struct_a.empty).to.be.null;
      const b = new StructA({ number: 500 });
      expect(b.empty).to.be.null;
    })
    it('should not compile code with null bare union', async function() {
      this.timeout(120000);
      await expect(importTest('in-bare-union')).to.eventually.be.rejected;
    })
    it('should not compile code with null tagged union', async function() {
      this.timeout(120000);
      await expect(importTest('in-tagged-union')).to.eventually.be.rejected;
    })
    it('should not compile code with null optional', async function() {
      this.timeout(120000);
      await expect(importTest('in-optional')).to.eventually.be.rejected;
    })
    it('should not compile code with null error union', async function() {
      this.timeout(120000);
      await expect(importTest('in-error-union')).to.eventually.be.rejected;
    })
    it('should not compile code with null vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}
