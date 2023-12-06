import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Float', function() {
    it('should import float as static variables', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-static-variables');
      expect(module.float16_const.toFixed(1)).to.equal('-44.4');
      expect(module.float16.toFixed(2)).to.equal('0.44');
      expect(module.float32_const.toFixed(4)).to.equal('0.1234');
      expect(module.float32.toFixed(2)).to.equal('34567.56');
      expect(module.float64).to.equal(Math.PI);
      expect(module.float80).to.equal(Math.PI);
      expect(module.float128).to.equal(Math.PI);
      expect(() => module.float32_const = 0).to.throw();
    })
  })
}