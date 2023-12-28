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
  describe('Type', function() {
    it('should import type as static variables', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-static-variables');
      const { Int32, Int128, Struct } = module;
      expect(Int32).to.be.a('function');
      const int32 = new Int32(undefined);
      int32.$ = 1234;
      expect(int32.$).to.equal(1234);
      expect(Int128).to.be.a('function');
      const int128 = new Int128(0n);
      int128.$ = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn;
      expect(int128.$).to.equal(0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn);
      const object = new Struct({});
      expect(object.number1).to.equal(123);
      expect(object.number2).to.equal(456);
    })
    it('should ignore a function accepting type as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.be.undefined;
    })
    it('should ignore a function returning type', async function() {
      this.timeout(120000);
      const { getType } = await importTest('as-return-value');
      expect(getType).to.be.undefined;
    })
    it('should handle type in array', async function() {
      this.timeout(120000);
      const { array } = await importTest('array-of');      
      expect(array.length).to.equal(4);
      for (const item of array) {
        expect(item).to.be.a('function');
      }
    })
    it('should ignore struct with type as member', async function() {
      this.timeout(120000);
      const { StructA } = await importTest('in-struct');
      expect(StructA).to.be.undefined;
    })
    it('should handle type in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle type as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA } = await importTest('as-comptime-field');
      expect(module.struct_a.Type).to.be.a('function');
      const b = new StructA({ number: 500 });
      expect(b.Type).to.be.a('function');
    })
    it('should handle type in bare union', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('in-tagged-union');
      expect(module.union_a.Type).to.be.a('function');
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
    })
    it('should handle type in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType } = await importTest('in-tagged-union');
      expect(module.union_a.Type).to.be.a('function');
      expect(TagType(module.union_a)).to.equal(TagType.Type);
      expect(module.union_a.number).to.be.null;
    })
    it('should handle type in optional', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('in-optional');
      expect(module.optional1).to.be.a('function');
      const [ line ] = await capture(() => print());
      expect(line).to.equal('bool');
      expect(module.optional2).to.be.null;
    })
    it('should handle type in error union', async function() {
      this.timeout(120000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union1).to.be.a('function');
      const [ line ] = await capture(() => print());
      expect(line).to.equal('bool');
      expect(() => module.error_union2).to.throw(Error.GoldfishDied);
    })
    it('should not compile code with type vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}

