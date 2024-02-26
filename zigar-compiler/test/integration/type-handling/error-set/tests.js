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
  describe('Error set', function() {
    it('should handle error set as static variables', async function() {
      this.timeout(120000);
      const {
        default: module,
        NormalError,
        StrangeError,
        PossibleError,
        print,
      } = await importTest('as-static-variables');
      expect(NormalError.OutOfMemory).to.be.instanceOf(Error);
      expect(NormalError.OutOfMemory).to.be.instanceOf(NormalError);
      expect(PossibleError.OutOfMemory).to.be.instanceOf(PossibleError);
      expect(StrangeError.SystemIsOnFire).to.equal(PossibleError.SystemIsOnFire);
      expect(StrangeError.SystemIsOnFire).to.be.instanceOf(PossibleError);
      expect(() => StrangeError.SystemIsOnFire.$ = StrangeError.SystemIsOnFire).to.throw(TypeError);
      expect(module.error_var).to.equal(NormalError.FileNotFound);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('error.FileNotFound');
      module.error_var = NormalError.OutOfMemory;
      expect(module.error_var).to.equal(NormalError.OutOfMemory);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('error.OutOfMemory');
      expect(module.error_var.valueOf()).equal(NormalError.OutOfMemory);
      expect(JSON.stringify(module.error_var)).to.equal('{"error":"Out of memory"}');
    })
    it('should print error arguments', async function() {
      this.timeout(120000);
      const { StrangeError, print, printAny } = await importTest('as-function-parameters');
      const lines = await capture(() => {
        print(StrangeError.SystemIsOnFire);
        printAny(StrangeError.NoMoreBeer);
      });
      expect(lines).to.eql([ 'error.SystemIsOnFire', 'error.NoMoreBeer' ]);
    })
    it('should return error', async function() {
      this.timeout(120000);
      const { getError, getAnyError, StrangeError } = await importTest('as-return-value');
      expect(getError()).to.equal(StrangeError.NoMoreBeer);
      expect(getAnyError()).to.equal(StrangeError.AlienInvasion);
    })
    it('should handle error in array', async function() {
      this.timeout(120000);
      const { default: module, StrangeError, print } = await importTest('array-of');
      expect(module.array.length).to.equal(4);
      expect(module.array[0]).to.equal(StrangeError.SystemIsOnFire);
      expect(module.array[1]).to.equal(StrangeError.DogAteAllMemory);
      expect(module.array[2]).to.equal(StrangeError.AlienInvasion);
      expect(module.array[3]).to.equal(StrangeError.CondomBrokeYouPregnant);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ error.SystemIsOnFire, error.DogAteAllMemory, error.AlienInvasion, error.CondomBrokeYouPregnant }');
      module.array[2] = StrangeError.NoMoreBeer;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('{ error.SystemIsOnFire, error.DogAteAllMemory, error.NoMoreBeer, error.CondomBrokeYouPregnant }');
    })
    it('should handle error in struct', async function() {
      this.timeout(120000);
      const { default: module, StrangeError, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.err1).to.equal(StrangeError.AlienInvasion);
      expect(module.struct_a.err2).to.equal(StrangeError.SystemIsOnFire);
      const b = new StructA({});
      expect(b.err1).to.equal(StrangeError.SystemIsOnFire);
      expect(b.err2).to.equal(StrangeError.DogAteAllMemory);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .err1 = error.AlienInvasion, .err2 = error.SystemIsOnFire }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .err1 = error.SystemIsOnFire, .err2 = error.DogAteAllMemory }');
    })
    it('should not compile code with error in packed struct', async function() {
      this.timeout(120000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle error as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StrangeError, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.err).to.equal(StrangeError.SystemIsOnFire);
      const b = new StructA({ number: 500 });
      expect(b.err).to.equal(StrangeError.SystemIsOnFire);
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .number = 500, .err = error.SystemIsOnFire }');
    })
    it('should handle error in bare union', async function() {
      this.timeout(120000);
      const { default: module, StrangeError, UnionA } = await importTest('in-bare-union');
      expect(module.union_a.err).to.equal(StrangeError.AlienInvasion);
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
      const b = new UnionA({ err: StrangeError.NoMoreBeer });
      const c = new UnionA({ number: 123 });
      expect(b.err).to.equal(StrangeError.NoMoreBeer);
      expect(c.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => c.err).to.throw();
      }
      module.union_a = b;
      expect(module.union_a.err).to.equal(StrangeError.NoMoreBeer);
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.err).to.throw();
      }
    })
    it('should handle error in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType, StrangeError, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.err).to.equal(StrangeError.DogAteAllMemory);
      expect(TagType(module.union_a)).to.equal(TagType.err);
      expect(module.union_a.number).to.be.null;
      const b = new UnionA({ err: StrangeError.CondomBrokeYouPregnant });
      const c = new UnionA({ number: 123 });
      expect(b.err).to.equal(StrangeError.CondomBrokeYouPregnant);
      expect(c.number).to.equal(123);
      expect(c.err).to.be.null;
      module.union_a = b;
      expect(module.union_a.err).to.equal(StrangeError.CondomBrokeYouPregnant);
      module.union_a = c;
      expect(module.union_a.err).to.be.null;
    })
    it('should handle error in optional', async function() {
      this.timeout(120000);
      const { default: module, StrangeError, print } = await importTest('in-optional');
      module.optional;
      // expect(module.optional).to.equal(StrangeError.SystemIsOnFire);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('error.SystemIsOnFire');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('null');
      module.optional = StrangeError.NoMoreBeer;
      expect(module.optional).to.equal(StrangeError.NoMoreBeer);
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('error.NoMoreBeer');
    })
    it('should not compile code containing error in error union', async function() {
      this.timeout(120000);
      await expect(importTest('in-error-union')).to.eventually.be.rejected;
    })
    it('should not compile code containing error vector', async function() {
      this.timeout(120000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}