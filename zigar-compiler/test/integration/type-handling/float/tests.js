import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const { optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };    
  describe('Float', function() {
    it('should import float as static variables', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('as-static-variables');
      expect(module.float16_const.toFixed(1)).to.equal('-44.4');
      expect(module.float16.toFixed(2)).to.equal('0.44');
      expect(module.float32_const.toFixed(4)).to.equal('0.1234');
      expect(module.float32.toFixed(2)).to.equal('34567.56');
      expect(module.float64).to.equal(Math.PI);
      expect(module.float80).to.equal(Math.PI);
      expect(module.float128).to.equal(Math.PI);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('3.141592653589793');
      module.float64 = 1.234;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('1.234');
      expect(() => module.float32_const = 0).to.throw();
    })
    it('should print float arguments', async function() {
      this.timeout(120000);
      const { default: module, print1, print2 } = await importTest('as-function-parameters');
      const lines = await capture(() => {
        print1(Math.PI, Math.PI);
        print2(Math.PI, Math.PI, Math.PI);
      });
      expect(lines).to.eql([
        '3.140625 3.1415927410125732',
        '3.141592653589793 3.141592653589793e+00 3.141592653589793e+00',
      ]);
    })
    it('should return float', async function() {
      this.timeout(120000);
      const { default: module } = await importTest('as-return-value');
      expect(module.getFloat16()).to.equal(-44.40625);
      expect(module.getFloat32()).to.equal(0.1234000027179718);
      expect(module.getFloat64()).to.equal(Math.PI);
      expect(module.getFloat80()).to.equal(Math.PI);
      expect(module.getFloat128()).to.equal(Math.PI);
    })
    it('should handle float in array', async function() {
      this.timeout(120000);
      const { default: module, print1, print2, print3 } = await importTest('array-of');
      expect([ ...module.array1 ]).to.eql([ 1.25, 2.25, 3.25, 4.25 ]);
      expect([ ...module.array2 ]).to.eql([ 1.1, 2.1, 3.1, 4.1 ]);
      expect([ ...module.array3 ]).to.eql([ 1.1, 2.1, 3.1, 4.1 ]);
      const [ before1 ] = await capture(() => print1());
      expect(before1).to.equal('{ 1.25e+00, 2.25e+00, 3.25e+00, 4.25e+00 }');
      module.array1 = [ 3.5, 3.5, 3.5, 3.5 ];
      const [ after1 ] = await capture(() => print1());
      expect(after1).to.equal('{ 3.5e+00, 3.5e+00, 3.5e+00, 3.5e+00 }');
      const [ before2 ] = await capture(() => print2());
      expect(before2).to.equal('{ 1.1e+00, 2.1e+00, 3.1e+00, 4.1e+00 }');
      module.array2 = [ 3.5, 3.5, 3.5, 3.5 ];
      const [ after2 ] = await capture(() => print2());
      expect(after2).to.equal('{ 3.5e+00, 3.5e+00, 3.5e+00, 3.5e+00 }');
      const [ before3 ] = await capture(() => print3());
      expect(before3).to.equal('{ 1.1e+00, 2.1e+00, 3.1e+00, 4.1e+00 }');
      module.array3 = [ 3.5, 3.5, 3.5, 3.5 ];
      const [ after3 ] = await capture(() => print1());
      expect(after3).to.equal('{ 3.5e+00, 3.5e+00, 3.5e+00, 3.5e+00 }');
    })
    it('should handle float in struct', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({ number1: -0.5, number2: -4.44 });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ number1: 123, number2: 0.456 });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .number1 = -5.0e-01, .number2 = -4.44e+00 }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .number1 = 1.23e+02, .number2 = 4.56e-01 }');
    })
    it('should handle float in packed struct', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('in-packed-struct');
      expect(module.struct_a.valueOf()).to.eql({ state: true, number1: 1.5, number2: 7.77, number3: -4.25 });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ state: false, number1: 1, number2: 2, number3: 3 });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-packed-struct.StructA{ .state = true, .number1 = 1.5e+00, .number2 = 7.77e+00, .number3 = -4.25e+00 }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-packed-struct.StructA{ .state = false, .number1 = 1.0e+00, .number2 = 2.0e+00, .number3 = 3.0e+00 }');
    })
    it('should handle float as comptime field', async function() {
      this.timeout(120000);
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.number).to.equal(5.55);
      const b = new StructA({ state: true });
      expect(b.number).to.equal(5.55);
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .state = true, .number = 5.55e+00 }');
    })
    it('should handle float in bare union', async function() {
      this.timeout(120000);
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect(module.union_a.number).to.equal(1.234);
      if (runtimeSafety) {
        expect(() => module.union_a.state).to.throw();
      }
      const b = new UnionA({ number: 4.567 });
      const c = new UnionA({ state: false });
      expect(b.number).to.equal(4.567);
      expect(c.state).to.be.false;
      if (runtimeSafety) {
        expect(() => c.number).to.throw();
      }
      module.union_a = b;
      expect(module.union_a.number).to.equal(4.567);
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
    })
    it('should handle float in tagged union', async function() {
      this.timeout(120000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.number).to.equal(3.456);
      expect(TagType(module.union_a)).to.equal(TagType.number);
      expect(module.union_a.state).to.be.null;
      const b = new UnionA({ number: 1.23 });
      const c = new UnionA({ state: false });
      expect(b.number).to.equal(1.23);
      expect(c.state).to.false;
      expect(c.number).to.be.null;
      module.union_a = b;
      expect(module.union_a.number).to.equal(1.23);
      module.union_a = c;
      expect(module.union_a.number).to.be.null;
    })
    it('should handle float in optional', async function() {
      this.timeout(120000);
      const { default: module, print } = await importTest('in-optional');
      expect(module.optional).to.equal(3.14);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('3.14e+00');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('null');
      module.optional = 8.12;
      expect(module.optional).to.equal(8.12);
    })
    it('should handle float in error union', async function() {
      this.timeout(120000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union).to.equal(3.14);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('3.14e+00');
      module.error_union = Error.GoldfishDied;
      expect(() => module.error_union).to.throw(Error.GoldfishDied);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('error.GoldfishDied');
      module.error_union = 8.12;
      expect(module.error_union).to.equal(8.12);
    })
    it('should handle float in vector', async function() {
      this.timeout(120000);
      const { default: module, print1, print2, print3 } = await importTest('vector-of');
      expect([ ...module.vector1 ]).to.eql([ 1.5, 2.5, 3.5, 4.5 ]);
      expect([ ...module.vector2 ]).to.eql([ 1.5, 2.5, 3.5, 4.5 ]);
      expect([ ...module.vector3 ]).to.eql([ 1.5, 2.5, 3.5, 4.5 ]);
      const [ before1 ] = await capture(() => print1());
      expect(before1).to.equal('{ 1.5e+00, 2.5e+00, 3.5e+00, 4.5e+00 }');
      module.vector1 = [ 3.5, 3.5, 3.5, 3.5 ];
      const [ after1 ] = await capture(() => print1());
      expect(after1).to.equal('{ 3.5e+00, 3.5e+00, 3.5e+00, 3.5e+00 }');
      const [ before2 ] = await capture(() => print2());
      expect(before2).to.equal('{ 1.5e+00, 2.5e+00, 3.5e+00, 4.5e+00 }');
      module.vector2 = [ 3.5, 3.5, 3.5, 3.5 ];
      const [ after2 ] = await capture(() => print2());
      expect(after2).to.equal('{ 3.5e+00, 3.5e+00, 3.5e+00, 3.5e+00 }');
      const [ before3 ] = await capture(() => print3());
      expect(before3).to.equal('{ 1.5e+00, 2.5e+00, 3.5e+00, 4.5e+00 }');
      module.vector3 = [ 3.5, 3.5, 3.5, 3.5 ];
      const [ after3 ] = await capture(() => print1());
      expect(after3).to.equal('{ 3.5e+00, 3.5e+00, 3.5e+00, 3.5e+00 }');
    })

  })
}