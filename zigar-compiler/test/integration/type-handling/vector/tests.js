import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { capture } from '../../test-utils.js';

use(chaiAsPromised);

export function addTests(importModule, options) {
  const { optimize, compilerVersion } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Vector', function() {
    this.timeout(0);
    it('should handle vector as static variables', async function() {
      const { default: module } = await importTest('as-static-variables');
      expect([ ...module.v1 ]).to.eql([ 1, 2, 3, 4 ]);
      module.v2 = [ 4, 5, 6 ];
      expect([ ...module.v2 ]).to.eql([ 4, 5, 6 ]);
      const lines = await capture(() => module.print());
      expect(lines).to.eql([ '{ 4, 5, 6 }' ]);
      expect(module.v1.valueOf()).to.eql([ 1, 2, 3, 4 ]);
      expect(JSON.stringify(module.v1)).to.equal('[1,2,3,4]');
    })
    it('should print vector arguments', async function() {
      const { print } = await importTest('as-function-parameters');
      const lines = await capture(() => print([ 1.1, 2.2, 3.3, 4.4 ]));
      if (compilerVersion === '0.11.0') {
        expect(lines).to.eql([ '{ 1.1e+00, 2.2e+00, 3.3e+00, 4.4e+00 }' ]);
      } else {
        expect(lines).to.eql([ '{ 1.1e0, 2.2e0, 3.3e0, 4.4e0 }' ]);
      }
    })
    it('should return vector', async function() {
      const { default: module } = await importTest('as-return-value');
      expect([ ...module.getVector() ]).to.eql([ 1, 2, 3, 4 ]);
    })
    it('should handle vector in array', async function() {
      const { array, print } = await importTest('array-of');
      expect(array.length).to.equal(2);
      expect([
        [ ...array[0] ],
        [ ...array[1] ],
      ]).to.eql([
        [ 1, 2, 3, 4 ],
        [ 2, 3, 4, 5 ]
      ]);
      const [ line ] = await capture(() => print());
      expect(line).to.equal('{ { 1, 2, 3, 4 }, { 2, 3, 4, 5 } }');
    })
    it('should handle vector in struct', async function() {
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({
        vector1: [ 10, 20, 30, 40 ],
        vector2: [ 11, 21, 31, 41 ],
      });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({
        vector1: [ 1, 2, 3, 4 ],
        vector2: [ 5, 6, 7, 8 ],
      });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .vector1 = { 10, 20, 30, 40 }, .vector2 = { 11, 21, 31, 41 } }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .vector1 = { 1, 2, 3, 4 }, .vector2 = { 5, 6, 7, 8 } }');
    })
    it('should handle vector in packed struct', async function() {
      const { default: module } = await importTest('in-packed-struct');
      expect(() => module.struct_a.valueOf()).to.throw(TypeError);
    })
    it('should handle vector as comptime field', async function() {
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect([ ...module.struct_a.vector ]).to.eql([ 1, 2, 3, 4 ]);
      const b = new StructA({ number: 500 });
      expect(b.number).to.to.equal(500);
      expect([ ...b.vector ]).to.to.eql([ 1, 2, 3, 4 ]);
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .number = 500, .vector = { 1, 2, 3, 4 } }');
    })
    it('should handle vector in bare union', async function() {
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect([ ...module.union_a.vector ]).to.eql([ 1, 2, 3, 4 ]);
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
      const b = new UnionA({ vector: [ 5, 6, 7, 8 ] });
      const c = new UnionA({ number: 123 });
      expect([ ...b.vector ]).to.eql([ 5, 6, 7, 8 ]);
      expect(c.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => c.vector).to.throw();
      }
      module.union_a = b;
      expect([ ...module.union_a.vector ]).to.eql([ 5, 6, 7, 8 ]);
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.vector).to.throw();
      }
    })
    it('should handle vector in tagged union', async function() {
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect([ ...module.union_a.vector ]).to.eql([ 1, 2, 3, 4 ]);
      expect(TagType(module.union_a)).to.equal(TagType.vector);
      expect(module.union_a.number).to.be.null;
      const b = new UnionA({ vector: [ 5, 6, 7, 8 ] });
      const c = new UnionA({ number: 123 });
      expect([ ...b.vector ]).to.eql([ 5, 6, 7, 8 ]);
      expect(c.number).to.equal(123);
      expect(c.vector).to.be.null;
      module.union_a = b;
      expect([ ...module.union_a.vector ]).to.eql([ 5, 6, 7, 8 ]);
      module.union_a = c;
      expect(module.union_a.vector).to.be.null;
    })
    it('should handle vector in optional', async function() {
      const { default: module, print } = await importTest('in-optional');
      expect([ ...module.optional ]).to.be.eql([ 1, 2, 3, 4 ]);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ 1, 2, 3, 4 }');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('null');
      module.optional = [ 5, 6, 7, 8 ];
      expect([ ...module.optional ]).to.be.eql([ 5, 6, 7, 8 ]);
    })
    it('should handle vector in error union', async function() {
      const { default: module, Error, print } = await importTest('in-error-union');
      expect([ ...module.error_union ]).to.eql([ 1, 2, 3, 4 ]);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ 1, 2, 3, 4 }');
      module.error_union = Error.GoldfishDied;
      expect(() => module.error_union).to.throw(Error.GoldfishDied);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('error.GoldfishDied');
      module.error_union = [ 5, 6, 7, 8 ];
      expect([ ...module.error_union ]).to.eql([ 5, 6, 7, 8 ]);
    })
    it('should not compile code containing vector of vectors', async function() {
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}
