import { expect } from 'chai';
import { capture } from '../test-utils.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Memory allocation', function() {
    it('should provide allocator to function returning string', async function() {
      this.timeout(300000);
      const { getMessage } = await importTest('allocate-memory-for-string');;
      const { string } = getMessage(123, 456n, 3.14);
      expect(string).to.equal('Numbers: 123, 456, 3.14');
    })
    it('should return memory from internal allocator', async function() {
      this.timeout(300000);
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
    it('should keep a usable copy of allocator', async function() {
      this.timeout(300000);
      const { create } = await importTest('retain-allocator');
      const copier = create();
      const copy1 = copier.dupe('Hello world');
      expect(copy1.string).to.equal('Hello world');
      const copy2 = copier.dupe('This is a test');
      expect(copy2.string).to.equal('This is a test');
    })
    it('should return a Zig allocator', async function() {
      this.timeout(300000);
      const { getAllocator } = await importTest('return-allocator');
      const allocator = getAllocator();
    })
  })
}