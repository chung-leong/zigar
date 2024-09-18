import { expect } from 'chai';
import { MemberType, StructureFlag, StructureType, UnionFlag } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Member: special-methods', function() {
  describe('defineSpecialMethods', function() {
    it('should return descriptors for toJSON and valueOf', function() {
      const env = new Env();
      const descriptors = env.defineSpecialMethods();
      expect(descriptors.toJSON.value).to.be.a('function');
      expect(descriptors.valueOf.value).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should attach toJSON and valueOf methods to defined structures', function() {
      const env = new Env();
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
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
        structure: {},
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: true,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'HelloArray',
        length: 4,
        byteSize: structStructure.byteSize * 4,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.defineStructure(arrayStructure);
      env.endStructure(arrayStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Complex',
        byteSize: arrayStructure.byteSize + 8 * 2,
      });
      env.attachMember(structure, {
        name: 'animals',
        type: MemberType.Object,
        bitSize: arrayStructure.byteSize * 8,
        bitOffset: 0,
        byteSize: arrayStructure.byteSize,
        structure: arrayStructure,
        slot: 0,
        structure: arrayStructure,
      });
      env.attachMember(structure, {
        name: 'donut',
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: arrayStructure.byteSize * 8,
        byteSize: 8,
        structure: {},
      })
      env.attachMember(structure, {
        name: 'turkey',
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: (arrayStructure.byteSize + 8) * 8,
        byteSize: 8,
        structure: {},
      });
      const Complex = env.defineStructure(structure);
      env.endStructure(structure);
      const data = {
        animals: [
          { dog: 1, cat: 2 },
          { dog: 3, cat: 4 },
          { dog: 5, cat: 6 },
          { dog: 7, cat: 8 },
        ],
        donut: 3.5,
        turkey: 1e7,
      };
      const object = new Complex(data);
      expect(JSON.stringify(object)).to.equal(JSON.stringify(data));
      expect(object.valueOf()).to.eql(data);
    })
    it('should replace inaccessible pointer with symbol', function() {
      const env = new Env();
      const floatStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'f64',
        byteSize: 8,
      });
      env.attachMember(floatStructure, {
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: floatStructure,
      });
      env.defineStructure(floatStructure);
      env.endStructure(floatStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasSlot | StructureFlag.HasPointer,
        name: '*f64',
        byteSize: 8,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        bitOffset: 0,
        structure: floatStructure,
        slot: 0,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasPointer | UnionFlag.HasInaccessible,
        name: 'Union',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'goat',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: ptrStructure,
        slot: 0,
      });
      env.attachMember(structure, {
        name: 'donut',
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: floatStructure,
      });
      env.attachMember(structure, {
        name: 'turkey',
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: floatStructure,
      });
      const Complex = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Complex({ donut: 3.5 });
      expect(object.valueOf().goat).to.be.a('symbol');
      JSON.stringify(object);
      expect(JSON.stringify(object)).to.equal(JSON.stringify({ donut: 3.5, turkey: 3.5 }));
    })
  })
})
