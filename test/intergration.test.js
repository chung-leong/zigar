import { expect } from 'chai';

describe('Integration tests', function() {
  describe('Variables', function() {
    it('should import integer variables', async function() {
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
      expect(module.int128).to.equal(0xFFFF_FFFF_FFFF_FFFF_1234_5678);
      module.int16 = 123;
      expect(module.int16).to.equal(123);
    })
  })
  describe('Methods', function() {
    it('should import simple function', async function() {
      const { default: module } = await import(resolve('./integration/simple-function.zig'));
      const res = module.add(5, 17);
      expect(res).to.equal(22);
    })
  })
})

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}