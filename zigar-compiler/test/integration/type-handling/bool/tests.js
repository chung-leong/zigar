import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const { optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Bool', function() {
    it('should import bool as static variables', async function() {
      this.timeout(120000);
      const { default: module, bool3, bool4, print } = await importTest('as-static-variables');
      expect(module.bool1).to.be.true;
      expect(module.bool2).to.be.false;
      expect(module.bool3).to.be.true;
      expect(module.bool4).to.be.false;
      expect(bool3).to.be.true;
      expect(bool4).to.be.false;
      const [ before ] = await capture(() => print());
      expect(before).to.equal('yes');
      module.bool1 = false;
      expect(module.bool1).to.be.false;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('no');
      expect(JSON.stringify(module.bool1)).to.equal('false');
    })
    it('should print bool arguments', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('as-function-parameters');
      const lines = await capture(() => {
        print(true);
        print(false);
      });
      expect(lines).to.eql([ 'yes', 'no' ]);
    })
    it('should return bool', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-return-value');
      expect(module.getTrue()).to.equal(true);
      expect(module.getFalse()).to.equal(false);
    })
    it('should handle bool in array', async function() {
      this.timeout(120000);
      const { default: module, array_const, print } = await importTest('array-of');      
      expect(module.array.length).to.equal(4);
      expect([ ...module.array ]).to.eql([ true, false, false, true ]);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ true, false, false, true }');
      module.array[2] = true;
      const [ after1 ] = await capture(() => print());      
      expect(after1).to.equal('{ true, false, true, true }');
      module.array = [ true, true, true, true ];
      const [ after2 ] = await capture(() => print());      
      expect(after2).to.equal('{ true, true, true, true }');      
      expect(() => array_const[0] = true).to.throw();
      expect(() => module.array_const = [ false, false, false, false ]).to.throw();
      expect(() => module.array = [ false, false, false ]).to.throw();
    })
    it('should handle bool in struct', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({ state1: false, state2: true });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ state1: true, state2: false });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .state1 = false, .state2 = true }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .state1 = true, .state2 = false }');
    })
    it('should handle bool in packed struct', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('in-packed-struct');
      expect(module.struct_a.valueOf()).to.eql({ state1: false, state2: true, number: 200, state3: true });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ state1: true, state2: false, number: 100, state3: false });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-packed-struct.StructA{ .state1 = false, .state2 = true, .number = 200, .state3 = true }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-packed-struct.StructA{ .state1 = true, .state2 = false, .number = 100, .state3 = false }');
    })
    it('should handle bool as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.state).to.equal(false);
      const b = new StructA({ number: 500 });
      expect(b.state).to.equal(false);
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .number = 500, .state = false }');
    })
    it('should handle bool in bare union', async function() {
      this.timeout(120000);
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect(module.union_a.state).to.be.true;
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
      const b = new UnionA({ state: false });
      const c = new UnionA({ number: 123 });
      expect(b.state).to.be.false;
      expect(c.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => c.state).to.throw();
      }
      module.union_a = b;
      expect(module.union_a.state).to.be.false;
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.state).to.throw();
      }
    })
    it('should handle bool in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.state).to.be.true;
      expect(TagType(module.union_a)).to.equal(TagType.state);
      expect(module.union_a.number).to.be.null;
      const b = new UnionA({ state: false });
      const c = new UnionA({ number: 123 });
      expect(b.state).to.be.false;
      expect(c.number).to.equal(123);
      expect(c.state).to.be.null;
      module.union_a = b;
      expect(module.union_a.state).to.be.false;
      module.union_a = c;
      expect(module.union_a.state).to.be.null;
    })
    it('should handle bool in optional', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('in-optional');
      expect(module.optional).to.be.true;
      const [ before ] = await capture(() => print());
      expect(before).to.equal('true');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('null');
      module.optional = false;
      expect(module.optional).to.be.false;
    })
    it('should handle bool in error union', async function() {
      this.timeout(120000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union).to.be.true;
      const [ before ] = await capture(() => print());
      expect(before).to.equal('true');
      module.error_union = Error.GoldfishDied;
      expect(() => module.error_union).to.throw(Error.GoldfishDied);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('error.GoldfishDied');
      module.error_union = false;
      expect(module.error_union).to.be.false;
    })
    it('should handle bool in vector', async function() {
      this.timeout(120000);
      const { default: module, vector_const, print } = await importTest('vector-of');      
      expect(module.vector.length).to.equal(4);
      expect([ ...module.vector ]).to.eql([ true, false, false, true ]);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ true, false, false, true }');
      module.vector[2] = true;
      const [ after1 ] = await capture(() => print());      
      expect(after1).to.equal('{ true, false, true, true }');
      module.vector = [ true, true, true, true ];
      const [ after2 ] = await capture(() => print());      
      expect(after2).to.equal('{ true, true, true, true }');      
      expect(() => vector_const[0] = true).to.throw();
      expect(() => module.vector_const = [ false, false, false, false ]).to.throw();
      expect(() => module.vector = [ false, false, false ]).to.throw();
    })
  })
}
