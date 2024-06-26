import { expect } from 'chai';
import { capture, captureWarning } from '../capture.js';

export function addTests(importModule, options) {
  const { optimize } = options;
  const runtimeSafety = [ 'Debug', 'ReleaseSafe' ].includes(optimize);
  const importTest = async (name) => {
      const url = new URL(`./${name}.zig`, import.meta.url).href;
      return importModule(url);
  };
  describe('Function calling', function() {
    it('should throw when function returns an error', async function() {
      this.timeout(120000);
      const { returnNumber } = await importTest('throw-error');
      const result = returnNumber(1234);
      expect(result).to.equal(1234);
      expect(() => returnNumber(0)).to.throw()
        .with.property('message', 'System is on fire');
    })
    it('should throw when argument is invalid', async function() {
      this.timeout(120000);
      const { accept1, accept2, accept3, accept4, Struct } = await importTest('accept-u8');
      expect(() => accept1(1, 123)).to.throw()
        .with.property('message').that.contains('accept1(');
      expect(() => accept3(1)).to.throw()
        .with.property('message').that.contains('accept3(');
      const s = new Struct({});
      expect(() => s.accept(1)).to.throw()
        .with.property('message').that.contains('2 arguments');
      if (runtimeSafety) {
        expect(() => accept1(-1)).to.throw()
          .with.property('message').that.contains('accept1(');
        expect(() => accept2(-1)).to.throw()
          .with.property('message').that.contains('accept2(');
        expect(() => accept3(-1, 3)).to.throw()
          .with.property('message').that.contains('accept3(');
        expect(() => accept4(1, -1)).to.throw()
          .with.property('message').that.contains('accept4(');
        expect(() => s.accept(-1, 1)).to.throw()
          .with.property('message').that.contains('args[0]');
        expect(() => s.accept(1, -1)).to.throw()
          .with.property('message').that.contains('args[1]');
      }
    })
    it('should return a slice of the argument', async function() {
      this.timeout(120000);
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
      this.timeout(120000);
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
      this.timeout(120000);
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
      this.timeout(120000);
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
      this.timeout(120000);
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
      this.timeout(120000);
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
      this.timeout(120000);
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
      this.timeout(120000);
      const {
        allocate,
        allocateNoError,
        allocateOptional,
      } = await importTest('allocate-slice-of-structs');
      const structs1 = allocate(10);
      expect(structs1).to.be.a('[]allocate-slice-of-structs.StructA');
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
      expect(structs2).to.be.a('[]allocate-slice-of-structs.StructA');
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
      expect(structs3).to.be.a('[]allocate-slice-of-structs.StructA');
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
      this.timeout(120000);
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
      this.timeout(120000);
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
      this.timeout(120000);
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
      module.setI8(i8Array.buffer, 9);
      expect([ ...i8Array ]).to.eql([ 9, 9, 9, 9 ]);
      if (runtimeSafety) {
          // should issue a warning
        const [ u16Warning ] = await captureWarning(() => {
          module.setU16(i8Array, 19);
        });
        expect(u16Warning).to.equal('Implicitly creating an Uint16Array from an Int8Array');
      }
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
      this.timeout(120000);
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
      this.timeout(120000);
      const { default: module, Struct, echo } = await importTest('return-same-struct');
      const object1 = new Struct({ number1: 5, number2: 55 });
      const ptr = echo(object1);
      const object2 = ptr['*'];
      expect(object2).to.equal(object1);
    });
    it('should allow method calls', async function() {
      this.timeout(120000);
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
    });
    it('should change pointer target', async function() {
      this.timeout(120000);
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
    });
    it('should be able to call a function marked inline', async function() {
      this.timeout(120000);
      const { returnNumber } = await importTest('inline-function');
      const result = returnNumber(1234);
      expect(result).to.equal(1234);
    })
    it('should handle pointer in struct', async function() {
      this.timeout(120000);
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
    });
    it('should correctly return const pointer', async function() {
      this.timeout(120000);
      const { getUser } = await importTest('return-const-pointer');
      const user = getUser();
      expect(() => user.age = 18).to.throw(TypeError);
      expect(() => user.name = "Jesus Christ").to.throw(TypeError);
      expect(() => user.address.street = "Nowhere").to.throw(TypeError);
      expect(() => user.address.zip = 33333).to.throw(TypeError);
    });
    it('should correctly handle recursive structure', async function() {
      this.timeout(120000);
      const { getRoot } = await importTest('handle-recursive-structure');
      const root = getRoot();
      const parent = root.valueOf();
      const [ child1, child2 ]= parent.children;
      expect(child1.parent).to.equal(parent);
      expect(child2.parent).to.equal(parent);
    });
  })
}