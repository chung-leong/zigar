import { expect } from 'chai';
import { capture } from '../test-utils.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
    const url = new URL(`./${name}.zig`, import.meta.url).href;
    return importModule(url);
  };
  describe('System functions', function() {
    it('should print environment variables', async function () {
      this.timeout(0);
      const { __zigar, print } = await importTest('print-env');
      __zigar.on('env', () => {
        return {
          HELLO: 1,
          WORLD: 123,
        }
      });
      const lines = await capture(() => print());
      expect(lines).to.include('HELLO = 1');
      expect(lines).to.include('WORLD = 123');
    });
  })
}
