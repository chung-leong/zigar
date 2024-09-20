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
    it('should create object in fixed memory', async function() {
      this.timeout(300000);
      const { default: module, Struct, print } = await importTest('create-fixed-object');
      const [ before ] = await capture(() => print());
      expect(before).to.equal('empty');
      const notFixed = new Struct({ number1: 23, number2: 55 });
      expect(() => module.ptr_maybe = notFixed).to.throw(TypeError);
      const fixed = new Struct({ number1: 23, number2: 55 }, { fixed: true });
      expect(fixed.number1).to.equal(23);
      expect(fixed.number2).to.equal(55);
      expect(() => module.ptr_maybe = fixed).to.not.throw();
      const [ after ] = await capture(() => print());
      expect(after).to.equal('create-fixed-object.Struct{ .number1 = 23, .number2 = 55 }');
      fixed.delete();
      expect(() => fixed.number1).to.throw();
    })
  })
}