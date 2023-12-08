import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Int', function() {
    it('should import array as static variables', async function() {
      this.timeout(120000);
      const { 
        default: module, 
        float64_array4x4,
        array_a,
        array_b,
        print1, 
        print2,
      } = await importTest('as-static-variables');
      expect(module.int32_array4).to.be.an('[4]i32');
      expect(module.int32_array4.get(0)).to.equal(1);
      expect([ ...module.int32_array4 ]).to.eql([ 1, 2, 3, 4 ]);
      const [ before1 ] = await capture(() => print1());
      expect(before1).to.equal('{ 1, 2, 3, 4 }');
      module.int32_array4.set(1, 123);
      expect([ ...module.int32_array4 ]).to.eql([ 1, 123, 3, 4 ]);
      const [ after1 ] = await capture(() => print1());
      expect(after1).to.equal('{ 1, 123, 3, 4 }');
      expect(float64_array4x4).to.be.an('[4][4]f64');
      const row1 = float64_array4x4[1];
      expect(row1).to.be.an('[4]f64');
      expect(array_a.valueOf()).to.eql(
        [
          { number1: 1, number2: 2 },
          { number1: 3, number2: 4 },
          { number1: 5, number2: 6 },
          { number1: 7, number2: 8 },
        ]
      );
      expect(array_b.valueOf()).to.eql([
        { good: true, numbers: [ 1, 2, 3, 4 ] },
        { good: false, numbers: [ 3, 4, 5, 6 ] },
        { good: false, numbers: [ 2, 2, 7, 7 ] },
      ])
      const [ before2 ] = await capture(() => print2());
      expect(before2).to.equal('{ as-static-variables.StructA{ .number1 = 1, .number2 = 2 }, as-static-variables.StructA{ .number1 = 3, .number2 = 4 } }');
      module.array_c[1].number1 = 123;
      module.array_c[1].number2 = 456;
      const [ after2 ] = await capture(() => print2());
      expect(after2).to.equal('{ as-static-variables.StructA{ .number1 = 1, .number2 = 2 }, as-static-variables.StructA{ .number1 = 123, .number2 = 456 } }');
    })
  })
}