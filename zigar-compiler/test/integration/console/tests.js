import { expect } from 'chai';
import { capture } from '../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Console', function() {
    it('should output to development console', async function() {
      this.timeout(120000);
      const { hello } = await importTest('console');
      const lines = await capture(() => hello());
      expect(lines).to.eql([ 'Hello world!' ]);
    })
    it('should flush console after function exits', async function() {
      this.timeout(120000);
      const { print } = await importTest('print-no-newline');
      const lines = await capture(() => print())
      expect(lines[0]).to.equal('Hello world');
    })
  })
}
