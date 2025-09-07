import { expect } from 'chai';
import { ArrayFlag, MemberType, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Member: base64', function() {
  describe('defineBase64', function() {
    it('should return descriptor for base64 prop', function() {
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
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
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
      const base64 = env.defineBase64(structure);
      expect(base64.get).to.be.a('function');
      expect(base64.set).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should attach base64 prop to structure', function() {
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
      const { base64 } = array;
      expect(base64).to.be.a('string');
      const array2 = new Array({ base64 });
      expect([ ...array2 ]).to.eql([ ...array ]);
    })
    it('should throw when base prop is given incorrect data', function() {
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
      expect(() => array.base64 = '').to.throw(TypeError);
      expect(() => array.base64 = 5).to.throw(TypeError);
    })
  })
})
