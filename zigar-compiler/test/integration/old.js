import { expect } from 'chai';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import 'mocha-skip-if';

export function addTests(importModule, options) {
  const {
    littleEndian = true,
    optimize,
    target,
  } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  describe('Variables', function() {
    it('should import structs with complex members when there are no functions', async function() {
      this.timeout(120000);
      const { default: module, Pet, StructD } = await importModule(resolve('./zig-samples/basic/structs-with-complex-members.zig'));
      expect(module.struct_b.pet).to.equal(Pet.Cat);
      expect(module.struct_b.a.valueOf()).to.eql({ number1: 22, number2: 2.2 });
      expect([ ...module.struct_b.floats ]).to.eql([ 0.1, 0.2, 0.3, 0.4 ]);
      expect([ ...module.struct_b.integers ]).to.eql([ 0, 1, 2, 3 ]);
      module.struct_b.a = { number1: 123, number2: 456 };
      expect(module.struct_c.a_ptr.valueOf()).to.eql({ number1: 123, number2: 456 });
      // check pointer member default value
      const objectD = new StructD({});
      expect(objectD.a_ptr.valueOf()).to.eql({ number1: 123, number2: 456 });
    })
    it('should import structs with complex members', async function() {
      this.timeout(120000);
      const { default: module, Pet, StructD, print } = await importModule(resolve('./zig-samples/basic/structs-with-complex-members-with-function.zig'));
      expect(module.struct_b.pet).to.equal(Pet.Cat);
      expect(module.struct_b.a.valueOf()).to.eql({ number1: 22, number2: 2.2 });
      expect([ ...module.struct_b.floats ]).to.eql([ 0.1, 0.2, 0.3, 0.4 ]);
      expect([ ...module.struct_b.integers ]).to.eql([ 0, 1, 2, 3 ]);
      module.struct_b.a = { number1: 123, number2: 456 };
      expect(module.struct_c.a_ptr.valueOf()).to.eql({ number1: 123, number2: 456 });
      const lines = await capture(() => print());
      expect(lines[0]).to.equal('123 456');
      // check pointer member default value
      const objectD = new StructD({});
      expect(objectD.a_ptr.valueOf()).to.eql({ number1: 123, number2: 456 });
    })
    it('should import bare union with pointers', async function() {
      this.timeout(120000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/bare-union-with-slice.zig'));
      expect(() => module.variant_a.value.string['*']).to.throw(TypeError)
        .with.property('message').that.contains('not accessible');
      expect(module.variant_b.value.integer).to.equal(123);
      expect(module.variant_c.value.float).to.equal(3.14);
      const { printVariant, printVariantPtr } = module;
      const lines = await capture(() => {
        printVariant(module.variant_a);
        printVariant(module.variant_b);
        printVariant(module.variant_c);
        printVariantPtr(module.variant_a);
        printVariantPtr(module.variant_b);
        printVariantPtr(module.variant_c);
      });
      expect(lines).to.eql([ 'apple', '123', '3.14', 'apple', '123', '3.14' ]);
    })
    it('should import a tagged union that contains a tagged union', async function() {
      this.timeout(120000);
      const { default: module, Donut, VariantType } = await importModule(resolve('./zig-samples/basic/tagged-union-with-tagged-union.zig'));
      expect(module.donut_a.Jelly.String.string).to.equal('Hello world');
      expect(module.donut_a.Chocolate).to.be.null;
      expect(module.donut_b.Jelly).to.be.null;
      expect(module.donut_b.Chocolate).to.equal(1234);
      expect(Donut(module.donut_a)).to.equal(Donut.Jelly);
      expect(Donut(module.donut_b)).to.equal(Donut.Chocolate);
      module.donut_a = { Chocolate: 5678 };
      expect(module.donut_a.Jelly).to.be.null;
      expect(module.donut_a.Chocolate).to.equal(5678);
      expect(Donut(module.donut_a)).to.equal(Donut.Chocolate);
    })
    it('should ignore variables of unsupported types', async function() {
      this.timeout(120000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/unsupported-types.zig'));
      expect(module.number).to.equal(77);
      expect(module.weird).to.be.undefined;
      expect(module.frame).to.be.undefined;
      expect(module.fn1).to.be.undefined;
      expect(module.fn2).to.be.undefined;
    })
    it('should import struct with comptime fields', async function() {
      this.timeout(120000);
      const { StructA, StructB } = await importModule(resolve('./zig-samples/basic/structs-with-comptime-fields.zig'));
      const object = new StructA({ number1: 123 });
      expect(object.number1).to.eql(123);
      expect(object.number2).to.eql(77);
      expect(object.number3).to.eql(0x1000000000000n);
      expect(object.string.string).to.equal('Hello');
      expect(object.number_type).to.be.an('function');
      expect(object.literal).to.be.a('string');
      expect(object.literal).to.eql('donut');
      expect(new object.number_type(0)).to.be.an('i32');
      expect(() => object.number2 = 0).to.throw(Error);
      expect(() => object.$ = { number1: 88 }).to.not.throw();
      expect(() => object.$ = { number1: 88, number2: 1 }).to.throw();
      const object2 = new StructB({});
      expect(object2.number1).to.eql(77);
      expect(object2.number2).to.eql(123);
      expect(object2.number_type).to.be.an('function');
    })
    it('should account for padding bytes of vector', async function() {
      this.timeout(120000);
      const { Vector3 } = await importModule(resolve('./zig-samples/basic/vector-three-wide.zig'));
      const object = new Vector3(undefined);
      expect(object.length).to.equal(3);
    })
  })
  describe('Methods', function() {
    it('should import simple function', async function() {
      this.timeout(120000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/function-simple.zig'));
      const res = module.add(5, 17);
      expect(res).to.equal(22);
      expect(module.add).to.have.property('name', 'add');
    })
    it('should accept a slice', async function() {
      this.timeout(120000);
      const { fifth } = await importModule(resolve('./zig-samples/basic/function-accepting-slice.zig'));
      const dv = new DataView(new ArrayBuffer(32));
      dv.setInt32(4, 123, littleEndian);
      dv.setInt32(12, 79, littleEndian);
      dv.setInt32(16, 456, littleEndian);
      const res = fifth(dv);
      expect(res).to.equal(456);
    })
    it('should output a slice of strings to console', async function() {
      this.timeout(120000);
      const { print } = await importModule(resolve('./zig-samples/basic/function-outputting-slice-of-slices.zig'));
      const inputStrings = [
        'Test string 1',
        'Test string 2',
        '',
        'Test string 3',
      ];
      const outputStrings = await capture(() => print(inputStrings));
      expect(outputStrings).to.eql(inputStrings);
    })
    it('should take and return a slice of strings', async function() {
      this.timeout(120000);
      const { bounce } = await importModule(resolve('./zig-samples/basic/function-returning-slice-of-slices.zig'));
      const inputStrings = [
        'Test string 1',
        'Test string 2',
        '',
        'Test string 3',
      ];
      const result = bounce(inputStrings);
      expect(result).to.be.an('[]const []const u8');
      const outputStrings = [ ...result ].map(a => a.string);
      expect(outputStrings).to.eql(inputStrings);
    })
    it('should throw when function returns an error', async function() {
      this.timeout(120000);
      const { returnNumber } = await importModule(resolve('./zig-samples/basic/function-returning-error-union.zig'));
      const result = returnNumber(1234);
      expect(result).to.equal(1234);
      expect(() => returnNumber(0)).to.throw()
        .with.property('message', 'System is on fire');
    })
    it('should return a string', async function() {
      this.timeout(120000);
      const { getMessage } = await importModule(resolve('./zig-samples/basic/function-returning-string.zig'));
      const { string } = getMessage(123, 456n, 3.14);
      expect(string).to.equal('Numbers: 123, 456, 3.14');
    })
    it('should return a slice of the argument', async function() {
      this.timeout(120000);
      const { getSlice } = await importModule(resolve('./zig-samples/basic/function-returning-slice.zig'));
      const dv = new DataView(new ArrayBuffer(4 * 12));
      for (let i = 0, j = 1; j <= 12; i += 4, j++) {
        dv.setInt32(i, j, littleEndian);
      }
      const slice = getSlice(dv, 2, 5);
      expect([ ...slice ]).to.eql([ 3, 4, 5 ]);
      expect(slice.dataView.byteOffset).to.equal(8);
      expect(slice.dataView.buffer).to.equal(dv.buffer);
    })
    it('should accept a compatible TypedArray', async function() {
      this.timeout(120000);
      const { fifth, setFifth } = await importModule(resolve('./zig-samples/basic/function-accepting-typed-array.zig'));
      const ta = new Uint32Array(12);
      for (let i = 0, len = ta.length; i < len; i++) {
        ta[i] = i + 1;
      }
      const result = fifth(ta);
      expect(result).to.equal(5);
      setFifth(ta, 50);
      expect(ta[4]).to.equal(50);
    })
    it('should return correctly result from vector functions', async function() {
      this.timeout(120000);
      const { Vector4, multiply, add } = await importModule(resolve('./zig-samples/basic/vector-float.zig'));
      const a = new Vector4([ 1, 2, 3, 4 ]);
      const b = new Vector4([ 5, 6, 7, 8 ]);
      const c = multiply(a, b);
      const d = add(a, b);
      expect([ ...c ]).to.eql([ 5, 12, 21, 32 ]);
      expect([ ...d ]).to.eql([ 6, 8, 10, 12 ]);
    })
    it('should return correctly result from boolean vector functions', async function() {
      this.timeout(120000);
      const { any, all } = await importModule(resolve('./zig-samples/basic/vector-bool.zig'));
      const a = [ true, true, true, true ];
      const b = [ true, true, false, true ];
      const c = [ false, false, false, false ];
      expect(all(a)).to.be.true;
      expect(all(b)).to.be.false;
      expect(any(a)).to.be.true;
      expect(any(b)).to.be.true;
      expect(any(c)).to.be.false;
    })
    it('should handle misaligned pointers', async function() {
      this.timeout(120000);
      const { Vector4, double, add } = await importModule(resolve('./zig-samples/basic/vector-float-pointer.zig'));
      const a = new Vector4([ 1, 2, 3, 4 ]);
      // unaligned buffer
      const buffer = new ArrayBuffer(4 * 4 + 1);
      const dv = new DataView(buffer, 1, 4 * 4);
      const b = Vector4(dv);
      b.$ = [ 5, 6, 7, 8 ];
      add(a, b);
      double(b);
      expect([ ...a ]).to.eql([ 6, 8, 10, 12 ]);
      expect([ ...b ]).to.eql([ 10, 12, 14, 16 ]);
    })
    it('should handle misaligned pointer when aliased by another', async function() {
      this.timeout(120000);
      const { Vector4, hello, world } = await importModule(resolve('./zig-samples/basic/function-accepting-different-pointers.zig'));
      // make sure functions work correctly first
      const lines = await capture(() => {
        const vector = new Vector4([ 1, 2, 3, 4 ]);
        hello("Hello", vector);
        world(vector, "World");
      });
      expect(lines).to.eql([
        '{ 72, 101, 108, 108, 111 }',
        '{ 1, 2, 3, 4 }',
        '{ 87, 111, 114, 108, 100 }',
        '{ 1, 2, 3, 4 }'
      ]);
      // unaligned buffer
      const buffer = new ArrayBuffer(4 * 4 + 1);
      const dv = new DataView(buffer, 1, 4 * 4);
      const lines2 = await capture(() => {
        const vector = Vector4(dv);
        vector.$ = [ 5, 6, 7, 8 ];
        hello(buffer, vector);
        world(vector, buffer);
      });
    })
    it('should return optional pointer', async function() {
      this.timeout(120000);
      const { getSentence } = await importModule(resolve('./zig-samples/basic/function-returning-optional-pointer.zig'));
      const res1 = getSentence(0);
      const res2 = getSentence(1);
      expect(res1.string).to.equal('Hello world');
      expect(res2).to.be.null;
    })
    it('should accept optional pointer', async function() {
      this.timeout(120000);
      const { printName } = await importModule(resolve('./zig-samples/basic/function-accepting-optional-pointer.zig'));
      const lines = await capture(() => {
        printName("Bigus Dickus");
        printName(null);
      });
      expect(lines).to.eql([ 'Bigus Dickus', 'Anonymous' ]);
    })
    it('should allocate a slice of structs', async function() {
      this.timeout(120000);
      const {
        allocate,
        allocateNoError,
        allocateOptional,
      } = await importModule(resolve('./zig-samples/basic/function-allocating-slice-of-structs.zig'));
      const structs1 = allocate(10);
      expect(structs1).to.be.a('[]function-allocating-slice-of-structs.StructA');
      expect(structs1).to.have.lengthOf(10);
      for (const [ index, struct ] of structs1.entries()) {
        const { vector1, vector2 } = struct;
        expect(vector1[0].toFixed(5)).to.equal((Math.PI * 0.25 * (index + 1)).toFixed(5));
        expect(vector1[1].toFixed(5)).to.equal((Math.PI * 0.50 * (index + 1)).toFixed(5));
        expect(vector1[2].toFixed(5)).to.equal((Math.PI * 0.75 * (index + 1)).toFixed(5));
        expect(vector1[3].toFixed(5)).to.equal((Math.PI * 1.00 * (index + 1)).toFixed(5));
        expect(vector2[0]).to.equal(Math.PI * 0.25 / (index + 1));
        expect(vector2[1]).to.equal(Math.PI * 0.50 / (index + 1));
        expect(vector2[2]).to.equal(Math.PI * 0.75 / (index + 1));
        expect(vector2[3]).to.equal(Math.PI * 1.00 / (index + 1));
      }
      const structs2 = allocateNoError(10);
      expect(structs2).to.be.a('[]function-allocating-slice-of-structs.StructA');
      expect(structs2).to.have.lengthOf(10);
      for (const [ index, struct ] of structs2.entries()) {
        const { vector1, vector2 } = struct;
        expect(vector1[0].toFixed(5)).to.equal((Math.PI * 0.25 * (index + 1)).toFixed(5));
        expect(vector1[1].toFixed(5)).to.equal((Math.PI * 0.50 * (index + 1)).toFixed(5));
        expect(vector1[2].toFixed(5)).to.equal((Math.PI * 0.75 * (index + 1)).toFixed(5));
        expect(vector1[3].toFixed(5)).to.equal((Math.PI * 1.00 * (index + 1)).toFixed(5));
        expect(vector2[0]).to.equal(Math.PI * 0.25 / (index + 1));
        expect(vector2[1]).to.equal(Math.PI * 0.50 / (index + 1));
        expect(vector2[2]).to.equal(Math.PI * 0.75 / (index + 1));
        expect(vector2[3]).to.equal(Math.PI * 1.00 / (index + 1));
      }
      const structs3 = allocateOptional(10);
      expect(structs3).to.be.a('[]function-allocating-slice-of-structs.StructA');
      expect(structs3).to.have.lengthOf(10);
      for (const [ index, struct ] of structs3.entries()) {
        const { vector1, vector2 } = struct;
        expect(vector1[0].toFixed(5)).to.equal((Math.PI * 0.25 * (index + 1)).toFixed(5));
        expect(vector1[1].toFixed(5)).to.equal((Math.PI * 0.50 * (index + 1)).toFixed(5));
        expect(vector1[2].toFixed(5)).to.equal((Math.PI * 0.75 * (index + 1)).toFixed(5));
        expect(vector1[3].toFixed(5)).to.equal((Math.PI * 1.00 * (index + 1)).toFixed(5));
        expect(vector2[0]).to.equal(Math.PI * 0.25 / (index + 1));
        expect(vector2[1]).to.equal(Math.PI * 0.50 / (index + 1));
        expect(vector2[2]).to.equal(Math.PI * 0.75 / (index + 1));
        expect(vector2[3]).to.equal(Math.PI * 1.00 / (index + 1));
      }
    })
    it('should accept enum as argument', async function() {
      this.timeout(120000);
      const { Pet, printOne, printMultiple } = await importModule(resolve('./zig-samples/basic/function-accepting-enum-items.zig'));
      const lines = await capture(() => {
        printOne(Pet.Turtle);
        printOne(Pet.Cat);
        printOne('Cat');
        printOne(0);
        printMultiple([ Pet.Dog, Pet.Turtle, Pet.Cat ]);
        printMultiple([ 0, 'Turtle', 'Cat' ]);
      });
      expect(lines).to.eql([
        'Turtle',
        'Cat',
        'Cat',
        'Dog',
        'Dog',
        'Turtle',
        'Cat',
        'Dog',
        'Turtle',
        'Cat',
      ]);
      expect(() => printOne('Cow')).to.throw(TypeError);
      expect(() => printOne(88)).to.throw(TypeError);
      expect(() => printMultiple([ 'Dog', 'Cat', 'Tanooki' ])).to.throw(TypeError);
    })
    it('should import the same function under different names', async function() {
      this.timeout(120000);
      const { hello1, hello2, hello3 } = await importModule(resolve('./zig-samples/basic/function-under-different-names.zig'));
      const lines = await capture(() => {
        hello1();
        hello2();
        hello3();
      });
      expect(lines).to.eql([
        'Hello world',
        'Hello world',
        'Hello world',
      ]);
    })
    it('should ignore function with comptime argument', async function() {
      this.timeout(120000);
      const { memset, nothing } = await importModule(resolve('./zig-samples/basic/function-with-comptime-arg.zig'));
      expect(memset).to.be.undefined;
      expect(nothing).to.be.a('function');
    })
    it('should ignore fuinctions with unsupported arguments', async function() {
      this.timeout(120000);
      const {
        needFn,
        needOptionalFn,
        needFrame,
        nothing,
      } = await importModule(resolve('./zig-samples/basic/functions-with-unsupported-arg.zig'));
      expect(needFn).to.be.undefined;
      expect(needOptionalFn).to.be.undefined;
      expect(needFrame).to.be.undefined;
      expect(nothing).to.be.a('function');
    })
    it('should import function returning a pointer to a primitive', async function() {
      this.timeout(120000);
      const { default: module, getPointer } = await importModule(resolve('./zig-samples/basic/function-returning-primitive-pointer.zig'));
      expect(module.number).to.equal(1234);
      const pointer = getPointer();
      expect(pointer['*']).to.equal(1234);
    })
    it('should correctly auto-cast compatible typed arrays and buffers', async function() {
      this.timeout(120000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/function-assigning-value-to-slice.zig'));
      const u8Array = new Uint8Array(4);
      const i8Array = new Int8Array(4);
      const u16Array = new Uint16Array(4);
      const i16Array = new Int16Array(4);
      const u32Array = new Uint32Array(4);
      const i32Array = new Int32Array(4);
      const u64Array = new BigUint64Array(4);
      const i64Array = new BigInt64Array(4);
      const f32Array = new Float32Array(4);
      const f64Array = new Float64Array(4);
      module.setU8(u8Array, 100);
      expect([ ...u8Array ]).to.eql([ 100, 100, 100, 100 ]);
      module.setU8(u8Array.buffer, 101);
      expect([ ...u8Array ]).to.eql([ 101, 101, 101, 101 ]);
      module.setU8(new DataView(u8Array.buffer), 102);
      expect([ ...u8Array ]).to.eql([ 102, 102, 102, 102 ]);
      if (runtimeSafety) {
        // should issue a warning
        const [ i8Warning ] = await captureWarning(() => {
          module.setI8(u8Array, 19);
        });
        expect(i8Warning).to.equal('Implicitly creating an Int8Array from an Uint8Array');
      }
      module.setI8(i8Array, 8);
      expect([ ...u8Array ]).to.eql([ 102, 102, 102, 102 ]);
      expect([ ...i8Array ]).to.eql([ 8, 8, 8, 8 ]);
      expect(() => module.setI8(i8Array.buffer, 9)).to.throw(TypeError);
      if (runtimeSafety) {
          // should issue a warning
        const [ u16Warning ] = await captureWarning(() => {
          module.setU16(i8Array, 19);
        });
        expect(u16Warning).to.equal('Implicitly creating an Uint16Array from an Int8Array');
      }
      expect([ ...i8Array ]).to.eql([ 8, 8, 8, 8 ]);
      module.setU16(u16Array, 127);
      expect([ ...u16Array ]).to.eql([ 127, 127, 127, 127 ]);
      expect(() => module.setU16(u16Array.buffer, 127)).to.throw(TypeError);
      module.setI16(i16Array, 72);
      expect([ ...i16Array ]).to.eql([ 72, 72, 72, 72 ]);
      module.setU32(u32Array, 88);
      expect([ ...u32Array ]).to.eql([ 88, 88, 88, 88 ]);
      module.setI32(i32Array, 0x7FEE7711);
      expect([ ...i32Array ]).to.eql([ 0x7FEE7711, 0x7FEE7711, 0x7FEE7711, 0x7FEE7711 ]);
      module.setU64(u64Array, 0xF0000000n);
      expect([ ...u64Array ]).to.eql([ 0xF0000000n, 0xF0000000n, 0xF0000000n, 0xF0000000n ]);
      module.setI64(i64Array, 1234567890n);
      expect([ ...i64Array ]).to.eql([ 1234567890n, 1234567890n, 1234567890n, 1234567890n ]);
      module.setI64(new DataView(i64Array.buffer, 0, 8 * 2), 18n);
      expect([ ...i64Array ]).to.eql([ 18n, 18n, 1234567890n, 1234567890n ]);
      module.setF32(f32Array, 0.25);
      expect([ ...f32Array ]).to.eql([ 0.25, 0.25, 0.25, 0.25 ]);
      if (runtimeSafety) {
          const [ f64Warning ] = await captureWarning(() => {
          module.setF64(f32Array, 1.25);
        });
        expect(f64Warning).to.equal('Implicitly creating a Float64Array from a Float32Array');
      }
      module.setF64(f64Array, Math.PI);
      expect([ ...f64Array ]).to.eql([ Math.PI, Math.PI, Math.PI, Math.PI ]);
    })
    it('should correctly auto-cast compatible typed arrays and buffers to primitive pointer', async function() {
      this.timeout(120000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/function-assigning-value-to-pointer.zig'));
      const u8Array = new Uint8Array(1);
      const u8Array2 = new Uint8Array(2);
      const i8Array = new Int8Array(1);
      const u16Array = new Uint16Array(1);
      const i16Array = new Int16Array(1);
      const u32Array = new Uint32Array(1);
      const i32Array = new Int32Array(1);
      const u64Array = new BigUint64Array(1);
      const i64Array = new BigInt64Array(1);
      const f32Array = new Float32Array(1);
      const f64Array = new Float64Array(1);
      module.setU8(u8Array, 100);
      expect([ ...u8Array ]).to.eql([ 100 ]);
      module.setU8(u8Array.buffer, 101);
      expect([ ...u8Array ]).to.eql([ 101 ]);
      module.setU8(new DataView(u8Array.buffer), 102);
      expect([ ...u8Array ]).to.eql([ 102 ]);
      expect(() => module.setU8(u8Array2, 19)).to.throw(TypeError);
      expect(() => module.setI8(u8Array, 19)).to.throw(TypeError);
      module.setI8(i8Array, 8);
      expect([ ...u8Array ]).to.eql([ 102 ]);
      expect([ ...i8Array ]).to.eql([ 8 ]);
      expect(() => module.setI8(i8Array.buffer, 9)).to.throw(TypeError);
      expect(() => module.setU16(i8Array, 19)).to.throw(TypeError);
      expect([ ...i8Array ]).to.eql([ 8 ]);
      module.setU16(u16Array, 127);
      expect([ ...u16Array ]).to.eql([ 127 ]);
      expect(() => module.setU16(u16Array.buffer, 127)).to.throw(TypeError);
      module.setI16(i16Array, 72);
      expect([ ...i16Array ]).to.eql([ 72 ]);
      module.setU32(u32Array, 88);
      expect([ ...u32Array ]).to.eql([ 88 ]);
      module.setI32(i32Array, 0x7FEE7711);
      expect([ ...i32Array ]).to.eql([ 0x7FEE7711 ]);
      module.setU64(u64Array, 0xF0000000n);
      expect([ ...u64Array ]).to.eql([ 0xF0000000n ]);
      module.setI64(i64Array, 1234567890n);
      expect([ ...i64Array ]).to.eql([ 1234567890n ]);
      module.setF32(f32Array, 0.25);
      expect([ ...f32Array ]).to.eql([ 0.25 ]);
      expect(() => module.setF64(f32Array, 1.25)).to.throw(TypeError);
      module.setF64(f64Array, Math.PI);
      expect([ ...f64Array ]).to.eql([ Math.PI ]);
    })
    it('should free pointers after Zig functions made them invalid', async function() {
      this.timeout(120000);
      const {
        OptionalString,
        ErrorOrString,
        StringOrNumber,
        setOptionalNull,
        setErrorUnion,
        setUnionNumber,
      } = await importModule(resolve('./zig-samples/basic/functions-freeing-pointers.zig'));
      const optional = new OptionalString('Hello world');
      // get symbols from the optional object
      const [ MEMORY, SLOTS ] = Object.getOwnPropertySymbols(optional);
      // save the pointer, which we can't access again through the optional once it's set to null
      const pointer1 = optional.$;
      // change the optional thru Zig
      setOptionalNull(optional);
      // the pointer object should have released the object it was pointer to
      expect(pointer1[SLOTS][0]).to.be.null;
      const errorUnion = new ErrorOrString('Hello world');
      // save the pointer here for the same reason
      const pointer2 = errorUnion.$;
      // change the error union thru Zig
      setErrorUnion(errorUnion);
      expect(pointer2[SLOTS][0]).to.be.null;
      const union = new StringOrNumber({ String: 'Hello world' });
      const pointer3 = union.String;
      setUnionNumber(union);
      expect(pointer3[SLOTS][0]).to.be.null;
    })
    it('should free pointer array after Zig functions made it invalid', async function() {
      this.timeout(120000);
      const {
        OptionalStrings,
        setOptionalNull,
      } = await importModule(resolve('./zig-samples/basic/function-freeing-pointer-array.zig'));
      const optional = new OptionalStrings([ 'Hello world', 'This is a test' ]);
      // get symbols from the optional object
      const [ MEMORY, SLOTS ] = Object.getOwnPropertySymbols(optional);
      // save the pointer array, which we can't access again through the optional once it's set to null
      const pointers = optional.$;
      // change the optional thru Zig
      setOptionalNull(optional);
      expect(pointers[0][SLOTS][0]).to.be.null;
      expect(pointers[1][SLOTS][0]).to.be.null;
    })
    it('should not export function with illegal name', async function() {
      this.timeout(120000);
      const exports = await importModule(resolve('./zig-samples/basic/function-with-illegal-name.zig'));
      const { default: module } = exports;
      const name = ' \nthis is a totally weird function name!! :-)';
      const f = module[name];
      expect(f).to.be.a('function');
      expect(exports[name]).to.be.undefined;
      const lines = await capture(() => f())
      expect(lines[0]).to.equal('Hello world');
    })
  })
}

function resolve(relPath) {
  return new URL(relPath, import.meta.url).href;
}

async function capture(cb) {
  const logFn = console.log;
  const lines = [];
  try {
    console.log = (text) => {
      if (typeof(text) === 'string') {
        for (const line of text.split(/\r?\n/)) {
          lines.push(line)
        }
      } else {
        logFn.call(console, text);
      }
    };
    await cb();
  } finally {
    console.log = logFn;
  }
  return lines;
}

async function captureWarning(cb) {
  const warnFn = console.warn;
  const lines = [];
  try {
    console.warn =  (text) => {
      if (typeof(text) === 'string') {
        for (const line of text.split(/\r?\n/)) {
          lines.push(line)
        }
      } else {
        warnFn.call(console, text);
      }
    };
    await cb();
  } finally {
    console.warn = warnFn;
  }
  return lines;
}