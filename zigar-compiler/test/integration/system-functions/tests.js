import { expect } from 'chai';
import 'mocha-skip-if';
import { capture } from '../test-utils.js';

export function addTests(importModule, options) {
  const { target } = options;
  const importTest = async (name, options) => {
    const url = new URL(`./${name}.zig`, import.meta.url).href;
    return importModule(url, options);
  };
  describe('System functions', function() {
    skip.entirely.if(target === 'win32').
    it('should print environment variables', async function () {
      this.timeout(0);
      const { __zigar, print, get } = await importTest('print-env');
      __zigar.set('env', {
        HELLO: 1,
        WORLD: 123,
      });
      const lines1 = await capture(() => print());
      expect(lines1).to.include('HELLO = 1');
      expect(lines1).to.include('WORLD = 123');
      const result1 = get('WORLD');
      expect(result1).to.equal('123');
      __zigar.set('env', {
        '土耳其': '火雞',
      });
      const lines2 = await capture(() => print());
      expect(lines2).to.include('土耳其 = 火雞');
      const result2 = get('土耳其');
      expect(result2).to.equal('火雞');
      __zigar.set('env', null);
      const lines3 = await capture(() => print());
      expect(lines3).to.not.include('土耳其 = 火雞');
      __zigar.set('env', {});
      const lines4 = await capture(() => print());
      expect(lines4).to.have.lengthOf(0);
    })
    it('should print environment variables using libc functions', async function () {
      this.timeout(0);
      const { __zigar, print, get } = await importTest('print-env-with-libc-functions', { useLibc: true });
      __zigar.set('env', {
        HELLO: 1,
        WORLD: 123,
      });
      if (print) {
        const lines1 = await capture(() => print());
        expect(lines1).to.include('HELLO=1');
        expect(lines1).to.include('WORLD=123');
      }
      const result1 = get('WORLD');
      expect(result1).to.equal('123');
      __zigar.set('env', {
        '土耳其': '火雞',
      });
      if (print) {
        const lines2 = await capture(() => print());
        expect(lines2).to.include('土耳其=火雞');
      }
      const result2 = get('土耳其');
      expect(result2).to.equal('火雞');
      __zigar.set('env', null);
      if (print) {
        const lines3 = await capture(() => print());
        expect(lines3).to.not.include('土耳其=火雞');
      }
      __zigar.set('env', {});
      if (print) {
        const lines4 = await capture(() => print());
        expect(lines4).to.have.lengthOf(0);
      }
    })
    it('should use custom environment variables even when useRedirection is false', async function () {
      this.timeout(0);
      const { __zigar, get } = await importTest('print-env-with-redirection-disabled', { useLibc: true, useRedirection: false });
      __zigar.set('env', {
        HELLO: 1,
        WORLD: 123,
      });
      const result1 = get('WORLD');
      expect(result1).to.equal('123');
    })
    skip.entirely.unless(target === 'wasm32').
    it('should be able to exit even when useRedirection is false', async function () {
      this.timeout(0);
      const { exit } = await importTest('exit', { useLibc: true, useRedirection: false });
      expect(() => exit(7)).to.throw(Error).with.property('code', 7);
    })
    skip.entirely.unless(target === 'win32').
    it('should print environment variables using win32 functions', async function () {
      this.timeout(0);
      const { __zigar, print, printW, get, getW } = await importTest('print-env-with-win32-functions');
      __zigar.set('env', {
        HELLO: 1,
        WORLD: 123,
      });
      const lines1 = await capture(() => print());
      expect(lines1).to.include('HELLO=1');
      expect(lines1).to.include('WORLD=123');
      const result = get('WORLD');
      expect(result).to.equal('123');
      const resultW = getW('WORLD');
      expect(resultW).to.equal('123');
      __zigar.set('env', {
        '土耳其': '火雞',
      });
      const lines2 = await capture(() => printW());
      expect(lines2).to.include('土耳其=火雞');
    })
    it('should print random numbers', async function () {
      this.timeout(0);
      const { print } = await importTest('print-random');
      const [ line ] = await capture(() => print());
      const list = line.slice(1, -1).trim().split(/\s*,\s*/);
      expect(list).to.have.lengthOf(16);
    })
  })
}
