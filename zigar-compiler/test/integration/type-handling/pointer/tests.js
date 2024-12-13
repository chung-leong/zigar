import { expect } from 'chai';
import { capture } from '../../test-utils.js';

export function addTests(importModule, options) {
  const { optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Pointer', function() {
    it('should import pointer as static variables', async function() {
      this.timeout(300000);
      const {
        default: module,
        int32_slice,
        u8_slice,
        print,
        printText,
        allocText,
        freeText,
        u8_slice_w_sentinel,
        i64_slice_w_sentinel,
        u8_multi_pointer,
        u8_c_pointer,
        printPointer,
      } = await importTest('as-static-variables');
      expect([ ...module.int32_array ]).to.eql([ 123, 456, 789 ]);
      expect([ ...int32_slice ]).to.eql([ 123, 456, 789 ]);
      expect(module.int32_slice).to.be.an('[]const i32');
      expect(module.int32_slice.get(0)).to.equal(123);
      expect([ ...module.int32_slice ]).to.eql([ 123, 456, 789 ]);
      expect(() => module.int32_slice = [ 1, 2, 3 ]).to.throw(TypeError);
      expect(() => module.int32_slice[0] = 1).to.throw(TypeError);
      const slice = module.int32_slice['*'];
      expect(() => slice.$ = [ 1, 2, 3 ]).to.throw(TypeError);
      expect(() => slice[0] = 1).to.throw(TypeError);
      expect(() => slice[0] = 1).to.throw(TypeError);
      const nonConstSlice = module.int32_slice_nonconst['*'];
      expect(() => nonConstSlice[0] = 1).to.not.throw();
      expect(() => module.int32_slice_nonconst[0] = 123).to.not.throw();
      expect(() => module.int32_slice_nonconst = [ 1, 2, 3 ]).to.throw(TypeError);
      expect(module.u8_slice).to.have.lengthOf(11);
      expect(u8_slice).to.have.lengthOf(11);
      expect(module.u8_slice.get(0)).to.equal('H'.charCodeAt(0));
      expect([ ...module.uint32_array4 ]).to.eql([ 1, 2, 3, 4 ]);
      expect([ ...module.uint32_slice ]).to.eql([ 2, 3, 4 ]);
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ 1, 2, 3, 4 }');
      module.uint32_slice.set(1, 777);
      expect([ ...module.uint32_slice ]).to.eql([ 2, 777, 4 ]);
      expect([ ...module.uint32_array4 ]).to.eql([ 1, 2, 777, 4 ]);
      expect(module.i32_pointer['*']).to.equal(1234);
      const [ after ] = await capture(() => print());
      expect(after).to.equal('{ 1, 2, 777, 4 }');
      // modifying const pointer
      expect(() => module.u8_slice = "This is a test").to.throw(TypeError)
        .with.property('message').that.contains('read-only');
      // we no longer autovivicate for pointers in Zig memory
      expect(() => module.text = "This is a test").to.throw(TypeError)
        .with.property('message').that.contains('garbage-collected');
      const lines = await capture(() => {
        printText();
        // allocate Zig memory
        const text = allocText("This is another test");
        module.text = text;
        printText();
        module.text = module.alt_text;
        printText();
        freeText(text);
      });
      expect(lines).to.eql([
        'Hello world',
        'This is another test',
        'Goodbye cruel world',
      ]);
      const { string } = u8_slice_w_sentinel;
      expect(string).to.equal('Hello world');
      expect([ ...i64_slice_w_sentinel ]).to.eql([ 0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n ]);
      expect(int32_slice.valueOf()).to.eql([ 123, 456, 789 ]);
      expect(JSON.stringify(int32_slice)).to.equal('[123,456,789]');
      expect(u8_multi_pointer.length).to.equal(1);
      expect(u8_multi_pointer.string).to.equal('H');
      expect(() => u8_multi_pointer.length = 11).to.not.throw();
      expect(u8_multi_pointer.length).to.equal(11);
      expect(u8_multi_pointer.string).to.equal('Hello world');
      expect(u8_c_pointer.length).to.equal(12);
      expect(u8_c_pointer.string).to.equal('Hello world');
      const subarray = u8_c_pointer.subarray(0, 5);
      expect(subarray.string).to.equal('Hello');
      const subslice = u8_c_pointer.slice(0, 5);
      expect(subslice.string).to.equal('Hello');
      const intSlice = module.i32_c_pointer['*'];
      expect(intSlice[0]).to.equal(1234);
      const [ pointerBefore ] = await capture(() => printPointer());
      module.i32_c_pointer = null;
      const [ pointerAfter ] = await capture(() => printPointer());
      expect(pointerAfter).to.be.equal('i32@0');
      module.i32_c_pointer = intSlice;
      const [ pointerAfterRestore ] = await capture(() => printPointer());
      expect(pointerAfterRestore).to.equal(pointerBefore);
    })
    it('should print pointer arguments', async function() {
      this.timeout(300000);
      const { print } = await importTest('as-function-parameters');
      const lines = await capture(() => {
        print('hello');
        print('world');
      });
      expect(lines).to.eql([ 'hello', 'world' ]);
    })
    it('should return pointer', async function() {
      this.timeout(300000);
      const { getText } = await importTest('as-return-value');
      expect(getText().string).to.equal('Hello');
    })
    it('should handle pointer in array', async function() {
      this.timeout(300000);
      const { default: module, print } = await importTest('array-of');
      expect(module.array.length).to.equal(4);
      expect(module.array[0].string).to.equal('dog');
      expect(module.array[1].string).to.equal('cat');
      expect(module.array[2].string).to.equal('monkey');
      expect(module.array[3].string).to.equal('cow');
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ { 100, 111, 103 }, { 99, 97, 116 }, { 109, 111, 110, 107, 101, 121 }, { 99, 111, 119 } }');
      module.array[2] = module.alt_text;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('{ { 100, 111, 103 }, { 99, 97, 116 }, { 98, 101, 97, 114 }, { 99, 111, 119 } }');
    })
    it('should handle pointer in struct', async function() {
      this.timeout(300000);
      const { default: module, StructA, print } = await importTest('in-struct');
      expect(module.struct_a.text1.string).to.equal('dog');
      expect(module.struct_a.text2.string).to.equal('cat');
      const b = new StructA({});
      expect(b.text1.string).to.equal('apple');
      expect(b.text2.string).to.equal('orange');
      const [ before ] = await capture(() => print());
      expect(before).to.equal('in-struct.StructA{ .text1 = { 100, 111, 103 }, .text2 = { 99, 97, 116 } }');
      module.struct_a = b;
      const [ after ] = await capture(() => print());
      expect(after).to.equal('in-struct.StructA{ .text1 = { 97, 112, 112, 108, 101 }, .text2 = { 111, 114, 97, 110, 103, 101 } }');
    })
    it('should not compile code with pointer in packed struct', async function() {
      this.timeout(300000);
      await expect(importTest('in-packed-struct')).to.eventually.be.rejected;
    })
    it('should handle pointer as comptime field', async function() {
      this.timeout(300000);
      const { default: module, StructA, print } = await importTest('as-comptime-field');
      expect(module.struct_a.text.string).to.equal('Hello');
      const b = new StructA({ number: 500 });
      expect(b.text['*'] === module.struct_a.text['*']).to.be.true;
      expect(b.text.string).to.equal('Hello');
      const [ line ] = await capture(() => print(b));
      expect(line).to.equal('as-comptime-field.StructA{ .number = 500, .text = { 72, 101, 108, 108, 111 } }');
    })
    it('should handle pointer in bare union', async function() {
      this.timeout(300000);
      const { default: module, UnionA } = await importTest('in-bare-union');
      expect(() => module.union_a.text.string).to.throw(TypeError)
        .with.property('message').that.contains('untagged union');
      if (runtimeSafety) {
        expect(() => module.union_a.number).to.throw();
      }
      const object = new UnionA({ text: module.alt_text });
      expect(() => object.text.string).to.throw(TypeError)
        .with.property('message').that.contains('untagged union');
      const c = new UnionA({ number: 123 });
      expect(c.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => c.text).to.throw();
      }
      module.union_a = c;
      expect(module.union_a.number).to.equal(123);
      if (runtimeSafety) {
        expect(() => module.union_a.text).to.throw();
      }
    })
    it('should handle pointer in tagged union', async function() {
      this.timeout(300000);
      const { default: module, TagType, UnionA } = await importTest('in-tagged-union');
      expect(module.union_a.text.string).to.equal('Hello');
      expect(TagType(module.union_a)).to.equal(TagType.text);
      expect(module.union_a.number).to.be.null;
      const b = new UnionA({ text: module.alt_text });
      const c = new UnionA({ number: 123 });
      expect(b.text.string).to.equal('World');
      expect(c.number).to.equal(123);
      expect(c.text).to.be.null;
      module.union_a = b;
      expect(module.union_a.text.string).to.equal('World');
      module.union_a = c;
      expect(module.union_a.text).to.be.null;
    })
    it('should handle pointer in optional', async function() {
      this.timeout(300000);
      const { default: module, print } = await importTest('in-optional');
      expect(module.optional.string).to.equal('Hello');
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ 72, 101, 108, 108, 111 }');
      module.optional = null;
      expect(module.optional).to.be.null;
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('null');
      module.optional = module.alt_text;
      expect(module.optional.string).to.equal('World');
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('{ 87, 111, 114, 108, 100 }');
    })
    it('should handle pointer in error union', async function() {
      this.timeout(300000);
      const { default: module, Error, print } = await importTest('in-error-union');
      expect(module.error_union.string).to.equal('Hello');
      const [ before ] = await capture(() => print());
      expect(before).to.equal('{ 72, 101, 108, 108, 111 }');
      module.error_union = Error.GoldfishDied;
      expect(() => module.error_union).to.throw(Error.GoldfishDied);
      const [ after1 ] = await capture(() => print());
      expect(after1).to.equal('error.GoldfishDied');
      module.error_union = module.alt_text;
      expect(module.error_union.string).to.equal('World');
      const [ after2 ] = await capture(() => print());
      expect(after2).to.equal('{ 87, 111, 114, 108, 100 }');
    })
    it('should handle pointer in vector', async function() {
      this.timeout(300000);
      const { default: module, vector_const, change } = await importTest('vector-of');
      expect(vector_const.valueOf()).to.eql([ 1, 1, 1, 1 ]);
      expect(module.vector.valueOf()).to.eql([ 1, 1, 1, 1 ]);
      change(123);
      expect(vector_const.valueOf()).to.eql([ 123, 123, 123, 123 ]);
      expect(module.vector.valueOf()).to.eql([ 123, 123, 123, 123 ]);
    })
  })
}