import { expect } from 'chai';
import MersenneTwister from 'mersenne-twister';

import {
  checkDataView,
  getBoolAccessor,
  getNumericAccessor,
  getTypedArrayClass,
  isTypedArray,
  useAllExtendedTypes
} from '../src/data-view.js';
import { Environment } from '../src/environment.js';
import { MemberType, getIntRange } from '../src/types.js';

describe('Data view functions', function() {
  beforeEach(function() {
    useAllExtendedTypes();
  })
  const env = new Environment();
  describe('isTypedArray', function() {
    it('should return true when given the correct TypedArray', function() {
      const ta = new Int32Array(4);
      expect(isTypedArray(ta, Int32Array)).to.be.true;
    })
    it('should return false when the array type is different', function() {
      const ta = new Int32Array(4);
      expect(isTypedArray(ta, Uint32Array)).to.be.false;
    })
    it('should return false when given no array type', function() {
      const ta = new Int32Array(4);
      expect(isTypedArray(ta)).to.be.false;
    })
  })
  describe('getTypedArrayClass', function() {
    it('should return typed array constructor for integer primitive', function() {
      let index = 0;
      const types = [
        Int8Array,
        Uint8Array,
        Int16Array,
        Uint16Array,
        Int32Array,
        Uint32Array,
        BigInt64Array,
        BigUint64Array,
      ];
      for (const byteSize of [ 1, 2, 4, 8 ]) {
        for (const type of [ MemberType.Int, MemberType.Uint ]) {
          const member = {
            type,
            bitSize: byteSize * 8,
            byteSize,
          };
          const f = getTypedArrayClass(member)
          expect(f).to.be.a('function');
          expect(f).to.equal(types[index++]);
        }
      }
    })
    it('should return a typed array constructor for non-standard integer', function() {
      const member = {
        type: MemberType.Uint,
        bitSize: 36,
        byteSize: 8,
      };
      const f = getTypedArrayClass(member);
      expect(f).to.equal(BigUint64Array);
    })
    it('should return typed array constructor for floating point', function() {
      let index = 0;
      const types = [
        null,
        Float32Array,
        Float64Array,
        null,
      ];
      for (const byteSize of [ 2, 4, 8, 16 ]) {
        const member = {
          type: MemberType.Float,
          bitSize: byteSize * 8,
          byteSize,
        };
        const f = getTypedArrayClass(member);
        expect(f).to.equal(types[index++]);
      }
    })
    it('should return type array constructor of child elements', function() {
      const byteSize = 4 * 4;
      const member = {
        type: MemberType.Object,
        bitSize: byteSize * 8,
        byteSize,
        structure: {
          typedArray: Float32Array,
        },
      };
      const f = getTypedArrayClass(member);
      expect(f).to.equal(Float32Array);
    })
  })
  describe('getBoolAccessor', function() {
    it('should return function for getting standard bool types', function() {
      const dv = new DataView(new ArrayBuffer(1));
      dv.setInt8(0, 1);
      const member = {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 0,
        byteSize: 1,
      };
      const get = getBoolAccessor('get', member);
      const res = get.call(dv, 0);
      expect(res).to.equal(true);
    })
    it('should return function for setting standard bool types', function() {
      const dv = new DataView(new ArrayBuffer(1));
      dv.setUint8(0, 1);
      const member = {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 0,
        byteSize: 1,
      };
      const set = getBoolAccessor('set', member);
      set.call(dv, 0);
      expect(dv.getUint8(0)).to.equal(0);
    })
    it('should work when underlying type is a 64-bit integer', function() {
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigInt64(0, 0x8000000000000000n, true);
      const member = {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 0,
        byteSize: 8,
      };
      const get = getBoolAccessor('get', member);
      expect(get.call(dv, 0, true)).to.be.true;
      const set = getBoolAccessor('set', member);
      set.call(dv, 0, false, true);
      expect(dv.getBigInt64(0)).to.equal(0n);
    })
    it('should return function for getting bitfields', function() {
      const dv = new DataView(new ArrayBuffer(1));
      dv.setInt8(0, 0xAA);
      for (let bitOffset = 0; bitOffset < 8; bitOffset++) {
        const member = {
          type: MemberType.Bool,
          bitSize: 1,
          bitOffset,
        };
        const get = getBoolAccessor('get', member);
        const res = get.call(dv, 0);
        expect(res).to.equal(!!(bitOffset & 0x01));
      }
    })
    it('should return function for setting bitfields', function() {
      const dv = new DataView(new ArrayBuffer(1));
      for (let bitOffset = 0; bitOffset < 8; bitOffset++) {
        const member = {
          type: MemberType.Bool,
          bitSize: 1,
          bitOffset,
        };
        const set = getBoolAccessor('set', member);
        set.call(dv, 0, !!(bitOffset & 0x01));
      }
      expect(dv.getUint8(0)).to.equal(0xAA);
    })
  })
  describe('getNumericAccessor', function() {
    it('should return function for getting standard int types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setBigUint64(8, 0xFFFFFFFFFFFFFFFFn, true);
      for (const bitSize of [ 8, 16, 32, 64 ]) {
        const member = {
          type: MemberType.Int,
          bitSize,
          bitOffset: 64,
          byteSize: bitSize / 8
        }
        const get = getNumericAccessor('get', member);
        const res = get.call(dv, 8, true);
        expect(Number(res)).to.equal(-1);
      }
    })
    it('should return function for setting standard int types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setBigUint64(8, 0xFFFFFFFFFFFFFFFFn, true);
      for (const bitSize of [ 8, 16, 32, 64 ]) {
        const { max } = getIntRange({ type: MemberType.Int, bitSize });
        const member = {
          type: MemberType.Int,
          bitSize,
          bitOffset: 64,
          byteSize: bitSize / 8
        }
        const set = getNumericAccessor('set', member);
        const neg1 = (typeof(max) === 'bigint') ? -1n : -1;
        set.call(dv, 8, neg1, true);
        expect(dv.getBigUint64(8, true)).equal(0xFFFFFFFFFFFFFFFFn);
        expect(dv.getBigUint64(0, true)).equal(0n);
      }
    })
    it('should return function for getting 64-bit isize', function() {
      const member = {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: { name: 'isize' },
      };
      const get = getNumericAccessor('get', member);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigInt64(0, BigInt(Number.MIN_SAFE_INTEGER), true);
      expect(get.call(dv, 0, true)).to.equal(Number.MIN_SAFE_INTEGER);
      dv.setBigInt64(0, BigInt(Number.MIN_SAFE_INTEGER) - 1n, true);
      expect(get.call(dv, 0, true)).to.equal(BigInt(Number.MIN_SAFE_INTEGER) - 1n);
    })
    it('should return function for setting 64-bit isize', function() {
      const member = {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: { name: 'isize' },
      };
      const set = getNumericAccessor('set', member);
      const dv = new DataView(new ArrayBuffer(8));
      set.call(dv, 0, -1234, true);
      expect(dv.getBigInt64(0, true)).to.equal(-1234n);
      set.call(dv, 0, -4567n, true);
      expect(dv.getBigInt64(0, true)).to.equal(-4567n);
    })
    it('should return function for setting 32-bit isize', function() {
      const member = {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        structure: { name: 'isize' },
      };
      const set = getNumericAccessor('set', member);
      const dv = new DataView(new ArrayBuffer(8));
      set.call(dv, 0, 1234, true);
      expect(dv.getInt32(0, true)).to.equal(1234);
      set.call(dv, 0, -1234n, true);
      expect(dv.getInt32(0, true)).to.equal(-1234);
    })
    it('should return functions for getting non-standard int types (aligned, < 64-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setBigUint64(8, 0xFFFFFFFFFFFFFFFFn);
      const standard = [ 8, 16, 32, 64 ];
      for (let bitSize = 2; bitSize < 64; bitSize++) {
        if (standard.includes(bitSize)) {
          continue;
        }
        const member = {
          type: MemberType.Int,
          bitSize,
          bitOffset: 64,
          byteSize: [ 1, 2, 4, 8 ].find(b => b * 8 > bitSize),
        };
        const get = getNumericAccessor('get', member);
        const res = get.call(dv, 8, true);
        expect(Number(res)).to.equal(-1);
      }
    })
    it('should return functions for setting non-standard int types (aligned, < 64-bit)', function() {
      const standard = [ 8, 16, 32, 64 ];
      for (let bitSize = 2; bitSize < 64; bitSize++) {
        const dv = new DataView(new ArrayBuffer(16));
        if (standard.includes(bitSize)) {
          continue;
        }
        const { min, max } = getIntRange({ type: MemberType.Int, bitSize });
        const member = {
          type: MemberType.Int,
          bitSize,
          bitOffset: 64,
          byteSize: [ 1, 2, 4, 8 ].find(b => b * 8 > bitSize),
        };
        const set = getNumericAccessor('set', member);
        set.call(dv, 0, min, true);
        set.call(dv, 8, max, true);
        // assuming that the getter works properly here
        const get = getNumericAccessor('get', member);
        expect(get.call(dv, 0, true)).to.equal(min);
        expect(get.call(dv, 8, true)).to.equal(max);
      }
    })
    it('should return functions for getting non-standard int types (65-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt5
      const bytes = [ 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Int,
        bitSize: 65,
        bitOffset: 0,
        byteSize: 16,
      };
      const get = getNumericAccessor('get', member);
      const res = get.call(dv, 0, true);
      expect(res).to.equal(-0xFFFFFFFFFFFFFFFFn);
    })
    it('should return functions for getting non-standard int types (65-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt5
      const bytes = [ 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, ];
      const member = {
        type: MemberType.Int,
        bitSize: 65,
        bitOffset: 0,
        byteSize: 16,
      };
      const set = getNumericAccessor('set', member);
      set.call(dv, 0, -0xFFFFFFFFFFFFFFFFn, true);
      for (const [ i, b ] of bytes.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    })
    it('should return functions for setting non-standard int types (> 64-bit)', function() {
      for (let bitSize = 65; bitSize < 1024; bitSize += 33) {
        const dv = new DataView(new ArrayBuffer(256));
        const { min, max } = getIntRange({ type: MemberType.Int, bitSize });
        const member = {
          type: MemberType.Int,
          bitSize,
          bitOffset: 0,
          byteSize: Math.ceil(bitSize / 64) * 8,
        };
        const set = getNumericAccessor('set', member);
        set.call(dv, 0, min, true);
        set.call(dv, 128, max, true);
        // assuming that the getter works properly here
        const get = getNumericAccessor('get', member);
        expect(get.call(dv, 0, true)).to.equal(min);
        expect(get.call(dv, 128, true)).to.equal(max);
      }
    })
    it('should return functions for setting non-aligned int', function() {
      this.timeout(10000);
      const type = MemberType.Int;
      for (let bitSize = 2; bitSize <= 64; bitSize++) {
        for (let bitOffset = 1; bitOffset <= 7; bitOffset++) {
          const guard1 = {
            type: MemberType.Uint,
            bitSize : bitOffset,
            bitOffset: 0,
          };
          const member = {
            type,
            bitSize,
            bitOffset,
          };
          const guard2 = {
            type: MemberType.Uint,
            bitSize: 3,
            bitOffset: bitOffset + bitSize,
          };
          const offsetG1 = Math.floor(guard1.bitOffset / 8);
          const offsetG2 = Math.floor(guard2.bitOffset / 8);
          const offset = Math.floor(member.bitOffset / 8);
          const dv = new DataView(new ArrayBuffer(16));
          const getG1 = getNumericAccessor('get', guard1);
          const setG1 = getNumericAccessor('set', guard1);
          const getG2 = getNumericAccessor('get', guard2);
          const setG2 = getNumericAccessor('set', guard2);
          const get = getNumericAccessor('get', member);
          const set = getNumericAccessor('set', member);
          const { min, max } = getIntRange({ type, bitSize });
          const { max: maxG1 } = getIntRange({ type: MemberType.Uint, bitSize: guard1.bitSize });
          const { max: maxG2 } = getIntRange({ type: MemberType.Uint, bitSize: guard2.bitSize });
          let step;
          if (bitSize <= 8) {
            step = 1;
          } else if (bitSize <= 16) {
            step = 2 ** (bitSize - 8) + 1;
          } else if (bitSize <= 32) {
            step = 2 ** (bitSize - 6) + 1;
          } else {
            step = (2n ** BigInt(bitSize - 3)) + 1n;
          }
          for (let i = min; i <= max; i += step) {
            // clear guard bits and set the value
            setG1.call(dv, offsetG1, 0);
            setG2.call(dv, offsetG2, 0);
            set.call(dv, offset, i, true);
            // check if setter set the correct value
            const value1 = get.call(dv, offset, true);
            expect(value1).to.equal(i);
            // ensure setter doesn't write outside of the bit range
            const g1 = getG1.call(dv, offsetG1);
            const g2 = getG2.call(dv, offsetG2);
            expect(g1).to.equal(0);
            expect(g2).to.equal(0);
            // make sure getter isn't reading outside of its bit range
            setG1.call(dv, offsetG1, maxG1);
            setG2.call(dv, offsetG2, maxG2);
            const value2 = get.call(dv, offset, true);
            expect(value2).to.equal(i);
          }
        }
      }
    })
    it('should return function for getting standard uint types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setBigUint64(8, 0xFFFFFFFFFFFFFFFFn, true);
      for (const bitSize of [ 8, 16, 32, 64 ]) {
        const { max } = getIntRange({ type: MemberType.Uint, bitSize });
        const member = {
          type: MemberType.Uint,
          bitSize,
          bitOffset: 64,
          byteSize: bitSize / 8
        }
        const get = getNumericAccessor('get', member);
        const res = get.call(dv, 8, true);
        expect(res).to.equal(max);
      }
    })
    it('should return function for setting standard uint types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setBigUint64(8, 0xFFFFFFFFFFFFFFFFn, true);
      for (const bitSize of [ 8, 16, 32, 64 ]) {
        const { max } = getIntRange({ type: MemberType.Uint, bitSize });
        const member = {
          type: MemberType.Uint,
          bitSize,
          bitOffset: 64,
          byteSize: bitSize / 8
        }
        const set = getNumericAccessor('set', member);
        set.call(dv, 8, max, true);
        expect(dv.getBigUint64(8, true)).equal(0xFFFFFFFFFFFFFFFFn);
        expect(dv.getBigUint64(0, true)).equal(0n);
      }
    })
    it('should return function for getting usize', function() {
      const member = {
        type: MemberType.Uint,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: { name: 'usize' },
      };
      const get = getNumericAccessor('get', member);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigUint64(0, BigInt(Number.MAX_SAFE_INTEGER), true);
      expect(get.call(dv, 0, true)).to.equal(Number.MAX_SAFE_INTEGER);
      dv.setBigUint64(0, BigInt(Number.MAX_SAFE_INTEGER) + 1n, true);
      expect(get.call(dv, 0, true)).to.equal(BigInt(Number.MAX_SAFE_INTEGER) + 1n);
    })
    it('should return function for setting usize', function() {
      const member = {
        type: MemberType.Uint,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: { name: 'usize' },
      };
      const set = getNumericAccessor('set', member);
      const dv = new DataView(new ArrayBuffer(8));
      set.call(dv, 0, 1234, true);
      expect(dv.getBigUint64(0, true)).to.equal(1234n);
      set.call(dv, 0, 4567n, true);
      expect(dv.getBigUint64(0, true)).to.equal(4567n);
    })
    it('should return function for getting 32-bit usize', function() {
      const member = {
        type: MemberType.Uint,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        structure: { name: 'usize' },
      };
      const get = getNumericAccessor('get', member);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 1234, true);
      expect(get.call(dv, 0, true)).to.equal(1234);
    })
    it('should return functions for getting non-standard int types (aligned, < 64-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setBigUint64(8, 0xFFFFFFFFFFFFFFFFn);
      const standard = [ 8, 16, 32, 64 ];
      for (let bitSize = 2; bitSize < 64; bitSize++) {
        if (standard.includes(bitSize)) {
          continue;
        }
        const { max } = getIntRange({ type: MemberType.Uint, bitSize });
        const member = {
          type: MemberType.Uint,
          bitSize,
          bitOffset: 64,
          byteSize: [ 1, 2, 4, 8 ].find(b => b * 8 > bitSize),
        };
        const get = getNumericAccessor('get', member);
        const res = get.call(dv, 8, true);
        expect(res).to.equal(max);
      }
    })
    it('should return functions for setting non-standard int types (aligned, < 64-bit)', function() {
      const standard = [ 8, 16, 32, 64 ];
      for (let bitSize = 2; bitSize < 64; bitSize++) {
        const dv = new DataView(new ArrayBuffer(16));
        if (standard.includes(bitSize)) {
          continue;
        }
        const { min, max } = getIntRange({ type: MemberType.Uint, bitSize });
        const member = {
          type: MemberType.Uint,
          bitSize,
          bitOffset: 64,
          byteSize: [ 1, 2, 4, 8 ].find(b => b * 8 > bitSize),
        };
        const set = getNumericAccessor('set', member);
        set.call(dv, 0, min, true);
        set.call(dv, 8, max, true);
        // assuming that the getter works properly here
        const get = getNumericAccessor('get', member);
        expect(get.call(dv, 0, true)).to.equal(min);
        expect(get.call(dv, 8, true)).to.equal(max);
      }
    })
    it('should return functions for getting non-standard uint types (128-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt1
      const bytes = [ 255, 255, 255, 255, 255, 255, 255, 31, 0, 0, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Uint,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      };
      const get = getNumericAccessor('get', member);
      const res1 = get.call(dv, 0, true);
      expect(res1).to.equal(0x01FFFFFFFFFFFFFFFn);
      // from struct-bytes: BigInt2
      const bytesBE = [ 0, 0, 0, 0, 0, 0, 0, 0, 31, 255, 255, 255, 255, 255, 255, 255, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const res2 = get.call(dv, 0, false);
      expect(res1).to.equal(0x01FFFFFFFFFFFFFFFn);
    })
    it('should return functions for setting non-standard uint types (128-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt1
      const bytes = [ 255, 255, 255, 255, 255, 255, 255, 31, 0, 0, 0, 0, 0, 0, 0, 0, ];
      const member = {
        type: MemberType.Uint,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      };
      const set = getNumericAccessor('set', member);
      set.call(dv, 0, 0x01FFFFFFFFFFFFFFFn, true);
      for (const [ i, b ] of bytes.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      // from struct-bytes: BigInt2
      const bytesBE = [ 0, 0, 0, 0, 0, 0, 0, 0, 31, 255, 255, 255, 255, 255, 255, 255, ];
      set.call(dv, 0, 0x01FFFFFFFFFFFFFFFn, false);
      for (const [ i, b ] of bytesBE.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    });
    it('should return functions for getting non-standard uint types (72-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt3
      const bytes = [ 255, 255, 255, 255, 255, 255, 255, 31, 0, 0, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Uint,
        bitSize: 72,
        bitOffset: 0,
        byteSize: 16,
      };
      const get = getNumericAccessor('get', member);
      const res1 = get.call(dv, 0, true);
      expect(res1).to.equal(0x01FFFFFFFFFFFFFFFn);
      // from struct-bytes: BigInt4
      const bytesBE = [ 0, 31, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const res2 = get.call(dv, 0, false);
      expect(res1).to.equal(0x01FFFFFFFFFFFFFFFn);
    })
    it('should return functions for setting non-standard uint types (72-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt3
      const bytes = [ 255, 255, 255, 255, 255, 255, 255, 31, 0, 0, 0, 0, 0, 0, 0, 0, ];
      const member = {
        type: MemberType.Uint,
        bitSize: 72,
        bitOffset: 0,
        byteSize: 16,
      };
      const set = getNumericAccessor('set', member);
      set.call(dv, 0, 0x01FFFFFFFFFFFFFFFn, true);
      for (const [ i, b ] of bytes.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      // from struct-bytes: BigInt4
      const bytesBE = [ 0, 31, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, ];
      set.call(dv, 0, 0x01FFFFFFFFFFFFFFFn, false);
      for (const [ i, b ] of bytesBE.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    });
    it('should return functions for setting non-standard int types (> 64-bit)', function() {
      for (let bitSize = 65; bitSize < 1024; bitSize += 33) {
        const dv = new DataView(new ArrayBuffer(256));
        const { min, max } = getIntRange({ type: MemberType.Uint, bitSize });
        const member = {
          type: MemberType.Uint,
          bitSize,
          bitOffset: 0,
          byteSize: Math.ceil(bitSize / 64) * 8,
        };
        const set = getNumericAccessor('set', member);
        set.call(dv, 0, min, true);
        set.call(dv, 128, max, true);
        // assuming that the getter works properly here
        const get = getNumericAccessor('get', member);
        expect(get.call(dv, 0, true)).to.equal(min);
        expect(get.call(dv, 128, true)).to.equal(max);
      }
    })
    it('should return functions for setting non-aligned uint', function() {
      this.timeout(10000);
      const type = MemberType.Uint;
      for (let bitSize = 2; bitSize <= 64; bitSize++) {
        for (let bitOffset = 1; bitOffset <= 7; bitOffset++) {
          const guard1 = {
            type: MemberType.Uint,
            bitSize : bitOffset,
            bitOffset: 0,
          };
          const member = {
            type,
            bitSize,
            bitOffset,
          };
          const guard2 = {
            type: MemberType.Uint,
            bitSize: 3,
            bitOffset: bitOffset + bitSize,
          };
          const offsetG1 = Math.floor(guard1.bitOffset / 8);
          const offsetG2 = Math.floor(guard2.bitOffset / 8);
          const offset = Math.floor(member.bitOffset / 8);
          const dv = new DataView(new ArrayBuffer(16));
          const getG1 = getNumericAccessor('get', guard1);
          const setG1 = getNumericAccessor('set', guard1);
          const getG2 = getNumericAccessor('get', guard2);
          const setG2 = getNumericAccessor('set', guard2);
          const get = getNumericAccessor('get', member);
          const set = getNumericAccessor('set', member);
          const { min, max } = getIntRange({ type, bitSize });
          const { max: maxG1 } = getIntRange({ type: MemberType.Uint, bitSize: guard1.bitSize });
          const { max: maxG2 } = getIntRange({ type: MemberType.Uint, bitSize: guard2.bitSize });
          let step;
          if (bitSize <= 8) {
            step = 1;
          } else if (bitSize <= 16) {
            step = 2 ** (bitSize - 8) + 1;
          } else if (bitSize <= 32) {
            step = 2 ** (bitSize - 6) + 1;
          } else {
            step = (2n ** BigInt(bitSize - 3)) + 1n;
          }
          for (let i = min; i <= max; i += step) {
            // clear guard bits and set the value
            setG1.call(dv, offsetG1, 0);
            setG2.call(dv, offsetG2, 0);
            set.call(dv, offset, i, true);
            // check if setter set the correct value
            const value1 = get.call(dv, offset, true);
            expect(value1).to.equal(i);
            // ensure setter doesn't write outside of the bit range
            const g1 = getG1.call(dv, offsetG1);
            const g2 = getG2.call(dv, offsetG2);
            expect(g1).to.equal(0);
            expect(g2).to.equal(0);
            // make sure getter isn't reading outside of its bit range
            setG1.call(dv, offsetG1, maxG1);
            setG2.call(dv, offsetG2, maxG2);
            const value2 = get.call(dv, offset, true);
            expect(value2).to.equal(i);
          }
        }
      }
    })
    it('should return functions for getting standard float types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setFloat32(0, 3.14, true);
      dv.setFloat64(8, 3.14, true);
      for (const bitSize of [ 32, 64 ]) {
        const member = {
          type: MemberType.Float,
          bitSize,
          bitOffset: (bitSize === 32) ? 0 : 64,
          byteSize: bitSize / 8
        };
        const get = getNumericAccessor('get', member);
        const res = get.call(dv, (bitSize === 32) ? 0 : 8, true);
        expect(res.toFixed(2)).to.equal('3.14');
      }
    })
    it('should return functions for setting standard float types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      for (const bitSize of [ 32, 64 ]) {
        const member = {
          type: MemberType.Float,
          bitSize,
          bitOffset: (bitSize === 32) ? 0 : 64,
          byteSize: bitSize / 8
        };
        const set = getNumericAccessor('set', member);
        set.call(dv, (bitSize === 32) ? 0 : 8, 3.14, true);
      }
      expect(dv.getFloat32(0, true).toFixed(2)).to.equal('3.14');
      expect(dv.getFloat64(8, true).toFixed(2)).to.equal('3.14');
    })
    it('should return functions for getting non-standard float types (16-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: Float16
      const bytes = [ 72, 66, 0, 0, 0, 128, 0, 124, 0, 252, 1, 124, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Float,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      };
      const get = getNumericAccessor('get', member);
      const res1 = get.call(dv, 0, true);
      expect(res1.toFixed(2)).to.equal('3.14');
      const res2 = get.call(dv, 2, true);
      expect(Object.is(res2, 0)).to.be.true;
      const res3 = get.call(dv, 4, true);
      expect(Object.is(res3, -0)).to.be.true;
      const res4 = get.call(dv, 6, true);
      expect(Object.is(res4, Infinity)).to.be.true;
      const res5 = get.call(dv, 8, true);
      expect(Object.is(res5, -Infinity)).to.be.true;
      const res6 = get.call(dv, 10, true);
      expect(Object.is(res6, NaN)).to.be.true;
    })
    it('should return functions for setting non-standard float types (16-bit)', function() {
      const dv = new DataView(new ArrayBuffer(2));
      // from struct-bytes: Float16
      const bytes = [ 72, 66, 0, 0, 0, 128, 0, 124, 0, 252, 1, 124, ];
      const member = {
        type: MemberType.Float,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      };
      const set = getNumericAccessor('set', member);
      set.call(dv, 0, 3.14159, true);
      for (const [ i, b ] of bytes.slice(0, 2).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, 0, true);
      for (const [ i, b ] of bytes.slice(2, 4).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, -0, true);
      for (const [ i, b ] of bytes.slice(4, 6).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, Infinity, true);
      for (const [ i, b ] of bytes.slice(6, 8).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, -Infinity, true);
      for (const [ i, b ] of bytes.slice(8, 10).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, NaN, true);
      for (const [ i, b ] of bytes.slice(10, 12).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    })
    it('should handle floating point overflow correctly (16-bit)', function() {
      const dv = new DataView(new ArrayBuffer(2));
      const member = {
        type: MemberType.Float,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      };
      const set = getNumericAccessor('set', member);
      const get = getNumericAccessor('get', member);
      set.call(dv, 0, 65504, true);
      const value1 = get.call(dv, 0, true);
      expect(value1).to.equal(65504);
      set.call(dv, 0, 65504 * 2, true);
      const value2 = get.call(dv, 0, true);
      expect(value2).to.equal(Infinity);
    })
    it('should return functions for getting non-standard float types (80-bit, little endian)', function() {
      const dv = new DataView(new ArrayBuffer(96));
      // from struct-bytes: Float80
      const bytes = [ 53, 194, 104, 33, 162, 218, 15, 201, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 160, 255, 127, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Float,
        bitSize: 80,
        bitOffset: 0,
        byteSize: 16,
      };
      const get = getNumericAccessor('get', member);
      const res1 = get.call(dv, 0, true);
      expect(res1.toFixed(2)).to.equal('3.14');
      const res2 = get.call(dv, 16, true);
      expect(Object.is(res2, 0)).to.be.true;
      const res3 = get.call(dv, 32, true);
      expect(Object.is(res3, -0)).to.be.true;
      const res4 = get.call(dv, 48, true);
      expect(Object.is(res4, Infinity)).to.be.true;
      const res5 = get.call(dv, 64, true);
      expect(Object.is(res5, -Infinity)).to.be.true;
      const res6 = get.call(dv, 80, true);
      expect(Object.is(res6, NaN)).to.be.true;
    })
    it('should return functions for getting non-standard float types (80-bit, big endian)', function() {
      const dv = new DataView(new ArrayBuffer(96));
      // from struct-bytes: Float80
      const bytesLE = [ 53, 194, 104, 33, 162, 218, 15, 201, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 160, 255, 127, 0, 0, 0, 0, 0, 0, ];
      const bytes = Array(bytesLE.length);
      for (let i = 0; i < bytesLE.length; i += 16) {
        // swap the bytes
        for (let j = 0; j < 16; j++) {
          bytes[i + j] = bytesLE[i + 15 - j];
        }
      }
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Float,
        bitSize: 80,
        bitOffset: 0,
        byteSize: 16,
      };
      const get = getNumericAccessor('get', member);
      const res1 = get.call(dv, 0, false);
      expect(res1.toFixed(2)).to.equal('3.14');
      const res2 = get.call(dv, 16, false);
      expect(Object.is(res2, 0)).to.be.true;
      const res3 = get.call(dv, 32, false);
      expect(Object.is(res3, -0)).to.be.true;
      const res4 = get.call(dv, 48, false);
      expect(Object.is(res4, Infinity)).to.be.true;
      const res5 = get.call(dv, 64, false);
      expect(Object.is(res5, -Infinity)).to.be.true;
      const res6 = get.call(dv, 80, false);
      expect(Object.is(res6, NaN)).to.be.true;
    })
    it('should return functions for setting non-standard float types (80-bit, little endian)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: Float80
      const bytes = [ 53, 194, 104, 33, 162, 218, 15, 201, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 160, 255, 127, 0, 0, 0, 0, 0, 0, ];
      const member = {
        type: MemberType.Float,
        bitSize: 80,
        bitOffset: 0,
        byteSize: 16,
      };
      const set = getNumericAccessor('set', member);
      // we lose precision converting f64 to f80 so not all bytes will match
      set.call(dv, 0, 3.141592653589793, true);
      for (const [ i, b ] of bytes.slice(2, 16).entries()) {
        expect(dv.getUint8(i + 2)).to.equal(b);
      }
      set.call(dv, 0, 0, true);
      for (const [ i, b ] of bytes.slice(16, 32).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, -0, true);
      for (const [ i, b ] of bytes.slice(32, 48).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, Infinity, true);
      for (const [ i, b ] of bytes.slice(48, 64).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, -Infinity, true);
      for (const [ i, b ] of bytes.slice(64, 80).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, NaN, true);
      for (const [ i, b ] of bytes.slice(80, 96).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    })

    it('should return functions for setting non-standard float types (80-bit, big endian)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: Float80
      const bytesLE = [ 53, 194, 104, 33, 162, 218, 15, 201, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 160, 255, 127, 0, 0, 0, 0, 0, 0, ];
      const bytes = Array(bytesLE.length);
      for (let i = 0; i < bytesLE.length; i += 16) {
        // swap the bytes
        for (let j = 0; j < 16; j++) {
          bytes[i + j] = bytesLE[i + 15 - j];
        }
      }
      const member = {
        type: MemberType.Float,
        bitSize: 80,
        bitOffset: 0,
        byteSize: 16,
      };
      const set = getNumericAccessor('set', member);
      // we lose precision converting f64 to f80 so not all bytes will match
      set.call(dv, 0, 3.141592653589793, false);
      for (const [ i, b ] of bytes.slice(0, 14).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, 0, false);
      for (const [ i, b ] of bytes.slice(16, 32).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, -0, false);
      for (const [ i, b ] of bytes.slice(32, 48).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, Infinity, false);
      for (const [ i, b ] of bytes.slice(48, 64).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, -Infinity, false);
      for (const [ i, b ] of bytes.slice(64, 80).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, NaN, false);
      for (const [ i, b ] of bytes.slice(80, 96).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    })
    it('should handle floating point overflow correctly (80-bit)', function() {
      const dv = new DataView(new ArrayBuffer(64));
      // from struct-bytes: OverflowFloat80
      const bytes = [ 0, 248, 255, 255, 255, 255, 255, 255, 254, 67, 0, 0, 0, 0, 0, 0, 0, 248, 255, 255, 255, 255, 255, 255, 255, 67, 0, 0, 0, 0, 0, 0, 0, 248, 255, 255, 255, 255, 255, 255, 255, 195, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Float,
        bitSize: 80,
        bitOffset: 0,
        byteSize: 16,
      };
      const get = getNumericAccessor('get', member);
      const value1 = get.call(dv, 0, true);
      expect(value1).to.equal(Number.MAX_VALUE);
      const value2 = get.call(dv, 16, true);
      expect(value2).to.equal(Infinity);
      const value3 = get.call(dv, 32, true);
      expect(value3).to.equal(-Infinity);
    })
    it('should return functions for getting non-standard float types (128-bit, little endian)', function() {
      const dv = new DataView(new ArrayBuffer(96));
      // from struct-bytes: Float16
      const bytes = [ 184, 1, 23, 197, 140, 137, 105, 132, 209, 66, 68, 181, 31, 146, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 127, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Float,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      };
      const get = getNumericAccessor('get', member);
      const res1 = get.call(dv, 0, true);
      expect(res1.toFixed(15)).to.equal('3.141592653589793');
      const res2 = get.call(dv, 16, true);
      expect(Object.is(res2, 0)).to.be.true;
      const res3 = get.call(dv, 32, true);
      expect(Object.is(res3, -0)).to.be.true;
      const res4 = get.call(dv, 48, true);
      expect(Object.is(res4, Infinity)).to.be.true;
      const res5 = get.call(dv, 64, true);
      expect(Object.is(res5, -Infinity)).to.be.true;
      const res6 = get.call(dv, 80, true);
      expect(Object.is(res6, NaN)).to.be.true;
    })
    it('should return functions for getting non-standard float types (128-bit, big endian)', function() {
      const dv = new DataView(new ArrayBuffer(96));
      // from struct-bytes: Float16
      const bytesLE = [ 184, 1, 23, 197, 140, 137, 105, 132, 209, 66, 68, 181, 31, 146, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 127, ];
      const bytes = Array(bytesLE.length);
      for (let i = 0; i < bytesLE.length; i += 16) {
        // swap the bytes
        for (let j = 0; j < 16; j++) {
          bytes[i + j] = bytesLE[i + 15 - j];
        }
      }
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Float,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      };
      const get = getNumericAccessor('get', member);
      const res1 = get.call(dv, 0, false);
      expect(res1.toFixed(15)).to.equal('3.141592653589793');
      const res2 = get.call(dv, 16, false);
      expect(Object.is(res2, 0)).to.be.true;
      const res3 = get.call(dv, 32, false);
      expect(Object.is(res3, -0)).to.be.true;
      const res4 = get.call(dv, 48, false);
      expect(Object.is(res4, Infinity)).to.be.true;
      const res5 = get.call(dv, 64, false);
      expect(Object.is(res5, -Infinity)).to.be.true;
      const res6 = get.call(dv, 80, false);
      expect(Object.is(res6, NaN)).to.be.true;
    })
    it('should return functions for setting non-standard float types (128-bit, little endian)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: Float128
      const bytes = [ 184, 1, 23, 197, 140, 137, 105, 132, 209, 66, 68, 181, 31, 146, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 127, ];
      const member = {
        type: MemberType.Float,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      };
      const set = getNumericAccessor('set', member);
      // we lose precision f64 to f128 so not all bytes will match
      set.call(dv, 0, 3.141592653589793, true);
      for (const [ i, b ] of bytes.slice(8, 16).entries()) {
        expect(dv.getUint8(i + 8)).to.equal(b);
      }
      set.call(dv, 0, 0, true);
      for (const [ i, b ] of bytes.slice(16, 32).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, -0, true);
      for (const [ i, b ] of bytes.slice(32, 48).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, Infinity, true);
      for (const [ i, b ] of bytes.slice(48, 64).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, -Infinity, true);
      for (const [ i, b ] of bytes.slice(64, 80).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, NaN, true);
      for (const [ i, b ] of bytes.slice(80, 96).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    })
    it('should return functions for setting non-standard float types (128-bit, big endian)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: Float128
      const bytesLE = [ 184, 1, 23, 197, 140, 137, 105, 132, 209, 66, 68, 181, 31, 146, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 127, ];
      const bytes = Array(bytesLE.length);
      for (let i = 0; i < bytesLE.length; i += 16) {
        // swap the bytes
        for (let j = 0; j < 16; j++) {
          bytes[i + j] = bytesLE[i + 15 - j];
        }
      }
      const member = {
        type: MemberType.Float,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      };
      const set = getNumericAccessor('set', member);
      // we lose precision f64 to f128 so not all bytes will match
      set.call(dv, 0, 3.141592653589793, false);
      for (const [ i, b ] of bytes.slice(0, 8).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, 0, false);
      for (const [ i, b ] of bytes.slice(16, 32).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, -0, false);
      for (const [ i, b ] of bytes.slice(32, 48).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, Infinity, false);
      for (const [ i, b ] of bytes.slice(48, 64).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, -Infinity, false);
      for (const [ i, b ] of bytes.slice(64, 80).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      set.call(dv, 0, NaN, false);
      for (const [ i, b ] of bytes.slice(80, 96).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    })
    it('should handle floating point overflow correctly (128-bit)', function() {
      const dv = new DataView(new ArrayBuffer(64));
      // from struct-bytes: OverflowFloat80
      const bytes = [ 0, 0, 0, 0, 0, 0, 0, 240, 255, 255, 255, 255, 255, 255, 254, 67, 0, 0, 0, 0, 0, 0, 0, 240, 255, 255, 255, 255, 255, 255, 255, 67, 0, 0, 0, 0, 0, 0, 0, 240, 255, 255, 255, 255, 255, 255, 255, 195, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Float,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      };
      const get = getNumericAccessor('get', member);
      const value1 = get.call(dv, 0, true);
      expect(value1).to.equal(Number.MAX_VALUE);
      const value2 = get.call(dv, 16, true);
      expect(value2).to.equal(Infinity);
      const value3 = get.call(dv, 32, true);
      expect(value3).to.equal(-Infinity);
    })
    it('should return functions for setting non-aligned floats', function() {
      this.timeout(10000);
      const error = (n1, n2) => {
        const diff = n1 - n2;
        return diff ? diff / Math.max(n1, n2) : 0;
      };
      for (const bitSize of [ 16, 32, 64, 80, 128 ]) {
        for (let bitOffset = 1; bitOffset <= 7; bitOffset++) {
          const guard1 = {
            type: MemberType.Uint,
            bitSize : bitOffset,
            bitOffset: 0,
          };
          const member = {
            type: MemberType.Float,
            bitSize,
            bitOffset,
          };
          const guard2 = {
            type: MemberType.Uint,
            bitSize: 3,
            bitOffset: bitOffset + bitSize,
          };
          const offsetG1 = Math.floor(guard1.bitOffset / 8);
          const offsetG2 = Math.floor(guard2.bitOffset / 8);
          const offset = Math.floor(member.bitOffset / 8);
          const dv = new DataView(new ArrayBuffer(32));
          const getG1 = getNumericAccessor('get', guard1);
          const setG1 = getNumericAccessor('set', guard1);
          const getG2 = getNumericAccessor('get', guard2);
          const setG2 = getNumericAccessor('set', guard2);
          const get = getNumericAccessor('get', member);
          const set = getNumericAccessor('set', member);
          const { max: maxG1 } = getIntRange({ type: MemberType.Uint, bitSize: guard1.bitSize });
          const { max: maxG2 } = getIntRange({ type: MemberType.Uint, bitSize: guard2.bitSize });
          const generator = new MersenneTwister(bitSize + bitOffset);
          for (let i = 0; i < 1000; i++) {
            const nom = generator.random_int();
            const denom = generator.random_int();
            const value = nom / denom * (generator.random() > 0.5 ? 1 : -1);
            // clear guard bits and set the value
            setG1.call(dv, offsetG1, 0);
            setG2.call(dv, offsetG2, 0);
            set.call(dv, offset, value, true);
            // check if setter set the correct value
            const value1 = get.call(dv, offset, true);
            if (bitSize < 64) {
              expect(error(value1, value)).to.be.lessThan(0.001);
            } else {
              expect(value1).to.equal(value);
            }
            // ensure setter doesn't write outside of the bit range
            const g1 = getG1.call(dv, offsetG1);
            const g2 = getG2.call(dv, offsetG2);
            expect(g1).to.equal(0);
            expect(g2).to.equal(0);
            // make sure getter isn't reading outside of its bit range
            setG1.call(dv, offsetG1, maxG1);
            setG2.call(dv, offsetG2, maxG2);
            const value2 = get.call(dv, offset, true);
            if (bitSize < 64) {
              expect(error(value2, value)).to.be.lessThan(0.001);
            } else {
              expect(value2).to.equal(value);
            }
          }
        }
      }
    })
  })
  describe('checkDataView', function() {
    it('should not throw when a DataView is given', function() {
      const arg = new DataView(new ArrayBuffer(4));
      expect(() => checkDataView(arg)).to.not.throw();
    })
    it('should throw when the given object is not a DataView', function() {
      const arg = new ArrayBuffer(4);
      expect(() => checkDataView(arg)).to.throw(TypeError);
      expect(() => checkDataView(1)).to.throw(TypeError);
      expect(() => checkDataView(null)).to.throw(TypeError);
      expect(() => checkDataView(undefined)).to.throw(TypeError);
    })
  })
})
