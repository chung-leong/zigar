import { expect, use } from 'chai';
import { chaiPromised } from 'chai-promised';
import { capture } from '../../capture.js';

use(chaiPromised);

export function addTests(importModule, options) {
  const { optimize, compilerVersion } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Comptime float', function() {
    it('should import comptime float as variables', async function() {
      this.timeout(300000);
      const { pi } = await importTest('as-static-variables');
      expect(pi.toFixed(4)).to.equal('3.1416');
      expect(JSON.stringify(pi)).to.equal('3.141592653589793');
    })
    it('should ignore a function accepting comptime float as arguments', async function() {
      this.timeout(300000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.undefined;
    })
    it('should ignore a function returning comptime float', async function() {
      this.timeout(300000);
      const { getComptimeFloat } = await importTest('as-function-parameters');
      expect(getComptimeFloat).to.undefined;
    })
    it('should handle comptime float in array', async function() {
      this.timeout(300000);
      const { array } = await importTest('array-of');
      expect([ ...array ]).to.eql([ 1.1, 2.1, 3.1, 4.1 ]);
    })
    it('should handle comptime float in struct', async function() {
      this.timeout(300000);
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({ number1: 1.1, number2: 2.2 });
      expect(() => new StructA({ number1: 1 })).to.throw(TypeError)
        .with.property('message').that.contains('Comptime');        
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ number1: 0.1, number2: 0.2 });
      const [ line ] = await capture(() => print());
      if (compilerVersion === '0.11.0') {
        expect(line).to.equal('in-struct.StructA{ .number1 = 1.1e+00, .number2 = 2.2e+00 }');
      } else {
        expect(line).to.equal('in-struct.StructA{ .number1 = 1.1e0, .number2 = 2.2e0 }');
      }
    })
    it('should handle comptime float in packed struct', async function() {
      this.timeout(300000);
      await expect(importTest('in-packed-struct')).to.be.eventually.rejected;
    })
    it('should handle comptime float as comptime field', async function() {
      this.timeout(300000);
      const { default: module, StructA } = await importTest('as-comptime-field');
      expect(module.struct_a.number).to.equal(1.234);
      const b = new StructA({ state: false });
      expect(b.number).to.equal(1.234);
    })
    it('should not compile code with comptime float in bare union', async function() {
      this.timeout(300000);
      await expect(importTest('in-bare-union')).to.eventually.be.rejected;
    })
    it('should handle comptime float in tagged union', async function() {
      this.timeout(300000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.number).to.equal(1.23);
      expect(TagType(module.union_a)).to.equal(TagType.number);
      expect(module.union_a.state).to.be.null;
      expect(() => new UnionA({ number: 0.1 })).to.throw(TypeError)
        .with.property('message').that.contains('Comptime');
      const b = new UnionA({ state: true });
      expect(b.valueOf()).to.eql({ state: true });
    })
    it('should handle comptime float in optional', async function() {
      this.timeout(300000);
      const { default: module } = await importTest('in-optional');
      expect(module.optional1).to.equal(1234);
      expect(module.optional2).to.be.null;
    })
    it('should handle comptime float in error union', async function() {
      this.timeout(300000);
      const { default: module, Error, error_union1, error_union2 } = await importTest('in-error-union');
      expect(module.error_union1).to.equal(1234);
      expect(error_union1).to.equal(1234);
      expect(error_union2).to.be.undefined;
      expect(() => module.error_union2).to.throw(Error.goldfish_died);
    })
    it('should not compile code with comptime float vector', async function() {
      this.timeout(300000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}