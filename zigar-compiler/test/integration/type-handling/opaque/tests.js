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
  describe('Opaque', function() {
    it('should import opaque pointer as static variables', async function() {
      this.timeout(300000);
      const { default: module, Orange, Apple, print } = await importTest('as-static-variables');
      expect(Orange).to.be.a('function');
      expect(Apple).to.be.a('function');
      expect(() => new Orange()).to.throw();
      expect(() => new Apple()).to.throw();
      const dv1 = module.int_ptr.dataView;
      const dv2 = module.orange_ptr.dataView;
      expect(dv1.byteLength).to.equal(4);
      expect(dv2.byteLength).to.equal(0);
      expect(dv1.buffer).to.equal(dv2.buffer);
    })
    it('should print opaque pointer arguments', async function() {
      this.timeout(300000);
      const { default: module, print } = await importTest('as-function-parameters');
      const [ line ] = await capture(() => print(module.orange_ptr));
      expect(line).to.equal('Value = 1234');
    })
    it('should return opaque pointer', async function() {
      this.timeout(300000);
      const { create, print } = await importTest('as-return-value');
      const s = create(123, 456);
      const [ line ] = await capture(() => print(s));
      expect(line).to.equal('as-return-value.Struct{ .number1 = 123, .number2 = 456 }');
    })
    it('should handle opaque pointer in array', async function() {
      this.timeout(300000);
      const { default: module, Opaque, print } = await importTest('array-of');
      expect(module.array.length).to.equal(4);
      expect(module.array[0]['*']).to.be.instanceOf(Opaque);
      expect(module.array[1]['*']).to.be.instanceOf(Opaque);
      expect(module.array[2]['*']).to.be.instanceOf(Opaque);
      expect(module.array[3]['*']).to.be.instanceOf(Opaque);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ 123, 345, 567, 789 }');
      module.array[2] = module.alt_ptr;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('{ 123, 345, 5555, 789 }');
    })
    it('should handle opaque pointer in struct', async function() {
      this.timeout(300000);
      const { default: module, StructA, Opaque, print } = await importTest('in-struct');
      expect(module.struct_a.ptr1['*']).to.be.instanceOf(Opaque);
      expect(module.struct_a.ptr2['*']).to.be.instanceOf(Opaque);
      const b = new StructA({});
      expect(b.ptr1['*']).to.be.instanceOf(Opaque);
      expect(b.ptr2['*']).to.be.instanceOf(Opaque);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('8888 9999');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('1234 4567');
    })
    it('should not compile code with opaque pointer in packed struct', async function() {
      this.timeout(300000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    });
    it('should handle opaque pointer as comptime field', async function() {
      this.timeout(300000);
      const { default: module, StructA, Opaque, print } = await importTest('as-comptime-field');
      expect(module.struct_a.ptr['*']).to.be.instanceOf(Opaque);
      const b = new StructA({ number: 500 });
      expect(b.ptr['*']).to.be.instanceOf(Opaque);
      const [ line ] = await capture(() => print(b));
      expect(line).to.contain('as-comptime-field.StructA{ .number = 500, .ptr = as-comptime-field.Opaque@');
    })
    it('should handle opaque pointer in bare union', async function() {
      this.timeout(300000);
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect(() => module.union_a.ptr['*']).to.throw(TypeError)
        .with.property('message').that.contains('untagged union');
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
      expect(() => new UnionA({ ptr: module.alt_ptr })).to.throw(TypeError)
        .with.property('message').that.contains('untagged union');
      const c = new UnionA({ number: 123 });
      expect(c.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => c.ptr['*']).to.throw();
      }
      module.union_a = c;
      expect(module.union_a.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => module.union_a.ptr).to.throw();
      }
    })
    it('should handle opaque pointer in tagged union', async function() {
      this.timeout(300000);
      const { default: module, TagType, UnionA, Opaque, print } = await importTest('in-tagged-union');
      expect(module.union_a.ptr['*']).to.be.instanceOf(Opaque);
      expect(TagType(module.union_a)).to.equal(TagType.ptr);
      expect(module.union_a.number).to.be.null;
      const [ before ] = await capture(() => print());
      expect(before).to.equal('Value = 1234');
      const b = new UnionA({ ptr: module.alt_ptr });
      const c = new UnionA({ number: 123 });
      expect(b.ptr['*']).to.be.instanceOf(Opaque);
      expect(c.number).to.equal(123);
      expect(c.ptr).to.be.null;
      module.union_a = b;
      expect(module.union_a.ptr['*']).to.be.instanceOf(Opaque);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('Value = 4567');
      module.union_a = c;
      expect(module.union_a.ptr).to.be.null;
    })
    it('should handle opaque pointer in optional', async function() {
      this.timeout(300000);
      const { default: module, Opaque, print } = await importTest('in-optional');
      expect(module.optional['*']).to.be.instanceOf(Opaque);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('1234');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('null');
      module.optional = module.alt_ptr;
      expect(module.optional['*']).to.be.instanceOf(Opaque);
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('4567');
    })
    it('should handle opaque pointer in error union', async function() {
      this.timeout(300000);
      const { default: module, Error, Opaque, print } = await importTest('in-error-union');
      expect(module.error_union['*']).to.be.instanceOf(Opaque);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('1234');
      module.error_union = Error.goldfish_died;
      expect(() => module.error_union).to.throw(Error.goldfish_died);
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('error.goldfish_died');
      module.error_union = module.alt_ptr;
      expect(module.error_union['*']).to.be.instanceOf(Opaque);
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('4567');
    })
    it('should not compile code containing opaque pointer vector', async function() {
      this.timeout(300000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}
