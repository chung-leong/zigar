import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { capture } from '../../capture.js';

use(ChaiAsPromised);

export function addTests(importModule, options) {
  const { optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Enum', function() {
    it('should handle enum as static variables', async function() {
      this.timeout(120000);
      const { default: module, Pet, Donut, print } = await importTest('as-static-variables');      
      expect(Pet.Cat).to.be.instanceOf(Pet);      
      expect(Pet.Donut).to.not.be.instanceOf(Pet);
      expect(Pet.Cat.valueOf()).to.equal('Cat');
      expect(Number(Pet.Cat)).to.equal(1);
      expect(`${Pet.Dog} ${Pet.Cat} ${Pet.Monkey}`).to.equal('Dog Cat Monkey');
      expect(Pet(1)).to.equal(Pet.Cat);
      expect(Pet('Cat')).to.equal(Pet.Cat);
      expect(Donut(0)).to.equal(Donut.Plain);
      expect(Donut(0xffff_ffff_ffff_ffff_ffff_ffff_ffff_fffen)).to.equal(Donut.Jelly);
      expect(Pet(5)).to.be.undefined;
      expect(Pet('Bear')).to.be.undefined;
      expect(module.pet).to.be.instanceOf(Pet);
      expect(module.pet).to.be.equal(Pet.Cat);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('as-static-variables.Pet.Cat');
      module.pet = Pet.Dog;
      expect(module.pet).to.be.equal(Pet.Dog);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('as-static-variables.Pet.Dog');
    })
    it('should print enum arguments', async function() {
      this.timeout(120000);
      const { Pet, print } = await importTest('as-function-parameters');
      const lines = await capture(() => print(Pet.Cat, Pet.Dog));
      expect(lines).to.eql([ 'as-function-parameters.Pet.Cat as-function-parameters.Pet.Dog' ]);
    })
    it('should return enum', async function() {
      this.timeout(120000);
      const { default: module, Pet } = await importTest('as-return-value');
      expect(module.getEnum()).to.equal(Pet.Cat);
    })
    it('should handle enum in array', async function() {
      this.timeout(120000);
      const { array, Pet, print } = await importTest('array-of');      
      expect(array.length).to.equal(3);
      expect([ ...array ]).to.eql([ Pet.Monkey, Pet.Dog, Pet.Cat ]);
      const [ line ] = await capture(() => print());
      expect(line).to.equal('{ array-of.Pet.Monkey, array-of.Pet.Dog, array-of.Pet.Cat }');
    })
    it('should handle enum in struct', async function() {
      this.timeout(120000);
      const { default: module, Pet, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.pet1).to.equal(Pet.Dog);
      expect(module.struct_a.pet2).to.equal(Pet.Cat);
      const b = new StructA({});
      expect(b.pet1).to.equal(Pet.Monkey);
      expect(b.pet2).to.equal(Pet.Dog);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .pet1 = in-struct.Pet.Dog, .pet2 = in-struct.Pet.Cat }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .pet1 = in-struct.Pet.Monkey, .pet2 = in-struct.Pet.Dog }');
    })
    it('should handle enum in packed struct', async function() {
      this.timeout(120000);
      const { default: module, Pet, StructA, print } = await importTest('in-packed-struct');
      debugger;
      module.struct_a.pet1;
      expect(module.struct_a.pet1).to.equal(Pet.Dog);
      expect(module.struct_a.pet2).to.equal(Pet.Cat);
      expect(module.struct_a.number).to.equal(200);
      expect(module.struct_a.pet3).to.equal(Pet.Monkey);
      const b = new StructA({});
      expect(b.pet1).to.equal(Pet.Monkey);
      expect(b.pet2).to.equal(Pet.Dog);
      expect(b.number).to.equal(100);
      expect(b.pet3).to.equal(Pet.Cat);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-packed-struct.StructA{ .pet1 = in-packed-struct.Pet.Dog, .pet2 = in-packed-struct.Pet.Cat, .number = 200, .pet3 = in-packed-struct.Pet.Monkey }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-packed-struct.StructA{ .pet1 = in-packed-struct.Pet.Monkey, .pet2 = in-packed-struct.Pet.Dog, .number = 100, .pet3 = in-packed-struct.Pet.Cat }');
    })
    it('should handle enum as comptime field', async function() {
      this.timeout(120000);
      const { default: module, Pet, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.pet).to.equal(Pet.Cat);
      const b = new StructA({ number: 500 });
      expect(b.pet).to.equal(Pet.Cat);
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .number = 500, .pet = as-comptime-field.Pet.Cat }');
    })
    it('should handle enum in bare union', async function() {
      this.timeout(120000);
      const { default: module, Pet, UnionA } = await importTest('in-bare-union');
      expect(module.union_a.pet).to.equal(Pet.Cat);
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
      const b = new UnionA({ pet: Pet.Dog });
      const c = new UnionA({ number: 123 });
      expect(b.pet).to.equal(Pet.Dog);
      expect(c.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => c.pet).to.throw();
      }
      module.union_a = b;
      expect(module.union_a.pet).to.equal(Pet.Dog);
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.pet).to.throw();
      }
    })
    it('should handle enum in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType, Pet, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.pet).to.equal(Pet.Cat);
      expect(TagType(module.union_a)).to.equal(TagType.pet);
      expect(module.union_a.number).to.be.null;
      const b = new UnionA({ pet: Pet.Monkey });
      const c = new UnionA({ number: 123 });
      expect(b.pet).to.equal(Pet.Monkey);
      expect(c.number).to.equal(123);
      expect(c.pet).to.be.null;
      module.union_a = b;
      expect(module.union_a.pet).to.equal(Pet.Monkey);
      module.union_a = c;
      expect(module.union_a.pet).to.be.null;
    })
    it('should handle enum in optional', async function() {
      this.timeout(120000);
      const { default: module, Pet, print } = await importTest('in-optional');
      expect(module.optional).to.equal(Pet.Cat);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-optional.Pet.Cat');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('null');
      module.optional = Pet.Monkey;
      expect(module.optional).to.equal(Pet.Monkey);
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('in-optional.Pet.Monkey');
    })
    it('should handle enum in error union', async function() {
      this.timeout(120000);
      const { default: module, Error, Pet, print } = await importTest('in-error-union');
      expect(module.error_union).to.equal(Pet.Cat);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-error-union.Pet.Cat');
      module.error_union = Error.GoldfishDied;
      expect(() => module.error_union).to.throw(Error.GoldfishDied);
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('error.GoldfishDied');
      module.error_union = Pet.Dog;
      expect(module.error_union).to.equal(Pet.Dog);
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('in-error-union.Pet.Dog');
    })
    it('should not compile code containing enum vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;      
    })
  })
}

