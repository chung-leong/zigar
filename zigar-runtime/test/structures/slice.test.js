import { expect } from 'chai';
import {
  MemberFlag, MemberType, PointerFlag, SliceFlag, StructureFlag, StructureType,
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ENTRIES, FINALIZE, INITIALIZE, MEMORY, SLOTS } from '../../src/symbols.js';
import { encodeBase64 } from '../../src/utils.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Structure: slice', function() {
  describe('defineSlice', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 32,
          byteSize: 4,
          structure: {},
        },
      ];
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineSlice(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Slice,
        name: '[4]i32',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 32,
          byteSize: 4,
          structure: {},
        },
      ];
      const env = new Env();
      const descriptors = {};
      env.defineSlice(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors.entries?.value).to.be.a('function');
      expect(descriptors[Symbol.iterator]?.value).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
      expect(descriptors[FINALIZE]?.value).to.be.a('function');
      expect(descriptors[ENTRIES]?.value).to.be.a('function');
    })
  })
  describe('finalizeSlice', function() {
    it('should add static descriptors to the given object', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Slice',
        byteSize: 2,
        instance: {},
        static: {
          members: [],
          template: {
            [SLOTS]: {},
          }
        },
      };
      structure.instance.members = [
        {
          type: MemberType.Uint,
          bitSize: 16,
          byteSize: 2,
          structure,
        },
      ];
      const env = new Env();
      const descriptors = {};
      env.finalizeSlice(structure, descriptors);
      expect(descriptors.child?.value).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define structure for holding an int slice', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Slice',
        byteSize: 4,
      });
      const constructor = function() {};
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array }
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      expect(Slice).to.be.a('function');
      expect(Slice.child).to.equal(constructor);
      const object = Slice(new ArrayBuffer(32));
      object.set(1, 321);
      expect(object.get(1)).to.equal(321);
      expect(object.length).to.equal(8);
      const subarray1 = object.subarray();
      expect(subarray1).to.equal(object);
      const subarray2 = object.subarray(1, -1);
      expect(subarray2).to.not.equal(object);
      expect(subarray2.length).to.equal(6);
      subarray2[0] = 1234;
      expect(subarray2[0]).to.equal(1234);
      expect(subarray1[1]).to.equal(1234);
      const subarray3 = object.subarray(-1000, 1000);
      expect(subarray3).to.equal(object);
      const subarray4 = object.subarray(-1000, -1000);
      expect(subarray4.length).to.equal(0);
      const slice1 = object.slice();
      expect(slice1.length).to.equal(8);
      expect(slice1[1]).to.equal(1234);
      slice1[1] = 4567;
      expect(slice1[1]).to.equal(4567);
      expect(subarray2[0]).to.equal(1234);
    })
    it('should cast the same buffer to the same object', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Slice',
        byteSize: 4,
      });
      const constructor = function() {};
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array }
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const buffer = new ArrayBuffer(4 * 20);
      const object1 = Slice(buffer);
      const object2 = Slice(buffer);
      expect(object2).to.equal(object1);
    })
    it('should throw when no initializer is provided', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Slice',
        byteSize: 4,
      });
      const constructor = function() {};
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array }
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Slice).to.throw(TypeError);
    })
    it('should throw when the slice length is changed', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Slice',
        byteSize: 4,
      });
      const constructor = function() {};
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array }
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const object = Slice(new ArrayBuffer(32));
      expect(() => object.length = 0).to.throw(TypeError);
    })
    it('should define slice that is iterable', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Slice',
        byteSize: 4,
      });
      const constructor = function() {};
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array }
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const object = Slice(new ArrayBuffer(32));
      object.set(1, 321);
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 0, 321, 0, 0, 0, 0, 0, 0]);
    })
    it('should permit retrieval of indices during iteration', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Slice',
        byteSize: 4,
      });
      const constructor = function() {};
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array }
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const object = Slice(new ArrayBuffer(32));
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
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray,
        name: 'Slice',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const dv = new DataView(new ArrayBuffer(4));
      dv.setUint8(0, 'A'.charCodeAt(0));
      dv.setUint8(1, 'B'.charCodeAt(0));
      dv.setUint8(2, 'C'.charCodeAt(0));
      dv.setUint8(3, 'D'.charCodeAt(0));
      const object = Slice(dv);
      const { string } = object;
      expect(string).to.equal('ABCD');
    })
    it('should have string property when slice contains Uint16', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray,
        name: 'Slice',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint16(0, 'A'.charCodeAt(0), true);
      dv.setUint16(2, 'B'.charCodeAt(0), true);
      dv.setUint16(4, 'C'.charCodeAt(0), true);
      dv.setUint16(6, 'D'.charCodeAt(0), true);
      const object = Slice(dv);
      const { string } = object;
      expect(string).to.equal('ABCD');
    })
    it('should accept array as initializer', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 4,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u32',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Slice([ 1, 2, 3, 4, 5, 6, 7, 8 ]);
      expect(object.length).to.equal(8);
      for (let i = 0; i < 8; i++) {
        expect(object.get(i)).to.equal(i + 1);
      }
    })
    it('should accept number as initializer', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 4,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u32',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Slice(8);
      expect(object.length).to.equal(8);
    })
    it('should throw when given an invalid number', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 4,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u32',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Slice(-123)).to.throw();
      expect(() => new Slice(NaN)).to.throw();
      expect(() => new Slice(Infinity)).to.throw();
    })
    it('should accept string as initializer for []u8', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const str = 'Slice world';
      const slice = new Slice(str);
      expect(slice).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(slice[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should accept string as initializer for []u16', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const str = 'Slice world';
      const slice = new Slice(str);
      expect(slice).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(slice[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should allow reinitialization of []u16 using a string', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const str = 'Slice world';
      const slice = new Slice(str);
      const str2 = 'World war z';
      slice.$ = str2;
      for (let i = 0; i < str2.length; i++) {
        expect(slice[i]).to.equal(str2.charCodeAt(i));
      }
    })
    it('should throw when reinitialization leads to a different length', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const str = 'Slice world';
      const slice = new Slice(str);
      const slice2 = new Slice(str + '!');
      expect(() => slice.$ = slice2).to.throw(TypeError);
    })
    it('should initialize correctly from a string when zig is specified', function() {
      const env = new Env();
      env.allocateScratchMemory = function(len, align) {
        return usize(0x1000);
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else if (process.env.TARGET === 'node') {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const str = 'Slice world';
      const slice = new Slice(str, { zig: true });
      expect(slice).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(slice[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should allow assignment of string to []u16', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const slice = new Slice(11);
      const str = 'Slice world';
      slice.string = str;
      for (let i = 0; i < str.length; i++) {
        expect(slice[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should throw when the string is too short', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const slice = new Slice(11);
      const str = 'Slice';
      expect(() => slice.string = str).to.throw(TypeError);
    })
    it('should throw when given an object with unrecognized properties', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Slice({ dogmeat: 5 })).to.throw();
    })
    it('should throw when given something unacceptable', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u16',
        byteSize: 2,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u16',
        byteSize: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Slice(() => {})).to.throw();
    })
    it('should accept base64 data as initializer', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const str = 'Slice world';
      const base64 = encodeBase64(Buffer.from(str));
      const slice = new Slice({ base64 });
      expect(slice).to.have.lengthOf(str.length);
      for (let i = 0; i < str.length; i++) {
        expect(slice[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should allow assignment of base64 data', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const slice = new Slice('Slice world');
      const str = 'World war z';
      slice.base64 = encodeBase64(Buffer.from(str));
      for (let i = 0; i < str.length; i++) {
        expect(slice[i]).to.equal(str.charCodeAt(i));
      }
    })
    it('should accept typed array as initializer', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsTypedArray,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const slice = new Slice({ typedArray });
      expect(slice).to.have.lengthOf(typedArray.length);
      for (let i = 0; i < typedArray.length; i++) {
        expect(slice[i]).to.equal(typedArray[i]);
      }
      slice[0] = 123;
      expect(slice[0]).to.not.equal(typedArray[0]);
    })
    it('should allow assignment of typed array', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsTypedArray,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const slice = new Slice(new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]));
      const typedArray = new Uint8Array([ 0, 10, 20, 30, 40, 50, 60, 70 ]);
      slice.typedArray = typedArray;
      for (let i = 0; i < typedArray.length; i++) {
        expect(slice[i]).to.equal(typedArray[i]);
      }
    })
    it('should throw when given typed array of a different type', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsTypedArray,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const slice = new Slice(new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]));
      const typedArray = new Int16Array([ 0, 10, 20, 30, 40, 50, 60, 70 ]);
      expect(() => slice.typedArray = typedArray).to.throw(TypeError);
    })
    it('should accept data view as initializer', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const dataView = new DataView(typedArray.buffer);
      const slice = new Slice({ dataView });
      expect(slice).to.have.lengthOf(typedArray.length);
      for (let i = 0; i < typedArray.length; i++) {
        expect(slice[i]).to.equal(typedArray[i]);
      }
      slice[0] = 123;
      expect(slice[0]).to.not.equal(typedArray[0]);
    })
    it('should allow assignment of data view', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const slice = new Slice(8);
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      slice.dataView = new DataView(typedArray.buffer);
      for (let i = 0; i < typedArray.length; i++) {
        expect(slice[i]).to.equal(typedArray[i]);
      }
      slice[0] = 123;
      expect(slice[0]).to.not.equal(typedArray[0]);
    })
    it('should accept typed array of a different type as initializer', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const typedArray = new Float32Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const slice = new Slice(typedArray);
      expect(slice).to.have.lengthOf(typedArray.length);
      for (let i = 0; i < typedArray.length; i++) {
        expect(slice[i]).to.equal(typedArray[i]);
      }
    })
    it('should accept a generator as initializer', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const f = function*() {
        let i = 0;
        while (i < 8) {
          yield i++;
        }
      };
      const gen = f();
      const slice = new Slice(gen);
      expect(slice).to.have.lengthOf(8);
      for (let i = 0; i < slice.length; i++) {
        expect(slice[i]).to.equal(i);
      }
    })
    it('should accept a generator that provide a length as first item', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      // incorrect length would lead to too small a buffer
      const f1 = function*() {
        yield { length: 4 };
        let i = 0;
        while (i < 8) {
          yield i++;
        }
      };
      expect(() => new Slice(f1())).throw(RangeError);
      const f2 = function*() {
        yield { length: 8 };
        let i = 0;
        while (i < 8) {
          yield i++;
        }
      };
      const slice = new Slice(f2());
      expect(slice).to.have.lengthOf(8);
      for (let i = 0; i < slice.length; i++) {
        expect(slice[i]).to.equal(i);
      }
    })
    it('should correctly initialize a slice of structs', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Slice',
        byteSize: 4 * 2,
      });
      env.attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
        structure: intStructure,
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
        structure: intStructure,
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Slice',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      const SliceSlice = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new SliceSlice([
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
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Slice',
        byteSize: 4 * 2,
      });
      env.attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        flags: 0,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
        structure: intStructure,
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        flags: 0,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
        structure: intStructure,
      });
      env.attachTemplate(structStructure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 1234, true);
          dv.setUint32(4, 4567, true);
          return dv;
        })(),
      });
      const Slice = env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Slice',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      const SliceSlice = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new SliceSlice(4);
      for (let i = 0; i < 4; i++) {
        expect(object[i].valueOf()).to.eql({ dog: 0, cat: 0 });
      }
      object[0] = {};
      expect(object[0].valueOf()).to.eql({ dog: 1234, cat: 4567 });
    })
    it('should allow reinitialization through the dollar property', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Slice',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Slice([ 100n, 200n, 300n, 400n ]);
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
    it('should allow casting from a typed array', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const typedArray = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const slice = Slice(typedArray);
      slice[0] = 123;
      expect(typedArray[123]).to.not.equal(123);
    })
    it('should allow casting from an Uint8ClampedArray', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const typedArray = new Uint8ClampedArray([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      const slice = Slice(typedArray);
      slice[0] = 123;
      expect(typedArray[123]).to.not.equal(123);
    })
    it('should allow casting from an array with same element type', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u64',
        byteSize: 8,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u64',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: uintStructure
      });
      const U64Slice = env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        name: '[4]u64',
        length: 4,
        byteSize: 8 * 4,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: uintStructure
      });
      const U64Array = env.defineStructure(arrayStructure);
      env.endStructure(arrayStructure);
      const array = new U64Array([ 100n, 200n, 300n, 400n ]);
      const slice = U64Slice(array);
      expect(slice[MEMORY]).to.equal(array[MEMORY]);
    })
    it('should allow casting from an vector with same element type', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u64',
        byteSize: 8,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]u64',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: uintStructure,
      });
      const Slice = env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const vectorStructure = env.beginStructure({
        type: StructureType.Vector,
        name: '@Vector(4, u64)',
        length: 4,
        byteSize: 8 * 4,
      });
      env.attachMember(vectorStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: uintStructure,
      });
      const Vector = env.defineStructure(vectorStructure);
      env.endStructure(vectorStructure);
      const vector = new Vector([ 100n, 200n, 300n, 400n ]);
      const slice = Slice(vector);
      expect(slice[MEMORY]).to.equal(vector[MEMORY]);
    })
    it('should not allow casting from an array with different element type', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u64',
        byteSize: 8,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]i64',
        byteSize: 8,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Int,
        bitSize: 64,
        byteSize: 8,
        structure: intStructure,
      });
      const I64Slice = env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        name: '[4]u64',
        length: 4,
        byteSize: 8 * 4,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        structure: uintStructure,
      });
      const U64Array = env.defineStructure(arrayStructure);
      env.endStructure(arrayStructure);
      const array = new U64Array([ 100n, 200n, 300n, 400n ]);
      expect(() => I64Slice(array)).to.throw(TypeError)
        .with.property('message').that.contains(`that can accommodate items 8 bytes in length`);
    })
    it('should throw when initializer has the wrong size', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Slice',
        byteSize: 4 * 2,
      });
      env.attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
        structure: intStructure,
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
        structure: intStructure,
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Slice',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      const SliceSlice = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new SliceSlice([
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
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Slice',
        byteSize: 4 * 2,
      });
      env.attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
        structure: {},
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        name: 'Slice',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      const SliceSlice = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new SliceSlice({})).to.throw(TypeError);
    })
    it('should correctly copy a slice holding pointers', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Int32 = env.defineStructure(uintStructure);
      env.endStructure(uintStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]i32',
        byteSize: 8,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: uintStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[_]i32',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: ptrStructure,
      });
      const Int32PtrSlice = env.defineStructure(structure);
      env.endStructure(structure);
      const slice1 = new Int32PtrSlice([ new Int32(1234), new Int32(4567), new Int32(7890) ]);
      const slice2 = new Int32PtrSlice(slice1);
      expect(slice1[0]['*']).to.equal(1234);
      expect(slice2[0]['*']).to.equal(1234);
      expect(slice2[1]['*']).to.equal(4567);
      expect(slice2[2]['*']).to.equal(7890);
    })
    it('should return string without sentinel value', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray | SliceFlag.HasSentinel,
        name: '[_:0]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSentinel | MemberFlag.IsRequired,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(1)),
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const array = [ ...'Slice\0' ].map(c => c.charCodeAt(0));
      const slice = new Slice(array);
      expect(slice).to.have.lengthOf(6);
      const str = slice.string;
      expect(str).to.have.lengthOf(5);
    })
    it('should automatically insert sentinel character', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray | SliceFlag.HasSentinel,
        name: '[_:0]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSentinel | MemberFlag.IsRequired,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(1)),
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const slice = new Slice('Slice');
      expect(slice).to.have.lengthOf(6);
      expect(slice[5]).to.equal(0);
    })
    it('should not add unnecessary sentinel character', function() {
      const env = new Env();
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray | SliceFlag.HasSentinel,
        name: '[_:0]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSentinel | MemberFlag.IsRequired,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(1)),
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const slice = new Slice('Slice\0');
      expect(slice).to.have.lengthOf(6);
    })
    it('should should throw when sentinel appears too early', function() {
      const env = new Env();
      env.runtimeSafety = true;
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray | SliceFlag.HasSentinel,
        name: '[_:0]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSentinel | MemberFlag.IsRequired,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(1)),
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const array = [ ...'H\0llo\0' ].map(c => c.charCodeAt(0));
      expect(() => new Slice(array)).to.throw(TypeError);
      expect(() => new Slice('H\0llo\0')).to.throw(TypeError);
      expect(() => new Slice({ typedArray: new Uint8Array(array) })).to.throw(TypeError);
      const slice = new Slice(6);
      expect(() => slice.$.typedArray = new Uint8Array(array)).to.throw(TypeError);
    })
    it('should should throw when sentinel is missing', function() {
      const env = new Env();
      env.runtimeSafety = true;
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray | SliceFlag.HasSentinel,
        name: '[_:0]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSentinel | MemberFlag.IsRequired,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(1)),
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const array = [ ...'Slice' ].map(c => c.charCodeAt(0));
      expect(() => new Slice(array)).to.throw(TypeError);
      expect(() => new Slice({ typedArray: new Uint8Array(array) })).to.throw(TypeError);
      expect(() => new Slice('Slice')).to.not.throw();
      const slice = new Slice(5);
      expect(() => slice.$.typedArray = new Uint8Array(array)).to.throw(TypeError)
        .with.property('message').that.contains(4);
    })
    it('should should throw when sentinel is missing even if runtimeSafety is false', function() {
      const env = new Env();
      env.runtimeSafety = false;
      const uintStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(uintStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: uintStructure,
      });
      env.defineStructure(uintStructure);
      env.finalizeStructure(uintStructure);
      env.runtimeSafety = false;
      const structure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray | SliceFlag.HasSentinel,
        name: '[_:0]u8',
        byteSize: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSentinel | MemberFlag.IsRequired,
        bitOffset: 0,
        bitSize: 8,
        byteSize: 1,
        structure: uintStructure,
      });
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(1)),
      });
      const Slice = env.defineStructure(structure);
      env.endStructure(structure);
      const array = [ ...'Slice' ].map(c => c.charCodeAt(0));
      expect(() => new Slice(array)).to.throw(TypeError);
      expect(() => new Slice({ typedArray: new Uint8Array(array) })).to.throw(TypeError);
      expect(() => new Slice('Slice')).to.not.throw();
      const slice = new Slice(5);
      expect(() => slice.$.typedArray = new Uint8Array(array)).to.throw(TypeError)
        .with.property('message').that.contains(4);
    })
    if (process.env.TARGET === 'node') {
      it('should allow casting from a buffer', function() {
        const env = new Env();
        const uintStructure = env.beginStructure({
          type: StructureType.Primitive,
            byteSize: 4,
        });
        env.attachMember(uintStructure, {
          type: MemberType.Uint,
          bitSize: 32,
          bitOffset: 0,
          byteSize: 4,
          structure: uintStructure,
        });
        env.defineStructure(uintStructure);
        env.finalizeStructure(uintStructure);
        const structure = env.beginStructure({
          type: StructureType.Slice,
          name: '[_]u32',
          byteSize: 4,
        });
        env.attachMember(structure, {
          type: MemberType.Uint,
          bitSize: 32,
          byteSize: 4,
          structure: uintStructure,
        });
        const Slice = env.defineStructure(structure);
        env.endStructure(structure);
        const buffer = new Buffer(16);
        const slice = Slice(buffer);
        slice[0] = 0xf0f0f0f0;
        expect(slice).to.have.lengthOf(4);
        expect(buffer[0]).to.equal(0xf0);
      })
    }
  })
})