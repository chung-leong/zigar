import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Optional', function() {
    it('should import optional as static variables', async function() {
      this.timeout(120000);
      const { default: module, f64_empty, f64_value, print } = await importTest('as-static-variables');
      expect(module.i32_empty).to.be.null;
      expect(module.i32_value).to.be.equal(1234);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('1234');
      expect(() => module.i32_value = null).to.not.throw();
      expect(module.i32_value).to.be.null;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('null');
      expect(() => module.i32_value = 4567.8).to.not.throw();
      expect(module.i32_value).to.be.equal(4567);
      const [ afterThat ] = await capture(() => print());
      expect(afterThat).to.equal('4567');
      expect(module.bool_empty).to.be.null;
      expect(module.bool_value).to.be.equal(true);
      expect(f64_empty).to.be.null;
      expect(f64_value).to.equal(3.14);
      expect(() => module.f64_value = null).to.throw();
      expect(() => module.f64_empty = 3.14).to.throw();
    })
  })
}