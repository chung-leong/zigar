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
      module.void_error = undefined;
      expect(module.void_error).to.be.undefined;
      expect(() => JSON.stringify(module.negative_outcome)).to.throw();
      expect(JSON.stringify(module.positive_outcome)).to.equal('456');
    })
    it('should print error union arguments', async function() {
      this.timeout(120000);
      const { print, Error } = await importTest('as-function-parameters');
      const lines = await capture(() => {
        print(221);
        print(Error.NoMoney);
      });
      expect(lines).to.eql([
        '221',
        'error.NoMoney' 
      ]);
    })
    it('should return error union', async function() {
      this.timeout(120000);
      const { default: module, Error } = await importTest('as-return-value');
      expect(module.getSomething()).to.equal(1234);
      expect(() => module.getFailure()).to.throw(Error.GoldfishDied);
    })
    it('should handle error union in array', async function() {
      this.timeout(120000);
      const { default: module, Error, print } = await importTest('array-of');
      expect(module.array).to.have.lengthOf(4);      
      expect(module.array[0]).to.equal(1);
      expect(module.array[1]).to.equal(2);
      expect(() => module.array[2]).to.throw(Error.NoMoney);
      expect(() => [ ...module.array ]).to.throw(Error.NoMoney);
      expect(module.array[3]).to.equal(4);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ 1, 2, error.NoMoney, 4 }');
      module.array[1] = Error.GoldfishDied;
      module.array[2] = 3;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('{ 1, error.GoldfishDied, 3, 4 }');
    })
    it('should handle error union in struct', async function() {
      this.timeout(120000);
      const { default: module, Error, StructA, print } = await importTest('in-struct');
      expect(() => module.struct_a.number1).to.throw(Error.GoldfishDied);
      expect(module.struct_a.number2).to.equal(-444n);
      const b = new StructA({});
      expect(b.number1).to.equal(123);
      expect(() => b.number2).to.throw(Error.NoMoney);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .number1 = error.GoldfishDied, .number2 = -444 }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .number1 = 123, .number2 = error.NoMoney }');
    })
    it('should not compile code with error union in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle error union as comptime field', async function() {
      this.timeout(120000);
      const { default: module, Error, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.number1).to.equal(5000);
      expect(() => module.struct_a.number2).to.throw(Error.GoldfishDied);
      const b = new StructA({ state: true });
      expect(b.number1).to.equal(5000);
      expect(() => b.number2).to.throw(Error.GoldfishDied);
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .state = true, .number1 = 5000, .number2 = error.GoldfishDied }');
    })
    it('should handle error union in bare union', async function() {
      this.timeout(120000);
      const { default: module, Error, UnionA } = await importTest('in-bare-union');
      expect(module.union_a.number).to.equal(3456);
      if (runtimeSafety) {
        expect(() => module.union_a.state).to.throw();
      }
      const b = new UnionA({ number: Error.GoldfishDied });
      const c = new UnionA({ state: false });
      expect(() => b.number).to.throw(Error.GoldfishDied);
      expect(c.state).to.be.false;
      if (runtimeSafety) {
        expect(() => c.number).to.throw();
      }
      module.union_a = b;
      expect(() => module.union_a.number).to.throw(Error.GoldfishDied);
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
    })
    it('should handle error union in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType, Error, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.number).to.equal(3456);
      expect(TagType(module.union_a)).to.equal(TagType.number);
      expect(module.union_a.state).to.be.null;
      const b = new UnionA({ number: Error.GoldfishDied });
      const c = new UnionA({ state: false });
      expect(() => b.number).to.throw(Error.GoldfishDied);
      expect(c.state).to.false;
      expect(c.number).to.be.null;
      module.union_a = b;
      expect(() => module.union_a.number).to.throw(Error.GoldfishDied);
      module.union_a = c;
      expect(module.union_a.number).to.be.null;
    })
    it('should handle error union in optional', async function() {
      this.timeout(120000);
      const { default: module, Error, print } = await importTest('in-optional');
      expect(module.optional).to.equal(3000);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('3000');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('null');
      module.optional = Error.GoldfishDied;
      expect(() => module.optional).to.throw(Error.GoldfishDied);
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('error.GoldfishDied');
    })
    it('should handle error union in error union', async function() {
      this.timeout(120000);
      const { default: module, Error, FileError, print } = await importTest('in-error-union');
      expect(module.error_union).to.equal(3000);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('3000');
      module.error_union = Error.GoldfishDied;
      expect(() => module.error_union).to.throw(Error.GoldfishDied);
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('error.GoldfishDied');
      module.error_union = FileError.Corrupted;
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('error.Corrupted');
    })
    it('should handle error union in vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}