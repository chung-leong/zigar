import { expect } from 'chai';
import 'mocha-skip-if';

export function addTests(importModule, options) {
  const { target } = options;
  const importTest = async (name, options) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url, options);
  };
  describe('Metadata', function() {
    this.timeout(0);
    it('should make fields string, typed array, or object', async function() {
      const { object } = await importTest('special-fields');
      expect(object.typed_array).to.eql(new Float64Array([ 1, 2, 3, 4 ]));
      expect(object.string).to.equal('Hello world');
      expect(object.object).to.eql({ number1: 0, number2: 0 });
      expect(object.number).to.equal(123n);
      expect(object.undefined).to.be.undefined;
    })
    it('should make decls string, typed array, or object', async function() {
      const { typed_array, string, object, number, undefined } = await importTest('special-decls');
      expect(typed_array).to.eql(new Float64Array([ 1, 2, 3, 4 ]));
      expect(string).to.equal('Hello world');
      expect(object).to.eql({ number1: 0, number2: 0 });
      expect(number).to.equal(123n);
      expect(undefined).to.be.undefined;
    })
    it('should return string, typed array, or object', async function() {
      const { returnObject, returnString, returnTypedArray } = await importTest('special-return-values');
      expect(returnObject()).to.eql({ number1: 123, number2: 1234n });
      expect(returnString()).to.equal('Hello world');
      expect(returnTypedArray()).to.eql(new Uint8Array([ 72, 101, 108, 108, 111,  32, 119, 111, 114, 108, 100 ]));
    })
  })
}