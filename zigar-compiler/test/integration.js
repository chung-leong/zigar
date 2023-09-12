import { expect } from 'chai';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import 'mocha-skip-if';

export function addTests(importModule, options) {
  const {
    littleEndian = true,
    optimize,
    target,
  } = options;
  beforeEach(function() {
    process.env.ZIGAR_TARGET = target;
    process.env.ZIGAR_OPTIMIZE = optimize;
  })
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  describe('Console', function() {
    it('should output to development console', async function() {
      this.timeout(60000);
      const { hello } = await importModule(resolve('./zig-samples/basic/console.zig'));
      const lines = await capture(() => hello());
      expect(lines).to.eql([ 'Hello world!' ]);
    })
  })
  describe('Variables', function() {
    it('should import integer variables', async function() {
      this.timeout(60000);
      const { default: module, int4, int8, int16 } = await importModule(resolve('./zig-samples/basic/integers.zig'));
      expect(module.private).to.be.undefined;
      expect(module.int4).to.equal(7);
      expect(int4).to.be.undefined;
      expect(module.int8).to.equal(127);
      expect(int8).to.be.undefined;
      expect(module.uint8).to.equal(0);
      expect(module.int16).to.equal(-44);
      expect(int16).to.equal(-44);
      expect(module.uint16).to.equal(44);
      expect(module.int32).to.equal(1234);
      expect(module.uint32).to.equal(34567);
      expect(module.int64).to.equal(0x1FFF_FFFF_FFFF_FFFFn);
      expect(module.uint64).to.equal(0xFFFF_FFFF_FFFF_FFFFn);
      expect(module.int128).to.equal(0xFFFF_FFFF_FFFF_FFFF_1234_5678n);
      expect(module.size1).to.equal(1234);
      expect(module.size2).to.equal(-1234);
      module.uint16 = 123;
      expect(module.uint16).to.equal(123);
      expect(() => module.int16 = 0).to.throw();
    })
    it('should import float variables', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/floats.zig'));
      expect(module.float16_const.toFixed(1)).to.equal('-44.4');
      expect(module.float16.toFixed(2)).to.equal('0.44');
      expect(module.float32_const.toFixed(4)).to.equal('0.1234');
      expect(module.float32.toFixed(2)).to.equal('34567.56');
      expect(module.float64).to.equal(Math.PI);
      expect(module.float80).to.equal(Math.PI);
      expect(module.float128).to.equal(Math.PI);
      expect(() => module.float32_const = 0).to.throw();
    })
    it('should import comptime constants', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/comptime-numbers.zig'));
      expect(module.small).to.equal(127);
      expect(module.negative).to.equal(-167);
      expect(module.larger).to.equal(0x1234_5678);
      expect(module.pi.toFixed(4)).to.equal('3.1416');
    })
    it('should import types', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/types.zig'));
      const { Int32, Int128, Struct } = module;
      expect(Int32).to.be.a('function');
      const int32 = new Int32(undefined);
      int32.$ = 1234;
      expect(int32.$).to.equal(1234);
      expect(Int128).to.be.a('function');
      const int128 = new Int128(0n);
      int128.$ = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn;
      expect(int128.$).to.equal(0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn);
      const object = new Struct({});
      expect(object.number1).to.equal(123);
      expect(object.number2).to.equal(456);
    })
    it('should import primitive arrays', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/arrays-with-primitives.zig'));
      expect(module.int32_array4).to.be.an('[4]i32');
      expect(module.int32_array4.get(0)).to.equal(1);
      expect([ ...module.int32_array4 ]).to.eql([ 1, 2, 3, 4 ]);
      module.int32_array4.set(1, 123);
      expect([ ...module.int32_array4 ]).to.eql([ 1, 123, 3, 4 ]);
      expect(module.float64_array4x4).to.be.an('[4][4]f64');
      const row1 = module.float64_array4x4.get(1);
      expect(row1).to.be.an('[4]f64');
    })
    it('should import primitive slices', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/slices-with-primitive.zig'));
      expect([ ...module.int32_array ]).to.eql([ 123, 456, 789 ]);
      expect(module.int32_slice).to.be.an('[]const i32');
      expect(module.int32_slice.get(0)).to.equal(123);
      expect([ ...module.int32_slice ]).to.eql([ 123, 456, 789 ]);
      expect(module.u8_slice).to.have.lengthOf(11);
      expect(module.u8_slice.get(0)).to.equal('H'.charCodeAt(0));
      expect([ ...module.uint32_array4 ]).to.eql([ 1, 2, 3, 4 ]);
      expect([ ...module.uint32_slice ]).to.eql([ 2, 3, 4 ]);
      module.uint32_slice.set(1, 777);
      expect([ ...module.uint32_slice ]).to.eql([ 2, 777, 4 ]);
      expect([ ...module.uint32_array4 ]).to.eql([ 1, 2, 777, 4 ]);
    })
    it('should import optional values', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/optionals.zig'));
      expect(module.i32_empty).to.be.null;
      expect(module.i32_value).to.be.equal(1234);
      expect(module.bool_empty).to.be.null;
      expect(module.bool_value).to.be.equal(true);
    })
    it('should import error unions', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/error-unions.zig'));
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
      module.void_error = null;
      expect(module.void_error).to.be.null;
    })
    it('should import simple bare union', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/bare-union-simple.zig'));
      expect(module.animal.dog).to.equal(123);
      module.useCat();
      expect(module.animal.cat).to.equal(777);
      if (runtimeSafety) {
        expect(() => module.animal.dog).to.throw(TypeError);
      } else {
        expect(module.animal.dog).to.equal(777);
      }
      module.useMonkey();
      expect(module.animal.monkey).to.equal(777n);
    })
    it('should import slices with sentinel', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/slices-with-sentinel.zig'));
      const { string } = module.u8_slice;
      expect(string).to.equal('Hello world');
      expect([ ...module.i64_slice ]).to.eql([ 0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n ]);
    })
    it('should import error sets', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/error-sets.zig'));
      const { NormalError, StrangeError, PossibleError } = module;
      expect(NormalError.OutOfMemory).to.be.instanceOf(Error);
      expect(NormalError.OutOfMemory).to.be.instanceOf(NormalError);
      expect(PossibleError.OutOfMemory).to.be.instanceOf(PossibleError);
      expect(StrangeError.SystemIsOnFire).to.equal(PossibleError.SystemIsOnFire);
      expect(StrangeError.SystemIsOnFire).to.be.instanceOf(PossibleError);
    })
    it('should import arrays with structs', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/arrays-with-structs.zig'));
      expect(module.array_a.valueOf()).to.eql(
        [
          { number1: 1, number2: 2 },
          { number1: 3, number2: 4 },
          { number1: 5, number2: 6 },
          { number1: 7, number2: 8 },
        ]
      );
      expect(module.array_b.valueOf()).to.eql([
        { good: true, numbers: [ 1, 2, 3, 4 ] },
        { good: false, numbers: [ 3, 4, 5, 6 ] },
        { good: false, numbers: [ 2, 2, 7, 7 ] },
      ])
    })
    it('should import structs with complex members', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/structs-with-complex-members.zig'));
      const { Pet, StructB, StructC, StructD } = module;
      expect(module.struct_b.pet).to.equal(Pet.Cat);
      expect({ ...module.struct_b.a }).to.eql({ number1: 0, number2: 0 });
      expect([ ...module.struct_b.floats ]).to.eql([ 0.1, 0.2, 0.3, 0.4 ]);
      expect([ ...module.struct_b.integers ]).to.eql([ 0, 1, 2, 3 ]);
      module.struct_b.a = { number1: 123, number2: 456 };
      expect({ ...module.struct_c.a_ptr }).to.eql({ number1: 123, number2: 456 });
      // check pointer member default value
      const objectD = new StructD({});
      expect({ ...objectD.a_ptr }).to.eql({ number1: 123, number2: 456 });
    })
    it('should import bare union with pointers', async function() {
      this.timeout(60000);
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
    it('should import tagged union with pointers', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/tagged-union-with-slice.zig'));
      expect(module.variant_a.String.string).to.equal('apple');
      expect(module.variant_a.Integer).to.be.null;
      expect(module.variant_a.Float).to.be.null;
      expect(module.variant_b.Integer).to.equal(123);
      expect(module.variant_c.Float).to.equal(3.14);
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
      this.timeout(60000);
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
    it('should allow assignment to a pointer variable', async function() {
      this.timeout(60000);
      const { default: module,
        printText,
        allocText,
        freeText,
      } = await importModule(resolve('./zig-samples/basic/slice-variable.zig'));
      // this shouln't work
      expect(() => module.text = "This is a test").to.throw(TypeError);
      const lines = await capture(() => {
        printText();
        const text = allocText("This is a test");
        module.text = text;
        printText();
        module.text = module.alt_text;
        printText();
        freeText(text);
      });
      expect(lines).to.eql([
        'Hello world',
        'This is a test',
        'Goodbye cruel world',
      ]);
    })
    it('should ignore variables of unsupported types', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/unsupported-types.zig'));
      expect(module.number).to.equal(77);
      expect(module.weird).to.be.undefined;
      expect(module.frame).to.be.undefined;
      expect(module.fn1).to.be.undefined;
      expect(module.fn2).to.be.undefined;
    })
  })
  describe('Methods', function() {
    it('should import simple function', async function() {
      this.timeout(60000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/function-simple.zig'));
      const res = module.add(5, 17);
      expect(res).to.equal(22);
      expect(module.add).to.have.property('name', 'add');
    })
    it('should accept a slice', async function() {
      this.timeout(60000);
      const { fifth } = await importModule(resolve('./zig-samples/basic/function-accepting-slice.zig'));
      const dv = new DataView(new ArrayBuffer(32));
      dv.setInt32(4, 123, littleEndian);
      dv.setInt32(12, 79, littleEndian);
      dv.setInt32(16, 456, littleEndian);
      const res = fifth(dv);
      expect(res).to.equal(456);
    })
    it('should output a slice of strings to console', async function() {
      this.timeout(60000);
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
    it('should takes and returns a slice of strings', async function() {
      this.timeout(60000);
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
      this.timeout(60000);
      const { returnNumber } = await importModule(resolve('./zig-samples/basic/function-returning-error-union.zig'));
      const result = returnNumber(1234);
      expect(result).to.equal(1234);
      expect(() => returnNumber(0)).to.throw()
        .with.property('message', 'System is on fire');
    })
    it('should return a string', async function() {
      this.timeout(60000);
      const { getMessage } = await importModule(resolve('./zig-samples/basic/function-returning-string.zig'));
      const { string } = getMessage(123, 456n, 3.14);
      expect(string).to.equal('Numbers: 123, 456, 3.14');
    })
    it('should return a slice of the argument', async function() {
      this.timeout(60000);
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
      const { getSlice } = await importModule(resolve('./zig-samples/basic/function-returning-slice.zig'));
      const ta = new Int32Array(12);
      for (let i = 0, len = ta.length; i < len; i++) {
        ta[i] = i + 1;
      }
      const slice = getSlice(ta, 2, 5);
      expect([ ...slice ]).to.eql([ 3, 4, 5 ]);
      expect(slice.dataView.byteOffset).to.equal(8);
      expect(slice.dataView.buffer).to.equal(ta.buffer);
    })
    it('should return correctly result from vector functions', async function() {
      this.timeout(60000);
      const { Vector4, multiply, add } = await importModule(resolve('./zig-samples/basic/vector-float.zig'));
      const a = new Vector4([ 1, 2, 3, 4 ]);
      const b = new Vector4([ 5, 6, 7, 8 ]);
      const c = multiply(a, b);
      const d = add(a, b);
      expect([ ...c ]).to.eql([ 5, 12, 21, 32 ]);
      expect([ ...d ]).to.eql([ 6, 8, 10, 12 ]);
    })
    it('should handle misaligned pointers', async function() {
      this.timeout(60000);
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
    it('should fail when misaligned pointer is aliased by another', async function() {
      this.timeout(60000);
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
      const vector = Vector4(dv);
      vector.$ = [ 5, 6, 7, 8 ];
      expect(() => hello(buffer, vector)).to.throw(Error).with.property('message', 'Unable to retrieve memory location');
      expect(() => world(vector, buffer)).to.throw(Error).with.property('message', 'Unable to retrieve memory location');
      // misaligned buffer should pose no problem when not-aliased
      const lines2 = await capture(() => {
        hello("Hello", vector);
        world(vector, "World");
      });
      expect(lines2).to.eql([
        '{ 72, 101, 108, 108, 111 }',
        '{ 5, 6, 7, 8 }',
        '{ 87, 111, 114, 108, 100 }',
        '{ 5, 6, 7, 8 }'
      ]);
    })
    it('should return optional pointer', async function() {
      this.timeout(60000);
      const { getSentence } = await importModule(resolve('./zig-samples/basic/function-returning-optional-pointer.zig'));
      const res1 = getSentence(0);
      const res2 = getSentence(1);
      expect(res1.string).to.equal('Hello world');
      expect(res2).to.be.null;
    })
    it('should accept optional pointer', async function() {
      this.timeout(60000);
      const { printName } = await importModule(resolve('./zig-samples/basic/function-accepting-optional-pointer.zig'));
      const lines = await capture(() => {
        printName("Bigus Dickus");
        printName(null);
      });
      expect(lines).to.eql([ 'Bigus Dickus', 'Anonymous' ]);
    })
    it('should allocate a slice of structs', async function() {
      this.timeout(60000);
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
      this.timeout(60000);
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
      this.timeout(60000);
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
      this.timeout(60000);
      const { memset, nothing } = await importModule(resolve('./zig-samples/basic/function-with-comptime-arg.zig'));
      expect(memset).to.be.undefined;
      expect(nothing).to.be.a('function');
    })
    it('should ignore fuinctions with unsupported arguments', async function() {
      this.timeout(60000);
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
      this.timeout(60000);
      const { default: module, getPointer } = await importModule(resolve('./zig-samples/basic/function-returning-primitive-pointer.zig'));
      expect(module.number).to.equal(1234);
      const pointer = getPointer();
      expect(pointer['*']).to.equal(1234);
    })
    it('should correctly auto-cast compatible typed arrays and buffers', async function() {
      this.timeout(60000);
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
      this.timeout(60000);
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
      this.timeout(60000);
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
      // give the optional a chance to notice that it's now null and should therefore release the pointer
      expect(optional.$).to.be.null;
      // the pointer object should have released the object it was pointer to
      expect(pointer1[SLOTS][0]).to.be.null;
      const errorUnion = new ErrorOrString('Hello world');
      // save the pointer here for the same reason
      const pointer2 = errorUnion.$;
      // change the error union thru Zig
      setErrorUnion(errorUnion);
      // give the error union a chance to release its pointer
      expect(() => errorUnion.$).to.throw(Error);
      expect(pointer2[SLOTS][0]).to.be.null;
      const union = new StringOrNumber({ String: 'Hello world' });
      const pointer3 = union.String;
      setUnionNumber(union);
      // setters also perform pointer clean up
      union.Number = 0;
      expect(pointer3[SLOTS][0]).to.be.null;
    })
  })
  describe('Error handling', function() {
    beforeEach(function() {
      process.env.ZIGAR_KEEP_NAMES = '1';
    })
    skip.permanently.unless(process.env.ZIGAR_TARGET === 'WASM-COMPTIME').
    it('should produce an error return trace', async function() {
      this.timeout(60000);
      const { fail } = await importModule(resolve('./zig-samples/basic/error-trace.zig'));
      if (runtimeSafety) {
        expect(fail).to.throw(WebAssembly.RuntimeError)
          .with.property('stack')
            .that.contains('error-trace.fail')
            .and.contains('error-trace.a')
            .and.contains('error-trace.b')
            .and.contains('error-trace.c')
            .and.contains('error-trace.d');
      } else {
        expect(fail).to.not.throw();
      }
    })
    afterEach(function() {
      process.env.ZIGAR_KEEP_NAMES = '';
    })
  })
  describe('Memory allocation', function() {
    it('should return memory from internal allocator', async function() {
      this.timeout(60000);
      const { createSlice, printSlice, freeSlice } = await importModule(resolve('./zig-samples/basic/memory-allocation.zig'));
      for (let i = 0; i < 10; i++) {
        const slice = createSlice(16);
        for (let i = 0, { length, set } = slice; i < length; i++) {
          set(i, (i + 1) * 10);
        }
        const lines = await capture(() => {
          printSlice(slice);
        });
        expect(lines).to.eql([
          '10', '20', '30', '40',
          '50', '60', '70', '80',
          '90', '100', '110', '120',
          '130', '140', '150', '160',
        ]);
        expect(() => freeSlice(slice)).to.not.throw();
      }
    })
  })
  describe('Crypto functions', function() {
    it('should produce MD5 hash matching that from Node native function', async function() {
      this.timeout(60000);
      const { md5 } = await importModule(resolve('./zig-samples/crypto/md5.zig'));
      const data = new Uint8Array(1024 * 1024);
      for (let i = 0; i < data.byteLength; i++) {
        data[i] = i & 0xFF;
      }
      const digest1 = md5(data);
      const hash = createHash('md5');
      hash.update(data);
      const digest2 = hash.digest();
      for (const [ index, value ] of digest1.entries()) {
        const other = digest2[index];
        expect(value).to.equal(other);
      }
    })
    it('should produce SHA1 hash matching that from Node native function', async function() {
      this.timeout(60000);
      const { sha1 } = await importModule(resolve('./zig-samples/crypto/sha1.zig'));
      const data = new Uint8Array(1024 * 1024);
      for (let i = 0; i < data.byteLength; i++) {
        data[i] = i & 0xFF;
      }
      const digest1 = sha1(data);
      const hash = createHash('sha1');
      hash.update(data);
      const digest2 = hash.digest();
      for (const [ index, value ] of digest1.entries()) {
        const other = digest2[index];
        expect(value).to.equal(other);
      }
    })
  })
  describe('ZIG Benchmarks Game', function() {
    it('should produce the right results for the binary-trees example', async function() {
      this.timeout(120000);
      const { binaryTree } = await importModule(resolve('./zig-samples/benchmarks-game/binary-trees.zig'));
      const n = 12;
      const lines = await capture(() => binaryTree(n));
      const text = await readFile(resolve(`./zig-samples/benchmarks-game/data/binary-trees-${n}.txt`), 'utf-8');
      const refLines = text.split(/\r?\n/);
      expect(lines.length).to.not.equal(0);
      for (const [ index, line ] of lines.entries()) {
        expect(line).to.equal(refLines[index]);
      }
    })
    it('should produce the right results for the fannkuch-redux example', async function() {
      this.timeout(120000);
      const { Pfannkuchen } = await importModule(resolve('./zig-samples/benchmarks-game/fannkuch-redux.zig'));
      const n = 10;
      const result = Pfannkuchen(n);
      expect(result.checksum).to.equal(73196);
      expect(result.max_flips_count).equal(38);
    })
    it('should produce the right results for the fasta example', async function() {
      this.timeout(120000);
      const { fasta } = await importModule(resolve('./zig-samples/benchmarks-game/fasta.zig'));
      const n = 250000;
      const lines = await capture(() => fasta(n));
      const text = await readFile(resolve(`./zig-samples/benchmarks-game/data/fasta-${n}.txt`), 'utf-8');
      const refLines = text.split(/\r?\n/);
      expect(lines.length).to.not.equal(0);
      for (const [ index, line ] of lines.entries()) {
        expect(line).to.equal(refLines[index]);
      }
    })
    it('should produce the right results for the k-nucleotide example', async function() {
      this.timeout(120000);
      const { kNucleotide } = await importModule(resolve('./zig-samples/benchmarks-game/k-nucleotide.zig'));
      const n = 250000;
      const text = await readFile(resolve(`./zig-samples/benchmarks-game/data/fasta-${n}.txt`), 'utf-8');
      const lines = text.trim().split(/\r?\n/);
      const start = lines.findIndex(l => l.startsWith('>THREE'));
      if (start === -1) {
        throw new Error('Unable to find starting position');
      }
      const input = lines.slice(start + 1);
      const output = kNucleotide(input);
      const outputLines = [ ...output ].map(a => a.string.split(/\n/)).flat();
      const refText = await readFile(resolve(`./zig-samples/benchmarks-game/data/k-nucleotide-${n}.txt`), 'utf-8');
      const refLines = refText.trim().split(/\r?\n/);
      expect(outputLines).to.eql(refLines);
    })
    it('should produce the right results for the mandelbrot example', async function() {
      this.timeout(120000);
      const { mandelbrot } = await importModule(resolve('./zig-samples/benchmarks-game/mandelbrot.zig'));
      const n = 2000;
      const lines = await capture(() => mandelbrot(n));
      const text = await readFile(resolve(`./zig-samples/benchmarks-game/data/mandelbrot-${n}.txt`), 'utf-8');
      const refLines = text.split(/\r?\n/);
      expect(lines.length).to.not.equal(0);
      for (const [ index, line ] of lines.entries()) {
        expect(line).to.equal(refLines[index]);
      }
    })
    it('should produce the right results for the nbody example', async function() {
      this.timeout(120000);
      const {
        Planets, solar_mass, year, advance, energy, offset_momentum
      } = await importModule(resolve('./zig-samples/benchmarks-game/nbody.zig'));
      const solar_bodies = new Planets([
        // Sun
        {
          x: 0.0,
          y: 0.0,
          z: 0.0,
          vx: 0.0,
          vy: 0.0,
          vz: 0.0,
          mass: solar_mass,
        },
        // Jupiter
        {
            x: 4.84143144246472090e+00,
            y: -1.16032004402742839e+00,
            z: -1.03622044471123109e-01,
            vx: 1.66007664274403694e-03 * year,
            vy: 7.69901118419740425e-03 * year,
            vz: -6.90460016972063023e-05 * year,
            mass: 9.54791938424326609e-04 * solar_mass,
        },
        // Saturn
        {
            x: 8.34336671824457987e+00,
            y: 4.12479856412430479e+00,
            z: -4.03523417114321381e-01,
            vx: -2.76742510726862411e-03 * year,
            vy: 4.99852801234917238e-03 * year,
            vz: 2.30417297573763929e-05 * year,
            mass: 2.85885980666130812e-04 * solar_mass,
        },
        // Uranus
        {
            x: 1.28943695621391310e+01,
            y: -1.51111514016986312e+01,
            z: -2.23307578892655734e-01,
            vx: 2.96460137564761618e-03 * year,
            vy: 2.37847173959480950e-03 * year,
            vz: -2.96589568540237556e-05 * year,
            mass: 4.36624404335156298e-05 * solar_mass,
        },
        // Neptune
        {
            x: 1.53796971148509165e+01,
            y: -2.59193146099879641e+01,
            z: 1.79258772950371181e-01,
            vx: 2.68067772490389322e-03 * year,
            vy: 1.62824170038242295e-03 * year,
            vz: -9.51592254519715870e-05 * year,
            mass: 5.15138902046611451e-05 * solar_mass,
        },
      ]);
      const n = 50000;
      offset_momentum(solar_bodies);
      const result1 = energy(solar_bodies['*']);
      advance(solar_bodies, 0.01, n);
      const result2 = energy(solar_bodies['*']);
      expect(year.toFixed(2)).to.equal('365.24');
      expect(solar_mass).to.equal(4.0 * Math.PI * Math.PI);
      expect(result1.toFixed(9)).to.equal('-0.169075164');
      expect(result2.toFixed(9)).to.equal('-0.169078071');
    })
    it('should produce the right results for the reverse-complement example', async function() {
      this.timeout(120000);
      const { reverseComplement } = await importModule(resolve('./zig-samples/benchmarks-game/reverse-complement.zig'));
      const n = 250000;
      const data = await readFile(resolve(`./zig-samples/benchmarks-game/data/fasta-${n}.txt`));
      reverseComplement(data);
      const refData = await readFile(resolve(`./zig-samples/benchmarks-game/data/reverse-complement-${n}.txt`));
      let different = false;
      for (let i = 0; i < refData.byteLength; i++) {
        if (data[i] !== refData[i]) {
          different = true;
          break;
        }
      }
      expect(refData.byteLength).to.be.above(1000);
      expect(different).to.be.false;
    })
    it('should produce the right results for the spectral-norm example', async function() {
      this.timeout(120000);
      const { spectralNorm } = await importModule(resolve('./zig-samples/benchmarks-game/spectral-norm.zig'));
      const n = 1500;
      const result = spectralNorm(n);
      expect(result.toFixed(9)).to.equal('1.274224151');
    })
  })
}

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}

async function capture(cb) {
  const logFn = console.log;
  const lines = [];
  try {
    console.log =  (text) => {
      for (const line of text.split(/\r?\n/)) {
        lines.push(line)
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
      for (const line of text.split(/\r?\n/)) {
        lines.push(line)
      }
    };
    await cb();
  } finally {
    console.warn = warnFn;
  }
  return lines;
}