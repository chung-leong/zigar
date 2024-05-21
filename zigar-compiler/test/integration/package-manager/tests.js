import { expect } from 'chai';
import { capture } from '../capture.js';

export function addTests(importModule, options) {
  const { target, optimize } = options;
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Package manager', function() {
    skip.if(target === 'wasm32').
    it('should link in ziglua', async function() {
      this.timeout(300000);
      const { run } = await importTest('use-ziglua/ziglua');
      const code = `print "Hello world"`;
      const lines = await capture(() => run(code));
      expect(lines).to.eql([ 'Hello world' ]);
    })
    skip.if(target === 'wasm32').
    it('should link in zig-sqlite', async function() {
      this.timeout(300000);
      const { run } = await importTest('use-zig-sqlite/zig-sqlite');
      run();
    })
  })
}
