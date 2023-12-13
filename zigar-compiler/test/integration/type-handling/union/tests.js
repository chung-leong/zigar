import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(options.optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Union', function() {
    it('should import union as static variables', async function() {
      this.timeout(120000);
      const { 
        default: module, 
        printVariant, 
        printVariantPtr,
      } = await importTest('as-static-variables');
      expect(module.variant_a.String.string).to.equal('apple');
      expect(module.variant_a.Integer).to.be.null;
      expect(module.variant_a.Float).to.be.null;
      expect(module.variant_b.Integer).to.equal(123);
      expect(module.variant_c.Float).to.equal(3.14);
      const lines = await capture(() => {
        printVariant(module.variant_a);
        printVariant(module.variant_b);
        printVariant(module.variant_c);
        printVariantPtr(module.variant_a);
        printVariantPtr(module.variant_b);
        printVariantPtr(module.variant_c);
      });
      expect(lines).to.eql([ 'apple', '123', '3.14', 'apple', '123', '3.14' ]);
      expect(module.extern_union.cat).to.equal(100);
      expect(module.extern_union.dog).to.equal(100);
      expect(module.bare_union.dog).to.equal(123);
      module.useCat();
      expect(module.bare_union.cat).to.equal(777);
      if (runtimeSafety) {
        expect(() => module.bare_union.dog).to.throw(TypeError);
      } else {
        expect(module.bare_union.dog).to.equal(777);
      }
      module.useMonkey();
      expect(module.bare_union.monkey).to.equal(777n);
    })
  })
}