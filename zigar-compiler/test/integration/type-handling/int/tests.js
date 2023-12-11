import { expect } from 'chai';
import { arch } from 'os';
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
    it('should return int', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-return-value');
      expect(module.getInt8()).to.equal(127);
      expect(module.getUint8()).to.equal(0);
      expect(module.getInt16()).to.equal(-44);
      expect(module.getUint16()).to.equal(44);
      expect(module.getInt32()).to.equal(1234);
      expect(module.getUint32()).to.equal(34567);
      expect(module.getInt64()).to.equal(0x1FFF_FFFF_FFFF_FFFFn);
      expect(module.getUint64()).to.equal(0xFFFF_FFFF_FFFF_FFFFn);
      expect(module.getIsize()).to.equal(1000);
      if (/32/.test(arch())) {
        expect(module.getUsize()).to.equal(0x7FFF_FFFF);
      } else {
        expect(module.getUsize()).to.equal(0x7FFF_FFFF_FFFF_FFFFn);
      }
    })
    it('should handle int in array', async function() {
      this.timeout(120000);
      const { default: module, print1, print2, print3 } = await importTest('array-of');
      expect([ ...module.array1 ]).to.eql([ 1, 2, 3, 4 ]);
      expect([ ...module.array2 ]).to.eql([ 1, 2, 3, 4 ]);
      expect([ ...module.array3 ]).to.eql([ 1n, 2n, 3n, 4n ]);
      const [ before1 ] = await capture(() => print1());
      expect(before1).to.equal('{ 1, 2, 3, 4 }');
      module.array1 = [ 3, 3, 3, 3 ];
      const [ after1 ] = await capture(() => print1());
      expect(after1).to.equal('{ 3, 3, 3, 3 }');
      const [ before2 ] = await capture(() => print2());
      expect(before2).to.equal('{ 1, 2, 3, 4 }');
      module.array2 = [ 3, 3, 3, 3 ];
      const [ after2 ] = await capture(() => print2());
      expect(after2).to.equal('{ 3, 3, 3, 3 }');
      const [ before3 ] = await capture(() => print3());
      expect(before3).to.equal('{ 1, 2, 3, 4 }');
      module.array3 = [ 3n, 3n, 3n, 3n ];
      const [ after3 ] = await capture(() => print1());
      expect(after3).to.equal('{ 3, 3, 3, 3 }');
    })
  })
}