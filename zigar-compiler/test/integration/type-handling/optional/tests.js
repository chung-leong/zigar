import { expect } from 'chai';
import { capture } from '../../test-utils.js';

export function addTests(importModule, options) {
  const { optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Optional', function() {
    this.timeout(0);
    it('should import optional as static variables', async function() {
      const { default: module, f64_empty, f64_value, print } = await importTest('as-static-variables');
      expect(module.i32_empty).to.be.null;
      expect(module.i32_value).to.be.equal(1234);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('1234');
      expect(() => module.i32_value = null).to.not.throw();
      expect(module.i32_value).to.be.null;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('null');
      expect(() => module.i32_value = 4567.8).to.not.throw();
      expect(module.i32_value).to.be.equal(4567);
      const [ afterThat ] = await capture(() => print());
      expect(afterThat).to.equal('4567');
      expect(module.bool_empty).to.be.null;
      expect(module.bool_value).to.be.equal(true);
      expect(f64_empty).to.be.null;
      expect(f64_value).to.equal(3.14);
      expect(() => module.f64_value = null).to.throw();
      expect(() => module.f64_empty = 3.14).to.throw();
      expect(JSON.stringify(module.bool_empty)).to.equal('null');
      expect(JSON.stringify(module.bool_value)).to.equal('true');
      expect(module.struct_empty).to.be.null;
      expect(module.struct_value).to.eql({ integer: 1234, boolean: true, decimal: 3.5 });
    })
    it('should print optional arguments', async function() {
      const { print } = await importTest('as-function-parameters');
      const lines = await capture(() => {
        print(221);
        print(null);
      });
      expect(lines).to.eql([
        '221',
        'null'
      ]);
    })
    it('should return optional', async function() {
      const { default: module } = await importTest('as-return-value');
      expect(module.getSomething()).to.equal(1234);
      expect(module.getNothing()).to.be.null;
    })
    it('should handle optional in array', async function() {
      const { default: module, print } = await importTest('array-of');
      expect([ ...module.array ]).to.eql([ 1, 2, null, 4 ]);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ 1, 2, null, 4 }');
      module.array[1] = null;
      module.array[2] = 3;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('{ 1, null, 3, 4 }');
    })
    it('should handle optional in struct', async function() {
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({ number1: null, number2: -444n });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ number1: 123, number2: null });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .number1 = null, .number2 = -444 }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .number1 = 123, .number2 = null }');
    })
    it('should handle optional in packed struct', async function() {
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle optional as comptime field', async function() {
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.number1).to.equal(5000);
      expect(module.struct_a.number2).to.equal(null);
      const b = new StructA({ state: true });
      expect(b.number1).to.equal(5000);
      expect(b.number2).to.equal(null);
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .state = true, .number1 = 5000, .number2 = null }');
    })
    it('should handle optional in bare union', async function() {
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect(module.union_a.number).to.equal(1234);
      if (runtimeSafety) {
        expect(() => module.union_a.state).to.throw();
      }
      const b = new UnionA({ number: null });
      const c = new UnionA({ state: false });
      expect(b.number).to.be.null;
      expect(c.state).to.be.false;
      if (runtimeSafety) {
        expect(() => c.number).to.throw();
      }
      module.union_a = b;
      expect(module.union_a.number).to.be.null;
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
    })
    it('should handle optional in tagged union', async function() {
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.number).to.equal(3456);
      expect(TagType(module.union_a)).to.equal(TagType.number);
      expect(module.union_a.state).to.be.null;
      const b = new UnionA({ number: null });
      const c = new UnionA({ state: false });
      expect(b.number).to.be.null;
      expect(c.state).to.false;
      expect(c.number).to.be.null;
      module.union_a = b;
      expect(module.union_a.number).to.be.null;
      module.union_a = c;
      expect(module.union_a.state).to.be.false;
      expect(module.union_a.number).to.be.null;
    })
    it('should handle optional in optional', async function() {
      const { default: module, print } = await importTest('in-optional');
      expect(module.optional).to.equal(3000);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('3000');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('null');
      module.optional = -4000;
      expect(module.optional).to.equal(-4000);
    })
    it('should handle optional in error union', async function() {
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union).to.equal(3000);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('3000');
      module.error_union = Error.GoldfishDied;
      expect(() => module.error_union).to.throw(Error.GoldfishDied);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('error.GoldfishDied');
      module.error_union = null;
      expect(module.error_union).to.be.null;
    })
    it('should handle optional in vector', async function() {
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}