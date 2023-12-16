import { expect } from 'chai';
import { capture } from '../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Memory allocation', function() {
    it('should return memory from internal allocator', async function() {
      this.timeout(120000);
      const { createSlice, printSlice, freeSlice } = await importTest('create-internal-slice');
      for (let i = 0; i < 10; i++) {
        const slice = createSlice(16);
        for (let i = 0, { length, set } = slice; i < length; i++) {
          set(i, (i + 1) * 10);
        }
        const lines = await capture(() => {
          printSlice(slice);
        });
        expect(lines).to.eql([
          '10', '20', '30', '40',
          '50', '60', '70', '80',
          '90', '100', '110', '120',
          '130', '140', '150', '160',
        ]);
        expect(() => freeSlice(slice)).to.not.throw();
      }
    })
  })
}