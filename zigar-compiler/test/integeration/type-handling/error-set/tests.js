import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Error set', function() {
    it('should handle error set as static variables', async function() {
      this.timeout(120000);
      const { NormalError, StrangeError, PossibleError } = await importTest('as-static-variables');
      expect(NormalError.OutOfMemory).to.be.instanceOf(Error);
      expect(NormalError.OutOfMemory).to.be.instanceOf(NormalError);
      expect(PossibleError.OutOfMemory).to.be.instanceOf(PossibleError);
      expect(StrangeError.SystemIsOnFire).to.equal(PossibleError.SystemIsOnFire);
      expect(StrangeError.SystemIsOnFire).to.be.instanceOf(PossibleError);
   })
  })
}