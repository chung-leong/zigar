import { expect } from 'chai';
import { endianness } from 'os';

const littleEndian = (endianness() === 'LE');

describe('Integration tests', function() {
  describe('Variables', function() {
    it('should import integer variables', async function() {
      this.timeout(10000);
      const { default: module } = await import(resolve('./integration/integers.zig'));
      expect(module.private).to.be.undefined;
      expect(module.int4).to.equal(7);
      expect(module.int8).to.equal(127);
      expect(module.uint8).to.equal(0);
      expect(module.int16).to.equal(-44);
      expect(module.uint16).to.equal(44);
      expect(module.int32).to.equal(1234);
      expect(module.uint32).to.equal(34567);
      expect(module.int64).to.equal(0x1FFF_FFFF_FFFF_FFFFn);
      expect(module.uint64).to.equal(0xFFFF_FFFF_FFFF_FFFFn);
      expect(module.int128).to.equal(0xFFFF_FFFF_FFFF_FFFF_1234_5678n);
      module.uint16 = 123;
      expect(module.uint16).to.equal(123);
      expect(() => module.int16 = 0).to.throw();
    })
    it('should import comptime constants', async function() {
      this.timeout(10000);
      const { default: module } = await import(resolve('./integration/comptime-numbers.zig'));
      expect(module.small).to.equal(127);
      expect(module.negative).to.equal(-167);
      expect(module.larger).to.equal(0x1234_5678);
      expect(module.pi.toFixed(4)).to.equal('3.1416');
    })
    it('should import types', async function() {
      this.timeout(10000);
      const { default: module } = await import(resolve('./integration/types.zig'));
      const { Int32, Int128, Struct } = module;
      expect(Int32).to.be.a('function');
      const int32 = new Int32();
      int32.set(1234);
      expect(int32.get()).to.equal(1234);
      expect(Int128).to.be.a('function');
      const int128 = new Int128();
      int128.set(0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn);
      expect(int128.get()).to.equal(0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn);
      const object = new Struct();
      expect(object.number1).to.equal(123);
      expect(object.number2).to.equal(456);
    })
    it('should import primitive arrays', async function() {
      this.timeout(10000);
      const { default: module } = await import(resolve('./integration/primitive-arrays.zig'));
      expect(module.int32_array4).to.be.an('object');
      expect(module.int32_array4.get(0)).to.equal(1);
      expect([ ...module.int32_array4 ]).to.eql([ 1, 2, 3, 4 ]);
      module.int32_array4.set(1, 123);
      expect([ ...module.int32_array4 ]).to.eql([ 1, 123, 3, 4 ]);
      expect(module.float64_array4x4).to.be.an('object');
      const row1 = module.float64_array4x4.get(1);
      expect(row1).to.be.an('object');
    })
    it('should import primitive slices', async function() {
      this.timeout(10000);
      const { default: module } = await import(resolve('./integration/primitive-slices.zig'));
      const slice = module.int32_slice;
      expect(module.int32_slice).to.be.an('object');
      expect(module.int32_slice.get(0)).to.equal(123);
      expect([ ...module.int32_slice ]).to.eql([ 123, 456, 789 ]);
      expect(module.u8_slice).to.have.lengthOf(11);
      expect(module.u8_slice.get(0)).to.equal('H'.charCodeAt(0));
      expect([ ...module.uint32_array4 ]).to.eql([ 1, 2, 3, 4 ]);
      expect([ ...module.uint32_slice ]).to.eql([ 2, 3, 4 ]);
      module.uint32_slice.set(1, 777);
      expect([ ...module.uint32_slice ]).to.eql([ 2, 777, 4 ]);
      expect([ ...module.uint32_array4 ]).to.eql([ 1, 2, 777, 4 ]);
    })
  })
  describe('Methods', function() {
    it('should import simple function', async function() {
      this.timeout(10000);
      const { default: module } = await import(resolve('./integration/simple-function.zig'));
      const res = module.add(5, 17);
      expect(res).to.equal(22);
    })
    it('should import function that accepts a slice', async function() {
      this.timeout(10000);
      const { default: { fifth } } = await import(resolve('./integration/slice-function.zig'));
      const dv = new DataView(new ArrayBuffer(32));
      dv.setInt32(4, 123, littleEndian);
      dv.setInt32(12, 79, littleEndian);
      dv.setInt32(16, 456, littleEndian);
      const res = fifth(dv);
      expect(res).to.equal(456);
    })
  })
})

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}