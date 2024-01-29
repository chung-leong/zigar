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
    it('should link in zig-sqlite', async function() {
      this.timeout(300000);
      const { run } = await importTest('use-zig-sqlite/zig-sqlite');
      run();
    })
    it('should link in zigplotlib', async function() {
      this.timeout(300000);
      const { run } = await importTest('use-zigplotlib/zigplotlib');
      run();
    })
  })
}
