import { expect } from 'chai';
import 'mocha-skip-if';
import { arch, platform } from 'os';
import { fileURLToPath } from 'url';
import { capture, captureWarning } from '../test-utils.js';

export function addTests(importModule, options) {
  const { target, optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name, options) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url, options);
  };
  describe('Function calling', function() {
    it('should throw when function returns an error', async function() {
      this.timeout(0);
      const { returnNumber } = await importTest('throw-error');
      const result = returnNumber(1234);
      expect(result).to.equal(1234);
      expect(() => returnNumber(0)).to.throw(Error)
        .with.property('message', 'System is on fire');
    })
    it('should throw when argument is invalid', async function() {
      this.timeout(0);
      const { accept1, accept2, accept3, accept4, Struct } = await importTest('accept-u8');
      expect(() => accept1(1, 123)).to.throw()
        .with.property('message').that.contains('Expecting 1');
      expect(() => accept3(1)).to.throw()
        .with.property('message').that.contains('Expecting 3');
      const s = new Struct({});
      expect(() => s.accept(1)).to.throw()
        .with.property('message').that.contains('Expecting 2');
      if (runtimeSafety) {
        expect(() => accept1(-1)).to.throw(TypeError)
          .with.property('message').that.contains('args[0]');
        expect(() => accept2(1, -1)).to.throw()
          .with.property('message').that.contains('args[1');
        expect(() => accept3(-1, 3)).to.throw()
          .with.property('message').that.contains('Expecting 3');
        expect(() => accept4(1, -1)).to.throw()
          .with.property('message').that.contains('Expecting 4');
        expect(() => s.accept(-1, 1)).to.throw(TypeError)
          .with.property('message').that.contains('args[0]');
        expect(() => s.accept(1, -1)).to.throw(TypeError)
          .with.property('message').that.contains('args[1]');
      }
    })
    it('should return a slice of the argument', async function() {
      this.timeout(0);
      const { getSlice } = await importTest('return-slice');
      const dv = new DataView(new ArrayBuffer(4 * 12));
      for (let i = 0, j = 1; j <= 12; i += 4, j++) {
        dv.setInt32(i, j, options.littleEndian);
      }
      const slice = getSlice(dv, 2, 5);
      expect([ ...slice ]).to.eql([ 3, 4, 5 ]);
      expect(slice.dataView.byteOffset).to.equal(8);
      expect(slice.dataView.buffer).to.equal(dv.buffer);
    })
    it('should take and return a slice of strings', async function() {
      this.timeout(0);
      const { bounce } = await importTest('return-slice-of-slices');
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
    it('should output a slice of strings to console', async function() {
      this.timeout(0);
      const { print } = await importTest('print-slice-of-slices');
      const inputStrings = [
        'Test string 1',
        'Test string 2',
        '',
        'Test string 3',
      ];
      const outputStrings = await capture(() => print(inputStrings));
      expect(outputStrings).to.eql(inputStrings);
    })
    it('should accept a compatible typed array', async function() {
      this.timeout(0);
      const { fifth, setFifth } = await importTest('accept-typed-array');
      const ta = new Uint32Array(12);
      for (let i = 0, len = ta.length; i < len; i++) {
        ta[i] = i + 1;
      }
      const result = fifth(ta);
      expect(result).to.equal(5);
      setFifth(ta, 50);
      expect(ta[4]).to.equal(50);
    })
    it('should return correctly result from boolean vector functions', async function() {
      this.timeout(0);
      const { any, all } = await importTest('return-bool-vector');
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
      this.timeout(0);
      const { Vector4, double, add } = await importTest('handle-misaligned-pointer');
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
      this.timeout(0);
      const { Vector4, hello, world } = await importTest('handle-misaligned-aliased-pointer');
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
      expect(lines2).to.eql([
        '{ 0, 5, 0, 0, 0, 6, 0, 0, 0, 7, 0, 0, 0, 8, 0, 0, 0 }',
        '{ 5, 6, 7, 8 }',
        '{ 0, 5, 0, 0, 0, 6, 0, 0, 0, 7, 0, 0, 0, 8, 0, 0, 0 }',
        '{ 5, 6, 7, 8 }'
      ]);
    })
    it('should allocate a slice of structs', async function() {
      this.timeout(0);
      const {
        allocate,
        allocateNoError,
        allocateOptional,
      } = await importTest('allocate-slice-of-structs');
      const structs1 = allocate(10);
      expect(structs1).to.be.a('[]StructA');
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
      expect(structs2).to.be.a('[]StructA');
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
      expect(structs3).to.be.a('[]StructA');
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
    it('should clear pointers after Zig functions made them invalid', async function() {
      this.timeout(0);
      const {
        OptionalString,
        ErrorOrString,
        StringOrNumber,
        setOptionalNull,
        setErrorUnion,
        setUnionNumber,
      } = await importTest('clear-pointers');
      const optional = new OptionalString('Hello world');
      // get symbols from the optional object
      const [ MEMORY, SLOTS ] = Object.getOwnPropertySymbols(optional);
      // save the pointer, which we can't access again through the optional once it's set to null
      const pointer1 = optional.$;
      // change the optional thru Zig
      setOptionalNull(optional);
      // the pointer object should have released the object it was pointed to
      expect(pointer1[SLOTS][0]).to.be.undefined;
      const errorUnion = new ErrorOrString('Hello world');
      // save the pointer here for the same reason
      const pointer2 = errorUnion.$;
      // change the error union thru Zig
      setErrorUnion(errorUnion);
      expect(pointer2[SLOTS][0]).to.be.undefined;
      const union = new StringOrNumber({ string: 'Hello world' });
      const pointer3 = union.string;
      setUnionNumber(union);
      expect(pointer3[SLOTS][0]).to.be.undefined;
    })
    it('should clear pointer array after Zig functions made it invalid', async function() {
      this.timeout(0);
      const { OptionalStrings, setOptionalNull } = await importTest('clear-pointer-array');
      const optional = new OptionalStrings([ 'Hello world', 'This is a test' ]);
      // get symbols from the optional object
      const [ MEMORY, SLOTS ] = Object.getOwnPropertySymbols(optional);
      // save the pointer array, which we can't access again through the optional once it's set to null
      const pointers = optional.$;
      // change the optional thru Zig
      setOptionalNull(optional);
      expect(pointers[0][SLOTS][0]).to.be.undefined;
      expect(pointers[1][SLOTS][0]).to.be.undefined;
    })
    it('should correctly auto-cast compatible typed arrays and buffers', async function() {
      this.timeout(0);
      const { default: module } = await importTest('autocast-typed-array');
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
      expect(() => module.setI8(u8Array, 19)).to.throw(TypeError);
      module.setI8(i8Array, 8);
      expect([ ...u8Array ]).to.eql([ 102, 102, 102, 102 ]);
      expect([ ...i8Array ]).to.eql([ 8, 8, 8, 8 ]);
      module.setI8(i8Array.buffer, 9);
      expect([ ...i8Array ]).to.eql([ 9, 9, 9, 9 ]);
      expect(() => module.setU16(i8Array, 19)).to.throw(TypeError);
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
      expect(() => module.setF64(f32Array, 1.25)).to.throw(TypeError);
      module.setF64(f64Array, Math.PI);
      expect([ ...f64Array ]).to.eql([ Math.PI, Math.PI, Math.PI, Math.PI ]);
    })
    it('should correctly auto-cast compatible typed arrays and buffers to primitive pointer', async function() {
      this.timeout(0);
      const { default: module } = await importTest('autocast-typed-array-to-primitive');
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
      module.setI8(i8Array.buffer, 9);
      expect([ ...i8Array ]).to.eql([ 9 ]);
      expect(() => module.setU16(i8Array, 19)).to.throw(TypeError);
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
    it('should attach functions as getters and setters', async function() {
      this.timeout(0);
      const { default: module, Hello } = await importTest('attach-getters-setters');
      expect(module.cow).to.equal(123);
      module.cow = 456;
      expect(module.cow).to.equal(456);
      expect(Hello.something).to.equal(100);
      Hello.something = 200;
      expect(Hello.something).to.equal(200);
      const [ line ] = await capture(() => Hello.printSomething());
      expect(line).to.equal('something = 200');
      const object = new Hello({ dog: 3, cat: 7 });
      expect(object.both).to.equal(10);
    })
    it('should return the same struct', async function() {
      this.timeout(0);
      const { default: module, Struct, echo } = await importTest('return-same-struct');
      const object1 = new Struct({ number1: 5, number2: 55 });
      const ptr = echo(object1);
      const object2 = ptr['*'];
      expect(object2).to.equal(object1);
    })
    it('should allow method calls', async function() {
      this.timeout(0);
      const { Struct } = await importTest('allow-method-calls');
      const a = new Struct({ number: 123 });
      const b = new Struct({ number: 456 });
      const lines1 = await capture(() => {
        a.print1();
        b.print1();
      });
      expect(lines1).to.eql([
        'allow-method-calls.Struct{ .number = 123 }',
        'allow-method-calls.Struct{ .number = 456 }'
      ]);
      const lines2 = await capture(() => {
        a.print2();
        b.print2();
      });
      expect(lines2).to.eql([
        'allow-method-calls.Struct{ .number = 123 }',
        'allow-method-calls.Struct{ .number = 456 }'
      ]);
      a.add(7);
      expect(a.number).to.equal(130);
      b.add(4);
      expect(b.number).to.equal(460);
    })
    it('should change pointer target', async function() {
      this.timeout(0);
      const { default: module, change, print } = await importTest('change-pointer-target');
      expect(module.number_ptr['*']).to.equal(123);
      const [ line1 ] = await capture(() => print());
      expect(line1).to.equal('odd = 123, even = 456');
      module.number_ptr['*'] = 777;
      const [ line2 ] = await capture(() => print());
      expect(line2).to.equal('odd = 777, even = 456');
      change(true);
      expect(module.number_ptr['*']).to.equal(456);
      module.number_ptr['*'] = 888;
      const [ line3 ] = await capture(() => print());
      expect(line3).to.equal('odd = 777, even = 888');
    })
    it('should handle pointer in struct', async function() {
      this.timeout(0);
      const { User } = await importTest('handle-pointer-in-struct');
      const user = new User({ name: 'Alice' });
      const before = await capture(() => {
        user.print1();
        user.print2();
        user.print3();
      });
      expect(before).to.eql([ 'Alice', 'Alice', 'Alice' ]);
      // change pointer and call a second time
      user.name = 'Bob';
      const after = await capture(() => {
        user.print1();
        user.print2();
        user.print3();
      });
      expect(after).to.eql([ 'Bob', 'Bob', 'Bob' ]);
    })
    it('should correctly return const pointer', async function() {
      this.timeout(0);
      const { getUser } = await importTest('return-const-pointer');
      const user = getUser();
      expect(() => user.age = 18).to.throw(TypeError);
      expect(() => user.name = "Jesus Christ").to.throw(TypeError);
      expect(() => user.address.street = "Nowhere").to.throw(TypeError);
      expect(() => user.address.zip = 33333).to.throw(TypeError);
    })
    it('should correctly handle recursive structure', async function() {
      this.timeout(0);
      const { getRoot } = await importTest('handle-recursive-structure');
      const root = getRoot();
      const parent = root.valueOf();
      // for some reason the following line would cause sigfault on the M1 Mac
      // const [ child1, child2 ]= parent.children;
      const child1 = parent.children[0];
      const child2 = parent.children[1];
      expect(child1.parent).to.equal(parent);
      expect(child2.parent).to.equal(parent);
    })
    it('should accept multi-pointers', async function() {
      this.timeout(0);
      const { print } = await importTest('accept-multi-pointer');
      const list = [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
        { a: 5, b: 6 },
        { a: 7, b: 8 },
      ];
      const lines = await capture(() => print(list, list.length));
      expect(lines).to.eql([
        'accept-multi-pointer.Object{ .a = 1, .b = 2 }',
        'accept-multi-pointer.Object{ .a = 3, .b = 4 }',
        'accept-multi-pointer.Object{ .a = 5, .b = 6 }',
        'accept-multi-pointer.Object{ .a = 7, .b = 8 }'
      ]);
    })
    it('should accept C pointers', async function() {
      this.timeout(0);
      const { print, Object } = await importTest('accept-c-pointer');
      const list = [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
        { a: 5, b: 6 },
        { a: 7, b: 8 },
      ];
      const lines1 = await capture(() => print(list, list.length));
      expect(lines1).to.eql([
        'accept-c-pointer.Object{ .a = 1, .b = 2 }',
        'accept-c-pointer.Object{ .a = 3, .b = 4 }',
        'accept-c-pointer.Object{ .a = 5, .b = 6 }',
        'accept-c-pointer.Object{ .a = 7, .b = 8 }'
      ]);
      const lines2 = await capture(() => print(list[2], 1));
      expect(lines2).to.eql([
        'accept-c-pointer.Object{ .a = 5, .b = 6 }',
      ]);
      const object = new Object({ a: 9, b: 10 });
      const lines3 = await capture(() => print(object, 1));
      expect(lines3).to.eql([
        'accept-c-pointer.Object{ .a = 9, .b = 10 }',
      ]);
    })
    it('should return multi-pointers', async function() {
      this.timeout(0);
      const { getPointer } = await importTest('return-multi-pointer');
      const pointer = getPointer();
      expect(pointer.length).to.equal(1);
      expect(pointer.valueOf()).to.eql([ { a: 0, b: 1 } ]);
      expect(() => pointer.length = 5).to.not.throw();
      expect(pointer.valueOf()).to.eql([ { a: 0, b: 1 }, { a: 2, b: 3 }, { a: 4, b: 5 }, { a: 6, b: 7 }, { a: 8, b: 9 } ]);
      expect(() => pointer.length = 6).to.throw(TypeError);
      expect(() => pointer.length = 3).to.not.throw();
      expect(pointer.valueOf()).to.eql([ { a: 0, b: 1 }, { a: 2, b: 3 }, { a: 4, b: 5 } ]);
    });
    it('should return C pointers', async function() {
      this.timeout(0);
      const { getPointer, getString } = await importTest('return-c-pointer');
      const pointer = getPointer();
      expect(pointer.length).to.equal(1);
      expect(pointer.valueOf()).to.eql([ { a: 0, b: 1 } ]);
      expect(() => pointer.length = 5).to.not.throw();
      expect(pointer.valueOf()).to.eql([ { a: 0, b: 1 }, { a: 2, b: 3 }, { a: 4, b: 5 }, { a: 6, b: 7 }, { a: 8, b: 9 } ]);
      expect(() => pointer.length = 6).to.throw(TypeError);
      expect(() => pointer.length = 3).to.not.throw();
      expect(pointer.valueOf()).to.eql([ { a: 0, b: 1 }, { a: 2, b: 3 }, { a: 4, b: 5 } ]);
      const string = getString();
      string.length = 11;
      expect(string.string).to.equal('Hello world');
    })
    it('should call C functions', async function() {
      this.timeout(0);
      const { fopen, fwrite, fclose, puts, stream } = await importTest('call-c-functions', { useLibc: true });
      const buffer1 = Buffer.from('Hello world\0');
      const lines1 = await capture(() => puts(buffer1));
      expect(lines1).to.eql([ 'Hello world' ]);
      const stdout = stream(1);
      const buffer2 = Buffer.from('Hello world!\n');
      const lines2 = await capture(() => fwrite(buffer2, 1, buffer2.byteLength, stdout));
      expect(lines2).to.eql([ 'Hello world!' ]);
      const lines3 = await capture(() => fwrite('Hello?', 1, 6, stdout));
      expect(lines3).to.eql([ 'Hello?' ]);
      const lines4 = await capture(() => puts('Hello world'));
      expect(lines4).to.eql([ 'Hello world' ]);
    })
    // VaList is "disabled due to miscompilations" on 64-bits Windows
    // and ARM64 Linux currently
    skip.if(platform() === 'win32' && arch() === 'x64').
    or(platform() === 'linux' && arch() === 'aarch64').
    it('should call variadic functions', async function() {
      this.timeout(0);
      const {
        Int8, Int16, Int32, Int64, Int128, printIntegers,
        Float16, Float32, Float64, Float80, Float128, printFloats,
        StrPtr, printStrings,
      } = await importTest('call-variadic-functions');
      const lines1 = await capture(() => printIntegers(8, 3,
        new Int8(-10),
        new Int8(-20),
        new Int8(-30),
      ));
      expect(lines1).to.eql([ '-10', '-20', '-30' ]);
      const lines2 = await capture(() => printIntegers(16, 3,
        new Int16(-10),
        new Int16(-200),
        new Int16(-3000),
      ));
      expect(lines2).to.eql([ '-10', '-200', '-3000' ]);
      const lines3 = await capture(() => printIntegers(32, 3,
        new Int32(-10),
        new Int32(-200),
        new Int32(-3000),
      ));
      expect(lines3).to.eql([ '-10', '-200', '-3000' ]);
      const lines4 = await capture(() => printIntegers(64, 3,
        new Int64(-10),
        new Int64(-200),
        new Int64(-3000),
      ));
      expect(lines4).to.eql([ '-10', '-200', '-3000' ]);
      const lines5 = await capture(() => printFloats(16, 3,
        new Float16(-10),
        new Float16(-200),
        new Float16(-3000),
      ));
      expect(lines5).to.eql([ '-10', '-200', '-3000' ]);
      const lines6 = await capture(() => printFloats(32, 3,
        new Float32(-10.25),
        new Float32(-200.25),
        new Float32(-3000.25),
      ));
      expect(lines6).to.eql([ '-10.25', '-200.25', '-3000.25' ]);
      const lines7 = await capture(() => printFloats(64, 3,
        new Float64(-10.25),
        new Float64(-200.25),
        new Float64(-3000.25),
      ));
      expect(lines7).to.eql([ '-10.25', '-200.25', '-3000.25' ]);
      const lines8 = await capture(() => printFloats(80, 3,
        new Float80(-10.25),
        new Float80(-200.25),
        new Float80(-3000.25),
      ));
      expect(lines8).to.eql([ '-10.25', '-200.25', '-3000.25' ]);
      // this fails sporadically on ia32 and doesn't compile on MacOS
      // const lines9 = await capture(() => printFloats(128, 3,
      //   new Float128(-10.25),
      //   new Float128(-200.25),
      //   new Float128(-3000.25),
      // ));
      // expect(lines9).to.eql([ '-10.25', '-200.25', '-3000.25' ]);
      const lines10 = await capture(() => printStrings(3,
        new StrPtr('Agnieszka'),
        new StrPtr('Basia'),
        new StrPtr('Czesia'),
      ));
      expect(lines10).to.eql([ 'Agnieszka', 'Basia', 'Czesia' ]);
    })
    skip.if(platform() === 'win32' && arch() === 'x64').
    or(platform() === 'linux' && arch() === 'aarch64').
    it('should correctly pass unsigned int to variadic function', async function() {
      this.timeout(0);
      const {
        Uint8, Uint16, Uint32, Uint64, Uint128, printUnsigned,
      } = await importTest('call-variadic-functions-with-unsigned-int');
      const lines1 = await capture(() => printUnsigned(8, 3,
        new Uint8(255),
        new Uint8(254),
        new Uint8(253),
      ));
      expect(lines1).to.eql([ '255', '254', '253' ]);
      const lines2 = await capture(() => printUnsigned(16, 3,
        new Uint16(65535),
        new Uint16(65534),
        new Uint16(65533),
      ));
      expect(lines2).to.eql([ '65535', '65534', '65533' ]);
      const lines3 = await capture(() => printUnsigned(32, 3,
        new Uint32(4294967295),
        new Uint32(4294967294),
        new Uint32(4294967293),
      ));
      expect(lines3).to.eql([ '4294967295', '4294967294', '4294967293' ]);
      const lines4 = await capture(() => printUnsigned(64, 3,
        new Uint64(18446744073709551615n),
        new Uint64(18446744073709551614n),
        new Uint64(18446744073709551613n),
      ));
      expect(lines4).to.eql([ '18446744073709551615', '18446744073709551614', '18446744073709551613' ]);
      if (arch() != 'x64') {  // compiler issue https://github.com/ziglang/zig/issues/20417
        const lines5 = await capture(() => printUnsigned(128, 3,
          new Uint128(18446744073709551615n),
          new Uint128(18446744073709551614n),
          new Uint128(18446744073709551613n),
        ));
        expect(lines5).to.eql([ '18446744073709551615', '18446744073709551614', '18446744073709551613' ]);
      }
    })
    skip.if(process.version <= 'v18').
    it('should write to a file using fwrite', async function() {
      this.timeout(0);
      const { WASI } = await import('wasi');
      const { __zigar, fwrite, fopen, fclose } = await importTest('call-fwrite', { useLibc: true, topLevelAwait: false });
      if (target == 'wasm32') {
        const wasi = new WASI({
          version: 'preview1',
          args: [],
          env: {},
          preopens: {
            '/local': fileURLToPath(new URL('./test-data', import.meta.url)),
          },
        });
        await __zigar.init(wasi);
      }
      const path = (target == 'wasm32')
      ? '/local/hello-wasm.txt'
      : fileURLToPath(new URL(`./test-data/hello.txt`, import.meta.url));
      const buffer = Buffer.from('Hello world!\n');
      const f = fopen(path, 'w');
      const count1 = fwrite(buffer, 1, buffer.byteLength, f);
      const count2 = fwrite(buffer, 1, buffer.byteLength, f);
      fclose(f);
      expect(`${count1}`).to.equal(`${buffer.byteLength}`);
      expect(`${count2}`).to.equal(`${buffer.byteLength}`);
    })
    skip.if(process.version <= 'v18').
    it('should read from a file using fread', async function() {
      this.timeout(0);
      const { __zigar, fread, fopen, fclose } = await importTest('call-fread', { useLibc: true, topLevelAwait: false });
      if (target == 'wasm32') {
        const { WASI } = await import('wasi');
        const wasi = new WASI({
          version: 'preview1',
          args: [],
          env: {},
          preopens: {
            '/local': fileURLToPath(new URL('./test-data', import.meta.url)),
          },
        });
        await __zigar.init(wasi);
      }
      const path = (target == 'wasm32')
      ? '/local/donuts.txt'
      : fileURLToPath(new URL(`./test-data/donuts.txt`, import.meta.url));
      const buffer1 = new Uint8Array(3), buffer2 = new Uint8Array(3);
      const f = fopen(path, 'r');
      const count1 = fread(buffer1, 1, buffer1.byteLength, f);
      const count2 = fread(buffer2, 1, buffer2.byteLength, f);
      fclose(f);
      expect(`${count1}`).to.equal(`${buffer1.byteLength}`);
      expect(`${count2}`).to.equal(`${buffer2.byteLength}`);
      expect(String.fromCharCode(...buffer1)).to.equal('Was');
      expect(String.fromCharCode(...buffer2)).to.equal('abi');
    })
    it('should call printf correctly', async function() {
      this.timeout(0);
      const { printf, Int, Double, StrPtr } = await importTest('call-printf', { useLibc: true });
      await capture(() => {
        const result = printf(
          'Hello world %d!\n',
          new Int(123),
        );
        expect(result).to.equal(17);
      });
      const lines1 = await capture(() => printf(
        'Hello world, %d %d %d %d %d!!\n',
        new Int(123),
        new Int(234),
        new Int(345),
        new Int(456),
        new Int(567),
      ));
      expect(lines1).to.eql([ 'Hello world, 123 234 345 456 567!!' ]);
      const lines2 = await capture(() => printf(
        'Hello world, %.2f %.2f %.2f %.2f %.2f!!\n',
        new Double(1.23),
        new Double(2.34),
        new Double(3.45),
        new Double(4.56),
        new Double(5.67),
      ));
      expect(lines2).to.eql([ 'Hello world, 1.23 2.34 3.45 4.56 5.67!!' ]);
      const lines3 = await capture(() => printf(
        'Hello world, %s %s!!\n',
        new StrPtr('Dingo'),
        new StrPtr('Bingo')
      ));
      expect(lines3).to.eql([ 'Hello world, Dingo Bingo!!' ]);
      const lines4 = await capture(() => printf(
        'Hello world, %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %s!!\n',
        new Int(1),
        new Double(2),
        new Int(3),
        new Double(4),
        new Int(5),
        new Double(6),
        new Int(7),
        new Double(8),
        new Int(9),
        new Double(10),
        new Int(11),
        new Double(12),
        new Int(13),
        new Double(14),
        new Int(15),
        new Double(16),
        new Int(17),
        new Double(18),
        new Int(19),
        new Double(20),
        new StrPtr('End')
      ));
      expect(lines4).to.eql([
        'Hello world, 1 2.000000 3 4.000000 5 6.000000 7 8.000000 9 10.000000 11 12.000000 13 14.000000 15 16.000000 17 18.000000 19 20.000000 End!!'
      ]);
      const f = () => printf(
        'Hello world, %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f %d %f!!\n',
        new Int(1),
        new Double(2),
        new Int(3),
        new Double(4),
        new Int(5),
        new Double(6),
        new Int(7),
        new Double(8),
        new Int(9),
        new Double(10),
        new Int(11),
        new Double(12),
        new Int(13),
        new Double(14),
        new Int(15),
        new Double(16),
        new Int(17),
        new Double(18),
        new Int(19),
        new Double(20),
        new Int(21),
        new Double(22),
        new Int(23),
        new Double(24),
        new Int(25),
        new Double(26),
        new Int(27),
        new Double(28),
        new Int(29),
        new Double(30),
        new Int(31),
        new Double(32),
        new Int(33),
        new Double(34),
        new Int(35),
        new Double(36),
        new Int(37),
        new Double(38),
        new Int(39),
        new Double(40),
      );
      const lines5 = await capture(f);
      expect(lines5).to.eql([
        'Hello world, 1 2.000000 3 4.000000 5 6.000000 7 8.000000 9 10.000000 11 12.000000 13 14.000000 15 16.000000 17 18.000000 19 20.000000 21 22.000000 23 24.000000 25 26.000000 27 28.000000 29 30.000000 31 32.000000 33 34.000000 35 36.000000 37 38.000000 39 40.000000!!'
      ]);
    })
    skip.if(process.version <= 'v18').
    it('should write to a file using fprintf', async function() {
      this.timeout(0);
      const { __zigar, fprintf, fopen, fclose, Int, StrPtr } = await importTest('call-fprintf', { useLibc: true, topLevelAwait: false });
      if (target == 'wasm32') {
        const { WASI } = await import('wasi');
        const wasi = new WASI({
          version: 'preview1',
          args: [],
          env: {},
          preopens: {
            '/local': fileURLToPath(new URL('./test-data', import.meta.url)),
          },
        });
        await __zigar.init(wasi);
      }
      const path = (target == 'wasm32')
      ? '/local/world-wasm.txt'
      : fileURLToPath(new URL(`./test-data/world.txt`, import.meta.url));
      const f = fopen(path, 'w');
      const count1 = fprintf(f,
        'Hello world %d!\n',
        new Int(12345),
      );
      const count2 = fprintf(f,
        'Hello world %s!\n',
        new StrPtr('dingo'),
      )
      fclose(f);
      expect(count1).to.equal(19);
      expect(count2).to.equal(19);
    })
    it('should call sprintf correctly', async function() {
      this.timeout(0);
      const { sprintf, Int, Double, StrPtr } = await importTest('call-sprintf', { useLibc: true });
      const buffer = new ArrayBuffer(1024);
      const result1 = sprintf(buffer,
        'Hello world %d!\n',
        new Int(123),
      );
      expect(result1).to.equal(17);
      const ta = new Uint8Array(buffer);
      expect(ta[0]).to.equal('H'.charCodeAt(0));
      expect(ta[1]).to.equal('e'.charCodeAt(0));
      expect(ta[result1]).to.equal(0);
      const result2 = sprintf(buffer,
        'Hello world %d!\n',
        new Int(12345),
      );
      expect(result2).to.equal(19);
      const result3 = sprintf(buffer,
        'Hello world, %.2f!\n',
        new Double(1.23),
      );
      expect(result3).to.equal(19);
    })
    it('should call snprintf correctly', async function() {
      this.timeout(0);
      const { snprintf, Int, Double, StrPtr } = await importTest('call-snprintf', { useLibc: true });
      const buffer = new ArrayBuffer(32);
      const result1 = snprintf(buffer, buffer.byteLength,
        'Hello world %d!\n',
        new Int(123),
      );
      expect(result1).to.equal(17);
      const ta = new Uint8Array(buffer);
      expect(ta[0]).to.equal('H'.charCodeAt(0));
      expect(ta[1]).to.equal('e'.charCodeAt(0));
      expect(ta[result1]).to.equal(0);
      const result2 = snprintf(null, 0,
        'Hello world %d!\n',
        new Int(12345),
      );
      expect(result2).to.equal(19);
      const result3 = snprintf(buffer, buffer.byteLength,
        'Hello world, %.2f!!\n',
        new Double(1.23),
      );
      expect(result3).to.equal(20);
    })
  })
}