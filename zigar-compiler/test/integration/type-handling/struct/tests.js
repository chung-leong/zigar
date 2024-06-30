import { expect } from 'chai';
import { capture } from '../../capture.js';

export function addTests(importModule, options) {
  const { optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Struct', function() {
    it('should import struct as static variables', async function() {
      this.timeout(300000);
      const { default: module, constant, comptime_struct, tuple, print } = await importTest('as-static-variables');
      expect(constant.valueOf()).to.eql({ number1: 123, number2: 456 });
      expect(() => constant.number1 = 1).to.throw(TypeError);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('as-static-variables.Struct{ .number1 = 1, .number2 = 2 }');
      module.variable.number1 = 777;
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('as-static-variables.Struct{ .number1 = 777, .number2 = 2 }');
      module.variable = { number1: 888, number2: 999 };
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('as-static-variables.Struct{ .number1 = 888, .number2 = 999 }');
      expect(comptime_struct.valueOf()).to.eql({
        input: {
          src: {
            channels: 4,
          },
          params: [ 0, 1, 2, 3 ],
        }
      });
      expect(tuple.valueOf()).to.eql([ 123, 3.14, 'evil' ]);
      expect(() => comptime_struct.input.src.channels = 5).to.throw(TypeError);
      expect(() => comptime_struct.input.src = { channels: 5 }).to.throw(TypeError);
      expect(() => comptime_struct.input = { src: { channels: 5 } }).to.throw(TypeError);
      expect(() => tuple[0] = 123).to.throw(TypeError);
      expect(JSON.stringify(module.variable)).to.equal('{"number1":888,"number2":999}');
    })
    it('should print struct arguments', async function() {
      this.timeout(300000);
      const { print } = await importTest('as-function-parameters');
      const lines = await capture(() => print({ number1: 11, number2: 44 }));
      expect(lines).to.eql([ 'as-function-parameters.Struct{ .number1 = 11, .number2 = 44 }' ]);
    })
    it('should return struct', async function() {
      this.timeout(300000);
      const { getStruct } = await importTest('as-return-value');
      expect(getStruct().valueOf()).to.eql({ number1: 1, number2: 2 });
    })
    it('should handle struct in array', async function() {
      this.timeout(300000);
      const {
        default: module,
        array_a,
        array_b,
        print,
      } = await importTest('array-of');
      expect(array_a.valueOf()).to.eql(
        [
          { number1: 1, number2: 2 },
          { number1: 3, number2: 4 },
          { number1: 5, number2: 6 },
          { number1: 7, number2: 8 },
        ]
      );
      expect(array_b.valueOf()).to.eql([
        { good: true, numbers: [ 1, 2, 3, 4 ] },
        { good: false, numbers: [ 3, 4, 5, 6 ] },
        { good: false, numbers: [ 2, 2, 7, 7 ] },
      ])
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ array-of.StructA{ .number1 = 1, .number2 = 2 }, array-of.StructA{ .number1 = 3, .number2 = 4 } }');
      module.array_c[1].number1 = 123;
      module.array_c[1].number2 = 456;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('{ array-of.StructA{ .number1 = 1, .number2 = 2 }, array-of.StructA{ .number1 = 123, .number2 = 456 } }');
    })
    it('should handle struct in struct', async function() {
      this.timeout(300000);
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.valueOf()).to.eql({ struct1: { number1: 1, number2: 2 }, struct2: { number1: 3, number2: 4 } });
      const b = new StructA({});
      expect(b.valueOf()).to.eql({ struct1: { number1: 10, number2: 20 }, struct2: { number1: 11, number2: 21 } });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .struct1 = in-struct.Struct{ .number1 = 1, .number2 = 2 }, .struct2 = in-struct.Struct{ .number1 = 3, .number2 = 4 } }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .struct1 = in-struct.Struct{ .number1 = 10, .number2 = 20 }, .struct2 = in-struct.Struct{ .number1 = 11, .number2 = 21 } }');
    })
    it('should fail when there is a struct in packed struct', async function() {
      this.timeout(300000);
      const { default: module } = await importTest('in-packed-struct');
      expect(() => module.struct_a.valueOf()).to.throw(TypeError);
    })
    it('should handle struct as comptime field', async function() {
      this.timeout(300000);
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.structure.valueOf()).to.eql({ number1: 100, number2: 200 });
      const b = new StructA({ number: 500 });
      expect(b.structure.valueOf()).to.eql({ number1: 100, number2: 200 });
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .number = 500, .structure = as-comptime-field.Struct{ .number1 = 100, .number2 = 200 } }');
    })
    it('should handle struct in bare union', async function() {
      this.timeout(300000);
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect(module.union_a.structure.valueOf()).to.eql({ number1: 100, number2: 200 });
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
      const b = new UnionA({ structure: { number1: 1, number2: 2 } });
      const c = new UnionA({ number: 123 });
      expect(b.structure.valueOf()).to.eql({ number1: 1, number2: 2 });
      expect(c.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => c.structure).to.throw();
      }
      module.union_a = b;
      expect(module.union_a.structure.valueOf()).to.eql({ number1: 1, number2: 2 });
      module.union_a = c;
      if (runtimeSafety) {
        expect(() => module.union_a.structure).to.throw();
      }
    })
    it('should handle struct in tagged union', async function() {
      this.timeout(300000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.structure.valueOf()).to.eql({ number1: 100, number2: 200 });
      expect(TagType(module.union_a)).to.equal(TagType.structure);
      expect(module.union_a.number).to.be.null;
      const b = new UnionA({ structure: { number1: 1, number2: 2 } });
      const c = new UnionA({ number: 123 });
      expect(b.structure.valueOf()).to.eql({ number1: 1, number2: 2 });
      expect(c.number).to.equal(123);
      expect(c.structure).to.be.null;
      module.union_a = b;
      expect(module.union_a.structure.valueOf()).to.eql({ number1: 1, number2: 2 });
      module.union_a = c;
      expect(module.union_a.structure).to.be.null;
    })
    it('should handle struct in optional', async function() {
      this.timeout(300000);
      const { default: module, print } = await importTest('in-optional');
      expect(module.optional.valueOf()).to.eql({ number1: 100, number2: 200 });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-optional.Struct{ .number1 = 100, .number2 = 200 }');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('null');
      module.optional = { number1: 1, number2: 2 };
      expect(module.optional.valueOf()).to.eql({ number1: 1, number2: 2 });
    })
    it('should handle struct in error union', async function() {
      this.timeout(300000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union.valueOf()).to.eql({ number1: 100, number2: 200 });
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-error-union.Struct{ .number1 = 100, .number2 = 200 }');
      module.error_union = Error.goldfish_died;
      expect(() => module.error_union).to.throw(Error.goldfish_died);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('error.goldfish_died');
      module.error_union = { number1: 1, number2: 2 };
      expect(module.error_union.valueOf()).to.eql({ number1: 1, number2: 2 });
    })
    it('should not compile code containing struct vector', async function() {
      this.timeout(300000);
      await expect(importTest('vector-of')).to.eventually.be.rejected;
    })
  })
}