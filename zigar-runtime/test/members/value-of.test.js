import { expect } from 'chai';
import { MemberType, StructureFlag, StructureType, UnionFlag } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Member: valueOf', function() {
  describe('defineValueOf', function() {
    it('should return descriptor for valueOf', function() {
      const env = new Env();
      const valueOf = env.defineValueOf();
      expect(valueOf.value).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should attach valueOf method to structure', function() {
      const env = new Env();
      const structStructure = {
        type: StructureType.Struct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: 4 * 2,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Int,
              isRequired: true,
              byteSize: 4,
              bitOffset: 0,
              bitSize: 32,
              structure: {},
            },
            {
              name: 'cat',
              type: MemberType.Int,
              isRequired: true,
              byteSize: 4,
              bitOffset: 32,
              bitSize: 32,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structStructure);
      env.finishStructure(structStructure);
      const arrayStructure = {
        type: StructureType.Array,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'HelloArray',
        length: 4,
        byteSize: structStructure.byteSize * 4,
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
      env.beginStructure(arrayStructure);
      env.finishStructure(arrayStructure);
      const structure = {
        type: StructureType.Struct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Complex',
        byteSize: arrayStructure.byteSize + 8 * 2,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'animals',
              type: MemberType.Object,
              bitSize: arrayStructure.byteSize * 8,
              bitOffset: 0,
              byteSize: arrayStructure.byteSize,
              structure: arrayStructure,
              slot: 0,
              structure: arrayStructure,
            },
            {
              name: 'donut',
              type: MemberType.Float,
              bitSize: 64,
              bitOffset: arrayStructure.byteSize * 8,
              byteSize: 8,
              structure: {},
            },
            {
              name: 'turkey',
              type: MemberType.Float,
              bitSize: 64,
              bitOffset: (arrayStructure.byteSize + 8) * 8,
              byteSize: 8,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Complex = structure.constructor;
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
      expect(object.valueOf()).to.eql(data);
    })
    it('should replace inaccessible pointer with symbol', function() {
      const env = new Env();
      const floatStructure = {
        type: StructureType.Primitive,
        name: 'f64',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(floatStructure);
      env.finishStructure(floatStructure);
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasSlot | StructureFlag.HasPointer,
        name: '*f64',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              byteSize: 8,
              bitOffset: 0,
              structure: floatStructure,
              slot: 0,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = {
        type: StructureType.Union,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasPointer | UnionFlag.HasInaccessible,
        name: 'Union',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'goat',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure: ptrStructure,
              slot: 0,
            },
            {
              name: 'donut',
              type: MemberType.Float,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure: floatStructure,
            },
            {
              name: 'turkey',
              type: MemberType.Float,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure: floatStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Complex = structure.constructor;
      const object = new Complex({ donut: 3.5 });
      expect(object.valueOf().goat).to.be.a('symbol');
    })
  })
})
