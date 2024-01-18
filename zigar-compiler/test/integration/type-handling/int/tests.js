import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const { optimize, addressSize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
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
      expect(JSON.stringify(module.uint16)).to.equal('123');
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
      if (addressSize === 32) {
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
    it('should handle int in struct', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({ number1: -5, number2: -444n });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ number1: 123, number2: 456n });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .number1 = -5, .number2 = -444 }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .number1 = 123, .number2 = 456 }');
    })
    it('should handle int in packed struct', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('in-packed-struct');
      expect(module.struct_a.valueOf()).to.eql({ number1: 15, number2: 777n, state: true, number3: -420 });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ number1: 100, number2: 200n, state: false, number3: 300 });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-packed-struct.StructA{ .number1 = 15, .number2 = 777, .state = true, .number3 = -420 }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-packed-struct.StructA{ .number1 = 100, .number2 = 200, .state = false, .number3 = 300 }');
    })
    it('should handle int as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.number).to.equal(5000);
      const b = new StructA({ state: true });
      expect(b.number).to.equal(5000);
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .state = true, .number = 5000 }');
    })
    it('should handle int in bare union', async function() {
      this.timeout(120000);
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect(module.union_a.number).to.equal(1234);
      if (runtimeSafety) {
        expect(() => module.union_a.state).to.throw();
      }
      const b = new UnionA({ number: 4567 });
      const c = new UnionA({ state: false });
      expect(b.number).to.equal(4567);
      expect(c.state).to.be.false;
      if (runtimeSafety) {
        expect(() => c.number).to.throw();
      }
      module.union_a = b;
      expect(module.union_a.number).to.equal(4567);
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
    })
    it('should handle int in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.number).to.equal(3456);
      expect(TagType(module.union_a)).to.equal(TagType.number);
      expect(module.union_a.state).to.be.null;
      const b = new UnionA({ number: 123 });
      const c = new UnionA({ state: false });
      expect(b.number).to.equal(123);
      expect(c.state).to.false;
      expect(c.number).to.be.null;
      module.union_a = b;
      expect(module.union_a.number).to.equal(123);
      module.union_a = c;
      expect(module.union_a.number).to.be.null;
    })
    it('should handle int in optional', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('in-optional');
      expect(module.optional).to.equal(3000);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('3000');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('null');
      module.optional = -4000;
      expect(module.optional).to.equal(-4000);
    })
    it('should handle int in error union', async function() {
      this.timeout(120000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union).to.equal(3000);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('3000');
      module.error_union = Error.GoldfishDied;
      expect(() => module.error_union).to.throw(Error.GoldfishDied);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('error.GoldfishDied');
      module.error_union = -4000;
      expect(module.error_union).to.equal(-4000);
    })
    it('should handle int in vector', async function() {
      this.timeout(120000);
      const { default: module, print1, print2, print3 } = await importTest('vector-of');
      expect([ ...module.vector1 ]).to.eql([ 1, 2, 3, 4 ]);
      expect([ ...module.vector2 ]).to.eql([ 1, 2, 3, 4 ]);
      expect([ ...module.vector3 ]).to.eql([ 1n, 2n, 3n, 4n ]);
      const [ before1 ] = await capture(() => print1());
      expect(before1).to.equal('{ 1, 2, 3, 4 }');
      module.vector1 = [ 3, 3, 3, 3 ];
      const [ after1 ] = await capture(() => print1());
      expect(after1).to.equal('{ 3, 3, 3, 3 }');
      const [ before2 ] = await capture(() => print2());
      expect(before2).to.equal('{ 1, 2, 3, 4 }');
      module.vector2 = [ 3, 3, 3, 3 ];
      const [ after2 ] = await capture(() => print2());
      expect(after2).to.equal('{ 3, 3, 3, 3 }');
      const [ before3 ] = await capture(() => print3());
      expect(before3).to.equal('{ 1, 2, 3, 4 }');
      module.vector3 = [ 3n, 3n, 3n, 3n ];
      const [ after3 ] = await capture(() => print1());
      expect(after3).to.equal('{ 3, 3, 3, 3 }');
    })
  })
}