import { expect } from 'chai';
import { MemberType, PointerFlag, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { MEMORY, SLOTS } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Feature: write-protection', function() {
  describe('makeReadOnly', function() {
    it('should make an object read-only', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              name: 'cat',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 32,
              byteSize: 4,
              structure: {},
            },
          ],
          template: {
            [MEMORY]: (() => {
              const dv = new DataView(new ArrayBuffer(4 * 2));
              dv.setInt32(0, 1234, true);
              dv.setInt32(4, 4567, true);
              return dv;
            })(),
            [SLOTS]: {},
          },
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello({ dog: 123, cat: 456 });
      env.makeReadOnly(object);
      expect(object.dog).to.equal(123);
      object.valueOf();
      expect(object.valueOf()).to.eql({ dog: 123, cat: 456 });
      expect(() => object.dog = 1).to.throw(TypeError);
      expect(() => object.cat = 1).to.throw(TypeError);
    })
    skip.
    it('should make an array read-only', function() {
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
        name: '[8]u32',
        length: 8,
        byteSize: 4 * 8,
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
      const array = new Array([ 1, 2, 3, 4, 5, 6, 7, 8]);
      env.makeReadOnly(array);
      expect([ ...array ]).to.eql([ 1, 2, 3, 4, 5, 6, 7, 8]);
      expect(() => array[0] = 10).to.throw(TypeError);
      expect(() => array[1] = 20).to.throw(TypeError);
      expect(array.get(0)).to.equal(1);
      expect(() => array.set(0, 10)).to.throw(TypeError);
    })
    it('should make a slice pointer read-only', function() {
      const env = new Env();
      const structStructure = {
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              name: 'cat',
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              name: 'dog',
              bitSize: 32,
              bitOffset: 32,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structStructure);
      env.finishStructure(structStructure);
      const sliceStructure = {
        type: StructureType.Slice,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[_]Hello',
        byteSize: 8,
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
      env.beginStructure(sliceStructure);
      env.finishStructure(sliceStructure);
      const { constructor: HelloSlice } = sliceStructure;
      const structure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]Hello',
        byteSize: 16,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: sliceStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const { constructor: HelloPtr } = structure;
      const pointer = new HelloPtr([ { cat: 123, dog: 456 }, { cat: 1230, dog: 4560 }, { cat: 12300, dog: 45600 } ]);
      env.makeReadOnly(pointer);
      const newObject = new HelloSlice([]);
      expect(() => pointer.$ = newObject).to.throw(TypeError);
      expect(() => pointer['*'] = newObject).to.throw(TypeError);
      expect(() => pointer.length = 2).to.not.throw();
      const slice = pointer['*'];
      expect(slice.valueOf()).to.eql([ { cat: 123, dog: 456 }, { cat: 1230, dog: 4560 } ]);
      env.makeReadOnly(slice);
      const first = slice.get(0);
      expect(() => first.cat = 123).to.throw(TypeError);
    })
  })
})