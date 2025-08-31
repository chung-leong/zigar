import { expect } from 'chai';
import 'mocha-skip-if';
import { arch, platform } from 'os';
import { capture, delay } from '../test-utils.js';

export function addTests(importModule, options) {
  const { target, optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name, options) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url, options);
  };
  describe('Function pointer', function() {
    it('should correctly pass floating point arguments', async function() {
      this.timeout(0);
      const { call } = await importTest('floating-point-arguments');
      const f = (a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12) => {
        return a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8 + a9 + a10 + a11 + a12;
      };
      const result = call(f);
      expect(result.toFixed(1)).to.equal(`${0.1 + 0.2 + 0.3 + 0.4 + 0.5 + 0.6 + 0.7 + 0.8 + 0.9 + 1.0 + 1.1 + 1.2}`);
    })
    it('should correctly pass struct arguments', async function() {
      this.timeout(0);
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
      this.timeout(0);
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
      this.timeout(0);
      const { call } = await importTest('slice-arguments');
      let array;
      const f = (a) => {
        array = [ ...a ];
      };
      call(f);
      expect(array).to.eql([ 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2 ]);
    })
    it('should correctly pass string arguments', async function() {
      this.timeout(0);
      const { call } = await importTest('string-arguments');
      let string;
      const f = (s) => {
        string = s;
      };
      call(f);
      expect(string).to.equal('Hello world');
    })
    it('should correctly pass allocator as argument and return a new slice', async function() {
      this.timeout(0);
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
    it('should correctly pass abort signal as argument', async function() {
      this.timeout(0);
      const { call } = await importTest('abort-signal', { multithreaded: true });
      let aborted = false;
      const f = ({ signal }) => signal.addEventListener('abort', () => aborted = true);
      call(f);
      await delay(250);
      expect(aborted).to.be.true;
    })
    it('should correctly pass promise as argument', async function() {
      this.timeout(0);
      const { call, JSError } = await importTest('promise');
      const f1 = ({ callback }) => callback(55);
      const [ line1 ] = await capture(() => call(f1));
      expect(line1).to.equal('number = 1234, value = 55');
      const f2 = ({ callback }) => callback(null, 55);
      const [ line2 ] = await capture(() => call(f2));
      expect(line2).to.equal('number = 1234, value = 55');
      const f3 = ({ callback }) => callback(JSError.Unexpected);
      const [ line3 ] = await capture(() => call(f3));
      expect(line3).to.equal('number = 1234, error = Unexpected');
      const f4 = async () => 123;
      const [ line4 ] = await capture(() => call(f4));
      expect(line4).to.equal('number = 1234, value = 123');
      const f5 = async () => { throw JSError.Unexpected };
      const [ line5 ] = await capture(async () => {
        call(f5);
        // wait for invocation of promise callback
        await delay(10);
      });
      expect(line5).to.equal('number = 1234, error = Unexpected');
      const f6 = async () => { throw new Error('Unexpected') };
      const [ line6 ] = await capture(async () => {
        call(f6);
        await delay(10);
      });
      expect(line6).to.equal('number = 1234, error = Unexpected');
      const f7 = async () => { throw new Error('Doh!') };
      const [ line7 ] = await capture(async () => {
        call(f7);
        await delay(10);
      });
      expect(line7).to.equal('number = 1234, error = Unexpected');
    })
    it('should correctly pass allocator and promise as arguments', async function() {
      this.timeout(0);
      const { call } = await importTest('promise-with-allocator');
      const f1 = async () => 'Hello world';
      const [ line1 ] = await capture(() => call(f1));
      expect(line1).to.equal('value = Hello world');
      const f2 = ({ callback }) => callback('Hello world');
      const [ line2 ] = await capture(() => call(f2));
      expect(line2).to.equal('value = Hello world');
      const f3 = ({ allocator, callback }) => callback(allocator.dupe('Hello world'));
      const [ line3 ] = await capture(() => call(f3));
      expect(line3).to.equal('value = Hello world');
    })
    it('should correctly pass generator as argument', async function() {
      this.timeout(0);
      const { call, JSError } = await importTest('generator');
      const f1 = async function*() {
        for (let i = 0; i < 5; i++) yield i;
      };
      const lines1 = await capture(async () => {
        call(f1);
        await delay(10);
      });
      expect(lines1).to.eql([
        'number = 1234, value = 0',
        'number = 1234, value = 1',
        'number = 1234, value = 2',
        'number = 1234, value = 3',
        'number = 1234, value = 4',
        'number = 1234, value = null',
      ]);
      const f2 = async function*() {
        for (let i = 6; i < 20; i++) yield i;
      };
      const lines2 = await capture(async () => {
        call(f2);
        await delay(10);
      });
      expect(lines2).to.eql([
        'number = 1234, value = 6',
        'number = 1234, value = 7',
        'number = 1234, value = 8',
        'number = 1234, value = 9',
        'number = 1234, value = 10',
        'number = 1234, value = null',
      ]);
      const f3 = function({ callback }) {
        for (let i = 6; i < 20; i++) {
          if (!callback(i)) {
            callback(null);
            break;
          }
        }
      };
      const lines3 = await capture(async () => {
        call(f3);
        await delay(10);
      });
      expect(lines3).to.eql([
        'number = 1234, value = 6',
        'number = 1234, value = 7',
        'number = 1234, value = 8',
        'number = 1234, value = 9',
        'number = 1234, value = 10',
        'number = 1234, value = null',
      ]);
    })
    it('should correctly pass allocator and generator as arguments', async function() {
      this.timeout(0);
      const { call } = await importTest('generator-with-allocator');
      const f1 = async function*() {
        const avengers = [
          { real_name: 'Tony Stark', superhero_name: 'Ironman', age: 53 },
          { real_name: 'Peter Parker', superhero_name: 'Spiderman', age: 17 },
          { real_name: 'Natasha Romanoff', superhero_name: 'Black Widow', age: 39 },
        ];
        for (const avenger of avengers) yield avenger;
      };
      const lines1 = await capture(async () => {
        call(f1)
        await delay(10);
      });
      expect(lines1).to.eql([
        'real_name = Tony Stark, superhero_name = Ironman, age = 53',
        'real_name = Peter Parker, superhero_name = Spiderman, age = 17',
        'real_name = Natasha Romanoff, superhero_name = Black Widow, age = 39'
      ]);
      const f2 = async function*() {
        yield { real_name: 'Tony Stark', superhero_name: 'Ironman', age: 53 };
        throw new Error('Unexpected');
      };
      const lines2 = await capture(async () => {
        call(f2)
        await delay(10);
      });
      expect(lines2).to.eql([
        'real_name = Tony Stark, superhero_name = Ironman, age = 53',
        'error = Unexpected'
      ]);
    })

    skip.if(platform() === 'win32' && arch() === 'x64').
    or(platform() === 'linux' && arch() === 'aarch64').
    it('should throw when JavaScript is used as target of pointer to variadic function', async function() {
      this.timeout(0);
      const { call, printI32 } = await importTest('variadic-function');
      const lines = await capture(() => call(printI32));
      expect(lines).to.eql([ '123', '456', '789' ]);
      expect(() => call(() => {})).to.throw();
    })
  })
}
