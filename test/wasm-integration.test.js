import { writeFile } from 'fs/promises';
import { join } from 'path';
import { expect } from 'chai';
import { tmpdir } from 'os';
import 'mocha-skip-if';

import { transpile } from '../src/transpiler.js';

const littleEndian = true;

skip.if(process.env.npm_lifecycle_event === 'coverage').
describe('Integration tests (WASM)', function() {
  beforeEach(function() {
    process.env.NODE_ZIG_TARGET = 'WASM-COMPTIME';
  })
  describe('Variables', function() {
    it('should import integer variables', async function() {
      this.timeout(20000);
      const { default: module } = await transpileImport(resolve('./integration/integers.zig'));
      expect(module.private).to.be.undefined;
      expect(module.int4).to.equal(7);
      expect(module.int8).to.equal(127);
      expect(module.uint8).to.equal(0);
      expect(module.int16).to.equal(-44);
      expect(module.uint16).to.equal(44);
      expect(module.int32).to.equal(1234);
      expect(module.uint32).to.equal(34567);
      expect(module.int64).to.equal(0x1FFF_FFFF_FFFF_FFFFn);
      expect(module.uint64).to.equal(0xFFFF_FFFF_FFFF_FFFFn);
      expect(module.int128).to.equal(0xFFFF_FFFF_FFFF_FFFF_1234_5678n);
      module.uint16 = 123;
      expect(module.uint16).to.equal(123);
      expect(() => module.int16 = 0).to.throw();
    })
    it('should import comptime constants', async function() {
      this.timeout(20000);
      const { default: module } = await transpileImport(resolve('./integration/comptime-numbers.zig'));
      expect(module.small).to.equal(127);
      expect(module.negative).to.equal(-167);
      expect(module.larger).to.equal(0x1234_5678);
      expect(module.pi.toFixed(4)).to.equal('3.1416');
    })
    it('should import types', async function() {
      this.timeout(20000);
      const { default: module } = await transpileImport(resolve('./integration/types.zig'));
      const { Int32, Int128, Struct } = module;
      expect(Int32).to.be.a('function');
      const int32 = new Int32();
      int32.$ = 1234;
      expect(int32.$).to.equal(1234);
      expect(Int128).to.be.a('function');
      const int128 = new Int128(0n);
      int128.$ = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn;
      expect(int128.$).to.equal(0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn);
      const object = new Struct();
      expect(object.number1).to.equal(123);
      expect(object.number2).to.equal(456);
    })
    it('should import primitive arrays', async function() {
      this.timeout(20000);
      const { default: module } = await transpileImport(resolve('./integration/arrays-with-primitives.zig'));
      expect(module.int32_array4).to.be.an('object');
      expect(module.int32_array4.get(0)).to.equal(1);
      expect([ ...module.int32_array4 ]).to.eql([ 1, 2, 3, 4 ]);
      module.int32_array4.set(1, 123);
      expect([ ...module.int32_array4 ]).to.eql([ 1, 123, 3, 4 ]);
      expect(module.float64_array4x4).to.be.an('object');
      const row1 = module.float64_array4x4.get(1);
      expect(row1).to.be.an('object');
    })
    it('should import primitive slices', async function() {
      this.timeout(20000);
      const { default: module, __init } = await transpileImport(resolve('./integration/slices-with-primitive.zig'));
      const slice = module.int32_slice;
      expect(module.int32_slice).to.be.an('object');
      expect(module.int32_slice.get(0)).to.equal(123);
      expect([ ...module.int32_slice ]).to.eql([ 123, 456, 789 ]);
      expect(module.u8_slice).to.have.lengthOf(11);
      expect(module.u8_slice.get(0)).to.equal('H'.charCodeAt(0));
      expect([ ...module.uint32_array4 ]).to.eql([ 1, 2, 3, 4 ]);
      expect([ ...module.uint32_slice ]).to.eql([ 2, 3, 4 ]);
      module.uint32_slice.set(1, 777);
      expect([ ...module.uint32_slice ]).to.eql([ 2, 777, 4 ]);
      expect([ ...module.uint32_array4 ]).to.eql([ 1, 2, 777, 4 ]);
      await __init;
      // reading WASM memory now
      module.uint32_array4.set(2, 888);
      expect([ ...module.uint32_array4 ]).to.eql([ 1, 2, 888, 4 ]);
      expect([ ...module.uint32_slice ]).to.eql([ 2, 888, 4 ]);
    })
    it('should import optional values', async function() {
      this.timeout(20000);
      const { default: module } = await transpileImport(resolve('./integration/optionals.zig'));
      expect(module.i32_empty).to.be.null;
      expect(module.i32_value).to.be.equal(1234);
      expect(module.bool_empty).to.be.null;
      expect(module.bool_value).to.be.equal(true);
    })
    it('should import error unions', async function() {
      this.timeout(20000);
      const { default: module, __init } = await transpileImport(resolve('./integration/error-unions.zig'));
      await __init;
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
      this.timeout(20000);
      const { default: module, __init } = await transpileImport(resolve('./integration/bare-union-simple.zig'));
      await __init;
      expect(module.animal.dog).to.equal(123);
      module.useCat();
      expect(module.animal.dog).to.equal(null);
      expect(module.animal.cat).to.equal(777);
      module.useMonkey();
      expect(module.animal.monkey).to.equal(777n);
    })
  })
  describe('Methods', function() {
    it('should import simple function', async function() {
      this.timeout(20000);
      const { default: module } = await transpileImport(resolve('./integration/function-simple.zig'));
      const res = await module.add(5, 17);
      expect(res).to.equal(22);
      expect(module.add(5, 18)).to.equal(23);
    })
    it('should import function that accepts a slice', async function() {
      this.timeout(20000);
      const { default: { fifth }, __init } = await transpileImport(resolve('./integration/function-accepting-slice.zig'));
      await __init;
      const dv = new DataView(new ArrayBuffer(32));
      dv.setInt32(4, 123, littleEndian);
      dv.setInt32(12, 79, littleEndian);
      dv.setInt32(16, 456, littleEndian);
      const res = fifth(dv);
      expect(res).to.equal(456);
    })
    it('should throw when function returns an error', async function() {
      this.timeout(20000);
      const { default: { returnNumber }, __init } = await transpileImport(resolve('./integration/function-returning-error.zig'));
      await __init;
      const result = returnNumber(1234);
      expect(result).to.equal(1234);
      expect(() => returnNumber(0)).to.throw()
        .with.property('message', 'System is on fire');
    })
  })
})

function getWASMRuntime() {
  process.env.NODE_ZIG_TARGET = 'WASM-RUNTIME';
  return resolve('../src/wasm-exporter.js');
}

async function transpileImport(path) {
  const code = await transpile(path, { moduleResolver: getWASMRuntime });
  const hash = await md5(path);
  // need to use .mjs since the file is sitting in /tmp, outside the scope of our package.json
  const jsPath = join(tmpdir(), `${hash}.mjs`);
  await writeFile(jsPath, code);
  return import(jsPath);
}

async function md5(text) {
  const { createHash } = await import('crypto');
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}
