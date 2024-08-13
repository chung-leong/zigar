import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

export function addTests(importModule, options) {
  const { target } = options;
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('No return', function() {
    it('should not compile code with no return as static variables', async function() {
      this.timeout(300000);
      await expect(importTest('as-static-variables')).to.eventually.be.rejected;
    })
    it('should not compile code with function accepting no return as arguments', async function() {
      this.timeout(300000);
      await expect(importTest('as-function-parameters')).to.eventually.be.rejected;
    })
    it('should allow function returning no return', async function() {
      this.timeout(300000);
      const { exit } = await importTest('as-return-value');
      await expect(exit).to.be.a('function');
      if (target === 'wasm32') {
        expect(() => exit(0)).to.not.throw();
        expect(() => exit(1)).to.throw(Error).that.includes({ message: 'Program exited', code: 1 });
      }
    })
    it('should not compile code with array of no returns', async function() {
      this.timeout(300000);
      await expect(importTest('array-of')).to.eventually.be.rejected;
    })
    it('should handle no return in struct', async function() {
      this.timeout(300000);
      await expect(importTest('in-struct')).to.eventually.be.rejected;
    })
    it('should handle no return in packed struct', async function() {
      this.timeout(300000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should not compile code with no return comptime field', async function() {
      this.timeout(300000);
      await expect(importTest('as-comptime-field')).to.eventually.be.rejected;
    })
    it('should not compile code with no return bare union', async function() {
      this.timeout(300000);
      await expect(importTest('in-bare-union')).to.eventually.be.rejected;
    })
    it('should not compile code with no return tagged union', async function() {
      this.timeout(300000);
      await expect(importTest('in-tagged-union')).to.eventually.be.rejected;
    })
    it('should not compile code with no return optional', async function() {
      this.timeout(300000);
      await expect(importTest('in-optional')).to.eventually.be.rejected;
    })
    it('should not compile code with no return error union', async function() {
      this.timeout(300000);
      await expect(importTest('in-error-union')).to.eventually.be.rejected;
    })
    it('should not compile code with no return vector', async function() {
      this.timeout(300000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}
