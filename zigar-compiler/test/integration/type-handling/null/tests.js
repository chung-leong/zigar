import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Null', function() {
    it('should handle null as static variables', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-static-variables');
      expect(module.weird).to.be.null;
      expect(JSON.stringify(module.weird)).to.equal('null');
    })
    it('should ignore a function accepting null as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.undefined;
    })
    it('should ignore a function returning null', async function() {
      this.timeout(120000);
      const { getNull } = await importTest('as-function-parameters');
      expect(getNull).to.undefined;
    })
    it('should handle null in array', async function() {
      this.timeout(120000);
      const { array } = await importTest('array-of');
      expect([ ...array ]).to.eql([ null, null, null, null ]);
    })
    it('should handle null in struct', async function() {
      this.timeout(120000);
      const { struct_a, print, StructA } = await importTest('in-struct');
      expect(struct_a.valueOf()).to.eql({ empty1: null, empty2: null, hello: 1234 });
      expect(() => new StructA({ empty1: undefined })).to.throw(TypeError)
        .with.property('message').that.contains('Comptime');
      const b = new StructA({ hello: 234 });
      expect(b.valueOf()).to.eql({ empty1: null, empty2: null, hello: 234 });
      const [ line ] = await capture(() => print());
      expect(line).to.equal('in-struct.StructA{ .empty1 = null, .empty2 = null, .hello = 1234 }');
    })
    it('should not compile code with null in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle null as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA } = await importTest('as-comptime-field');
      expect(module.struct_a.empty).to.be.null;
      const b = new StructA({ number: 500 });
      expect(b.empty).to.be.null;
    })
    it('should not compile code with null bare union', async function() {
      this.timeout(120000);
      await expect(importTest('in-bare-union')).to.eventually.be.rejected;
    })
    it('should not compile code with null tagged union', async function() {
      this.timeout(120000);
      this.timeout(120000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.empty).to.equal(null);
      expect(TagType(module.union_a)).to.equal(TagType.empty);
      expect(module.union_a.number).to.be.null;
      expect(() => new UnionA({ empty: null })).to.throw(TypeError)
        .with.property('message').that.contains('Comptime');
      const b = new UnionA({ number: 777 });
      expect(b.valueOf()).to.eql({ number: 777 });
    })
    it('should not compile code with null optional', async function() {
      this.timeout(120000);
      await expect(importTest('in-optional')).to.eventually.be.rejected;
    })
    it('should handle null in error union', async function() {
      this.timeout(120000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union1).to.be.null;
      expect(() => module.error_union2).to.throw(Error.goldfish_died);
      const [ text ] = await capture(() => print());
      expect(text).to.equal('null');
    })
    it('should not compile code with null vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}
