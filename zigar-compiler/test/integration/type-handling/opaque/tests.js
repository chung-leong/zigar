import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { capture } from '../../capture.js';

use(ChaiAsPromised);

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Opaque', function() {
    it('should not compile code with opaque as static variable', async function() {
      this.timeout(120000);
      await expect(importTest('as-static-variables')).to.eventually.be.rejected;      
    })
    it('should not compile code with function accepting opaque arguments', async function() {
      this.timeout(120000);
      await expect(importTest('as-function-parameters')).to.eventually.be.rejected;      
    })
    it('should not compile code with function returning opaque', async function() {
      this.timeout(120000);
      await expect(importTest('as-return-value')).to.eventually.be.rejected;      
    })
    it('should not compile code with array of opaque', async function() {
      this.timeout(120000);
      await expect(importTest('array-of')).to.eventually.be.rejected;      
    })
    it('should not compile code with opaque in struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-a-struct')).to.eventually.be.rejected;
    });
    it('should not compile code with opaque in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-a-packed-struct')).to.eventually.be.rejected;
    });
    it('should not compile code with opaque as comptime field', async function() {
      this.timeout(120000);
      await expect(importTest('as-comptime-field')).to.eventually.be.rejected;
    })
    it('should not compile code with opaque in bare union', async function() {
      this.timeout(120000);
      await expect(importTest('in-bare-union')).to.eventually.be.rejected;
    })
    it('should not compile code with opaque in tagged union', async function() {
      this.timeout(120000);
      await expect(importTest('in-tagged-union')).to.eventually.be.rejected;
    })
    it('should not compile code with opaque in optional', async function() {
      this.timeout(120000);
      await expect(importTest('in-optional')).to.eventually.be.rejected;
    })
    it('should not compile code with opaque in error union', async function() {
      this.timeout(120000);
      await expect(importTest('in-error-union')).to.eventually.be.rejected;
    })
    it('should not compile code containing opaque vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;      
    })
  })
}
