import { expect } from 'chai';

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
    it('should import comptime constant', async function() {
      this.timeout(10000);
      const { default: module } = await import(resolve('./integration/comptime-numbers.zig'));
      expect(module.small).to.equal(127);
      expect(module.negative).to.equal(-167);
      expect(module.larger).to.equal(0x1234_5678);
      expect(module.pi.toFixed(4)).to.equal('3.1416');
    })
  })
  describe('Methods', function() {
    it('should import simple function', async function() {
      this.timeout(10000);
      const { default: module } = await import(resolve('./integration/simple-function.zig'));
      const res = module.add(5, 17);
      expect(res).to.equal(22);
    })
  })
})

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}