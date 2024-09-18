import { expect } from 'chai';
import { ArrayFlag, MemberType, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Member: special-props', function() {
  describe('defineSpecialProperties', function() {
    it('should return descriptors for special props', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u8',
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
        flags: ArrayFlag.IsString,
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
      const descriptors = env.defineSpecialProperties(structure);
      expect(descriptors.dataView.get).to.be.a('function');
      expect(descriptors.dataView.set).to.be.a('function');
      expect(descriptors.base64.get).to.be.a('function');
      expect(descriptors.base64.set).to.be.a('function');
      expect(descriptors.typedArray.get).to.be.a('function');
      expect(descriptors.typedArray.set).to.be.a('function');
      expect(descriptors.string.get).to.be.a('function');
      expect(descriptors.string.set).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should attach special props to structures', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u8',
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
        flags: ArrayFlag.IsString,
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
      expect(array.dataView.byteLength).to.equal(11);
      expect(array.typedArray).to.be.a('Uint8Array');
      expect(array.typedArray[3]).to.equal(4);
      array.typedArray = new Uint8Array([ 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110 ]);
      expect([ ...array ]).to.eql([ 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110 ]);
      const { base64 } = array;
      expect(base64).to.be.a('string');
      const array2 = new Array({ base64 });
      expect([ ...array2 ]).to.eql([ 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110 ]);
      for (let i = 0, c = 'A'.charCodeAt(0); i < 11; i++, c++) {
        array[i] = c;
      }
      expect(array.string).to.equal('ABCDEFGHIJK');
      array.string = 'Hello world';
      expect(array.string).to.equal('Hello world');
    })
    it('should throw when special props are given incorrect data', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u8',
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
        flags: ArrayFlag.IsString,
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
      expect(() => array.dataView = new DataView(new ArrayBuffer(0))).to.throw(TypeError);
      expect(() => array.dataView = new ArrayBuffer(0)).to.throw(TypeError);
      expect(() => array.base64 = '').to.throw(TypeError);
      expect(() => array.base64 = 5).to.throw(TypeError);
      expect(() => array.string = '').to.throw(TypeError);
      expect(() => array.string = 123).to.throw(TypeError);
      expect(() => array.string = 'Hello world!!!').to.throw(TypeError);
    })
  })
})
