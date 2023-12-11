import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Comptime int', function() {
    it('should import comptime int as variables', async function() {
      this.timeout(120000);
      const { small, negative, larger, pi } = await importTest('as-static-variables');
      expect(small).to.equal(127);
      expect(negative).to.equal(-167);
      expect(larger).to.equal(0x1234_5678);
    })
    it('should ignore a function accepting comptime_int as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.undefined;
    })
    it('should ignore a function returning comptime_int', async function() {
      this.timeout(120000);
      const { getComptimeInt } = await importTest('as-function-parameters');
      expect(getComptimeInt).to.undefined;
    })
  })
}