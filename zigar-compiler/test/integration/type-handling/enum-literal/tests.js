import { expect, use } from 'chai';
import { chaiPromised } from 'chai-promised';
import { capture } from '../../capture.js';

use(chaiPromised);

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Enum literal', function() {
    it('should handle enum literal as static variables', async function() {
      this.timeout(120000);
      const { default: module, hello, world } = await importTest('as-static-variables');
      expect(hello).to.equal('hello');
      expect(world.valueOf()).to.eql([
        'Asgard',
        'Midgard',
        'Jotunheim',
        'Svartalfheim',
        'Vanaheim',
        'Muspelheim',
        'Niflheim',
        'Alfheim',
        'Nidavellir',
      ]);
      expect(JSON.stringify(world)).to.equal('["Asgard","Midgard","Jotunheim","Svartalfheim","Vanaheim","Muspelheim","Niflheim","Alfheim","Nidavellir"]');
    })
    it('should ignore function accepting enum literal as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.be.undefined;
    })
    it('should ignore function returning enum literal', async function() {
      this.timeout(120000);
      const { getLiteral } = await importTest('as-return-value');
      expect(getLiteral).to.be.undefined;
    })
    it('should handle enum literal in array', async function() {
      this.timeout(120000);
      const { default: module, array } = await importTest('array-of');      
      expect(array.length).to.equal(4);
      expect([ ...array ]).to.eql([ 'hello', 'world', 'dog', 'cat' ]);
    })
    it('should handle enum literal in struct', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({ literal1: 'hello', literal2: 'world' });
      const [ line ] = await capture(() => print());
      expect(line).to.equal('in-struct.StructA{ .literal1 = .hello, .literal2 = .world }');
    })
    it('should handle enum literal in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle enum literal as comptime field', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('as-comptime-field');
      expect(module.struct_a.literal).to.equal('hello');
      const [ line ] = await capture(() => print());
      expect(line).to.equal('as-comptime-field.StructA{ .number = 123, .literal = .hello }');
    })
    it('should not compile code with enum literal in bare union', async function() {
      this.timeout(120000);
      await expect(importTest('in-bare-union')).to.eventually.be.rejected;
    })
    it('should handle enum literal in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType } = await importTest('in-tagged-union');
      expect(module.union_a.literal).to.equal('hello');
      expect(TagType(module.union_a)).to.equal(TagType.literal);
      expect(module.union_a.number).to.be.null;
    })
    it('should handle enum literal in optional', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('in-optional');
      expect(module.optional).to.equal('hello');
      const [ line ] = await capture(() => print());
      expect(line).to.equal('.hello');
    })
    it('should handle enum literal in error union', async function() {
      this.timeout(120000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union).to.equal('hello');
      const [ line ] = await capture(() => print());
      expect(line).to.equal('.hello');
    })
    it('should not compile code containing enum literal vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;      
    })
  })
}

