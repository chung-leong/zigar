import { expect } from 'chai';

import { MEMORY } from '../src/symbol.js';
import { MemberType, useAllMemberTypes, getDescriptor } from '../src/member.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import { NodeEnvironment } from '../src/environment.js'
import { encodeBase64 } from '../src/text.js';
import {
  getArrayIterator,
  getArrayEntriesIterator,
  createArrayEntries,
} from '../src/array.js';

describe('Array functions', function() {
  const env = new NodeEnvironment();
  describe('defineArray', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
    })
    it('should define structure for holding an int array', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      const constructor = function() {};
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(Hello).to.be.a('function');
      expect(Hello.child).to.equal(constructor);
      const object = new Hello(new Uint32Array(8));
      object.set(0, 321);
      expect(object.get(0)).to.equal(321);
      expect(object.$).to.equal(object);
      expect([ ...object ]).to.eql([ 321, 0, 0, 0, 0, 0, 0, 0 ]);
      expect(object.length).to.equal(8);
      expect(object.typedArray).to.be.instanceOf(Uint32Array);
    })
    it('should allow array access using bracket operator', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(new Uint32Array(8));
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
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(new Uint32Array(8));
      expect(Object.getOwnPropertyNames(object)).to.eql([ '0', '1', '2', '3', '4', '5', '6', '7', 'length' ]);
      expect(Object.keys(object)).to.eql([ '0', '1', '2', '3', '4', '5', '6', '7' ]);
    })
    it('should have getter and setter that are bound to the object', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(new Uint32Array(8));
      const { get, set, length } = object;
      for (let i = 0; i < length; i++) {
        set(i, i);
      }
      for (let i = 0; i < length; i++) {
        expect(get(i)).to.equal(i);
      }
    })
    it('should define array that is iterable', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const dv = new DataView(new ArrayBuffer(4 * 8));
      dv.setUint32(0, 1234, true);
      dv.setUint32(16, 4567, true);
      const object = Hello(dv);
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 1234, 0, 0, 0, 4567, 0, 0, 0 ]);
    })
    it('should permit retrieval of indices during iteration', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const dv = new DataView(new ArrayBuffer(4 * 8));
      dv.setUint32(0, 1234, true);
      dv.setUint32(16, 4567, true);
      const object = Hello(dv);
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
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello).to.throw(TypeError);
    })

    it('should accept an array as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      for (let i = 0; i < 8; i++) {
        expect(object.get(i)).to.equal(i + 1);
      }
    })
    it('should accept an object of the same type as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      const object2 = new Hello(object);
      expect([ ...object2 ]).to.eql([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
    })
    it('should accept an array of bigints as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 4,
        byteSize: 8 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: { constructor: function() {}, typedArray: BigUint64Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello([ 100n, 200n, 300n, 400n ]);
      for (let i = 0; i < 4; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 100n);
      }
    })
    it('should accept string as initializer for [#]u8', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[11]u8',
        length: 11,
        byteSize: 11,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Array } = structure;
      const str = 'Hello world';
      const array = new U8Array(str);
      expect(array).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(array[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should accept string as initializer for [#]u16', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[11]u8',
        length: 11,
        byteSize: 22,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Array } = structure;
      const str = 'Hello world';
      const array = new U8Array(str);
      expect(array).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(array[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should allow reinitialization of [#]u16 using a string', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[11]u16',
        length: 11,
        byteSize: 22,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U16Array } = structure;
      const str = 'Hello world';
      const array = new U16Array(str);
      const str2 = 'World war z';
      array.$ = str2;
      for (let i = 0; i < str2.length; i++) {
        expect(array[i]).to.equal(str2.charCodeAt(i));
      }
    })
    it('should allow assignment of string to [#]u16', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[11]u16',
        length: 11,
        byteSize: 22,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U16Array } = structure;
      const array = new U16Array(undefined);
      const str = 'Hello world';
      array.string = str;
      for (let i = 0; i < str.length; i++) {
        expect(array[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should throw when the string is too short', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[11]u16',
        length: 11,
        byteSize: 22,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U16Array } = structure;
      const array = new U16Array(undefined);
      const str = 'Hello';
      expect(() => array.string = str).to.throw(TypeError);
    })
    it('should throw when given an object with unrecognized properties', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[11]u16',
        length: 11,
        byteSize: 22,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U16Array } = structure;
      expect(() => new U16Array({ dogmeat: 5 })).to.throw();
    })
    it('should throw when given something unacceptable', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[11]u16',
        length: 11,
        byteSize: 22,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U16Array } = structure;
      expect(() => new U16Array(() => {})).to.throw();
    })
    it('should accept base64 data as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[11]u8',
        length: 11,
        byteSize: 11,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Array } = structure;
      const str = 'Hello world';
      const base64 = encodeBase64(Buffer.from(str));
      const array = new U8Array({ base64 });
      expect(array).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(array[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should allow assignment of base64 data', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[11]u8',
        length: 11,
        byteSize: 11,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Array } = structure;
      const array = new U8Array('Hello world');
      const str = 'World war z';
      array.base64 = encodeBase64(Buffer.from(str));
      for (let i = 0; i < str.length; i++) {
        expect(array[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should accept typed array as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[8]u8',
        length: 8,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Array } = structure;
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const array = new U8Array({ typedArray });
      expect(array).to.have.lengthOf(typedArray.length);
      for (let i = 0; i < typedArray.length; i++) {
        expect(array[i]).to.equal(typedArray[i]);
      }
      array[0] = 123;
      expect(array[0]).to.not.equal(typedArray[0]);
    })
    it('should allow assignment of typed array', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[8]u8',
        length: 8,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Array } = structure;
      const array = new U8Array(new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]));
      const typedArray = new Uint8Array([ 0, 10, 20, 30, 40, 50, 60, 70 ]);
      array.typedArray = typedArray;
      for (let i = 0; i < typedArray.length; i++) {
        expect(array[i]).to.equal(typedArray[i]);
      }
    })
    it('should throw when given typed array of a different type', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[8]u8',
        length: 8,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Array } = structure;
      const array = new U8Array(new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]));
      const typedArray = new Int16Array([ 0, 10, 20, 30, 40, 50, 60, 70 ]);
      expect(() => array.typedArray = typedArray).to.throw(TypeError);
    })
    it('should accept data view as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[8]u8',
        length: 8,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Array } = structure;
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const dataView = new DataView(typedArray.buffer);
      const array = new U8Array({ dataView });
      expect(array).to.have.lengthOf(typedArray.length);
      for (let i = 0; i < typedArray.length; i++) {
        expect(array[i]).to.equal(typedArray[i]);
      }
      array[0] = 123;
      expect(array[0]).to.not.equal(typedArray[0]);
    })
    it('should allow assignment of data view', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[8]u8',
        length: 8,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Array } = structure;
      const array = new U8Array(undefined);
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      array.dataView = new DataView(typedArray.buffer);
      for (let i = 0; i < typedArray.length; i++) {
        expect(array[i]).to.equal(typedArray[i]);
      }
      array[0] = 123;
      expect(array[0]).to.not.equal(typedArray[0]);
    })
    it('should accept typed array of a different type as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[8]u8',
        length: 8,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Array } = structure;
      const typedArray = new Float32Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const array = new U8Array(typedArray);
      expect(array).to.have.lengthOf(typedArray.length);
      for (let i = 0; i < typedArray.length; i++) {
        expect(array[i]).to.equal(typedArray[i]);
      }
    })
    it('should accept a generator as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[8]u8',
        length: 8,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Array } = structure;
      const f = function*() {
        let i = 0;
        while (i < 8) {
          yield i++;
        }
      };
      const gen = f();
      const array = new U8Array(gen);
      expect(array).to.have.lengthOf(8);
      for (let i = 0; i < array.length; i++) {
        expect(array[i]).to.equal(i);
      }
    })
    it('should throw when initializer is of the wrong length', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello([ 1, 2, 3, 4, 5, 6, 7, 8, 9 ])).to.throw();
    })
    it('should throw when given an object of the incorrect type', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello({})).to.throw();
    })
    it('should correctly initialize an array of struct pointers', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        isRequired: true,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: true,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        isRequired: true,
        byteSize: 8,
        bitOffset: 0,
        bitSize: 64,
        slot: 0,
        structure: structStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const { constructor: HelloPtr } = ptrStructure;
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[4]*Hello',
        length: 4,
        byteSize: 8 * 4,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: ptrStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloPtrArray } = structure;
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
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        isRequired: true,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: true,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
      });
      env.finalizeShape(structStructure)
      env.finalizeStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: '[4]Hello',
        length: 4,
        byteSize: 8 * 4,
        hasPointer: false,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloArray } = structure;
      const buffer = new ArrayBuffer(64);
      const dv = new DataView(buffer, 32, 32);
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, 4567, true);
      const array = HelloArray(dv);
      expect(array[0].valueOf()).to.eql({ dog: 1234, cat: 4567 });
    })
    it('should allow reinitialization through the dollar property', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 4,
        byteSize: 8 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: { constructor: function() {}, typedArray: BigUint64Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello([ 100n, 200n, 300n, 400n ]);
      for (let i = 0; i < 4; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 100n);
      }
      object.$ = new BigUint64Array([ 1000n, 2000n, 3000n, 4000n ]);
      for (let i = 0; i < 4; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 1000n);
      }
    })
    it('should correctly copy array holding pointers', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure)
      env.finalizeStructure(intStructure)
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const { constructor: Int32Ptr } = ptrStructure;
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 4,
        byteSize: 8 * 4,
        hasPointer: true,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: ptrStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32PtrArray } = structure;
      const array1 = new Int32PtrArray([ new Int32(1234), new Int32(4567), new Int32(7890), new Int32(12345) ]);
      const array2 = new Int32PtrArray(array1);
      expect(array2[0]['*']).to.equal(1234);
      expect(array2[1]['*']).to.equal(4567);
      expect(array2[2]['*']).to.equal(7890);
      expect(array2[3]['*']).to.equal(12345);
    })
    it('should allow casting to array from a slice with same element type', function() {
      const Int64 = function() {};
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Int64Slice',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: { constructor: Int64, typedArray: BigUint64Array },
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: Int64Slice } = sliceStructure;
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        name: 'Int64Array',
        length: 4,
        byteSize: 8 * 4,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: { constructor: Int64, typedArray: BigUint64Array },
      });
      env.finalizeShape(arrayStructure);
      env.finalizeStructure(arrayStructure);
      const { constructor: Int64Array } = arrayStructure;
      const slice = new Int64Slice([ 100n, 200n, 300n, 400n ]);
      const array = Int64Array(slice);
      expect(slice[MEMORY]).to.equal(array[MEMORY]);
    })
    it('should allow the assignment of setter and getter as well as other properties', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
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
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      object.get = () => {};
      delete object.get;
      expect(object.get(0)).to.equal(1);
      object.set = () => {};
      delete object.set;
      object.set(0, 1);
      expect(object.get(0)).to.equal(1);
      object.ok = () => {};
      delete object.ok;
      expect(object.ok).to.be.undefined;
      object[Symbol.asyncIterator] = function() {};
      object[Symbol.asyncIterator]();
      delete object[Symbol.asyncIterator];
      expect(object[Symbol.asyncIterator]).to.be.undefined;
    })
    it('should be able to create read-only object', function() {
      const structure = env.beginStructure({
        type: StructureType.Array,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      const constructor = function() {};
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(Hello).to.be.a('function');
      expect(Hello.child).to.equal(constructor);
      const object = new Hello(new Uint32Array(8), { writable: false });
      expect(() => object.set(0, 321)).to.throw();
      expect(() => object[0] = 321).to.throw();
    })
  })
  describe('getArrayIterator', function() {
    it('should return a iterator', function() {
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = { [MEMORY]: dv };
      const { get } = getDescriptor(member, {});
      Object.defineProperty(object, 'get', { value: get });
      Object.defineProperty(object, 'length', {
        get: function() {
          const dv = this[MEMORY];
          return dv.byteLength / 4;
        },
      });
      const it = getArrayIterator.call(object);
      expect(it.next()).to.eql({ value: 1234, done: false });
      expect(it.next()).to.eql({ value: -2, done: false });
      expect(it.next()).to.eql({ value: -1, done: false });
      expect(it.next()).to.eql({ value: undefined, done: true });
      object[Symbol.iterator] = getArrayIterator;
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 1234, -2, -1]);
    })
  })
  describe('getArrayEntriesIterator', function() {
    it('should return a iterator', function() {
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = { [MEMORY]: dv };
      const { get } = getDescriptor(member, {});
      Object.defineProperty(object, 'get', { value: get });
      Object.defineProperty(object, 'length', {
        get: function() {
          const dv = this[MEMORY];
          return dv.byteLength / 4;
        },
      });
      const it = getArrayEntriesIterator.call(object);
      expect(it.next()).to.eql({ value: [ 0, 1234 ], done: false });
      expect(it.next()).to.eql({ value: [ 1, -2 ], done: false });
      expect(it.next()).to.eql({ value: [ 2, -1 ], done: false });
      expect(it.next()).to.eql({ value: undefined, done: true });
      object.entries = function() {
        return { [Symbol.iterator]: getArrayEntriesIterator.bind(this) };
      };
      const indexList = [];
      const valueList = [];
      for (const [ index, value ] of object.entries()) {
        indexList.push(index);
        valueList.push(value);
      }
      expect(indexList).to.eql([ 0, 1, 2 ]);
      expect(valueList).to.eql([ 1234, -2, -1]);
    })
  })
  describe('createArrayEntries', function() {
    it('should create an entries object from an array', function() {
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = { [MEMORY]: dv };
      const { get } = getDescriptor(member, {});
      Object.defineProperty(object, 'get', { value: get });
      Object.defineProperty(object, 'length', {
        get: function() {
          const dv = this[MEMORY];
          return dv.byteLength / 4;
        },
      });
      const entries = createArrayEntries.call(object);
      const indexList = [];
      const valueList = [];
      for (const [ index, value ] of entries) {
        indexList.push(index);
        valueList.push(value);
      }
      expect(indexList).to.eql([ 0, 1, 2 ]);
      expect(valueList).to.eql([ 1234, -2, -1]);
    })
  })
})