import { expect } from 'chai';
import { ArrayFlag, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Member: clampedArray', function() {
  describe('defineClampedArray', function() {
    it('should return descriptor for clampedArray', function() {
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
        flags: StructureFlag.HasProxy | ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u8',
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
      const clampedArray = env.defineClampedArray(structure);
      expect(clampedArray.get).to.be.a('function');
      expect(clampedArray.set).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should attach clampedArray prop to structure', function() {
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
        flags: StructureFlag.HasProxy | ArrayFlag.IsString | ArrayFlag.IsTypedArray | ArrayFlag.IsClampedArray,
        name: '[11]u8',
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
      env.finalizeStructure(structure);
      const Array = structure.constructor;
      const array = new Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]);
      expect(array.clampedArray).to.be.a('Uint8ClampedArray');
      expect(array.clampedArray[3]).to.equal(4);
      array.clampedArray[3] = 1024;
      expect(array.clampedArray[3]).to.equal(255);
      array.clampedArray = new Uint8ClampedArray([ -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1 ]);
      expect(array.clampedArray[3]).to.equal(0);
    })
    it('should throw when clampedArray prop is given incorrect data', function() {
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
      intStructure.constructor;
      env.finalizeStructure(intStructure);
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasProxy | ArrayFlag.IsString | ArrayFlag.IsTypedArray | ArrayFlag.IsClampedArray,
        name: '[11]u8',
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
      env.finalizeStructure(structure);
      const Array = structure.constructor;
      const array = new Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]);
      expect(() => array.clampedArray = new Uint8Array(12)).to.throw(TypeError);
    })
  })
})
