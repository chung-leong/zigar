import { expect, use } from 'chai';
import { chaiPromised } from 'chai-promised';
import { capture } from '../../capture.js';

use(chaiPromised);

export function addTests(importModule, options) {
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Function', function() {
    it('should handle function as static variables', async function() {
      this.timeout(300000);
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
      this.timeout(300000);
      const { print } = await importTest('as-function-parameters');
      expect(print).to.be.undefined;
    })
    it('should ignore function returning function', async function() {
      this.timeout(300000);
      const { getFunction } = await importTest('as-return-value');
      expect(getFunction).to.be.undefined;
    })
    it('should ignore function in array', async function() {
      this.timeout(300000);
      const { default: module, Fn } = await importTest('array-of');
      expect(module.array).to.be.undefined;
      expect(module.Fn).to.be.undefined;
    })
    it('should export struct containing function pointers', async function() {
      this.timeout(300000);
      const { StructA, default: module } = await importTest('in-struct');
      expect(module).to.have.property('struct_a');
      expect(module.struct_a).to.be.instanceOf(StructA);
      expect(module.struct_a.number).to.equal(1234);
      expect(() => module.struct_a.function1).to.throw(TypeError);
    })
    it('should not compile code with function in packed struct', async function() {
      this.timeout(300000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle function pointer as comptime field', async function() {
      this.timeout(300000);
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect(() => module.struct_a.function).to.throw(TypeError);
      const b = new StructA({ number: 500 });
      expect(() => b.function).to.throw(TypeError);
      const [ line ] = await capture(() => print(b));
      expect(line).to.match(/as\-comptime\-field\.StructA{ \.number = 500, \.function = fn\s*\(\) void@/);
    })
    it('should export bare union containing function pointers', async function() {
      this.timeout(300000);
      const { default: module } = await importTest('in-bare-union');
      expect(module).to.have.property('union_a');
      expect(module).to.have.property('union_b');
      expect(module.union_b.number).to.equal(123);
      expect(() => module.union_a.function).to.throw(TypeError);
    })
    it('should export tagged union containing function pointers', async function() {
      this.timeout(300000);
      const { default: module } = await importTest('in-tagged-union');
      expect(module).to.have.property('union_a');
      expect(module).to.have.property('union_b');
      expect(module.union_b.number).to.equal(123);
      expect(() => module.union_a.function).to.throw(TypeError);
    })
    it('should ignore function in optional', async function() {
      this.timeout(300000);
      const { default: module, print } = await importTest('in-optional');
      expect(module).to.not.have.property('optional');
      const [ line ] = await capture(() => print());
      expect(line).to.match(/fn\s*\(\) void@/);
    })
    it('should ignore function in error union', async function() {
      this.timeout(300000);
      const { default: module, print } = await importTest('in-error-union');
      expect(module).to.not.have.property('error_union');
      const [ line ] = await capture(() => print());
      expect(line).to.match(/fn\s*\(\) void@/);
    })
    it('should not compile code containing function vector', async function() {
      this.timeout(300000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}
