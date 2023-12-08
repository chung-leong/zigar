import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Int', function() {
    it('should import bool as static variables', async function() {
      this.timeout(120000);
      const { default: module, bool3, bool4, print } = await importTest('as-static-variables');
      expect(module.bool1).to.be.true;
      expect(module.bool2).to.be.false;
      expect(module.bool3).to.be.true;
      expect(module.bool4).to.be.false;
      expect(bool3).to.be.true;
      expect(bool4).to.be.false;
      const [ before ] = await capture(() => print());
      expect(before).to.equal('yes');
      module.bool1 = false;
      expect(module.bool1).to.be.false;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('no');
    })
  })
}