import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { capture } from '../../capture.js';

use(ChaiAsPromised);

export function addTests(importModule, options) {
  const { optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Array', function() {
    it('should import array as static variables', async function() {
      this.timeout(120000);
      const { 
        default: module, 
        float64_array4x4,
        print,
      } = await importTest('as-static-variables');
      expect(module.int32_array4).to.be.an('[4]i32');
      expect(module.int32_array4.get(0)).to.equal(1);
      expect([ ...module.int32_array4 ]).to.eql([ 1, 2, 3, 4 ]);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ 1, 2, 3, 4 }');
      module.int32_array4.set(1, 123);
      expect([ ...module.int32_array4 ]).to.eql([ 1, 123, 3, 4 ]);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('{ 1, 123, 3, 4 }');
      expect(float64_array4x4).to.be.an('[4][4]f64');
      const row1 = float64_array4x4[1];
      expect(row1).to.be.an('[4]f64');
      expect(() => float64_array4x4[1][1] = 0).to.throw(TypeError);
      expect(module.int32_array4.valueOf()).to.eql([ 1, 123, 3, 4 ]);
      expect(JSON.stringify(module.int32_array4)).to.equal('[1,123,3,4]');
      expect(float64_array4x4.valueOf()).to.eql([
        [ 1.1, 1.2, 1.3, 1.4 ],
        [ 2.1, 2.2, 2.3, 2.4 ],
        [ 3.1, 3.2, 3.3, 3.4 ],
        [ 4.1, 4.2, 4.3, 4.4 ],
      ]);
      expect(JSON.stringify(float64_array4x4)).to.equal('[[1.1,1.2,1.3,1.4],[2.1,2.2,2.3,2.4],[3.1,3.2,3.3,3.4],[4.1,4.2,4.3,4.4]]');
    })
    it('should print array arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      const lines = await capture(() => print([ 1.1, 2.2, 3.3, 4.4 ]));
      expect(lines).to.eql([ '{ 1.1e+00, 2.2e+00, 3.3e+00, 4.4e+00 }' ]);
    })
    it('should return array', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-return-value');
      expect([ ...module.getArray() ]).to.eql([ 1, 2, 3, 4 ]);
    })
    it('should handle array in array', async function() {
      this.timeout(120000);
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
    it('should handle array in struct', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({ 
        array1: [ 10, 20, 30, 40 ], 
        array2: [ 11, 21, 31, 41 ], 
      });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ 
        array1: [ 1, 2, 3, 4 ],
        array2: [ 5, 6, 7, 8 ],
      });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .array1 = { 10, 20, 30, 40 }, .array2 = { 11, 21, 31, 41 } }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .array1 = { 1, 2, 3, 4 }, .array2 = { 5, 6, 7, 8 } }');
    })
    it('should should not compile code with array in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle array as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect([ ...module.struct_a.array ]).to.eql([ 1, 2, 3, 4 ]);
      const b = new StructA({ number: 500 });
      expect(b.number).to.to.equal(500);
      expect([ ...b.array ]).to.to.eql([ 1, 2, 3, 4 ]);
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .number = 500, .array = { 1, 2, 3, 4 } }');
    })
    it('should handle array in bare union', async function() {
      this.timeout(120000);
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect([ ...module.union_a.array ]).to.eql([ 1, 2, 3, 4 ]);
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
      const b = new UnionA({ array: [ 5, 6, 7, 8 ] });
      const c = new UnionA({ number: 123 });
      expect([ ...b.array ]).to.eql([ 5, 6, 7, 8 ]);
      expect(c.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => c.array).to.throw();
      }
      module.union_a = b;
      expect([ ...module.union_a.array ]).to.eql([ 5, 6, 7, 8 ]);
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.array).to.throw();
      }
    })
    it('should handle array in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect([ ...module.union_a.array ]).to.eql([ 1, 2, 3, 4 ]);
      expect(TagType(module.union_a)).to.equal(TagType.array);
      expect(module.union_a.number).to.be.null;
      const b = new UnionA({ array: [ 5, 6, 7, 8 ] });
      const c = new UnionA({ number: 123 });
      expect([ ...b.array ]).to.eql([ 5, 6, 7, 8 ]);
      expect(c.number).to.equal(123);
      expect(c.array).to.be.null;
      module.union_a = b;
      expect([ ...module.union_a.array ]).to.eql([ 5, 6, 7, 8 ]);
      module.union_a = c;
      expect(module.union_a.array).to.be.null;
    })
    it('should handle array in optional', async function() {
      this.timeout(120000);
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
    it('should handle array in error union', async function() {
      this.timeout(120000);
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
    it('should not compile code containing vector of arrays', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;      
    })
  })
}