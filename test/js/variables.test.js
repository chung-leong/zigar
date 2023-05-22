import { expect } from 'chai';

describe('Module properities getter/setter', async function() {
  let mod;
  before(async function () {
    this.timeout(30000);
    const pkg = await import('./zig-files/variables.zig');
    mod = pkg.default;
  })
  it('should not expose private variables', function() {      
    const names = Object.keys(mod);
    expect(names).to.be.not.contain('private');
  })
  it('should expose public variables', function() {
    const names = Object.keys(mod);
    expect(names).to.be.contain('constant');
    expect(mod.constant).to.equal(43);
  })
  it('should not allow change to constant', function() {
    expect(() => mod.constant = 777).to.throw();
  })
  it('should allow setting of variable', function() {
    expect(() => mod.variable = 789).to.not.throw();
    expect(mod.variable).to.equal(789);
  })
  it('should throw when an i8 overflows', function() {
    expect(mod.int8).to.equal(127);
    expect(() => mod.int8++).to.throw();
    expect(mod.int8).to.equal(127);
  })
  it('should throw when an i16 underflows', function() {
    expect(mod.int16).to.equal(-44);
    expect(() => mod.int16 -= 60000).to.throw();
    expect(mod.int16).to.equal(-44);
  })
  it('should throw when an u32 overflows', function() {
    expect(mod.uint32).to.equal(34567);
    expect(() => mod.uint32 = 0x1FFFFFFFF).to.throw();
    expect(mod.uint32).to.equal(34567);
  })
  it('should throw when i64 exceeding safe range is accessed', function() {
    expect(() => mod.int64).to.throw();
  })
  it('should throw when an i4 overflows', function() {
    expect(mod.int4).to.equal(7);
    expect(() => mod.int4 = 10).to.throw();
    expect(mod.int4).to.equal(7);
  })
  it('should return a u64 as bigInt correctly', function() {
    // TODO something like should be required to return bigInt:
    // mod.$properties.uint64 = BigInt;
    expect(mod.uint64).to.equal(0xFFFFFFFFFFFFFFFFn);
  })
  it('should return a i128 as bigInt', function() {
    expect(mod.int128).to.equal(1234n);
  })
  it('should correctly set an i128', function() {
    mod.int128 = 0xFFFFFFFFFFFFFFFFFFFFFFFFn;
    expect(mod.int128).to.equal(0xFFFFFFFFFFFFFFFFFFFFFFFFn);
  })
  it('should return an i32 array as an Int32Array', function() {
    const a = mod.int32Array4;
    expect(a).to.be.an.instanceOf(Int32Array);
    expect(a).to.have.lengthOf(4);
  })
  it('should return a multi-dimensional f64 array as an Float64Array', function() {
    const a = mod.float64Array4x4;
    expect(a).to.be.an.instanceOf(Float64Array);
    expect(a).to.have.lengthOf(16);
    expect(a[2 * 4 + 2]).to.equal(3.3);
    expect(a[3 * 4 + 1]).to.equal(4.2);
  })
})
