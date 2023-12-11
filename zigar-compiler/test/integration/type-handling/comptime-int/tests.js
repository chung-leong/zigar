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
    it('should ignore a function accepting comptime int as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.undefined;
    })
    it('should ignore a function returning comptime int', async function() {
      this.timeout(120000);
      const { getComptimeInt } = await importTest('as-function-parameters');
      expect(getComptimeInt).to.undefined;
    })
    it('should handle comptime int in array', async function() {
      this.timeout(120000);
      const { array1, array2 } = await importTest('array-of');
      expect([ ...array1 ]).to.eql([ 1, 2, 3, 4 ]);
      expect([ ...array2 ]).to.eql([ 0x1000_0000_0000_0000n, 0x2000_0000_0000_0000n ]);
    })
  })
}