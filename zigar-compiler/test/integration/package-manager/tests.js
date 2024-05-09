import { expect } from 'chai';
import { capture } from '../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Package manager', function() {
    it('should link in ziglua', async function() {
      this.timeout(300000);
      const { run } = await importTest('use-ziglua/ziglua');
      const code = `print "Hello world"`;
      const lines = await capture(() => run(code));
      expect(lines).to.eql([ 'Hello world' ]);
    })
    skip.
    it('should link in zig-sqlite', async function() {
      this.timeout(300000);
      const { run } = await importTest('use-zig-sqlite/zig-sqlite');
      run();
    })
    skip.
    it('should link in zigplotlib', async function() {
      this.timeout(300000);
      const { run } = await importTest('use-zigplotlib/zigplotlib');
      run();
    })
    it('should link in ziglyph', async function() {
      this.timeout(300000);
      const { isAlphabetic } = await importTest('use-ziglyph/ziglyph');
      expect(isAlphabetic).to.be.a('function');
      expect(isAlphabetic('A'.charCodeAt(0))).to.be.true;
      expect(isAlphabetic('1'.charCodeAt(0))).to.be.false;
      expect(isAlphabetic('Ź'.charCodeAt(0))).to.be.true;
    })
  })
}
