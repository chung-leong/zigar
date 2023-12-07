import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
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
      expect(Pet.Cat.valueOf()).to.equal(1);
      expect(Number(Pet.Cat)).to.equal(1);
      expect(`${Pet.Dog} ${Pet.Cat} ${Pet.Monkey}`).to.equal('0 1 2');
      expect(Pet(1)).to.equal(Pet.Cat);
      expect(Pet('Cat')).to.equal(Pet.Cat);
      expect(Donut(0)).to.equal(Donut.Plain);
      expect(Donut(0xffff_ffff_ffff_ffff_ffff_ffff_ffff_fffen)).to.equal(Donut.Jelly);
      expect(Pet(5)).to.be.undefined;
      expect(Pet('Bear')).to.be.undefined;
      expect(module.pet).to.be.instanceOf(Pet);
      expect(module.pet).to.be.equal(Pet.Cat);
      const [ before ] = await capture(() => {
        print();
      });
      expect(before).to.equal('as-static-variables.Pet.Cat');
      module.pet = Pet.Dog;
      expect(module.pet).to.be.equal(Pet.Dog);
      const [ after ] = await capture(() => {
        print();
      });
      expect(after).to.equal('as-static-variables.Pet.Dog');
    })
  })
}

