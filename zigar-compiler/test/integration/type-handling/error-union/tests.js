import { expect } from 'chai';

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Error union', function() {
    it('should import error union as static variables', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-static-variables');
      expect(module.Error).to.be.a('function');
      expect(module.positive_outcome).to.equal(123);
      expect(() => module.negative_outcome).to.throw()
        .with.property('message', 'Condom broke you pregnant');
      // should set error/value correctly
      module.positive_outcome = 456;
      expect(module.positive_outcome).to.equal(456);
      module.negative_outcome = module.Error.DogAteAllMemory;
      expect(() => module.negative_outcome).to.throw()
        .with.property('message', 'Dog ate all memory');
      expect(module.encounterBadLuck).to.be.a('function');
      expect(() => module.encounterBadLuck(true)).to.throw()
        .with.property('message', 'Dog ate all memory');
      expect(module.encounterBadLuck(false)).to.equal(456);
      // below 16-bit types
      expect(() => module.bool_error).to.throw()
        .with.property('message', 'Alien invasion');
      expect(() => module.i8_error).to.throw()
        .with.property('message', 'System is on fire');
      expect(() => module.u16_error).to.throw()
        .with.property('message', 'No more beer');
      expect(() => module.void_error).to.throw()
        .with.property('message', 'Dog ate all memory');
      // check void setter
      module.void_error = null;
      expect(module.void_error).to.be.null;
    })
  })
}