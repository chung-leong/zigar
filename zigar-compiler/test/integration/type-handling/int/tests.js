import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Int', function() {
    it('should import int as static variables', async function() {
      this.timeout(120000);
      const { default: module, int4, int8, int16, print } = await importTest('as-static-variables');
      expect(module.private).to.be.undefined;
      expect(module.int4).to.equal(7);
      expect(int4).to.be.undefined;
      expect(module.int8).to.equal(127);
      expect(int8).to.be.undefined;
      expect(module.uint8).to.equal(0);
      expect(module.int16).to.equal(-44);
      expect(int16).to.equal(-44);
      expect(module.uint16).to.equal(44);
      expect(module.int32).to.equal(1234);
      expect(module.uint32).to.equal(34567);
      expect(module.int64).to.equal(0x1FFF_FFFF_FFFF_FFFFn);
      expect(module.uint64).to.equal(0xFFFF_FFFF_FFFF_FFFFn);
      expect(module.int128).to.equal(0xFFFF_FFFF_FFFF_FFFF_1234_5678n);
      expect(module.size1).to.equal(1234);
      expect(module.size2).to.equal(-1234);
      const [ before ] = await capture(() => print());
      expect(before).to.equal("44");
      module.uint16 = 123;
      expect(module.uint16).to.equal(123);
      const [ after ] = await capture(() => print());
      expect(after).to.equal("123");
      expect(() => module.int16 = 0).to.throw();
    })
    it('should print int arguments', async function() {
      this.timeout(120000);
      const { default: module, print1, print2 } = await importTest('as-function-parameters');
      const lines = await capture(() => {
        print1(221, -1234);
        print2(0x1FFF_FFFF_FFFF_FFFFn, 0xAAAA_AAAA_AAAA_AAAA_AAAA_AAABn);
      });
      expect(lines).to.eql([
        '221 -1234',
        '1fffffffffffffff aaaaaaaaaaaaaaaaaaaaaaab' 
      ]);
    })
  })
}