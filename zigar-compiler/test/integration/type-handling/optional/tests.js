import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Optional', function() {
    it('should import optional as static variables', async function() {
      this.timeout(120000);
      const { default: module, float_value } = await importTest('as-static-variables');
      expect(module.i32_empty).to.be.null;
      expect(module.i32_value).to.be.equal(1234);
      expect(() => module.i32_value = null).to.not.throw();
      expect(module.i32_value).to.be.null;
      expect(() => module.i32_value = 4567.8).to.not.throw();
      expect(module.i32_value).to.be.equal(4567);
      expect(module.bool_empty).to.be.null;
      expect(module.bool_value).to.be.equal(true);
      expect(f64_value).to.equal(3.14);
      expect(() => module.f64_value = null).to.throw();
    })
  })
}