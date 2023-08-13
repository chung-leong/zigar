import { expect } from 'chai';
import { readFile } from 'fs/promises';

export function addTests(importModule, options) {
  const {
    littleEndian = true,
  } = options;
  describe('Console', function() {
    it('should output to development console', async function() {
      this.timeout(30000);
      const { hello } = await importModule(resolve('./zig-samples/basic/console.zig'));
      const origFn = console.log;
      try {
        let text;
        console.log = (s) => text = s;
        hello();
        expect(text).to.equal('Hello world!');
      } finally {
        console.log = origFn;
      }
    })
  })
  describe('Variables', function() {
    it('should import integer variables', async function() {
      this.timeout(30000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/integers.zig'));
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
      this.timeout(30000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/comptime-numbers.zig'));
      expect(module.small).to.equal(127);
      expect(module.negative).to.equal(-167);
      expect(module.larger).to.equal(0x1234_5678);
      expect(module.pi.toFixed(4)).to.equal('3.1416');
    })
    it('should import types', async function() {
      this.timeout(30000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/types.zig'));
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
      this.timeout(30000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/arrays-with-primitives.zig'));
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
      this.timeout(30000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/slices-with-primitive.zig'));
      expect([ ...module.int32_array ]).to.eql([ 123, 456, 789 ]);
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
    })
    it('should import optional values', async function() {
      this.timeout(30000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/optionals.zig'));
      expect(module.i32_empty).to.be.null;
      expect(module.i32_value).to.be.equal(1234);
      expect(module.bool_empty).to.be.null;
      expect(module.bool_value).to.be.equal(true);
    })
    it('should import error unions', async function() {
      this.timeout(30000);
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
      this.timeout(30000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/bare-union-simple.zig'));
      expect(module.animal.dog).to.equal(123);
      module.useCat();
      expect(module.animal.cat).to.equal(777);
      if (process.env.ZIGAR_OPTIMIZE === 'Debug' || process.env.ZIGAR_OPTIMIZE === 'ReleaseSafe') {
        expect(module.animal.dog).to.equal(null);
      } else {
        expect(module.animal.dog).to.equal(777);
      }
      module.useMonkey();
      expect(module.animal.monkey).to.equal(777n);
    })
  })
  describe('Methods', function() {
    it('should import simple function', async function() {
      this.timeout(30000);
      const { default: module } = await importModule(resolve('./zig-samples/basic/function-simple.zig'));
      const res = module.add(5, 17);
      expect(res).to.equal(22);
    })
    it('should import function that accepts a slice', async function() {
      this.timeout(30000);
      const { default: { fifth } } = await importModule(resolve('./zig-samples/basic/function-accepting-slice.zig'));
      const dv = new DataView(new ArrayBuffer(32));
      dv.setInt32(4, 123, littleEndian);
      dv.setInt32(12, 79, littleEndian);
      dv.setInt32(16, 456, littleEndian);
      const res = fifth(dv);
      expect(res).to.equal(456);
    })
    it('should throw when function returns an error', async function() {
      this.timeout(30000);
      const { default: { returnNumber } } = await importModule(resolve('./zig-samples/basic/function-returning-error.zig'));
      const result = returnNumber(1234);
      expect(result).to.equal(1234);
      expect(() => returnNumber(0)).to.throw()
        .with.property('message', 'System is on fire');
    })
    it('should return a string', async function() {
      this.timeout(30000);
      const { default: { getMessage } } = await importModule(resolve('./zig-samples/basic/function-returning-string.zig'));
      const { string } = getMessage(123, 456n, 3.14);
      expect(string).to.equal('Numbers: 123, 456, 3.14');
    })
    it('should return a slice of the argument', async function() {
      this.timeout(30000);
      const { default: { getSlice } } = await importModule(resolve('./zig-samples/basic/function-returning-slice.zig'));
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
      const { default: { getSlice } } = await importModule(resolve('./zig-samples/basic/function-returning-slice.zig'));
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
      this.timeout(30000);
      const { default: { Vector4, multiply, add } } = await importModule(resolve('./zig-samples/basic/vector-float.zig'));
      const a = new Vector4([ 1, 2, 3, 4 ]);
      const b = new Vector4([ 5, 6, 7, 8 ]);
      const c = multiply(a, b);
      const d = add(a, b);
      expect([ ...c ]).to.eql([ 5, 12, 21, 32 ]);
      expect([ ...d ]).to.eql([ 6, 8, 10, 12 ]);
    })
  })
  describe('ZIG Benchmarks Game', function() {
    it('should produce the right results for the binary-trees example', async function() {
      this.timeout(60000);
      const { default: { binaryTree } } = await importModule(resolve('./zig-samples/benchmarks-game/binary-trees.zig'));
      const n = 14;
      const origFn = console.log;
      const lines = [];
      try {
        console.log = (text) => {
          for (const line of text.split(/\r?\n/)) {
            lines.push(line)
          }
        };
        binaryTree(n);
      } finally {
        console.log = origFn;
      }
      const text = await readFile(resolve(`./zig-samples/benchmarks-game/binary-trees-${n}.txt`), 'utf-8');
      const refLines = text.split(/\r?\n/);
      expect(lines.length).to.not.equal(0);
      for (const [ index, line ] of lines.entries()) {
        expect(line).to.equal(refLines[index]);
      }
    })
    it('should produce the right results for the fannkuch-redux example', async function() {
      this.timeout(60000);
      const { default: { Pfannkuchen } } = await importModule(resolve('./zig-samples/benchmarks-game/fannkuch-redux.zig'));
      const n = 10;
      const result = Pfannkuchen(n);
      expect(result.checksum).to.equal(73196);
      expect(result.max_flips_count).equal(38);
    })
    it('should produce the right results for the fasta example', async function() {
      this.timeout(60000);
      const { default: { fasta } } = await importModule(resolve('./zig-samples/benchmarks-game/fasta.zig'));
      const n = 250000;
      const origFn = console.log;
      const lines = [];
      try {
        console.log = (text) => {
          for (const line of text.split(/\r?\n/)) {
            lines.push(line)
          }
        };
        fasta(n);
      } finally {
        console.log = origFn;
      }
      const text = await readFile(resolve(`./zig-samples/benchmarks-game/fasta-${n}.txt`), 'utf-8');
      const refLines = text.split(/\r?\n/);
      expect(lines.length).to.not.equal(0);
      for (const [ index, line ] of lines.entries()) {
        expect(line).to.equal(refLines[index]);
      }
    })
    it('should produce the right results for the mandelbrot example', async function() {
      this.timeout(60000);
      const { default: { mandelbrot } } = await importModule(resolve('./zig-samples/benchmarks-game/mandelbrot.zig'));
      const n = 2000;
      const origFn = console.log;
      const lines = [];
      try {
        console.log = (text) => {
          for (const line of text.split(/\r?\n/)) {
            lines.push(line)
          }
        };
        mandelbrot(n);
      } finally {
        console.log = origFn;
      }
      const text = await readFile(resolve(`./zig-samples/benchmarks-game/mandelbrot-${n}.txt`), 'utf-8');
      const refLines = text.split(/\r?\n/);
      expect(lines.length).to.not.equal(0);
      for (const [ index, line ] of lines.entries()) {
        expect(line).to.equal(refLines[index]);
      }
    })
    it('should produce the right results for the nbody example', async function() {
      this.timeout(60000);
      const {
        default: {
          Planets, solar_mass, year, advance, energy, offset_momentum
        }
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
    it('should produce the right results for the spectral-norm example', async function() {
      this.timeout(60000);
      const { default: { spectralNorm } } = await importModule(resolve('./zig-samples/benchmarks-game/spectral-norm.zig'));
      const n = 1500;
      const result = spectralNorm(n);
      expect(result.toFixed(9)).to.equal('1.274224151');
    })
  })
}

function resolve(relPath) {
  return new URL(relPath, import.meta.url).pathname;
}
