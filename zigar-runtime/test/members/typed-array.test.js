import { expect } from 'chai';
import { ArrayFlag, MemberType, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Member: typedArray', function() {
  describe('defineTypedArray', function() {
    it('should return descriptor for typedArray', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u8',
        length: 11,
        byteSize: 11,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: intStructure
      });
      const typedArray = env.defineTypedArray(structure);
      expect(typedArray.get).to.be.a('function');
      expect(typedArray.set).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should attach typedArray to structure', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u8',
        length: 11,
        byteSize: 11,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: intStructure
      });
      const Array = env.defineStructure(structure);
      env.finalizeStructure(structure);
      const array = new Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]);
      expect(array.typedArray).to.be.a('Uint8Array');
      expect(array.typedArray[3]).to.equal(4);
      array.typedArray = new Uint8Array([ 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110 ]);
      expect([ ...array ]).to.eql([ 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110 ]);
    })
    it('should throw when typedArray prop is given incorrect data', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Array,
        flags: ArrayFlag.IsString | ArrayFlag.IsTypedArray,
        name: '[11]u8',
        length: 11,
        byteSize: 11,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: intStructure
      });
      const Array = env.defineStructure(structure);
      env.finalizeStructure(structure);
      const array = new Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]);
      expect(() => array.typedArray = new Uint8Array(12)).to.throw(TypeError);
    })
  })
})
