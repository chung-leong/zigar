import { expect } from 'chai';
import MersenneTwister from 'mersenne-twister';

import { StructureType } from '../src/structure.js';
import { MemberType } from '../src/member.js';
import { getIntRange } from '../src/primitive.js';
import {
  isBuffer,
  isTypedArray,
  addTypedArray,
  getTypeName,
  getDataView,
  requireDataView,
  getDataViewBoolAccessor,
  getDataViewBoolAccessorEx,
  getDataViewIntAccessor,
  getDataViewIntAccessorEx,
  getDataViewUintAccessor,
  getDataViewUintAccessorEx,
  getDataViewFloatAccessor,
  getDataViewFloatAccessorEx,
  clearMethodCache,
} from '../src/data-view.js';
import { MEMORY } from '../src/symbol.js';

describe('Data view functions', function() {
  beforeEach(function() {
    clearMethodCache();
  })
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
    it('should return true when argument is a compatible typed array', function() {
      expect(isBuffer(new Uint32Array(8), Uint32Array)).to.be.true;
    })
    it('should return false when argument is an incompatible typed array', function() {
      expect(isBuffer(new Uint32Array(8), Int8Array)).to.be.false;
    })
  })
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
  describe('addTypedArray', function() {
    it('should add typed array to integer primitive', function() {
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
          const structure = {
            type: StructureType.Primitive,
            instance: {
              members: [
                {
                  type,
                  bitSize: byteSize * 8,
                  byteSize,
                },
              ],
            },
          }
          const f = addTypedArray(structure);
          expect(f).to.equal(structure.typedArray);
          expect(f).to.be.a('function');
          expect(f).to.equal(types[index++]);
        }
      }
    })
    it('should add typed array to non-standard integer when byte size match', function() {
      const structure = {
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 36,
              byteSize: 8,
            },
          ],
        },
      };
      const f = addTypedArray(structure);
      expect(f).to.equal(BigUint64Array);
    })
    it('should add typed array to floating point primitive', function() {
      let index = 0;
      const types = [
        null,
        Float32Array,
        Float64Array,
        null,
      ];
      for (const byteSize of [ 2, 4, 8, 16 ]) {
        const structure = {
          type: StructureType.Primitive,
          instance: {
            members: [
              {
                type: MemberType.Float,
                bitSize: byteSize * 8,
                byteSize,
              },
            ],
          },
        };
        const f = addTypedArray(structure);
        expect(f).to.equal(types[index++]);
      }
    })
    it('should add typed array of child element to array', function() {
      const structure = {
        type: StructureType.Array,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitSize: 64,
              byteSize: 8,
              structure: {
                typedArray: Float64Array,
              },
            },
          ],
        }
      };
      const f = addTypedArray(structure);
      expect(f).to.equal(Float64Array);
    })
    it('should add typed array of child element to slice', function() {
      const structure = {
        type: StructureType.Slice,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitSize: 64,
              byteSize: 8,
              structure: {
                typedArray: Float64Array,
              },
            },
          ],
        }
      };
      const f = addTypedArray(structure);
      expect(f).to.equal(Float64Array);
    })
    it('should add typed array of child element to vector', function() {
      const structure = {
        type: StructureType.Vector,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitSize: 64,
              byteSize: 8,
              structure: {
                typedArray: Float64Array,
              },
            },
          ],
        }
      };
      const f = addTypedArray(structure);
      expect(f).to.equal(Float64Array);
    })
  })
  describe('getDataView', function() {
    it('should return a DataView when given an ArrayBuffer', function() {
      const structure = {
        type: StructureType.Array,
        name: 'Test',
        byteSize: 8
      };
      const arg = new ArrayBuffer(8);
      const dv = getDataView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an SharedArrayBuffer', function() {
      const structure = {
        type: StructureType.Array,
        name: 'Test',
        byteSize: 8
      };
      const arg = new SharedArrayBuffer(8);
      const dv = getDataView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an DataView', function() {
      const structure = {
        type: StructureType.Array,
        name: 'Test',
        byteSize: 8
      };
      const arg = new DataView(new ArrayBuffer(8));
      const dv = getDataView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an DataView with length that is multiple of given size', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 8
      };
      const arg = new DataView(new ArrayBuffer(64));
      const dv = getDataView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an empty DataView', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 8
      };
      const arg = new DataView(new ArrayBuffer(0));
      const dv = getDataView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return undefined when argument is not a data view or buffer', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 8
      };
      const arg = {};
      const dv = getDataView(structure, arg);
      expect(dv).to.be.undefined;
    })
    it('should throw when there is a size mismatch', function() {
      const structure1 = {
        type: StructureType.Array,
        name: 'Test',
        byteSize: 17
      };
      const structure2 = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 3
      };
      const arg = new DataView(new ArrayBuffer(8));
      expect(() => getDataView(structure1, arg)).to.throw(TypeError)
        .with.property('message').that.contains('17');
      expect(() => getDataView(structure2, arg)).to.throw(TypeError)
        .with.property('message').that.contains('3');
    })
    it('should accept compatible TypedArray', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 3,
        typedArray: Uint32Array
      };
      const ta1 = new Uint32Array([ 1, 2, 3 ]);
      const ta2 = new Int32Array([ 1, 2, 3 ]);
      const dv1 = getDataView(structure, ta1);
      const dv2 = getDataView(structure, ta2);
      expect(dv1).to.be.an.instanceOf(DataView);
      expect(dv2).to.be.undefined;
    })
    it('should return memory of compatible array', function() {
      const elementConstructor = function() {};
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 2,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              byteSize: 2,
              structure: { constructor: elementConstructor }
            }
          ]
        },
      };
      const arrayConstructor = function() {};
      arrayConstructor.child = elementConstructor;
      const array = new arrayConstructor();
      array[MEMORY] = new DataView(new ArrayBuffer(6));
      array.length = 3;
      const dv = getDataView(structure, array);
      expect(dv).to.be.an.instanceOf(DataView);
    })
    it('should return memory of compatible slice', function() {
      const elementConstructor = function() {};
      const structure = {
        type: StructureType.Array,
        name: 'Test',
        byteSize: 6,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              byteSize: 2,
              structure: { constructor: elementConstructor }
            }
          ]
        },
      };
      const arrayConstructor = function() {};
      arrayConstructor.child = elementConstructor;
      const array = new arrayConstructor();
      array[MEMORY] = new DataView(new ArrayBuffer(6));
      array.length = 3;
      const dv = getDataView(structure, array);
      expect(dv).to.equal(array[MEMORY]);
    })
    it('should return memory of compatible object', function() {
      const elementConstructor = function() {};
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 2,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              byteSize: 2,
              structure: { constructor: elementConstructor }
            }
          ]
        },
      };
      const object = new elementConstructor();
      object[MEMORY] = new DataView(new ArrayBuffer(2));
      const dv = getDataView(structure, object);
      expect(dv).to.equal(object[MEMORY]);
    })
    it('should return memory of compatible slice', function() {
      const elementConstructor = function() {};
      const structure = {
        type: StructureType.Array,
        name: 'Test',
        byteSize: 6,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              byteSize: 2,
              structure: { constructor: elementConstructor }
            }
          ]
        },
      };
      const arrayConstructor = function() {};
      arrayConstructor.child = elementConstructor;
      const array = new arrayConstructor();
      array[MEMORY] = new DataView(new ArrayBuffer(8));
      array.length = 4;
      expect(() => getDataView(structure, array)).to.throw(TypeError);
    })
  })
  describe('requireDataView', function() {
    it('should throw when argument is not a data view or buffer', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 8
      };
      const arg = {};
      expect(() => requireDataView(structure, arg)).to.throw(TypeError)
        .with.property('message').that.contains('8');
    })
  })
  describe('getTypeName', function() {
    it('should return the name for a integer type', function() {
      const members = [
        { type: MemberType.Int, bitSize: 32 },
        { type: MemberType.Int, bitSize: 64 },
        { type: MemberType.Int, bitSize: 33 },
      ];
      expect(getTypeName(members[0])).to.equal('Int32');
      expect(getTypeName(members[1])).to.equal('BigInt64');
      expect(getTypeName(members[2])).to.equal('BigInt33');
    })
    it('should return the correct name for unsigned integers', function() {
      const members = [
        { type: MemberType.Uint, bitSize: 32 },
        { type: MemberType.Uint, bitSize: 64 },
        { type: MemberType.Uint, bitSize: 33 },
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
      const get = getDataViewBoolAccessor('get', member);
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
      const set = getDataViewBoolAccessor('set', member);
      set.call(dv, 0);
      expect(dv.getUint8(0)).to.equal(0);
    })
    it('should return undefined when type is non-standard', function() {
      const member = {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 1,
        byteSize: undefined,
      };
      const get = getDataViewBoolAccessor('get', member);
      expect(get).to.be.undefined;
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
      const get = getDataViewBoolAccessor('get', member);
      expect(get.call(dv, 0, true)).to.be.true;
      const set = getDataViewBoolAccessor('set', member);
      set.call(dv, 0, false, true);
      expect(dv.getBigInt64(0)).to.equal(0n);
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
        const get = getDataViewBoolAccessorEx('get', member);
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
        const set = getDataViewBoolAccessorEx('set', member);
        set.call(dv, 0, !!(bitOffset & 0x01));
      }
      expect(dv.getUint8(0)).to.equal(0xAA);
    })
  })
  describe('getDataViewIntAccessor', function() {
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
        const get = getDataViewIntAccessor('get', member);
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
        const set = getDataViewIntAccessor('set', member);
        const neg1 = (typeof(max) === 'bigint') ? -1n : -1;
        set.call(dv, 8, neg1, true);
        expect(dv.getBigUint64(8, true)).equal(0xFFFFFFFFFFFFFFFFn);
        expect(dv.getBigUint64(0, true)).equal(0n);
      }
    })
    it('should return function for getting isize', function() {
      const member = {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: { name: 'isize' },
      };
      const get = getDataViewIntAccessor('get', member);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigInt64(0, BigInt(Number.MIN_SAFE_INTEGER), true);
      expect(get.call(dv, 0, true)).to.equal(Number.MIN_SAFE_INTEGER);
      dv.setBigInt64(0, BigInt(Number.MIN_SAFE_INTEGER) - 1n, true);
      expect(get.call(dv, 0, true)).to.equal(BigInt(Number.MIN_SAFE_INTEGER) - 1n);
    })
    it('should return function for setting isize', function() {
      const member = {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: { name: 'isize' },
      };
      const set = getDataViewIntAccessor('set', member);
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
      const set = getDataViewIntAccessor('set', member);
      const dv = new DataView(new ArrayBuffer(8));
      set.call(dv, 0, 1234, true);
      expect(dv.getInt32(0, true)).to.equal(1234);
      set.call(dv, 0, -1234n, true);
      expect(dv.getInt32(0, true)).to.equal(-1234);
    })
    it('should return undefined when type is non-standard', function() {
      const member = {
        type: MemberType.Uint,
        bitSize: 66,
        bitOffset: 0,
        byteSize: 16,
      };
      const get = getDataViewIntAccessor('get', member);
      expect(get).to.be.undefined;
    })
  })
  describe('getDataViewUintAccessor', function() {
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
        const get = getDataViewUintAccessor('get', member);
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
        const set = getDataViewUintAccessor('set', member);
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
      const get = getDataViewUintAccessor('get', member);
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
      const set = getDataViewUintAccessor('set', member);
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
      const get = getDataViewUintAccessor('get', member);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 1234, true);
      expect(get.call(dv, 0, true)).to.equal(1234);
    })
    it('should return undefined when type is non-standard', function() {
      const member = {
        type: MemberType.Uint,
        bitSize: 66,
        bitOffset: 0,
        byteSize: 16,
      };
      const get = getDataViewUintAccessor('get', member);
      expect(get).to.be.undefined;
    })
  })
  describe('getDataViewIntAccessorEx', function() {
    it('should return the same function as getDataViewIntAccessor when type is standard', function() {
      for (const bitSize of [ 8, 16, 32, 64 ]) {
        const member = {
          type: MemberType.Int,
          bitSize,
          bitOffset: 64,
          byteSize: bitSize / 8
        }
        // setter for i64 would be different
        const f = getDataViewIntAccessorEx('get', member);
        const g = getDataViewIntAccessor('get', member);
        expect(f).equal(g);
      }
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
        const get = getDataViewIntAccessorEx('get', member);
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
        const set = getDataViewIntAccessorEx('set', member);
        set.call(dv, 0, min, true);
        set.call(dv, 8, max, true);
        // assuming that the getter works properly here
        const get = getDataViewIntAccessorEx('get', member);
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
      const get = getDataViewIntAccessorEx('get', member);
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
      const set = getDataViewIntAccessorEx('set', member);
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
        const set = getDataViewIntAccessorEx('set', member);
        set.call(dv, 0, min, true);
        set.call(dv, 128, max, true);
        // assuming that the getter works properly here
        const get = getDataViewIntAccessorEx('get', member);
        expect(get.call(dv, 0, true)).to.equal(min);
        expect(get.call(dv, 128, true)).to.equal(max);
      }
    })
    it('should return functions for setting non-aligned integers', function() {
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
          const getG1 = getDataViewUintAccessorEx('get', guard1);
          const setG1 = getDataViewUintAccessorEx('set', guard1);
          const getG2 = getDataViewUintAccessorEx('get', guard2);
          const setG2 = getDataViewUintAccessorEx('set', guard2);
          const get = getDataViewIntAccessorEx('get', member);
          const set = getDataViewIntAccessorEx('set', member);
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
  })
  describe('getDataViewUintAccessorEx', function() {
    it('should return the same function as getDataViewUintAccessor when type is standard', function() {
      for (const bitSize of [ 8, 16, 32, 64 ]) {
        const member = {
          type: MemberType.Uint,
          bitSize,
          bitOffset: 64,
          byteSize: bitSize / 8
        }
        // setter for i64 would be different
        const f = getDataViewUintAccessorEx('get', member);
        const g = getDataViewUintAccessor('get', member);
        expect(f).equal(g);
      }
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
        const get = getDataViewUintAccessorEx('get', member);
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
        const set = getDataViewUintAccessorEx('set', member);
        set.call(dv, 0, min, true);
        set.call(dv, 8, max, true);
        // assuming that the getter works properly here
        const get = getDataViewUintAccessorEx('get', member);
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
      const get = getDataViewUintAccessorEx('get', member);
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
      const set = getDataViewUintAccessorEx('set', member);
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
      const get = getDataViewUintAccessorEx('get', member);
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
      const set = getDataViewUintAccessorEx('set', member);
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
        const set = getDataViewUintAccessorEx('set', member);
        set.call(dv, 0, min, true);
        set.call(dv, 128, max, true);
        // assuming that the getter works properly here
        const get = getDataViewUintAccessorEx('get', member);
        expect(get.call(dv, 0, true)).to.equal(min);
        expect(get.call(dv, 128, true)).to.equal(max);
      }
    })
    it('should return functions for setting non-aligned integers', function() {
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
          const getG1 = getDataViewUintAccessorEx('get', guard1);
          const setG1 = getDataViewUintAccessorEx('set', guard1);
          const getG2 = getDataViewUintAccessorEx('get', guard2);
          const setG2 = getDataViewUintAccessorEx('set', guard2);
          const get = getDataViewUintAccessorEx('get', member);
          const set = getDataViewUintAccessorEx('set', member);
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
  })
  describe('getDataViewFloatAccessor', function() {
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
        const get = getDataViewFloatAccessor('get', member);
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
        const set = getDataViewFloatAccessorEx('set', member);
        set.call(dv, (bitSize === 32) ? 0 : 8, 3.14, true);
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
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      };
      const get = getDataViewFloatAccessorEx('get', member);
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
      const set = getDataViewFloatAccessorEx('set', member);
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
      const set = getDataViewFloatAccessorEx('set', member);
      const get = getDataViewFloatAccessorEx('get', member);
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
      const get = getDataViewFloatAccessorEx('get', member);
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
      const get = getDataViewFloatAccessorEx('get', member);
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
      const set = getDataViewFloatAccessorEx('set', member);
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
      const set = getDataViewFloatAccessorEx('set', member);
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
      const get = getDataViewFloatAccessorEx('get', member);
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
      const get = getDataViewFloatAccessorEx('get', member);
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
      const get = getDataViewFloatAccessorEx('get', member);
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
      const set = getDataViewFloatAccessorEx('set', member);
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
      const set = getDataViewFloatAccessorEx('set', member);
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
      const get = getDataViewFloatAccessorEx('get', member);
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
          const getG1 = getDataViewIntAccessorEx('get', guard1);
          const setG1 = getDataViewIntAccessorEx('set', guard1);
          const getG2 = getDataViewIntAccessorEx('get', guard2);
          const setG2 = getDataViewIntAccessorEx('set', guard2);
          const get = getDataViewFloatAccessorEx('get', member);
          const set = getDataViewFloatAccessorEx('set', member);
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
})
