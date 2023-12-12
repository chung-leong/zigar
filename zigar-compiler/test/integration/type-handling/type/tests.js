import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Type', function() {
    it('should import type as static variables', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-static-variables');
      const { Int32, Int128, Struct } = module;
      expect(Int32).to.be.a('function');
      const int32 = new Int32(undefined);
      int32.$ = 1234;
      expect(int32.$).to.equal(1234);
      expect(Int128).to.be.a('function');
      const int128 = new Int128(0n);
      int128.$ = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn;
      expect(int128.$).to.equal(0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn);
      const object = new Struct({});
      expect(object.number1).to.equal(123);
      expect(object.number2).to.equal(456);
    })
    it('should ignore a function accepting type as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.be.undefined;
    })
    it('should ignore a function returning type', async function() {
      this.timeout(120000);
      const { getType } = await importTest('as-return-value');
      expect(getType).to.be.undefined;
    })
    it('should handle type in array', async function() {
      this.timeout(120000);
      const { array } = await importTest('array-of');      
      expect(array.length).to.equal(4);
      for (const item of array) {
        expect(item).to.be.a('function');
      }
    })

  })
}

