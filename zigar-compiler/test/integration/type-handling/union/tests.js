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
      expect(module.array.length).to.equal(4);
      expect(module.array.valueOf()).to.eql([
        { Integer: 123 },
        { Float: 1.23 },
        { String: [ 119, 111, 114, 108, 100 ] },
        { Integer: 777 }
      ]);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ array-of.Variant{ .Integer = 123 }, array-of.Variant{ .Float = 1.23e+00 }, array-of.Variant{ .String = { 119, 111, 114, 108, 100 } }, array-of.Variant{ .Integer = 777 } }');
    })
    it('should handle union in struct', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.variant_a.valueOf()).to.eql({
        variant1: { Float: 7.777 },
        variant2: { String: [ 72, 101, 108, 108, 111 ] }
      });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({
        variant1: { String: [ 119, 111, 114, 108, 100 ] },
        variant2: { Float: 3.14 }
      });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .variant1 = in-struct.Variant{ .Float = 7.777e+00 }, .variant2 = in-struct.Variant{ .String = { 72, 101, 108, 108, 111 } } }');
      module.variant_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .variant1 = in-struct.Variant{ .String = { 119, 111, 114, 108, 100 } }, .variant2 = in-struct.Variant{ .Float = 3.14e+00 } }');
    })
    it('should not compile code with union in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle struct as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.valueOf()).to.eql({ number: 123, variant: { String: [ 119, 111, 114, 108, 100 ] } });
      const b = new StructA({ number: 500 });
      expect(b.variant.valueOf()).to.eql({ String: [ 119, 111, 114, 108, 100 ] });
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .number = 500, .variant = as-comptime-field.Variant{ .String = { 119, 111, 114, 108, 100 } } }');
    })
    it('should handle union in bare union', async function() {
      this.timeout(120000);
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect(() => module.union_a.variant.valueOf()).to.throw(TypeError).
        with.property('message').that.contains('Pointers within an untagged union are not accessible');
      expect(() => module.union_a.variant.String.string).to.throw(TypeError).
        with.property('message').that.contains('Pointers within an untagged union are not accessible');
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
      const b = new UnionA({ variant: { Float: 3.14 } });
      const c = new UnionA({ number: 123 });
      expect(b.variant.valueOf()).to.eql({ Float: 3.14 });
      expect(c.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => c.variant).to.throw();
      }
      module.union_a = b;
      expect(module.union_a.variant.valueOf()).to.eql({ Float: 3.14 });
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.variant).to.throw();
      }
    })
    it('should handle union in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.variant.valueOf()).to.eql({ String: [ 72, 101, 108, 108, 111 ] });
      expect(TagType(module.union_a)).to.equal(TagType.variant);
      expect(module.union_a.number).to.be.null;
      const b = new UnionA({ variant: { Float: 3.14 } });
      const c = new UnionA({ number: 123 });
      expect(b.variant.valueOf()).to.eql({ Float: 3.14 });
      expect(c.number).to.equal(123);
      expect(c.variant).to.be.null;
      module.union_a = b;
      expect(module.union_a.variant.valueOf()).to.eql({ Float: 3.14 });
      module.union_a = c;
      expect(module.union_a.variant).to.be.null;
    })
    it('should handle union in optional', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('in-optional');
      expect(module.optional.Integer).to.equal(100);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-optional.Variant{ .Integer = 100 }');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('null');
      module.optional = { Float: 3.14 };
      expect(module.optional.Float).to.equal(3.14);
      expect(module.optional.Integer).to.be.null;
    })
    it('should handle union in error union', async function() {
      this.timeout(120000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union.Integer).to.equal(100);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-error-union.Variant{ .Integer = 100 }');
      module.error_union = Error.GoldfishDied;
      expect(() => module.error_union).to.throw(Error.GoldfishDied);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('error.GoldfishDied');
      module.error_union = { Float: 3.14 };
      expect(module.error_union.Float).to.equal(3.14);
      expect(module.error_union.Integer).to.be.null;
    })
    it('should not compile code containing union vector', async function() {
      await expect(importTest('vector-of')).to.eventually.be.rejected;      
    })   
  })
}