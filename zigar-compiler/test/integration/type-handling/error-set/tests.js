import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { capture } from '../../capture.js';

use(ChaiAsPromised);

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Error set', function() {
    it('should handle error set as static variables', async function() {
      this.timeout(120000);
      const { 
        default: module, 
        NormalError, 
        StrangeError, 
        PossibleError,
        print,
      } = await importTest('as-static-variables');
      expect(NormalError.OutOfMemory).to.be.instanceOf(Error);
      expect(NormalError.OutOfMemory).to.be.instanceOf(NormalError);
      expect(PossibleError.OutOfMemory).to.be.instanceOf(PossibleError);
      expect(StrangeError.SystemIsOnFire).to.equal(PossibleError.SystemIsOnFire);
      expect(StrangeError.SystemIsOnFire).to.be.instanceOf(PossibleError);
      expect(module.error_var).to.equal(NormalError.FileNotFound);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('error.FileNotFound');
      module.error_var = NormalError.OutOfMemory;
      expect(module.error_var).to.equal(NormalError.OutOfMemory);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('error.OutOfMemory');
    })
  })
}