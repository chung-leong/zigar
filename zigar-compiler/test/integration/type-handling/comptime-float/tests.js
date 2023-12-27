import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { capture } from '../../capture.js';

use(ChaiAsPromised);

export function addTests(importModule, options) {
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(options.optimize);
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
    it('should handle comptime float in struct', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({ number1: 1.1, number2: 2.2 });
      expect(StructA).to.be.undefined;
      const [ line ] = await capture(() => print());
      expect(line).to.equal('in-struct.StructA{ .number1 = 1.1e+00, .number2 = 2.2e+00 }');
    })
    it('should handle comptime float in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.be.eventually.rejected;
    })
    it('should handle comptime float as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA } = await importTest('as-comptime-field');
      expect(module.struct_a.number).to.equal(1.234);
      const b = new StructA({ state: false });
      expect(b.number).to.equal(1.234);
    })
    it('should handle comptime float in bare union', async function() {
      this.timeout(120000);
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect(module.union_a.number).to.equal(1.23);
      if (runtimeSafety) {
        expect(() => module.union_a.state).to.throw();
      }
      expect(UnionA).to.be.undefined;
    })
    it('should handle comptime float in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.number).to.equal(1.23);
      expect(TagType(module.union_a)).to.equal(TagType.number);
      expect(() => module.union_a.state).to.be.null;
      expect(UnionA).to.be.undefined;
    })
    it('should handle comptime float in optional', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('in-optional');
      expect(module.optional1).to.equal(1234);
      expect(module.optional2).to.be.null;
    })
    it('should handle comptime float in error union', async function() {
      this.timeout(120000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union1).to.equal(1234);
      expect(() => module.error_union2).to.throw(Error.GoldfishDied);
    })
    it('should not compile code with comptime float vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}