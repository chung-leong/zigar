import { expect } from 'chai';
import { ArrayFlag, MemberFlag, MemberType, PointerFlag, StructureFlag, StructureType, VisitorFlag } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ENTRIES, FINALIZE, INITIALIZE, MEMORY, VISIT } from '../../src/symbols.js';
import { encodeBase64 } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Structure: array', function() {
  describe('defineArray', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Array,
        byteSize: 8,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineArray(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Array,
        byteSize: 8,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      const env = new Env();
      const descriptors = {};
      env.defineArray(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors.entries?.value).to.be.a('function');
      expect(descriptors[Symbol.iterator]?.value).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
      expect(descriptors[FINALIZE]?.value).to.be.a('function');
      expect(descriptors[ENTRIES]?.value).to.be.a('function');
    })
  })
  describe('finalizeArray', function() {
    it('should add static descriptors to the given object', function() {
      const structure = {
        type: StructureType.Array,
        name: 'Array',
        byteSize: 2,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              byteSize: 2,
              structure,
            },
          ],
        },
        static: {},
      };
      const env = new Env();
      const descriptors = {};
      env.finalizeArray(structure, descriptors);
      expect(descriptors.child?.value).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define structure for holding an int array', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const Uint32 = intStructure.constructor;
      const structure = {
        type: StructureType.Array,
        flags: ArrayFlag.IsTypedArray,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      expect(Array).to.be.a('function');
      expect(Array.child).to.equal(Uint32);
      const object = new Array(new Uint32Array(8));
      object.set(0, 321);
      expect(object.get(0)).to.equal(321);
      expect(object.$).to.equal(object);
      expect([ ...object ]).to.eql([ 321, 0, 0, 0, 0, 0, 0, 0 ]);
      expect(object.valueOf()).to.eql([ 321, 0, 0, 0, 0, 0, 0, 0 ]);
      expect(object.length).to.equal(8);
      expect(object.typedArray).to.be.instanceOf(Uint32Array);
    })
    it('should cast the same buffer to the same object', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: intStructure
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const buffer = new ArrayBuffer(4 * 8);
      const object1 = Array(buffer);
      const object2 = Array(buffer);
      expect(object2).to.equal(object1);
    })
    it('should allow array access using bracket operator', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const object = new Array(new Uint32Array(8));
      object[0] = 321;
      expect(object[0]).to.equal(321);
      expect(() => delete object[0]).to.throw();
      expect(object[0]).to.equal(321);
      for (let i = 0; i < object.length; i++) {
        object[i] = i;
      }
      for (let i = 0; i < object.length; i++) {
        expect(object[i]).to.equal(i);
      }
      expect(0 in object).to.be.true;
      expect(7 in object).to.be.true;
      expect('length' in object).to.be.true;
      expect(-1 in object).to.be.false;
      expect(9 in object).to.be.false;
      // ensure it that it doesn't throw with symbol
      expect(() => object[Symbol.asyncIterator]).to.not.throw();
      expect(() => Symbol.asyncIterator in object).to.not.throw();
      expect(() => Object.getOwnPropertyDescriptor(object, Symbol.asyncIterator)).to.not.throw();
    })
    it('should return available keys', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: { constructor: function() {}, typedArray: Uint32Array }
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const object = new Array(new Uint32Array(8));
      expect(Object.getOwnPropertyNames(object)).to.eql([ '0', '1', '2', '3', '4', '5', '6', '7', 'length' ]);
      expect(Object.keys(object)).to.eql([ '0', '1', '2', '3', '4', '5', '6', '7' ]);
    })
    it('should have getter and setter that are bound to the object', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: { constructor: function() {}, typedArray: Uint32Array }
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const object = new Array(new Uint32Array(8));
      const { get, set, length } = object;
      for (let i = 0; i < length; i++) {
        set(i, i);
      }
      for (let i = 0; i < length; i++) {
        expect(get(i)).to.equal(i);
      }
    })
    it('should define array that is iterable', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const dv = new DataView(new ArrayBuffer(4 * 8));
      dv.setUint32(0, 1234, true);
      dv.setUint32(16, 4567, true);
      const object = Array(dv);
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 1234, 0, 0, 0, 4567, 0, 0, 0 ]);
    })
    it('should permit retrieval of indices during iteration', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const dv = new DataView(new ArrayBuffer(4 * 8));
      dv.setUint32(0, 1234, true);
      dv.setUint32(16, 4567, true);
      const object = Array(dv);
      const indexList = [];
      const valueList = [];
      for (const [ index, value ] of object.entries()) {
        indexList.push(index);
        valueList.push(value);
      }
      expect(indexList).to.eql([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      expect(valueList).to.eql([ 1234, 0, 0, 0, 4567, 0, 0, 0 ]);
    })
    it('should throw when no initializer is provided', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      expect(() => new Array).to.throw(TypeError);
    })
    it('should accept an array as initializer', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const object = new Array([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      for (let i = 0; i < 8; i++) {
        expect(object.get(i)).to.equal(i + 1);
      }
    })
    it('should accept an object of the same type as initializer', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const object = new Array([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      const object2 = new Array(object);
      expect([ ...object2 ]).to.eql([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
    })
    it('should accept an array of bigints as initializer', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 4,
        byteSize: 8 * 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 64,
              byteSize: 8,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const object = new Array([ 100n, 200n, 300n, 400n ]);
      for (let i = 0; i < 4; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 100n);
      }
    })
    it('should accept string as initializer for [#]u8', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        length: 11,
        byteSize: 11,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const str = 'Hello world';
      const array = new Array(str);
      expect(array).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(array[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should accept string as initializer for [#]u16', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        length: 11,
        byteSize: 22,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              byteSize: 2,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const str = 'Hello world';
      const array = new Array(str);
      expect(array).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(array[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should allow reinitialization of [#]u16 using a string', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              bitOffset: 0,
              byteSize: 2,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u16',
        length: 11,
        byteSize: 22,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              byteSize: 2,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const str = 'Hello world';
      const array = new Array(str);
      const str2 = 'World war z';
      array.$ = str2;
      for (let i = 0; i < str2.length; i++) {
        expect(array[i]).to.equal(str2.charCodeAt(i));
      }
    })
    it('should allow assignment of string to [#]u16', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              bitOffset: 0,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u16',
        length: 11,
        byteSize: 22,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              byteSize: 2,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const array = new Array(undefined);
      const str = 'Hello world';
      array.string = str;
      for (let i = 0; i < str.length; i++) {
        expect(array[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should throw when the string is too short', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              bitOffset: 0,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u16',
        length: 11,
        byteSize: 22,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              byteSize: 2,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const array = new Array(undefined);
      const str = 'Hello';
      expect(() => array.string = str).to.throw(TypeError);
    })
    it('should throw when given an object with unrecognized properties', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              bitOffset: 0,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        name: '[11]u16',
        length: 11,
        byteSize: 22,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              byteSize: 2,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      expect(() => new Array({ dogmeat: 5 })).to.throw();
    })
    it('should throw when given something unacceptable', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              bitOffset: 0,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u16',
        length: 11,
        byteSize: 22,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              byteSize: 2,
              structure: intStructure
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      expect(() => new Array(() => {})).to.throw();
    })
    it('should accept base64 data as initializer', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        length: 11,
        byteSize: 11,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const str = 'Hello world';
      const base64 = encodeBase64(Buffer.from(str));
      const array = new Array({ base64 });
      expect(array).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(array[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should allow assignment of base64 data', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        length: 11,
        byteSize: 11,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const array = new Array('Hello world');
      const str = 'World war z';
      array.base64 = encodeBase64(Buffer.from(str));
      for (let i = 0; i < str.length; i++) {
        expect(array[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should accept typed array as initializer', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: ArrayFlag.IsTypedArray,
        length: 8,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const array = new Array({ typedArray });
      expect(array).to.have.lengthOf(typedArray.length);
      for (let i = 0; i < typedArray.length; i++) {
        expect(array[i]).to.equal(typedArray[i]);
      }
      array[0] = 123;
      expect(array[0]).to.not.equal(typedArray[0]);
    })

    it('should allow assignment of typed array', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: ArrayFlag.IsTypedArray,
        length: 8,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const array = new Array(new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]));
      const typedArray = new Uint8Array([ 0, 10, 20, 30, 40, 50, 60, 70 ]);
      array.typedArray = typedArray;
      for (let i = 0; i < typedArray.length; i++) {
        expect(array[i]).to.equal(typedArray[i]);
      }
    })
    it('should throw when given typed array of a different type', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: ArrayFlag.IsTypedArray,
        length: 8,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const array = new Array(new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]));
      const typedArray = new Int16Array([ 0, 10, 20, 30, 40, 50, 60, 70 ]);
      expect(() => array.typedArray = typedArray).to.throw(TypeError);
    })
    it('should accept data view as initializer', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const dataView = new DataView(typedArray.buffer);
      const array = new Array({ dataView });
      expect(array).to.have.lengthOf(typedArray.length);
      for (let i = 0; i < typedArray.length; i++) {
        expect(array[i]).to.equal(typedArray[i]);
      }
      array[0] = 123;
      expect(array[0]).to.not.equal(typedArray[0]);
    })
    it('should allow assignment of data view', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const array = new Array(undefined);
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      array.dataView = new DataView(typedArray.buffer);
      for (let i = 0; i < typedArray.length; i++) {
        expect(array[i]).to.equal(typedArray[i]);
      }
      array[0] = 123;
      expect(array[0]).to.not.equal(typedArray[0]);
    })
    it('should accept typed array of a different type as initializer', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const typedArray = new Float32Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const array = new Array(typedArray);
      expect(array).to.have.lengthOf(typedArray.length);
      for (let i = 0; i < typedArray.length; i++) {
        expect(array[i]).to.equal(typedArray[i]);
      }
    })
    it('should accept a generator as initializer', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Array = structure.constructor;
      const f = function*() {
        let i = 0;
        while (i < 8) {
          yield i++;
        }
      };
      const gen = f();
      const array = new Array(gen);
      expect(array).to.have.lengthOf(8);
      for (let i = 0; i < array.length; i++) {
        expect(array[i]).to.equal(i);
      }
    })
    it('should throw when initializer is of the wrong length', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      expect(() => new Hello([ 1, 2, 3, 4, 5, 6, 7, 8, 9 ])).to.throw();
    })
    it('should throw when given an object of the incorrect type', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: intStructure
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      expect(() => new Hello({})).to.throw();
    })
    it('should correctly initialize an array of struct pointers', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structStructure = {
        type: StructureType.Struct,
        byteSize: 4 * 2,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              byteSize: 4,
              bitOffset: 0,
              bitSize: 32,
              structure: intStructure,
            },
            {
              name: 'cat',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              byteSize: 4,
              bitOffset: 32,
              bitSize: 32,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structStructure);
      env.finishStructure(structStructure);
      const Hello = structStructure.constructor;
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              flags: MemberFlag.IsRequired,
              byteSize: 8,
              bitOffset: 0,
              bitSize: 64,
              slot: 0,
              structure: structStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasPointer,
        name: '[4]*Hello',
        length: 4,
        byteSize: 8 * 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              byteSize: 8,
              structure: ptrStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const HelloPtrArray = structure.constructor;
      const object = new HelloPtrArray([
        new Hello({ dog: 1, cat: 2 }),
        new Hello({ dog: 3, cat: 4 }),
        new Hello({ dog: 5, cat: 6 }),
        new Hello({ dog: 7, cat: 8 }),
      ]);
      expect(object[0]['*']).to.be.instanceOf(Hello);
      expect(object[0].dog).to.be.equal(1);
    })
    it('should correctly cast a data view with byteOffset', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structStructure = {
        type: StructureType.Struct,
        byteSize: 4 * 2,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              byteSize: 4,
              bitOffset: 0,
              bitSize: 32,
              structure: intStructure,
            },
            {
              name: 'cat',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              byteSize: 4,
              bitOffset: 32,
              bitSize: 32,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structStructure);
      env.finishStructure(structStructure);
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[4]Hello',
        length: 4,
        byteSize: 8 * 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              byteSize: 8,
              structure: structStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const HelloArray = structure.constructor;
      const buffer = new ArrayBuffer(64);
      const dv = new DataView(buffer, 32, 32);
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, 4567, true);
      const array = HelloArray(dv);
      expect(array[0].valueOf()).to.eql({ dog: 1234, cat: 4567 });
    })
    it('should allow reinitialization through the dollar property', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        name: 'u64',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        name: '[4]u64',
        length: 4,
        byteSize: 8 * 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 64,
              byteSize: 8,
              structure: intStructure
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello([ 100n, 200n, 300n, 400n ]);
      for (let i = 0; i < 4; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 100n);
      }
      object.$ = new BigUint64Array([ 1000n, 2000n, 3000n, 4000n ]);
      for (let i = 0; i < 4; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 1000n);
      }
    })
    it('should permit visitation of invalid pointers', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure)
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[4]*i32',
        length: 4,
        byteSize: 8 * 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              byteSize: 8,
              structure: ptrStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Int32PtrArray = structure.constructor;
      const dv = new DataView(new ArrayBuffer(structure.byteSize));
      const array = Int32PtrArray(dv);
      const pointers = [], errors = [];
      // make sure that children don't get vivificated when IgnoreUncreated flag is set
      array[VISIT](function() {
        pointers.push(this);
      }, VisitorFlag.IgnoreUncreated);
      expect(pointers).to.have.lengthOf(0);
      // look for the pointers for real
      array[VISIT](function(flags) {
        try {
          expect(this['*']).to.be.null;
        } catch (err) {
          // null pointer error
          errors.push(err);
        }
        expect(flags & VisitorFlag.IsImmutable).to.equal(0);
        expect(flags & VisitorFlag.IsInactive).to.equal(0);
        pointers.push(this);
      }, 0);
      expect(pointers).to.have.lengthOf(4);
      expect(errors).to.have.lengthOf(4);
    })
    it('should correctly copy array holding pointers', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure)
      const Int32 = intStructure.constructor
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        length: 4,
        byteSize: 8 * 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              byteSize: 8,
              structure: ptrStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const { constructor: Int32PtrArray } = structure;
      const array1 = new Int32PtrArray([ new Int32(1234), new Int32(4567), new Int32(7890), new Int32(12345) ]);
      const array2 = new Int32PtrArray(array1);
      expect(array2[0]['*']).to.equal(1234);
      expect(array2[1]['*']).to.equal(4567);
      expect(array2[2]['*']).to.equal(7890);
      expect(array2[3]['*']).to.equal(12345);
    })
    it('should correctly copy array holding pointers', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure)
      const Int32 = intStructure.constructor
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '[4]*i32',
        length: 4,
        byteSize: 8 * 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              byteSize: 8,
              structure: ptrStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const { constructor: Int32PtrArray } = structure;
      const array1 = new Int32PtrArray([ new Int32(1234), new Int32(4567), new Int32(7890), new Int32(12345) ]);
      const array2 = new Int32PtrArray(array1);
      expect(array2[0]['*']).to.equal(1234);
      expect(array2[1]['*']).to.equal(4567);
      expect(array2[2]['*']).to.equal(7890);
      expect(array2[3]['*']).to.equal(12345);
    })
    it('should allow casting to array from a slice with same element type', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure)
      const sliceStructure = {
        type: StructureType.Slice,
        name: 'Int64Slice',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 64,
              byteSize: 8,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(sliceStructure);
      const Int64Slice = sliceStructure.constructor;
      env.finishStructure(sliceStructure);
      const arrayStructure = {
        type: StructureType.Array,
        name: 'Int64Array',
        length: 4,
        byteSize: 8 * 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 64,
              byteSize: 8,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(arrayStructure);
      env.finishStructure(arrayStructure);
      const Int64Array = arrayStructure.constructor;
      const slice = new Int64Slice([ 100n, 200n, 300n, 400n ]);
      const array = Int64Array(slice);
      expect(slice[MEMORY]).to.equal(array[MEMORY]);
    })
    it('should allow the assignment of setter and getter as well as other properties', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure)
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      let called;
      object.get = () => { called = 'get' };
      object.get();
      expect(called).to.equal('get');
      object.set = () => { called = 'set' };
      object.set();
      expect(called).to.equal('set');
      object.ok = () => { called = 'ok' };
      object.ok();
      object[Symbol.asyncIterator] = function() {};
      object[Symbol.asyncIterator]();
    })
    it('should allow the deletion of setter and getter as well as other properties', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure)
      const structure = {
        type: StructureType.Array,
        length: 8,
        byteSize: 4 * 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      delete object.get;
      expect(object.get).to.be.undefined;
      delete object.set;
      expect(object.set).to.be.undefined;
      object.ok = () => {};
      delete object.ok;
      expect(object.ok).to.be.undefined;
      object[Symbol.asyncIterator] = function() {};
      object[Symbol.asyncIterator]();
      delete object[Symbol.asyncIterator];
      expect(object[Symbol.asyncIterator]).to.be.undefined;
    })
  })
})
