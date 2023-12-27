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
  describe('Comptime int', function() {
    it('should import comptime int as variables', async function() {
      this.timeout(120000);
      const { small, negative, larger, pi } = await importTest('as-static-variables');
      expect(small).to.equal(127);
      expect(negative).to.equal(-167);
      expect(larger).to.equal(0x1234_5678);
    })
    it('should ignore a function accepting comptime int as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.undefined;
    })
    it('should ignore a function returning comptime int', async function() {
      this.timeout(120000);
      const { getComptimeInt } = await importTest('as-function-parameters');
      expect(getComptimeInt).to.undefined;
    })
    it('should handle comptime int in array', async function() {
      this.timeout(120000);
      const { array1, array2 } = await importTest('array-of');
      expect([ ...array1 ]).to.eql([ 1, 2, 3, 4 ]);
      expect([ ...array2 ]).to.eql([ 0x1000_0000_0000_0000n, 0x2000_0000_0000_0000n ]);
    })
    it('should handle comptime int in struct', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({ number1: 1, number2: 2 });
      expect(StructA).to.be.undefined;
      const [ line ] = await capture(() => print());
      expect(line).to.equal('in-struct.StructA{ .number1 = 1, .number2 = 2 }');
    })
    it('should handle comptime int in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.be.eventually.rejected;
    })
    it('should handle comptime int as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA } = await importTest('as-comptime-field');
      expect(module.struct_a.number).to.equal(1234);
      const b = new StructA({ state: false });
      expect(b.number).to.equal(1234);
    })
    it('should handle comptime int in bare union', async function() {
      this.timeout(120000);
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect(module.union_a.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => module.union_a.state).to.throw();
      }
      expect(UnionA).to.be.undefined;
    })
    it('should handle comptime int in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.number).to.equal(123);
      expect(TagType(module.union_a)).to.equal(TagType.number);
      expect(module.union_a.state).to.be.null;
      expect(UnionA).to.be.undefined;
    })
    it('should handle comptime int in optional', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('in-optional');
      expect(module.optional1).to.equal(1234);
      expect(module.optional2).to.be.null;
    })
    it('should handle comptime int in error union', async function() {
      this.timeout(120000);
      const { default: module, Error } = await importTest('in-error-union');
      expect(module.error_union1).to.equal(1234);
      expect(() => module.error_union2).to.throw(Error.GoldfishDied);
    })
    it('should not compile code with comptime int vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}