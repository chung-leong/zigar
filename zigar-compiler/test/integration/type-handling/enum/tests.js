import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { capture } from '../../test-utils.js';

use(chaiAsPromised);

export function addTests(importModule, options) {
  const { optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Enum', function() {
    this.timeout(0);
    it('should handle enum as static variables', async function() {
      const { default: module, Pet, Donut, print } = await importTest('as-static-variables');
      expect(Pet.dog).to.be.instanceOf(Pet);
      expect(Pet.donut).to.not.be.instanceOf(Pet);
      expect(Pet.cat.valueOf()).to.equal('cat');
      expect(Number(Pet.cat)).to.equal(1);
      expect(`${Pet.dog} ${Pet.cat} ${Pet.monkey}`).to.equal('dog cat monkey');
      expect(Pet(1)).to.equal(Pet.cat);
      expect(Pet('cat')).to.equal(Pet.cat);
      expect(Donut(0)).to.equal(Donut.Plain);
      expect(Donut(0xffff_ffff_ffff_ffff_ffff_ffff_ffff_fffen)).to.equal(Donut.Jelly);
      expect(Pet(5)).to.be.undefined;
      expect(Pet('Bear')).to.be.undefined;
      expect(module.pet).to.be.instanceOf(Pet);
      expect(module.pet).to.be.equal(Pet.cat);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('.cat');
      module.pet = Pet.dog;
      expect(module.pet).to.be.equal(Pet.dog);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('.dog');
      expect(module.pet.valueOf()).to.equal('dog');
      expect(JSON.stringify(module.pet)).to.equal('"dog"');
      expect(Donut(1n)).to.not.be.undefined;
      expect(Donut(5n)).to.not.be.undefined;
      expect(module.donut).to.equal(Donut(5n));
      expect(module.donut.valueOf()).to.equal('5');
    })
    it('should print enum arguments', async function() {
      const { Pet, print } = await importTest('as-function-parameters');
      const lines = await capture(() => print(Pet.cat, Pet.dog));
      expect(lines).to.eql([ '.cat .dog' ]);
    })
    it('should return enum', async function() {
      const { default: module, Pet } = await importTest('as-return-value');
      expect(module.getEnum()).to.equal(Pet.cat);
    })
    it('should handle enum in array', async function() {
      const { array, Pet, print } = await importTest('array-of');
      expect(array.length).to.equal(3);
      expect([ ...array ]).to.eql([ Pet.monkey, Pet.dog, Pet.cat ]);
      const [ line ] = await capture(() => print());
      expect(line).to.equal('{ .monkey, .dog, .cat }');
    })
    it('should handle enum in struct', async function() {
      const { default: module, Pet, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.pet1).to.equal(Pet.dog);
      expect(module.struct_a.pet2).to.equal(Pet.cat);
      const b = new StructA({});
      expect(b.pet1).to.equal(Pet.monkey);
      expect(b.pet2).to.equal(Pet.dog);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('.{ .pet1 = .dog, .pet2 = .cat }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('.{ .pet1 = .monkey, .pet2 = .dog }');
    })
    it('should handle enum in packed struct', async function() {
      const { default: module, Pet, StructA, print } = await importTest('in-packed-struct');
      expect(module.struct_a.pet1).to.equal(Pet.dog);
      expect(module.struct_a.pet2).to.equal(Pet.cat);
      expect(module.struct_a.number).to.equal(200);
      expect(module.struct_a.pet3).to.equal(Pet.monkey);
      const b = new StructA({});
      expect(b.pet1).to.equal(Pet.monkey);
      expect(b.pet2).to.equal(Pet.dog);
      expect(b.number).to.equal(100);
      expect(b.pet3).to.equal(Pet.cat);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('.{ .pet1 = .dog, .pet2 = .cat, .number = 200, .pet3 = .monkey }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('.{ .pet1 = .monkey, .pet2 = .dog, .number = 100, .pet3 = .cat }');
    })
    it('should handle enum as comptime field', async function() {
      const { default: module, Pet, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.pet).to.equal(Pet.cat);
      const b = new StructA({ number: 500 });
      expect(b.pet).to.equal(Pet.cat);
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('.{ .number = 500, .pet = .cat }');
    })
    it('should handle enum in bare union', async function() {
      const { default: module, Pet, UnionA } = await importTest('in-bare-union');
      expect(module.union_a.pet).to.equal(Pet.cat);
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
      const b = new UnionA({ pet: Pet.dog });
      const c = new UnionA({ number: 123 });
      expect(b.pet).to.equal(Pet.dog);
      expect(c.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => c.pet).to.throw();
      }
      module.union_a = b;
      expect(module.union_a.pet).to.equal(Pet.dog);
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.pet).to.throw();
      }
    })
    it('should handle enum in tagged union', async function() {
      const { default: module, TagType, Pet, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.pet).to.equal(Pet.cat);
      expect(TagType(module.union_a)).to.equal(TagType.pet);
      expect(module.union_a.number).to.be.null;
      const b = new UnionA({ pet: Pet.monkey });
      const c = new UnionA({ number: 123 });
      expect(b.pet).to.equal(Pet.monkey);
      expect(c.number).to.equal(123);
      expect(c.pet).to.be.null;
      module.union_a = b;
      expect(module.union_a.pet).to.equal(Pet.monkey);
      module.union_a = c;
      expect(module.union_a.pet).to.be.null;
    })
    it('should handle enum in optional', async function() {
      const { default: module, Pet, print } = await importTest('in-optional');
      expect(module.optional).to.equal(Pet.cat);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('.cat');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('null');
      module.optional = Pet.monkey;
      expect(module.optional).to.equal(Pet.monkey);
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('.monkey');
    })
    it('should handle enum in error union', async function() {
      const { default: module, Error, Pet, print } = await importTest('in-error-union');
      expect(module.error_union).to.equal(Pet.cat);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('.cat');
      module.error_union = Error.GoldfishDied;
      expect(() => module.error_union).to.throw(Error.GoldfishDied);
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('error.GoldfishDied');
      module.error_union = Pet.dog;
      expect(module.error_union).to.equal(Pet.dog);
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('.dog');
    })
    it('should not compile code containing enum vector', async function() {
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}

