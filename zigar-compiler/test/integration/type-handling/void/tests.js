import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { capture } from '../../test-utils.js';

use(chaiAsPromised);

export function addTests(importModule, options) {
  const { optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Void', function() {
    it('should handle void as static variables', async function() {
      this.timeout(300000);
      const { default: module } = await importTest('as-static-variables');
      expect(module.empty).to.be.undefined;
      expect(JSON.stringify(module.empty)).to.equal(undefined);
    })
    it('should print void arguments', async function() {
      this.timeout(300000);
      const { print } = await importTest('as-function-parameters');
      const lines = await capture(() => print(undefined));
      expect(lines).to.eql([ 'void' ]);
    })
    it('should return void', async function() {
      this.timeout(300000);
      const { getVoid } = await importTest('as-return-value');
      expect(getVoid()).to.equal(undefined);
    })
    it('should handle void in array', async function() {
      this.timeout(300000);
      const { array, print } = await importTest('array-of');
      expect(array.length).to.equal(4);
      expect([ ...array ]).to.eql([ undefined, undefined, undefined, undefined ]);
      const [ line ] = await capture(() => print());
      expect(line).to.equal('{ void, void, void, void }');
    })
    it('should handle void in struct', async function() {
      this.timeout(300000);
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({ empty1: undefined, empty2: undefined });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ empty1: undefined, empty2: undefined });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .empty1 = void, .empty2 = void }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .empty1 = void, .empty2 = void }');
    })
    it('should handle void in packed struct', async function() {
      this.timeout(300000);
      const { default: module, StructA, print } = await importTest('in-packed-struct');
      expect(module.struct_a.valueOf()).to.eql({ empty1: undefined, empty2: undefined, number: 200, empty3: undefined });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ empty1: undefined, empty2: undefined, number: 100, empty3: undefined });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-packed-struct.StructA{ .empty1 = void, .empty2 = void, .number = 200, .empty3 = void }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-packed-struct.StructA{ .empty1 = void, .empty2 = void, .number = 100, .empty3 = void }');
    })
    it('should handle void as comptime field', async function() {
      this.timeout(300000);
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.empty).to.be.undefined;
      const b = new StructA({ number: 500 });
      expect(b.empty).to.be.undefined;
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .number = 500, .empty = void }');
    })
    it('should handle void in bare union', async function() {
      this.timeout(300000);
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
    it('should handle void in tagged union', async function() {
      this.timeout(300000);
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
    it('should handle void in optional', async function() {
      this.timeout(300000);
      const { default: module, print } = await importTest('in-optional');
      expect(module.optional).to.be.undefined;
      const [ before ] = await capture(() => print());
      expect(before).to.equal('void');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('null');
      module.optional = undefined;
      expect(module.optional).to.be.undefined;
    })
    it('should handle void in error union', async function() {
      this.timeout(300000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union).to.be.undefined;
      const [ before ] = await capture(() => print());
      expect(before).to.equal('void');
      module.error_union = Error.GoldfishDied;
      expect(() => module.error_union).to.throw(Error.GoldfishDied);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('error.GoldfishDied');
      module.error_union = undefined;
      expect(module.error_union).to.be.undefined;
    })
    it('should not compile code containing void vector', async function() {
      this.timeout(300000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}
