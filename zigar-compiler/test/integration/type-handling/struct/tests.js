import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Struct', function() {
    it('should import struct as static variables', async function() {
      this.timeout(120000);
      const { default: module, constant, comptime_struct, print } = await importTest('as-static-variables');
      expect(constant.valueOf()).to.eql({ number1: 123, number2: 456 });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('as-static-variables.StructA{ .number1 = 1, .number2 = 2 }');
      module.variable.number1 = 777;
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('as-static-variables.StructA{ .number1 = 777, .number2 = 2 }');
      module.variable = { number1: 888, number2: 999 };
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('as-static-variables.StructA{ .number1 = 888, .number2 = 999 }');
      expect(comptime_struct.input.src.channels).to.equal(4);
      expect(() => comptime_struct.input.src.channels = 5).to.throw(Error);
      expect(() => comptime_struct.input.src = { channels: 5 }).to.throw(Error);
      expect(() => comptime_struct.input = { src: { channels: 5 } }).to.throw(Error);
    })
    it('should handle struct in array', async function() {
      this.timeout(120000);
      const { 
        default: module, 
        array_a,
        array_b,
        print, 
      } = await importTest('array-of');
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
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ array-of.StructA{ .number1 = 1, .number2 = 2 }, array-of.StructA{ .number1 = 3, .number2 = 4 } }');
      module.array_c[1].number1 = 123;
      module.array_c[1].number2 = 456;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('{ array-of.StructA{ .number1 = 1, .number2 = 2 }, array-of.StructA{ .number1 = 123, .number2 = 456 } }');
    })
  })
}