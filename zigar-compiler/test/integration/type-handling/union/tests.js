import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const { optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
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
      expect(module.variant_a.string.string).to.equal('apple');
      expect(module.variant_a.integer).to.be.null;
      expect(module.variant_a.float).to.be.null;
      expect(module.variant_b.integer).to.equal(123);
      expect(module.variant_c.float).to.equal(3.14);
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
      expect(module.variant_c.valueOf()).to.eql({ float: 3.14 });
      expect(JSON.stringify(module.variant_c)).to.equal('{"float":3.14}');
      expect(JSON.stringify(module.variant_a)).to.equal('{"string":[97,112,112,108,101]}');
      expect(module.extern_union.valueOf()).to.eql({ 
        dog: 100,
        cat: 100,
        pig: 4.94e-322,
      });
      expect(JSON.stringify(module.extern_union)).to.equal('{"dog":100,"cat":100,"pig":4.94e-322}');
    })
    it('should print union arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      const lines = await capture(() => {
        print({ integer: 200 });
        print({ float: 3.14 });
        print({ string: "Hello" })
      });
      expect(lines).to.eql([ 
        'as-function-parameters.Variant{ .integer = 200 }',
        'as-function-parameters.Variant{ .float = 3.14e+00 }', 
        'as-function-parameters.Variant{ .string = { 72, 101, 108, 108, 111 } }', 
      ]);
    })
    it('should return union', async function() {
      this.timeout(120000);
      const { getInteger, getFloat, getString } = await importTest('as-return-value');
      expect(getInteger().integer).to.equal(300);
      expect(getFloat().float).to.equal(3.14);
      expect(getFloat().integer).to.be.null;
      expect(getString().string.string).to.equal('Hello');
    })
    it('should handle union in array', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('array-of');      
      expect(module.array.length).to.equal(4);
      expect(module.array.valueOf()).to.eql([
        { integer: 123 },
        { float: 1.23 },
        { string: [ 119, 111, 114, 108, 100 ] },
        { integer: 777 }
      ]);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ array-of.Variant{ .integer = 123 }, array-of.Variant{ .float = 1.23e+00 }, array-of.Variant{ .string = { 119, 111, 114, 108, 100 } }, array-of.Variant{ .integer = 777 } }');
    })
    it('should handle union in struct', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.variant_a.valueOf()).to.eql({
        variant1: { float: 7.777 },
        variant2: { string: [ 72, 101, 108, 108, 111 ] }
      });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({
        variant1: { string: [ 119, 111, 114, 108, 100 ] },
        variant2: { float: 3.14 }
      });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .variant1 = in-struct.Variant{ .float = 7.777e+00 }, .variant2 = in-struct.Variant{ .string = { 72, 101, 108, 108, 111 } } }');
      module.variant_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .variant1 = in-struct.Variant{ .string = { 119, 111, 114, 108, 100 } }, .variant2 = in-struct.Variant{ .float = 3.14e+00 } }');
    })
    it('should not compile code with union in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle struct as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.valueOf()).to.eql({ number: 123, variant: { string: [ 119, 111, 114, 108, 100 ] } });
      const b = new StructA({ number: 500 });
      expect(b.variant.valueOf()).to.eql({ string: [ 119, 111, 114, 108, 100 ] });
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .number = 500, .variant = as-comptime-field.Variant{ .string = { 119, 111, 114, 108, 100 } } }');
    })
    it('should handle union in bare union', async function() {
      this.timeout(120000);
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect(() => module.union_a.variant.string.string).to.throw(TypeError).
        with.property('message').that.contains('Pointers within an untagged union are not accessible');
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
      const b = new UnionA({ variant: { float: 3.14 } });
      const c = new UnionA({ number: 123 });
      expect(b.variant.valueOf()).to.eql({ float: 3.14 });
      expect(c.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => c.variant).to.throw();
      }
      module.union_a = b;
      expect(module.union_a.variant.valueOf()).to.eql({ float: 3.14 });
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.variant).to.throw();
      }
    })
    it('should handle union in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.variant.valueOf()).to.eql({ string: [ 72, 101, 108, 108, 111 ] });
      expect(TagType(module.union_a)).to.equal(TagType.variant);
      expect(module.union_a.number).to.be.null;
      const b = new UnionA({ variant: { float: 3.14 } });
      const c = new UnionA({ number: 123 });
      expect(b.variant.valueOf()).to.eql({ float: 3.14 });
      expect(c.number).to.equal(123);
      expect(c.variant).to.be.null;
      module.union_a = b;
      expect(module.union_a.variant.valueOf()).to.eql({ float: 3.14 });
      module.union_a = c;
      expect(module.union_a.variant).to.be.null;
    })
    it('should handle union in optional', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('in-optional');
      expect(module.optional.integer).to.equal(100);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-optional.Variant{ .integer = 100 }');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('null');
      module.optional = { float: 3.14 };
      expect(module.optional.float).to.equal(3.14);
      expect(module.optional.integer).to.be.null;
    })
    it('should handle union in error union', async function() {
      this.timeout(120000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union.integer).to.equal(100);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-error-union.Variant{ .integer = 100 }');
      module.error_union = Error.goldfish_died;
      expect(() => module.error_union).to.throw(Error.goldfish_died);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('error.goldfish_died');
      module.error_union = { float: 3.14 };
      expect(module.error_union.float).to.equal(3.14);
      expect(module.error_union.integer).to.be.null;
    })
    it('should not compile code containing union vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;      
    })   
  })
}