import { expect } from 'chai';

describe('Enumeration', async function() {
  let mod;
  before(async function () {
    this.timeout(30000);
    const pkg = await import('../zig/integration/enumeration.zig');
    mod = pkg.default;
  })
  it ('should export a pub enumeration', function() {
    expect(mod.Pet).to.be.a('function');
    expect(Object.keys(mod.Pet)).to.eql([ 'Dog', 'Cat', 'Monkey' ]);
  })
  it ('should have items that are instances of Number', function() {
    expect(mod.Pet.Dog).to.be.instanceOf(Number);
  })
  it ('should have items that are instances of the enum', function() {
    expect(mod.Pet.Dog).to.be.instanceOf(mod.Pet);
  })
  it ('should not match regular number', function() {
    expect(mod.Pet.Dog === 0).to.be.false;
    expect(`${mod.Pet.Dog}` == `0`).to.be.true;
  })
  it('should return the enum item when the enum function is called with a valid number', function() {
    const pet = mod.Pet(1);
    expect(pet).to.equal(mod.Pet.Cat);
  })
  it('should be able to find a enum item by a bigint', function() {
    const donut = mod.Donut(0xfffffffffffffffffffffffffffffffen);
    expect(donut).to.equal(mod.Donut.Jelly);
  })
  it ('should not match different enum types', function() {
    expect(mod.Pet.Dog == mod.Donut.Plain).to.be.false;
    expect(mod.Pet.Dog === mod.Donut.Plain).to.be.false;
  })
  it ('should export static function attach to enum', function() {
    expect(mod.Donut.tasty).to.be.a('function');
  })
  it ('should export enum attached to an enum', function() {
    expect(mod.Donut.Favor).to.be.a('function');
    expect(Object.keys(mod.Donut.Favor)).to.eql(['Strawberry', 'Raspberry', 'Cranberry']);
  })
  it ('should not export private constant', function() {
    expect(mod.Donut.secret).to.be.undefined;
  })
});
