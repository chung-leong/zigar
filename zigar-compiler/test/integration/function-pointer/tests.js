import { expect } from 'chai';
import 'mocha-skip-if';
import { capture } from '../test-utils.js';

export function addTests(importModule, options) {
  const { target, optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name, options) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url, options);
  };
  describe('Function pointer', function() {
    it('should correctly free function thunks', async function() {
      this.timeout(300000);
      const { Callback, release } = await importTest('function-pointer');
      const list = [];
      const addresses = [];
      for (let i = 0; i < 256; i++) {
        const f = new Callback(() => {});
        list.push(f);
        const [ MEMORY ] = Object.getOwnPropertySymbols(f);
        const dv = f[MEMORY];
        const [ ZIG ] = Object.getOwnPropertySymbols(dv);
        addresses.push(dv[ZIG].address);
      }
      for (const [ i, f ] of list.entries()) {
        // don't delete the first one so the initial page is kept
        if (i !== 0) {
          release(f);
        }
      }
      let reuseCount = 0;
      for (let i = 0; i < 256; i++) {
        const f = new Callback(() => {});
        list.push(f);
        const [ MEMORY ] = Object.getOwnPropertySymbols(f);
        const dv = f[MEMORY];
        const [ ZIG ] = Object.getOwnPropertySymbols(dv);
        const { address } = dv[ZIG];
        if (addresses.includes(address)) {
          reuseCount++;
        }
      }
      expect(reuseCount).to.be.above(100);
    })
    it('should correctly pass floating point arguments', async function() {
      this.timeout(300000);
      const { call } = await importTest('floating-point-arguments');
      const f = (a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12) => {
        return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12;
      };
      const result = call(f);
      expect(result.toFixed(1)).to.equal(`${0.1 + 0.2 + 0.3 + 0.4 + 0.5 + 0.6 + 0.7 + 0.8 + 0.9 + 1.0 + 1.1 + 1.2}`);
    })
    it('should correctly pass struct arguments', async function() {
      this.timeout(300000);
      const { call } = await importTest('struct-arguments');
      let object;
      const f = (b) => {
        object = b.valueOf();
        return b.a;
      };
      const result = call(f);
      expect(object).to.eql({ a: { number1: 123, number2: 456 }, b: 3.141592653589793 });
      expect(result.valueOf()).to.eql({ number1: 123, number2: 456 });
    })
    it('should correctly pass array arguments', async function() {
      this.timeout(300000);
      const { call } = await importTest('array-arguments');
      let array1, array2;
      const f = (a, b) => {
        array1 = [ ...a ];
        array2 = [ ...b ];
      };
      call(f);
      expect(array1).to.eql([ 123, 456, 789 ]);
      expect(array2).to.eql([ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2 ]);
    })
    it('should correctly pass slice arguments', async function() {
      this.timeout(300000);
      const { call } = await importTest('slice-arguments');
      let array;
      const f = (a) => {
        array = [ ...a ];
      };
      call(f);
      expect(array).to.eql([ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2 ]);
    })
    it('should correctly pass allocator as argument and return a new slice', async function() {
      this.timeout(300000);
      const { printString, printArray } = await importTest('returning-slice');
      const f1 = ({ allocator }) => {
        return allocator.dupe('Hello world!');
      };
      const [ line1 ] = await capture(() => {
        printString(f1);
      });
      expect(line1).to.equal('Hello world!');
      const f2 = ({ allocator }) => {
        return allocator.dupe(new Float64Array([ 1, 2, 3, 4 ]));
      };
      const [ line2 ] = await capture(() => {
        printArray(f2);
      });
      expect(line2).to.equal('{ 1e0, 2e0, 3e0, 4e0 }');
    })
  })
}