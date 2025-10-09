import { expect } from 'chai';
import { ArrayFlag, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Member: string', function() {
  describe('defineString', function() {
    it('should return descriptor for string prop', function() {
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
      const string = env.defineString(structure);
      expect(string.get).to.be.a('function');
      expect(string.set).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should attach string prop to structures', function() {
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
      env.finalizeStructure(structure);
      const Array = structure.constructor;
      const array = new Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]);
      for (let i = 0, c = 'A'.charCodeAt(0); i < 11; i++, c++) {
        array[i] = c;
      }
      expect(array.string).to.equal('ABCDEFGHIJK');
      array.string = 'Hello world';
      expect(array.string).to.equal('Hello world');
    })
    it('should throw when string prop is given incorrect data', function() {
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
      env.finalizeStructure(structure);
      const Array = structure.constructor;
      const array = new Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]);
      expect(() => array.string = '').to.throw(TypeError);
      expect(() => array.string = 123).to.throw(TypeError);
      expect(() => array.string = 'Hello world!!!').to.throw(TypeError);
    })
  })
})
