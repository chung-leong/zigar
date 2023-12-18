import { expect } from 'chai';

export function addTests(importModule, options) {
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(options.optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Undefined', function() {
    it('should handle undefined as static variables', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-static-variables');
      expect(module.weird).to.be.undefined;
    })
    it('should ignore a function accepting undefined as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.be.undefined;
    })
    it('should ignore a function returning undefined', async function() {
      this.timeout(120000);
      const { getUndefined } = await importTest('as-return-value');
      expect(getUndefined).to.be.undefined;
    })
    it('should not compile when there is an array of undefineds', async function() {
      this.timeout(120000);
      await expect(importTest('array-of')).to.eventually.be.rejected;
    })
    it('should handle undefined in struct', async function() {
      this.timeout(120000);
      const { default: module, StructA } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({ empty1: undefined, empty2: undefined });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ empty1: undefined, empty2: undefined });
    })
    it('should not compile code with undefined in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle undefined as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA } = await importTest('as-comptime-field');
      expect(module.struct_a.empty).to.be.undefined;
      const b = new StructA({ number: 500 });
      expect(b.empty).to.be.undefined;
    })
    it('should handle undefined in bare union', async function() {
      this.timeout(120000);
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect(module.union_a.empty).to.be.undefined;
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
      const b = new UnionA({ empty: undefined });
      const c = new UnionA({ number: 123 });
      expect(b.empty).to.be.undefined;
      expect(c.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => c.empty).to.throw();
      }
      module.union_a = b;
      expect(module.union_a.empty).to.be.undefined;
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.empty).to.throw();
      }
    })
    it('should handle undefined in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.empty).to.be.undefined;
      expect(TagType(module.union_a)).to.equal(TagType.empty);
      expect(module.union_a.number).to.be.null;
      const b = new UnionA({ empty: undefined });
      const c = new UnionA({ number: 123 });
      expect(b.empty).to.be.undefined;
      expect(c.number).to.equal(123);
      expect(c.empty).to.be.null;
      module.union_a = b;
      expect(module.union_a.empty).to.be.undefined;
      module.union_a = c;
      expect(module.union_a.empty).to.be.null;
    })
    it('should not compile code with undefined optional', async function() {
      this.timeout(120000);
      await expect(importTest('in-optional')).to.eventually.be.rejected;
    })
    it('should not compile code with undefined error union', async function() {
      this.timeout(120000);
      await expect(importTest('in-error-union')).to.eventually.be.rejected;
    })
    it('should not compile code with undefined vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}
