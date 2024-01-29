import { expect } from 'chai';
import { capture } from '../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}/main.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Package manager', function() {
    it('should link in ziglua', async function() {
      this.timeout(300000);
      const { run } = await importTest('use-ziglua');
      const code = `print "Hello world"`;
      const lines = await capture(() => run(code));
      console.log(lines);
      expect(lines).to.eql([]);
    })
  })
}
