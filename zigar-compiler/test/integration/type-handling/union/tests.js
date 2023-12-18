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
    it('should print union arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      const lines = await capture(() => {
        print({ Integer: 200 });
        print({ Float: 3.14 });
        print({ String: "Hello" })
      });
      expect(lines).to.eql([ 
        'as-function-parameters.Variant{ .Integer = 200 }',
        'as-function-parameters.Variant{ .Float = 3.14e+00 }', 
        'as-function-parameters.Variant{ .String = { 72, 101, 108, 108, 111 } }', 
      ]);
    })
    it('should return union', async function() {
      this.timeout(120000);
      const { getInteger, getFloat, getString } = await importTest('as-return-value');
      expect(getInteger().Integer).to.equal(300);
      expect(getFloat().Float).to.equal(3.14);
      expect(getFloat().Integer).to.be.null;
      expect(getString().String.string).to.equal('Hello');
    })
    it('should handle union in array', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('array-of');      
      expect(array.length).to.equal(4);
      expect([ ...module.array ]).to.eql([ undefined, undefined, undefined, undefined ]);
      const [ line ] = await capture(() => print());
      expect(line).to.equal('{ void, void, void, void }');
    })


    it('should handle union in optional', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('in-optional');
      expect(module.optional.Integer).to.equal(100);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-error-union.Variant');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('null');
      module.optional = { Float: 3.14 };
      expect(module.optional.Float).to.equal(3.14);
      expect(module.error_union.Integer).to.be.null;
    })
    it('should handle union in error union', async function() {
      this.timeout(120000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union.Integer).to.equal(100);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-error-union.Variant');
      module.error_union = Error.GoldfishDied;
      expect(() => module.error_union).to.throw(Error.GoldfishDied);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('error.GoldfishDied');
      module.error_union = { Float: 3.14 };
      expect(module.error_union.Float).to.equal(3.14);
      expect(module.error_union.Integer).to.be.null;
    })
    it('should not compile code containing union vector', async function() {
      await importTest('vector-of');
      await expect(importTest('vector-of')).to.eventually.be.rejected;      
    })   
  })
}