import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { capture } from '../../capture.js';

use(ChaiAsPromised);

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Function', function() {
    it('should handle function as static variables', async function() {
      this.timeout(120000);
      const { default: module, hello, hello2, hello3 } = await importTest('as-static-variables');
      // no support for function pointer currently
      expect(module.func).to.be.undefined;
      expect(hello).to.be.a('function');
      expect(hello2).to.be.a('function');
      expect(hello3).to.be.a('function');
      const name = ' \nthis is a totally weird function name!! :-)';
      const f = module[name];
      expect(f).to.be.a('function');
      const lines = await capture(() => f())
      expect(lines[0]).to.equal('Hello world');
      expect(hello.valueOf()).to.equal(hello);
      expect(JSON.stringify(hello)).to.equal(undefined);
    })
    it('should ignore function accepting function as arguments', async function() {
      this.timeout(120000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.be.undefined;
    })
    it('should ignore function returning function', async function() {
      this.timeout(120000);
      const { getFunction } = await importTest('as-return-value');
      expect(getFunction).to.be.undefined;
    })
    it('should ignore function in array', async function() {
      this.timeout(120000);
      const { default: module, Fn } = await importTest('array-of');      
      expect(module.array).to.be.undefined;
      expect(module.Fn).to.be.undefined;
    })
    it('should ignore function in struct', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('in-struct');
      expect(module).to.not.have.property('struct_a');
    })
    it('should not compile code with function in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should ignore function as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a).to.not.have.property('function');
      const b = new StructA({ number: 500 });
      expect(b).to.not.have.property('function');
      const [ line ] = await capture(() => print(b));
      expect(line).to.match(/as\-comptime\-field\.StructA{ \.number = 500, \.function = fn\(\) void@/);
    })
    it('should ignore function in bare union', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('in-bare-union');
      expect(module).to.not.have.property('union_a');
    })
    it('should ignore function in tagged union', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('in-tagged-union');
      expect(module).to.not.have.property('union_a');
    })
    it('should ignore function in optional', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('in-optional');
      expect(module).to.not.have.property('optional');
      const [ line ] = await capture(() => print());
      expect(line).to.match(/fn\(\) void@/);
    })
    it('should ignore function in error union', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('in-error-union');
      expect(module).to.not.have.property('error_union');
      const [ line ] = await capture(() => print());
      expect(line).to.match(/fn\(\) void@/);
    })
    it('should not compile code containing function vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;      
    })
  })
}
