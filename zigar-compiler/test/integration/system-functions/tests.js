import { expect } from 'chai';
import 'mocha-skip-if';
import { capture } from '../test-utils.js';

export function addTests(importModule, options) {
  const { target } = options;
  const importTest = async (name) => {
    const url = new URL(`./${name}.zig`, import.meta.url).href;
    return importModule(url);
  };
  describe('System functions', function() {
    skip.entirely.if(target === 'win32').
    it('should print environment variables', async function () {
      this.timeout(0);
      const { __zigar, print, get } = await importTest('print-env');
      let called = false;
      __zigar.on('env', () => {
        called = true;
        return {
          HELLO: 1,
          WORLD: 123,
        }
      });
      const lines = await capture(() => print());
      expect(called).to.be.true;
      expect(lines).to.include('HELLO = 1');
      expect(lines).to.include('WORLD = 123');
      const result = get('WORLD');
      expect(result).to.equal('123');
    });
    it('should print environment variables using libc', async function () {
      this.timeout(0);
      const { __zigar, print, get } = await importTest('print-env-with-libc', { useLibc: true });
      let called = false;
      __zigar.on('env', () => {
        called = true;
        return {
          HELLO: 1,
          WORLD: 123,
        }
      });
      if (print) {
        const lines = await capture(() => print());
        expect(called).to.be.true;
        expect(lines).to.include('HELLO = 1');
        expect(lines).to.include('WORLD = 123');
      }
      const result = get('WORLD');
      expect(result).to.equal('123');
    });
    it('should print random numbers', async function () {
      this.timeout(0);
      const { print } = await importTest('print-random');
      const [ line ] = await capture(() => print());
      const list = line.slice(1, -1).trim().split(/\s*,\s*/);
      expect(list).to.have.lengthOf(16);
    })
  })
}
