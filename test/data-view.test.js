import { expect } from 'chai';
import MersenneTwister from 'mersenne-twister';

import { StructureType } from '../src/structure.js';
import { MemberType } from '../src/member.js';
import { getIntRange } from '../src/primitive.js';
import {
  isBuffer,
  getTypeName,
  getDataView,
  getDataViewBoolAccessor,
  getDataViewBoolAccessorEx,
  getDataViewIntAccessor,
  getDataViewIntAccessorEx,
  getDataViewFloatAccessor,
  getDataViewFloatAccessorEx,
} from '../src/data-view.js';

describe('Data view functions', function() {
  describe('isBuffer', function() {
    it('should return true when argument is an ArrayBuffer', function() {
      expect(isBuffer(new ArrayBuffer(8))).to.be.true;
    })
    it('should return true when argument is an SharedArrayBuffer', function() {
      expect(isBuffer(new SharedArrayBuffer(8))).to.be.true;
    })
    it('should return true when argument is a DataView', function() {
      expect(isBuffer(new DataView(new ArrayBuffer(8)))).to.be.true;
    })
    it('should return false when argument does not contain a buffer', function() {
      expect(isBuffer({})).to.be.false;
    })
  })
  describe('getDataView', function() {
    it('should return a DataView when given an ArrayBuffer', function() {
      const structure = {
        type: StructureType.Array,
        name: 'Test',
        size: 8
      };
      const arg = new ArrayBuffer(8);
      const dv = getDataView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an SharedArrayBuffer', function() {
      const structure = {
        type: StructureType.Array,
        name: 'Test',
        size: 8
      };
      const arg = new SharedArrayBuffer(8);
      const dv = getDataView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an DataView', function() {
      const structure = {
        type: StructureType.Array,
        name: 'Test',
        size: 8
      };
      const arg = new DataView(new ArrayBuffer(8));
      const dv = getDataView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an DataView with length that is multiple of given size', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        size: 8
      };
      const arg = new DataView(new ArrayBuffer(64));
      const dv = getDataView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an empty DataView', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        size: 8
      };
      const arg = new DataView(new ArrayBuffer(0));
      const dv = getDataView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should throw when argument is not a data view or buffer', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        size: 8
      };
      const arg = {};
      expect(() => getDataView(structure, arg)).to.throw(TypeError)
        .with.property('message').that.contains('8');
    })
    it('should throw when there is a size mismatch', function() {
      const structure1 = {
        type: StructureType.Array,
        name: 'Test',
        size: 17
      };
      const structure2 = {
        type: StructureType.Slice,
        name: 'Test',
        size: 3
      };
      const arg = new DataView(new ArrayBuffer(8));
      expect(() => getDataView(structure1, arg)).to.throw(TypeError)
        .with.property('message').that.contains('17');
      expect(() => getDataView(structure2, arg)).to.throw(TypeError)
        .with.property('message').that.contains('3');
    })
  })
  describe('getTypeName', function() {
    it('should return the name for a integer type', function() {
      const members = [
        { type: MemberType.Int, isSigned: true, bitSize: 32 },
        { type: MemberType.Int, isSigned: true, bitSize: 64 },
        { type: MemberType.Int, isSigned: true, bitSize: 33 },
      ];
      expect(getTypeName(members[0])).to.equal('Int32');
      expect(getTypeName(members[1])).to.equal('BigInt64');
      expect(getTypeName(members[2])).to.equal('BigInt33');
    })
    it('should return the correct name for unsigned integers', function() {
      const members = [
        { type: MemberType.Int, isSigned: false, bitSize: 32 },
        { type: MemberType.Int, isSigned: false, bitSize: 64 },
        { type: MemberType.Int, isSigned: false, bitSize: 33 },
      ];
      expect(getTypeName(members[0])).to.equal('Uint32');
      expect(getTypeName(members[1])).to.equal('BigUint64');
      expect(getTypeName(members[2])).to.equal('BigUint33');
    })
    it('should return the correct names for floats', function() {
      const members = [
        { type: MemberType.Float, bitSize: 16 },
        { type: MemberType.Float, bitSize: 32 },
        { type: MemberType.Float, bitSize: 64 },
        { type: MemberType.Float, bitSize: 128 },
      ];
      expect(getTypeName(members[0])).to.equal('Float16');
      expect(getTypeName(members[1])).to.equal('Float32');
      expect(getTypeName(members[2])).to.equal('Float64');
      expect(getTypeName(members[3])).to.equal('Float128');
    })
    it('should return the correct names for boolean', function() {
      const members = [
        { type: MemberType.Bool, bitSize: 1, byteSize: 1 },
        { type: MemberType.Bool, bitSize: 1, byteSize: 8 },
        { type: MemberType.Bool, bitSize: 1 },
      ];
      expect(getTypeName(members[0])).to.equal('Bool8');
      expect(getTypeName(members[1])).to.equal('Bool64');
      expect(getTypeName(members[2])).to.equal('Bool1');
    })
    it('should return "Null" for Void', function() {
      const members = [
        { type: MemberType.Void, bitSize: 0 },
      ];
      expect(getTypeName(members[0])).to.equal('Null');
    })
  })
  describe('getDataViewBoolAccessor', function() {
    it('should return function for getting standard bool types', function() {
      const dv = new DataView(new ArrayBuffer(1));
      dv.setInt8(0, 1);
      const member = {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 0,
        byteSize: 1,
      };
      const f = getDataViewBoolAccessor('get', member);
      const res = f.call(dv, 0);
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
      const f = getDataViewBoolAccessor('set', member);
      f.call(dv, 0);
      expect(dv.getUint8(0)).to.equal(0);
    })
    it('should return undefined when type is non-standard', function() {
      const member = {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 1,
        byteSize: undefined,
      };
      const f = getDataViewBoolAccessor('get', member);
      expect(f).to.be.undefined;
    })
    it('should work when underlying type is a 64-bit integer', function() {
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigInt64(0, 1n);
      const member = {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 0,
        byteSize: 8,
      };
      const f = getDataViewBoolAccessor('get', member);
      expect(f.call(dv, 0, true)).to.be.true;
      expect(dv.getUint8(0)).to.equal(0);
      dv.setBigInt64(0, 1n);
    })
  })
  describe('getDataViewBoolAccessorEx', function() {
    it('should return the same function as getDataViewBoolAccessor when bool is standard', function() {
      const member = {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 0,
        byteSize: 1
      }
      const f = getDataViewBoolAccessorEx('set', member);
      const g = getDataViewBoolAccessor('set', member);
      expect(f).equal(g);
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
        const f = getDataViewBoolAccessorEx('get', member);
        const res = f.call(dv, 0);
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
        const f = getDataViewBoolAccessorEx('set', member);
        f.call(dv, 0, !!(bitOffset & 0x01));
      }
      expect(dv.getUint8(0)).to.equal(0xAA);
    })
  })
  describe('getDataViewIntAccessor', function() {
    it('should return function for getting standard int types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setBigUint64(8, 0xFFFFFFFFFFFFFFFFn);
      for (const isSigned of [ false, true ]) {
        for (const bitSize of [ 8, 16, 32, 64 ]) {
          const { max } = getIntRange({ isSigned, bitSize });
          const member = {
            type: MemberType.Int,
            isSigned,
            bitSize,
            bitOffset: 64,
            byteSize: bitSize / 8
          }
          const f = getDataViewIntAccessor('get', member);
          const res = f.call(dv, 8, true);
          if (isSigned) {
            expect(Number(res)).to.equal(-1);
          } else {
            expect(res).to.equal(max);
          }
        }
      }
    })
    it('should return function for setting standard int types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setBigUint64(8, 0xFFFFFFFFFFFFFFFFn);
      for (const isSigned of [ false, true ]) {
        for (const bitSize of [ 8, 16, 32, 64 ]) {
          const { max } = getIntRange({ isSigned, bitSize });
          const member = {
            type: MemberType.Int,
            isSigned,
            bitSize,
            bitOffset: 64,
            byteSize: bitSize / 8
          }
          const f = getDataViewIntAccessor('set', member);
          if (isSigned) {
            f.call(dv, 8, (bitSize == 64) ? -1n : -1, true);
          } else {
            f.call(dv, 8, max, true);
          }
          expect(dv.getBigUint64(8, true)).equal(0xFFFFFFFFFFFFFFFFn);
          expect(dv.getBigUint64(0, true)).equal(0n);
        }
      }
    })
    it('should return undefined when type is non-standard', function() {
      const member = {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 66,
        bitOffset: 0,
        byteSize: 16,
      };
      const f = getDataViewIntAccessor('get', member);
      expect(f).to.be.undefined;
    })
  })
  describe('getDataViewIntAccessorEx', function() {
    it('should return the same function as getDataViewIntAccessor when type is standard', function() {
      for (const isSigned of [ false, true ]) {
        for (const bitSize of [ 8, 16, 32, 64 ]) {
          const member = {
            type: MemberType.Int,
            isSigned,
            bitSize,
            bitOffset: 64,
            byteSize: bitSize / 8
          }
          const f = getDataViewIntAccessorEx('set', member);
          const g = getDataViewIntAccessor('set', member);
          expect(f).equal(g);
        }
      }
    })
    it('should return functions for getting non-standard int types (aligned, < 64-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setBigUint64(8, 0xFFFFFFFFFFFFFFFFn);
      for (const isSigned of [ false, true ]) {
        const standard = [ 8, 16, 32, 64 ];
        for (let bitSize = 2; bitSize < 64; bitSize++) {
          if (standard.includes(bitSize)) {
            continue;
          }
          const { max } = getIntRange({ isSigned, bitSize });
          const member = {
            type: MemberType.Int,
            isSigned,
            bitSize,
            bitOffset: 64,
            byteSize: [ 1, 2, 4, 8 ].find(b => b * 8 > bitSize),
          };
          const f = getDataViewIntAccessorEx('get', member);
          const res = f.call(dv, 8, true);
          if (isSigned) {
            expect(Number(res)).to.equal(-1);
          } else {
            expect(res).to.equal(max);
          }
        }
      }
    })
    it('should return functions for setting non-standard int types (aligned, < 64-bit)', function() {
      for (const isSigned of [ false, true ]) {
        const standard = [ 8, 16, 32, 64 ];
        for (let bitSize = 2; bitSize < 64; bitSize++) {
          const dv = new DataView(new ArrayBuffer(16));
          if (standard.includes(bitSize)) {
            continue;
          }
          const { min, max } = getIntRange({ isSigned, bitSize });
          const member = {
            type: MemberType.Int,
            isSigned,
            bitSize,
            bitOffset: 64,
            byteSize: [ 1, 2, 4, 8 ].find(b => b * 8 > bitSize),
          };
          const f = getDataViewIntAccessorEx('set', member);
          f.call(dv, 0, min, true);
          f.call(dv, 8, max, true);
          // assuming that the getter works properly here
          const get = getDataViewIntAccessorEx('get', member);
          expect(get.call(dv, 0, true)).to.equal(min);
          expect(get.call(dv, 8, true)).to.equal(max);
        }
      }
    })
    it('should return functions for getting non-standard int types (128-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt1
      const bytes = [ 255, 255, 255, 255, 255, 255, 255, 31, 0, 0, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      };
      const f = getDataViewIntAccessorEx('get', member);
      const res1 = f.call(dv, 0, true);
      expect(res1).to.equal(0x01FFFFFFFFFFFFFFFn);
      // from struct-bytes: BigInt2
      const bytesBE = [ 0, 0, 0, 0, 0, 0, 0, 0, 31, 255, 255, 255, 255, 255, 255, 255, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const res2 = f.call(dv, 0, false);
      expect(res1).to.equal(0x01FFFFFFFFFFFFFFFn);
    })
    it('should return functions for setting non-standard int types (128-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt1
      const bytes = [ 255, 255, 255, 255, 255, 255, 255, 31, 0, 0, 0, 0, 0, 0, 0, 0, ];
      const member = {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      };
      const f = getDataViewIntAccessorEx('set', member);
      f.call(dv, 0, 0x01FFFFFFFFFFFFFFFn, true);
      for (const [ i, b ] of bytes.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      // from struct-bytes: BigInt2
      const bytesBE = [ 0, 0, 0, 0, 0, 0, 0, 0, 31, 255, 255, 255, 255, 255, 255, 255, ];
      f.call(dv, 0, 0x01FFFFFFFFFFFFFFFn, false);
      for (const [ i, b ] of bytesBE.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    });
    it('should return functions for getting non-standard int types (72-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt3
      const bytes = [ 255, 255, 255, 255, 255, 255, 255, 31, 0, 0, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Int,
        bitSize: 72,
        bitOffset: 0,
        byteSize: 16,
        isSigned: false,
      };
      const f = getDataViewIntAccessorEx('get', member);
      const res1 = f.call(dv, 0, true);
      expect(res1).to.equal(0x01FFFFFFFFFFFFFFFn);
      // from struct-bytes: BigInt4
      const bytesBE = [ 0, 31, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const res2 = f.call(dv, 0, false);
      expect(res1).to.equal(0x01FFFFFFFFFFFFFFFn);
    })
    it('should return functions for setting non-standard int types (72-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt3
      const bytes = [ 255, 255, 255, 255, 255, 255, 255, 31, 0, 0, 0, 0, 0, 0, 0, 0, ];
      const member = {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 72,
        bitOffset: 0,
        byteSize: 16,
      };
      const f = getDataViewIntAccessorEx('set', member);
      f.call(dv, 0, 0x01FFFFFFFFFFFFFFFn, true);
      for (const [ i, b ] of bytes.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      // from struct-bytes: BigInt4
      const bytesBE = [ 0, 31, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, ];
      f.call(dv, 0, 0x01FFFFFFFFFFFFFFFn, false);
      for (const [ i, b ] of bytesBE.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    });
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
        isSigned: true,
        byteSize: 16,
      };
      const f = getDataViewIntAccessorEx('get', member);
      const res = f.call(dv, 0, true);
      expect(res).to.equal(-0xFFFFFFFFFFFFFFFFn);
    })
    it('should return functions for getting non-standard int types (65-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt5
      const bytes = [ 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, ];
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 65,
        bitOffset: 0,
        byteSize: 16,
      };
      const f = getDataViewIntAccessorEx('set', member);
      f.call(dv, 0, -0xFFFFFFFFFFFFFFFFn, true);
      for (const [ i, b ] of bytes.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    })
    it('should return functions for setting non-standard int types (> 64-bit)', function() {
      for (const isSigned of [ false, true ]) {
        for (let bitSize = 65; bitSize < 1024; bitSize += 33) {
          const dv = new DataView(new ArrayBuffer(256));
          const { min, max } = getIntRange({ isSigned, bitSize });
          const member = {
            type: MemberType.Int,
            isSigned,
            bitSize,
            bitOffset: 0,
            byteSize: Math.ceil(bitSize / 64) * 8,
          };
          const f = getDataViewIntAccessorEx('set', member);
          f.call(dv, 0, min, true);
          f.call(dv, 128, max, true);
          // assuming that the getter works properly here
          const get = getDataViewIntAccessorEx('get', member);
          expect(get.call(dv, 0, true)).to.equal(min);
          expect(get.call(dv, 128, true)).to.equal(max);
        }
      }
    })
    it('should return functions for setting non-aligned integers', function() {
      this.timeout(10000);
      const isSigned = true;
      for (const isSigned of [ true, false ]) {
        for (let bitSize = 2; bitSize <= 64; bitSize++) {
          for (let bitOffset = 1; bitOffset <= 7; bitOffset++) {
            const guard1 = {
              type: MemberType.Int,
              isSigned: false,
              bitSize : bitOffset,
              bitOffset: 0,
            };
            const member = {
              type: MemberType.Int,
              isSigned,
              bitSize,
              bitOffset,
            };
            const guard2 = {
              type: MemberType.Int,
              isSigned: false,
              bitSize: 3,
              bitOffset: bitOffset + bitSize,
            };
            const offsetG1 = Math.floor(guard1.bitOffset / 8);
            const offsetG2 = Math.floor(guard2.bitOffset / 8);
            const offset = Math.floor(member.bitOffset / 8);
            const dv = new DataView(new ArrayBuffer(16));
            const getG1 = getDataViewIntAccessorEx('get', guard1);
            const setG1 = getDataViewIntAccessorEx('set', guard1);
            const getG2 = getDataViewIntAccessorEx('get', guard2);
            const setG2 = getDataViewIntAccessorEx('set', guard2);
            const get = getDataViewIntAccessorEx('get', member);
            const set = getDataViewIntAccessorEx('set', member);
            const { min, max } = getIntRange({ isSigned, bitSize });
            const { max: maxG1 } = getIntRange({ isSigned: false, bitSize: guard1.bitSize });
            const { max: maxG2 } = getIntRange({ isSigned: false, bitSize: guard2.bitSize });
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
      }
    })
  })
  describe('getDataViewFloatAccessor', function() {
    it('should return functions for getting standard float types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setFloat32(0, 3.14, true);
      dv.setFloat64(8, 3.14, true);
      for (const bitSize of [ 32, 64 ]) {
        const member = {
          type: MemberType.Float,
          isSigned: true,
          bitSize,
          bitOffset: (bitSize === 32) ? 0 : 64,
          byteSize: bitSize / 8
        };
        const f = getDataViewFloatAccessor('get', member);
        const res = f.call(dv, (bitSize === 32) ? 0 : 8, true);
        expect(res.toFixed(2)).to.equal('3.14');
      }
    })
    it('should return functions for setting standard float types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      for (const bitSize of [ 32, 64 ]) {
        const member = {
          type: MemberType.Float,
          isSigned: true,
          bitSize,
          bitOffset: (bitSize === 32) ? 0 : 64,
          byteSize: bitSize / 8
        };
        const f = getDataViewFloatAccessorEx('set', member);
        f.call(dv, (bitSize === 32) ? 0 : 8, 3.14, true);
      }
      expect(dv.getFloat32(0, true).toFixed(2)).to.equal('3.14');
      expect(dv.getFloat64(8, true).toFixed(2)).to.equal('3.14');
    })
  })
  describe('getDataViewFloatAccessorEx', function() {
    it('should return the same function as getDataViewFloatAccessor when type is standard', function() {
      for (const bitSize of [ 32, 64 ]) {
        const member = {
          type: MemberType.Float,
          bitSize,
          bitOffset: 0,
          byteSize: bitSize / 8
        }
        const f = getDataViewFloatAccessorEx('set', member);
        const g = getDataViewFloatAccessor('set', member);
        expect(f).equal(g);
      }
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
        isSigned: true,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      };
      debugger;
      const f = getDataViewFloatAccessorEx('get', member);
      const res1 = f.call(dv, 0, true);
      expect(res1.toFixed(2)).to.equal('3.14');
      const res2 = f.call(dv, 2, true);
      expect(Object.is(res2, 0)).to.be.true;
      const res3 = f.call(dv, 4, true);
      expect(Object.is(res3, -0)).to.be.true;
      const res4 = f.call(dv, 6, true);
      expect(Object.is(res4, Infinity)).to.be.true;
      const res5 = f.call(dv, 8, true);
      expect(Object.is(res5, -Infinity)).to.be.true;
      const res6 = f.call(dv, 10, true);
      expect(Object.is(res6, NaN)).to.be.true;
    })
    it('should return functions for setting non-standard float types (16-bit)', function() {
      const dv = new DataView(new ArrayBuffer(2));
      // from struct-bytes: Float16
      const bytes = [ 72, 66, 0, 0, 0, 128, 0, 124, 0, 252, 1, 124, ];
      const member = {
        type: MemberType.Float,
        isSigned: true,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      };
      const f = getDataViewFloatAccessorEx('set', member);
      f.call(dv, 0, 3.14159, true);
      for (const [ i, b ] of bytes.slice(0, 2).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, 0, true);
      for (const [ i, b ] of bytes.slice(2, 4).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, -0, true);
      for (const [ i, b ] of bytes.slice(4, 6).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, Infinity, true);
      for (const [ i, b ] of bytes.slice(6, 8).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, -Infinity, true);
      for (const [ i, b ] of bytes.slice(8, 10).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, NaN, true);
      for (const [ i, b ] of bytes.slice(10, 12).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    })
    it('should handle floating point overflow correctly (16-bit)', function() {
      const dv = new DataView(new ArrayBuffer(2));
      const member = {
        type: MemberType.Float,
        isSigned: true,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      };
      const f = getDataViewFloatAccessorEx('set', member);
      const get = getDataViewFloatAccessorEx('get', member);
      f.call(dv, 0, 65504, true);
      const value1 = get.call(dv, 0, true);
      expect(value1).to.equal(65504);
      f.call(dv, 0, 65504 * 2, true);
      const value2 = get.call(dv, 0, true);
      expect(value2).to.equal(Infinity);
    })
    it('should return functions for getting non-standard float types (80-bit)', function() {
      const dv = new DataView(new ArrayBuffer(96));
      // from struct-bytes: Float80
      const bytes = [ 53, 194, 104, 33, 162, 218, 15, 201, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 160, 255, 127, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Float,
        isSigned: true,
        bitSize: 80,
        bitOffset: 0,
        byteSize: 16,
      };
      const f = getDataViewFloatAccessorEx('get', member);
      const res1 = f.call(dv, 0, true);
      expect(res1.toFixed(2)).to.equal('3.14');
      const res2 = f.call(dv, 16, true);
      expect(Object.is(res2, 0)).to.be.true;
      const res3 = f.call(dv, 32, true);
      expect(Object.is(res3, -0)).to.be.true;
      const res4 = f.call(dv, 48, true);
      expect(Object.is(res4, Infinity)).to.be.true;
      const res5 = f.call(dv, 64, true);
      expect(Object.is(res5, -Infinity)).to.be.true;
      const res6 = f.call(dv, 80, true);
      expect(Object.is(res6, NaN)).to.be.true;
    })
    it('should return functions for setting non-standard float types (80-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: Float80
      const bytes = [ 53, 194, 104, 33, 162, 218, 15, 201, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 160, 255, 127, 0, 0, 0, 0, 0, 0, ];
      const member = {
        type: MemberType.Float,
        isSigned: true,
        bitSize: 80,
        bitOffset: 0,
        byteSize: 16,
      };
      const f = getDataViewFloatAccessorEx('set', member);
      // we lose precision f64 to f80 so not all bytes will match
      f.call(dv, 0, 3.141592653589793, true);
      for (const [ i, b ] of bytes.slice(2, 16).entries()) {
        expect(dv.getUint8(i + 2)).to.equal(b);
      }
      f.call(dv, 0, 0, true);
      for (const [ i, b ] of bytes.slice(16, 32).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, -0, true);
      for (const [ i, b ] of bytes.slice(32, 48).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, Infinity, true);
      for (const [ i, b ] of bytes.slice(48, 64).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, -Infinity, true);
      for (const [ i, b ] of bytes.slice(64, 80).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, NaN, true);
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
        isSigned: true,
        bitSize: 80,
        bitOffset: 0,
        byteSize: 16,
      };
      const f = getDataViewFloatAccessorEx('get', member);
      const value1 = f.call(dv, 0, true);
      expect(value1).to.equal(Number.MAX_VALUE);
      const value2 = f.call(dv, 16, true);
      expect(value2).to.equal(Infinity);
      const value3 = f.call(dv, 32, true);
      expect(value3).to.equal(-Infinity);
    })
    it('should return functions for getting non-standard float types (128-bit)', function() {
      const dv = new DataView(new ArrayBuffer(96));
      // from struct-bytes: Float16
      const bytes = [ 184, 1, 23, 197, 140, 137, 105, 132, 209, 66, 68, 181, 31, 146, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 127, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Float,
        isSigned: true,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      };
      const f = getDataViewFloatAccessorEx('get', member);
      const res1 = f.call(dv, 0, true);
      expect(res1.toFixed(15)).to.equal('3.141592653589793');
      const res2 = f.call(dv, 16, true);
      expect(Object.is(res2, 0)).to.be.true;
      const res3 = f.call(dv, 32, true);
      expect(Object.is(res3, -0)).to.be.true;
      const res4 = f.call(dv, 48, true);
      expect(Object.is(res4, Infinity)).to.be.true;
      const res5 = f.call(dv, 64, true);
      expect(Object.is(res5, -Infinity)).to.be.true;
      const res6 = f.call(dv, 80, true);
      expect(Object.is(res6, NaN)).to.be.true;
    })
    it('should return functions for setting non-standard float types (128-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: Float128
      const bytes = [ 184, 1, 23, 197, 140, 137, 105, 132, 209, 66, 68, 181, 31, 146, 0, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 127, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 127, ];
      const member = {
        type: MemberType.Float,
        isSigned: true,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      };
      const f = getDataViewFloatAccessorEx('set', member);
      // we lose precision f64 to f128 so not all bytes will match
      f.call(dv, 0, 3.141592653589793, true);
      for (const [ i, b ] of bytes.slice(8, 16).entries()) {
        expect(dv.getUint8(i + 8)).to.equal(b);
      }
      f.call(dv, 0, 0, true);
      for (const [ i, b ] of bytes.slice(16, 32).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, -0, true);
      for (const [ i, b ] of bytes.slice(32, 48).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, Infinity, true);
      for (const [ i, b ] of bytes.slice(48, 64).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, -Infinity, true);
      for (const [ i, b ] of bytes.slice(64, 80).entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      f.call(dv, 0, NaN, true);
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
        isSigned: true,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
      };
      const f = getDataViewFloatAccessorEx('get', member);
      const value1 = f.call(dv, 0, true);
      expect(value1).to.equal(Number.MAX_VALUE);
      const value2 = f.call(dv, 16, true);
      expect(value2).to.equal(Infinity);
      const value3 = f.call(dv, 32, true);
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
            type: MemberType.Int,
            isSigned: false,
            bitSize : bitOffset,
            bitOffset: 0,
          };
          const member = {
            type: MemberType.Float,
            isSigned: false,
            bitSize,
            bitOffset,
          };
          const guard2 = {
            type: MemberType.Int,
            isSigned: false,
            bitSize: 3,
            bitOffset: bitOffset + bitSize,
          };
          const offsetG1 = Math.floor(guard1.bitOffset / 8);
          const offsetG2 = Math.floor(guard2.bitOffset / 8);
          const offset = Math.floor(member.bitOffset / 8);
          const dv = new DataView(new ArrayBuffer(32));
          const getG1 = getDataViewIntAccessorEx('get', guard1);
          const setG1 = getDataViewIntAccessorEx('set', guard1);
          const getG2 = getDataViewIntAccessorEx('get', guard2);
          const setG2 = getDataViewIntAccessorEx('set', guard2);
          const get = getDataViewFloatAccessorEx('get', member);
          const set = getDataViewFloatAccessorEx('set', member);
          const { max: maxG1 } = getIntRange({ isSigned: false, bitSize: guard1.bitSize });
          const { max: maxG2 } = getIntRange({ isSigned: false, bitSize: guard2.bitSize });
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
})
