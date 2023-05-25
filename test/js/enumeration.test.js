import { expect } from 'chai';

describe('Enumeration', async function() {
  let mod;
  before(async function () {
    this.timeout(30000);
    const pkg = await import('./zig-files/enumeration.zig');
    mod = pkg.default;
  })
  it ('should export a pub enumeration', function() {
    expect(mod.pets).to.be.a('function');
    expect(Object.keys(mod.pets)).to.eql([ 'Dog', 'Cat', 'Monkey' ]);
  })
  it ('should have items that are instances of Number', function() {
    expect(mod.pets.Dog).to.be.instanceOf(Number);
  })
  it ('should have items that are instances of the enum', function() {
    expect(mod.pets.Dog).to.be.instanceOf(mod.pets);
  })
  it ('should not match regular number', function() {
    expect(mod.pets.Dog === 0).to.be.false;
    expect(`${mod.pets.Dog}` == `0`).to.be.true;
  })
  it('should return the enum item when the enum function is called with a valid number', function() {
    const pet = mod.pets(1);
    expect(pet).to.equal(mod.pets.Cat);
  })
  it('should be able to find a enum item by a bigint', function() {
    const donut = mod.donuts(0xfffffffffffffffffffffffffffffffen);
    expect(donut).to.equal(mod.donuts.jelly);
  })
});
