import { expect } from 'chai';

import { NodeEnvironment } from '../src/environment-node.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import { MEMORY } from '../src/symbol.js';
import { encodeBase64 } from '../src/text.js';
import { MemberType, StructureType } from '../src/types.js';

describe('Slice functions', function() {
  const env = new NodeEnvironment();
  describe('defineSlice', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
    })
    it('should define structure for holding an int slice', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 4,
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
      const object = Hello(new ArrayBuffer(32));
      object.set(1, 321);
      expect(object.get(1)).to.equal(321);
      expect(object.length).to.equal(8);
    })
    it('should cast the same buffer to the same object', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 4,
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
      const buffer = new ArrayBuffer(4 * 20);
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
    })
    it('should throw when no initializer is provided', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 4,
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
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should define slice that is iterable', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 4,
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
      const object = Hello(new ArrayBuffer(32));
      object.set(1, 321);
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 0, 321, 0, 0, 0, 0, 0, 0]);
    })
    it('should permit retrieval of indices during iteration', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 4,
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
      const object = Hello(new ArrayBuffer(32));
      object.set(1, 321);
      const indexList = [];
      const valueList = [];
      for (const [ index, value ] of object.entries()) {
        indexList.push(index);
        valueList.push(value);
      }
      expect(indexList).to.eql([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      expect(valueList).to.eql([ 0, 321, 0, 0, 0, 0, 0, 0]);
    })
    it('should have string property when slice contains Uint8', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const dv = new DataView(new ArrayBuffer(4));
      dv.setUint8(0, 'A'.charCodeAt(0));
      dv.setUint8(1, 'B'.charCodeAt(0));
      dv.setUint8(2, 'C'.charCodeAt(0));
      dv.setUint8(3, 'D'.charCodeAt(0));
      const object = Hello(dv);
      const { string } = object;
      expect(string).to.equal('ABCD');
    })
    it('should have string property when slice contains Uint16', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint16(0, 'A'.charCodeAt(0), true);
      dv.setUint16(2, 'B'.charCodeAt(0), true);
      dv.setUint16(4, 'C'.charCodeAt(0), true);
      dv.setUint16(6, 'D'.charCodeAt(0), true);
      const object = Hello(dv);
      const { string } = object;
      expect(string).to.equal('ABCD');
    })
    it('should accept array as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 4,
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
      expect(object.length).to.equal(8);
      for (let i = 0; i < 8; i++) {
        expect(object.get(i)).to.equal(i + 1);
      }
    })
    it('should accept number as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 4,
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
      const object = new Hello(8);
      expect(object.length).to.equal(8);
    })
    it('should throw when given an invalid number', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 4,
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
      expect(() => new Hello(-123)).to.throw();
      expect(() => new Hello(NaN)).to.throw();
      expect(() => new Hello(Infinity)).to.throw();
    })
    it('should accept string as initializer for []u8', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const str = 'Hello world';
      const slice = new U8Slice(str);
      expect(slice).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(slice[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should accept string as initializer for []u16', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const str = 'Hello world';
      const slice = new U8Slice(str);
      expect(slice).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(slice[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should allow reinitialization of []u16 using a string', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U16Slice } = structure;
      const str = 'Hello world';
      const slice = new U16Slice(str);
      const str2 = 'World war z';
      slice.$ = str2;
      for (let i = 0; i < str2.length; i++) {
        expect(slice[i]).to.equal(str2.charCodeAt(i));
      }
    })
    it('should throw when reinitialization leads to a different length', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U16Slice } = structure;
      const str = 'Hello world';
      const slice = new U16Slice(str);
      const slice2 = new U16Slice(str + '!');
      expect(() => slice.$ = slice2).to.throw(TypeError);
    })
    it('should allow assignment of string to []u16', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U16Slice } = structure;
      const slice = new U16Slice(11);
      const str = 'Hello world';
      slice.string = str;
      for (let i = 0; i < str.length; i++) {
        expect(slice[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should throw when the string is too short', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U16Slice } = structure;
      const slice = new U16Slice(11);
      const str = 'Hello';
      expect(() => slice.string = str).to.throw(TypeError);
    })
    it('should throw when given an object with unrecognized properties', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U16Slice } = structure;
      expect(() => new U16Slice({ dogmeat: 5 })).to.throw();
    })
    it('should throw when given something unacceptable', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U16Slice } = structure;
      expect(() => new U16Slice(() => {})).to.throw();
    })
    it('should accept base64 data as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const str = 'Hello world';
      const base64 = encodeBase64(Buffer.from(str));
      const slice = new U8Slice({ base64 });
      expect(slice).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(slice[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should allow assignment of base64 data', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const slice = new U8Slice('Hello world');
      const str = 'World war z';
      slice.base64 = encodeBase64(Buffer.from(str));
      for (let i = 0; i < str.length; i++) {
        expect(slice[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should accept typed array as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const slice = new U8Slice({ typedArray });
      expect(slice).to.have.lengthOf(typedArray.length);
      for (let i = 0; i < typedArray.length; i++) {
        expect(slice[i]).to.equal(typedArray[i]);
      }
      slice[0] = 123;
      expect(slice[0]).to.not.equal(typedArray[0]);
    })
    it('should allow assignment of typed array', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const slice = new U8Slice(new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]));
      const typedArray = new Uint8Array([ 0, 10, 20, 30, 40, 50, 60, 70 ]);
      slice.typedArray = typedArray;
      for (let i = 0; i < typedArray.length; i++) {
        expect(slice[i]).to.equal(typedArray[i]);
      }
    })
    it('should throw when given typed array of a different type', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const slice = new U8Slice(new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]));
      const typedArray = new Int16Array([ 0, 10, 20, 30, 40, 50, 60, 70 ]);
      expect(() => slice.typedArray = typedArray).to.throw(TypeError);
    })
    it('should accept data view as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const dataView = new DataView(typedArray.buffer);
      const slice = new U8Slice({ dataView });
      expect(slice).to.have.lengthOf(typedArray.length);
      for (let i = 0; i < typedArray.length; i++) {
        expect(slice[i]).to.equal(typedArray[i]);
      }
      slice[0] = 123;
      expect(slice[0]).to.not.equal(typedArray[0]);
    })
    it('should allow assignment of data view', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const slice = new U8Slice(8);
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      slice.dataView = new DataView(typedArray.buffer);
      for (let i = 0; i < typedArray.length; i++) {
        expect(slice[i]).to.equal(typedArray[i]);
      }
      slice[0] = 123;
      expect(slice[0]).to.not.equal(typedArray[0]);
    })
    it('should accept typed array of a different type as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const typedArray = new Float32Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const slice = new U8Slice(typedArray);
      expect(slice).to.have.lengthOf(typedArray.length);
      for (let i = 0; i < typedArray.length; i++) {
        expect(slice[i]).to.equal(typedArray[i]);
      }
    })
    it('should accept a generator as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const f = function*() {
        let i = 0;
        while (i < 8) {
          yield i++;
        }
      };
      const gen = f();
      const slice = new U8Slice(gen);
      expect(slice).to.have.lengthOf(8);
      for (let i = 0; i < slice.length; i++) {
        expect(slice[i]).to.equal(i);
      }
    })
    it('should accept a generator that provide a length as first item', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      // incorrect length would lead to too small a buffer
      const f1 = function*() {
        yield { length: 4 };
        let i = 0;
        while (i < 8) {
          yield i++;
        }
      };
      expect(() => new U8Slice(f1())).throw(RangeError);
      const f2 = function*() {
        yield { length: 8 };
        let i = 0;
        while (i < 8) {
          yield i++;
        }
      };
      const slice = new U8Slice(f2());
      expect(slice).to.have.lengthOf(8);
      for (let i = 0; i < slice.length; i++) {
        expect(slice[i]).to.equal(i);
      }
    })
    it('should correctly initialize a slice of structs', function() {
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
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloSlice } = structure;
      const object = new HelloSlice([
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
        { dog: 7, cat: 8 },
      ]);
      expect(object.valueOf()).to.eql([
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
        { dog: 7, cat: 8 },
      ]);
    })
    it('should not set default values of structs when initialized with an element count', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        isRequired: false,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: false,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
      });
      env.attachTemplate(structStructure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 1234, true);
          dv.setUint32(4, 4567, true);
          return dv;
        })(),
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const { constructor: Hello } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloSlice } = structure;
      const object = new HelloSlice(4);
      for (let i = 0; i < 4; i++) {
        expect(object[i].valueOf()).to.eql({ dog: 0, cat: 0 });
      }
      object[0] = {};
      expect(object[0].valueOf()).to.eql({ dog: 1234, cat: 4567 });
    })
    it('should allow reinitialization through the dollar property', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 8,
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
      expect(object.length).to.equal(4);
      for (let i = 0; i < 4; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 100n);
      }
      object.$ = new BigUint64Array([ 1000n, 2000n, 3000n, 4000n ]);
      expect(object.length).to.equal(4);
      for (let i = 0; i < 4; i++) {
        expect(object.get(i)).to.equal(BigInt(i + 1) * 1000n);
      }
    })
    it('should allow casting from a buffer', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u32',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: function() {}, typedArray: Uint32Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U32Slice } = structure;
      const buffer = new Buffer(16);
      const slice = U32Slice(buffer);
      slice[0] = 0xf0f0f0f0;
      expect(slice).to.have.lengthOf(4);
      expect(buffer[0]).to.equal(0xf0);
    })
    it('should allow casting from a typed array', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const slice = U8Slice(typedArray);
      slice[0] = 123;
      expect(typedArray[123]).to.not.equal(123);
    })
    it('should allow casting from an Uint8ClampedArray', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const typedArray = new Uint8ClampedArray([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const slice = U8Slice(typedArray);
      slice[0] = 123;
      expect(typedArray[123]).to.not.equal(123);
    })
    it('should allow casting from an array with same element type', function() {
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
        structure: { constructor: Int64, typedArray: BigUint64Array }
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
        structure: { constructor: Int64 },
      });
      env.finalizeShape(arrayStructure);
      env.finalizeStructure(arrayStructure);
      const { constructor: Int64Array } = arrayStructure;
      const array = new Int64Array([ 100n, 200n, 300n, 400n ]);
      const slice = Int64Slice(array);
      expect(slice[MEMORY]).to.equal(array[MEMORY]);
    })
    it('should allow casting from an vector with same element type', function() {
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
        structure: { constructor: Int64, typedArray: BigUint64Array }
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: Int64Slice } = sliceStructure;
      const vectorStructure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Int64Vector',
        length: 4,
        byteSize: 8 * 4,
      });
      env.attachMember(vectorStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: { constructor: Int64 },
      });
      env.finalizeShape(vectorStructure);
      env.finalizeStructure(vectorStructure);
      const { constructor: Int64Vector } = vectorStructure;
      const vector = new Int64Vector([ 100n, 200n, 300n, 400n ]);
      const slice = Int64Slice(vector);
      expect(slice[MEMORY]).to.equal(vector[MEMORY]);
    })
    it('should not allow casting from an array with different element type', function() {
      const Int64 = function() {};
      const Uint64 = function() {};
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Int64Slice',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: { constructor: Int64, typedArray: BigUint64Array }
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: Int64Slice } = sliceStructure;
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        name: 'Uint64Array',
        length: 4,
        byteSize: 8 * 4,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: { constructor: Uint64 },
      });
      env.finalizeShape(arrayStructure);
      env.finalizeStructure(arrayStructure);
      const { constructor: Uint64Array } = arrayStructure;     
      const array = new Uint64Array([ 100n, 200n, 300n, 400n ]);
      expect(() => Int64Slice(array)).to.throw(TypeError)
        .with.property('message').that.contains(`that can accommodate items 8 bytes in length`);
    })
    it('should throw when initializer has the wrong size', function() {
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
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloSlice } = structure;
      const object = new HelloSlice([
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
        { dog: 7, cat: 8 },
      ]);
      expect(() => object.$ = [
        { dog: 1, cat: 2 },
        { dog: 3, cat: 4 },
        { dog: 5, cat: 6 },
        { dog: 7, cat: 8 },
        { dog: 9, cat: 10 },
      ]).to.throw(TypeError);
    })
    it('should throw when initializer is of an invalid type', function() {
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
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: HelloSlice } = structure;
      expect(() => new HelloSlice({})).to.throw(TypeError);
    })
    it('should correctly copy a slice holding pointers', function() {
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
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
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
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 8,
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
      const { constructor: Int32PtrSlice } = structure;
      const slice1 = new Int32PtrSlice([ new Int32(1234), new Int32(4567), new Int32(7890) ]);
      const slice2 = new Int32PtrSlice(slice1);
      expect(slice1[0]['*']).to.equal(1234);
      expect(slice2[0]['*']).to.equal(1234);
      expect(slice2[1]['*']).to.equal(4567);
      expect(slice2[2]['*']).to.equal(7890);
    })
    it('should return string without sentinel value', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_:0]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
      });
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(1)),
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const array = [ ...'Hello\0' ].map(c => c.charCodeAt(0));
      const slice = new U8Slice(array);
      expect(slice).to.have.lengthOf(6);
      const str = slice.string;
      expect(str).to.have.lengthOf(5);
    })
    it('should automatically insert sentinel character', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_:0]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
      });
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(1)),
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const slice = new U8Slice('Hello');
      expect(slice).to.have.lengthOf(6);
      expect(slice[5]).to.equal(0);
    })
    it('should not add unnecessary sentinel character', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_:0]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
      });
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(1)),
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const slice = new U8Slice('Hello\0');
      expect(slice).to.have.lengthOf(6);
    })
    it('should should throw when sentinel appears too early', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_:0]u8',
        byteSize: 1,
      }, { runtimeSafety: true });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
      });
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(1)),
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const array = [ ...'H\0llo\0' ].map(c => c.charCodeAt(0));
      expect(() => new U8Slice(array)).to.throw(TypeError);
      expect(() => new U8Slice('H\0llo\0')).to.throw(TypeError);
      expect(() => new U8Slice({ typedArray: new Uint8Array(array) })).to.throw(TypeError);
      const slice = new U8Slice(6);
      expect(() => slice.$.typedArray = new Uint8Array(array)).to.throw(TypeError);
    })
    it('should should throw when sentinel is missing', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_:0]u8',
        byteSize: 1,
      }, { runtimeSafety: true });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
      });
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(1)),
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const array = [ ...'Hello' ].map(c => c.charCodeAt(0));
      expect(() => new U8Slice(array)).to.throw(TypeError);
      expect(() => new U8Slice({ typedArray: new Uint8Array(array) })).to.throw(TypeError);
      expect(() => new U8Slice('Hello')).to.not.throw();
      const slice = new U8Slice(5);
      expect(() => slice.$.typedArray = new Uint8Array(array)).to.throw(TypeError)
        .with.property('message').that.contains(4);
    })
    it('should should throw when sentinel is missing even if runtimeSafety is false', function() {
      const env = new NodeEnvironment();
      env.runtimeSafety = false;
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_:0]u8',
        byteSize: 1,
      }, { runtimeSafety: false });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array }
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
      });
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(1)),
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: U8Slice } = structure;
      const array = [ ...'Hello' ].map(c => c.charCodeAt(0));
      expect(() => new U8Slice(array)).to.throw(TypeError);
      expect(() => new U8Slice({ typedArray: new Uint8Array(array) })).to.throw(TypeError);
      expect(() => new U8Slice('Hello')).to.not.throw();
      const slice = new U8Slice(5);
      expect(() => slice.$.typedArray = new Uint8Array(array)).to.throw(TypeError)
        .with.property('message').that.contains(4);
    })
    it('should be able to create read-only object', function() {
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        byteSize: 4,
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
      const object = new Hello(new Uint32Array(12), { writable: false });
      expect(() => object.set(0, 321)).to.throw();
      expect(() => object[0] = 321).to.throw();
    })
    it('should make child object read-only too', function() {
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
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Hello',
        length: 4,
        byteSize: structStructure.byteSize,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: structStructure.byteSize * 8,
        byteSize: structStructure.byteSize,
        structure: structStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const objects = Hello(new ArrayBuffer(structure.byteSize * 3), { writable: false });
      const [ object ] = objects;
      expect(() => object.dog = 123).to.throw(TypeError)
        .with.property('message').that.contains('read-only');
      expect(() => objects[2] = { cat: 123 }).to.throw(TypeError)
        .with.property('message').that.contains('read-only');
    })
  })
})
