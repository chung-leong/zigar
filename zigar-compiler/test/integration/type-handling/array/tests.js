import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
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
    })
  })
}