import { expect } from 'chai';
import {
  MemberFlag, MemberType, PointerFlag, StructureFlag, StructurePurpose, StructureType, UnionFlag,
  VisitorFlag,
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import {
  ENTRIES, ENVIRONMENT, INITIALIZE, KEYS, MEMORY, SETTERS, SLOTS, VISIT, ZIG,
} from '../../src/symbols.js';
import { defineValue, encodeBase64, usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Structure: union', function() {
  describe('defineUnion', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Union,
        byteSize: 4,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          name: "number",
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 0,
          byteSize: 4,
          structure: {},
        },
        {
          name: "boolean",
          type: MemberType.Bool,
          bitSize: 1,
          bitOffset: 0,
          byteSize: 1,
          structure: {},
        },
      ];
      const env = new Env();
      const setters = {};
      const keys = [];
      const descriptors = {
        [SETTERS]: defineValue(setters),
        [KEYS]: defineValue(keys),
      };
      const constructor = env.defineUnion(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Union,
        byteSize: 4,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          name: "number",
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 0,
          byteSize: 4,
          structure: {},
        },
        {
          name: "boolean",
          type: MemberType.Bool,
          bitSize: 1,
          bitOffset: 0,
          byteSize: 1,
          structure: {},
        },
      ];
      const env = new Env();
      const setters = {};
      const keys = [];
      const descriptors = {
        [SETTERS]: defineValue(setters),
        [KEYS]: defineValue(keys),
      };
      env.defineUnion(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors.number?.get).to.be.a('function');
      expect(descriptors.number?.set).to.be.a('function');
      expect(descriptors.boolean?.get).to.be.a('function');
      expect(descriptors.boolean?.set).to.be.a('function');
      expect(descriptors[Symbol.iterator]?.value).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
      expect(descriptors[ENTRIES]?.value).to.be.a('function');
      expect(keys).to.eql([ 'number', 'boolean' ]);
      expect(setters.number).to.be.a('function');
      expect(setters.boolean).to.be.a('function');
    })
  })
  describe('finalizeUnion', function() {
    it('should add static descriptors to the given object', function() {
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasTag,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              name: "number",
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              name: "boolean",
              type: MemberType.Bool,
              bitSize: 1,
              bitOffset: 0,
              byteSize: 1,
              structure: {},
            },
            {
              type: MemberType.Enum,
              flags: MemberFlag.IsSelector,
              bitSize: 8,
              bitOffset: 32,
              byteSize: 1,
              structure: {
                type: StructureType.Enum,
                constructor: () => {},
              },
            },
          ],
        },
        static: {},
      };
      const env = new Env();
      const descriptors = {};
      env.finalizeUnion(structure, descriptors);
      expect(descriptors.tag?.value).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define a simple extern union', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.IsExtern,
        byteSize: 4,
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
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      expect(Hello).to.be.a('function');
      const object = new Hello({ cat: 1234 });
      expect(object).to.be.an.instanceOf(Object);
      expect(object).to.be.an.instanceOf(Hello);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(1234);
      expect([ ...object ]).to.eql([ [ 'dog', 1234 ], [ 'cat', 1234 ] ]);
      object.dog = 777;
      expect(object.dog).to.equal(777);
      expect(object.cat).to.equal(777);
      expect(object.valueOf()).to.eql({ dog: 777, cat: 777 });
    })
    it('should cast the same buffer to the same object', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.IsExtern,
        byteSize: 4,
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
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const buffer = new ArrayBuffer(4);
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
    })
    it('should throw when no initializer is provided', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.IsExtern,
        byteSize: 4,
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
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should define a simple bare union', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasSelector,
        byteSize: 8,
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
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      expect(Hello).to.be.a('function');
      const object = new Hello({ dog: 1234 });
      expect(object).to.be.an.instanceOf(Object);
      expect(object).to.be.an.instanceOf(Hello);
      expect([ ...object ]).to.have.lengthOf(2);
      expect(object.dog).to.equal(1234);
      expect(() => object.cat).to.throw(TypeError);
      expect(() => object.cat = 567).to.throw(TypeError);
      object[MEMORY].setInt16(4, 1, true);
      object[MEMORY].setInt32(0, 567, true);
      expect(() => object.dog).to.throw(TypeError);
      expect(object.cat).to.equal(567);
      expect(() => object.cat = 123).to.not.throw();
      expect(object.cat).to.equal(123);
      expect(object.valueOf()).to.eql({ dog: 123, cat: 123 });
    })
    it('should initialize a simple bare union', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasSelector,
        byteSize: 8,
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
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello({ cat: 123 });
      expect(object.cat).to.equal(123);
      expect(() => object.dog).to.throw(TypeError);
      expect([ ...object ]).to.eql([ [ 'dog', 123 ], [ 'cat', 123 ] ]);
      object.cat = 777;
      expect(() => object.dog).to.throw(TypeError);
      expect(object.cat).to.equal(777);
      expect(object.valueOf()).to.eql({ dog: 777, cat: 777 });
    })
    it('should initialize a simple bare union using inenumerable property', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasSelector,
        byteSize: 8,
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
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const initObj = Object.create({ cat: 123 })
      const object = new Hello(initObj);
      expect(object.cat).to.equal(123);
    })
    it('should allow casting to a simple bare union', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasSelector,
        byteSize: 8,
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
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const dv = new DataView(new ArrayBuffer(8));
      dv.setInt32(0, 1234, true);
      dv.setInt16(4, 1, true);
      const object = Hello(dv.buffer);
      expect(object.cat).to.equal(1234);
      expect(() => object.dog).to.throw(TypeError);
    })
    it('should accept base64 data as initializer', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasSelector,
        byteSize: 6,
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
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const dv = new DataView(new ArrayBuffer(6));
      dv.setUint32(0, 1234, true);
      const base64 = encodeBase64(dv);
      const object = new Hello({ base64 });
      expect(object.dog).to.equal(1234);
      expect(() => object.cat).to.throw();
    })
    it('should allow assignment of base64 data', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasSelector,
        byteSize: 6,
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
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello({ cat: 5 });
      expect(object.cat).to.equal(5);
      const dv = new DataView(new ArrayBuffer(6))
      dv.setUint32(0, 1234, true);
      object.base64 = encodeBase64(dv);
      expect(object.dog).to.equal(1234);
      expect(() => object.cat).to.throw();
    })
    it('should define a bare union containing a struct', function() {
      const env = new Env();
      const structStructure = {
        type: StructureType.Struct,
        name: 'Animal',
        byteSize: 8,
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
        },
        static: {},
      };
      env.beginStructure(structStructure);
      env.finishStructure(structStructure);
      const structure = {
        type: StructureType.Union,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot | UnionFlag.HasSelector,
        byteSize: structStructure.byteSize * 8 + 32,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'pets',
              type: MemberType.Object,
              bitSize: structStructure.byteSize * 8,
              bitOffset: 0,
              byteSize: structStructure.byteSize,
              slot: 1,
              structure: structStructure,
            },
            {
              name: 'money',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: structStructure.byteSize * 8,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello({ pets: { cat: 7, dog: 9 } });
      expect(object.$.pets.cat).to.equal(7);
      object.$ = { money: 1000 };
      expect(object.$.money).to.equal(1000);
      expect(() => object.$.pets).to.throw(TypeError);
    })
    it('should disable pointers in a bare union', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
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
      env.finishStructure(intStructure);
      const Int32 = intStructure.constructor;
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*i32',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structStructure = {
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'SomeStruct',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'pointer',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: ptrStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structStructure);
      env.finishStructure(structStructure);
      const arrayStructure = {
        type: StructureType.Array,
        flags: StructureFlag.HasProxy | StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[4]*Int32',
        length: 4,
        byteSize: 8 * 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              byteSize: 8,
              structure: ptrStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(arrayStructure);
      env.finishStructure(arrayStructure);
      const structure = {
        type: StructureType.Union,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | UnionFlag.HasSelector | UnionFlag.HasInaccessible,
        byteSize: 8 * 4,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'pointer',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: ptrStructure,
            },
            {
              name: 'struct',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 1,
              structure: structStructure,
            },
            {
              name: 'array',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8 * 4,
              slot: 2,
              structure: arrayStructure,
            },
            {
              name: 'number',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      // initializer will call pointer setter which will throw
      const pointer = new Int32(1234);
      const struct = { pointer: new Int32(1234) };
      const array = [ new Int32(1234), new Int32(1234), new Int32(1234), new Int32(1234) ];
      expect(() => new Hello({ pointer })).to.throw(TypeError)
        .with.property('message').that.contains('not accessible');
      expect(() => new Hello({ struct })).to.throw(TypeError)
        .with.property('message').that.contains('not accessible');
      expect(() => new Hello({ array })).to.throw(TypeError)
        .with.property('message').that.contains('not accessible');
      const object = new Hello(undefined);
      // getter will throw
      expect(() => object.pointer['*']).to.throw(TypeError)
        .with.property('message').that.contains('not accessible');
      const inaccessible = Symbol.for('inaccessible');
      expect(object.valueOf()).to.eql({
        pointer: inaccessible,
        struct: { pointer: inaccessible },
        array: [
          inaccessible,
          inaccessible,
          inaccessible,
          inaccessible
        ]
      });
    })
    it('should define a simple tagged union', function() {
      const env = new Env();
      const enumStructure = {
        type: StructureType.Enum,
        name: 'HelloTag',
        byteSize: 2,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              bitOffset: 0,
              byteSize: 2,
              structure: {},
            },
          ],
        },
      };
      env.beginStructure(enumStructure);
      const HelloTag = enumStructure.constructor;
      enumStructure.static = {
        members: [
          {
            name: 'dog',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
            slot: 0,
            structure: enumStructure,
          },
          {
            name: 'cat',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
            slot: 1,
            structure: enumStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 100 ]))),
            1: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 200 ]))),
          },
        },
      };
      env.finishStructure(enumStructure);
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasTag | UnionFlag.HasSelector,
        byteSize: 6,
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
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: enumStructure,
            },            
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      expect(Hello).to.be.a('function');
      const object = new Hello({ dog: 1234 });
      expect(object).to.be.an.instanceOf(Object);
      expect(object).to.be.an.instanceOf(Hello);
      expect([ ...object ]).to.eql([ [ 'dog', 1234 ] ]);
      const [ [ name, value ] ] = object;
      expect(name).to.equal('dog')
      expect(value).to.equal(1234);
      expect(object.valueOf()).to.eql({ dog: 1234 });
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.be.null;
      expect(() => object.cat = 567).to.throw(TypeError);
      object[MEMORY].setInt16(4, 200, true);
      object[MEMORY].setInt16(0, 567, true);
      expect(object.dog).to.be.null;
      expect(object.cat).to.equal(567);
      expect(HelloTag(object)).to.equal(HelloTag.cat);
      expect(Hello.tag).to.equal(HelloTag);
      expect(object == 'cat').to.be.true;
      expect(String(object)).to.equal('cat');
      expect(Number(object)).to.equal(200);
      expect(`${object}`).to.equal('cat');
    })
    it('should only have a single enumerable property', function() {
      const env = new Env();
      const enumStructure = {
        type: StructureType.Enum,
        name: 'HelloTag',
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
      env.beginStructure(enumStructure);
      const HelloTag = enumStructure.constructor;
      enumStructure.static = {
        members: [
          {
            name: 'dog',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
            slot: 0,
            structure: enumStructure,
          },
          {
            name: 'cat',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
            slot: 1,
            structure: enumStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: HelloTag.call(ENVIRONMENT, viewOf(new Uint32Array([ 100 ]))),
            1: HelloTag.call(ENVIRONMENT, viewOf(new Uint32Array([ 200 ]))),
          },
        },
      };
      env.finishStructure(enumStructure);
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasTag | UnionFlag.HasSelector,
        byteSize: 8,
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
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 32,
              bitOffset: 32,
              byteSize: 4,
              structure: enumStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello({ dog: 1234 });
      expect(object.dog).to.equal(1234);
      expect(object.valueOf()).to.eql({ dog: 1234 });
    })
    it('should define a tagged union containing a pointer', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
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
      env.finishStructure(intStructure);
      const Int32 = intStructure.constructor;
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*i32',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const enumStructure = {
        type: StructureType.Enum,
        name: 'HelloTag',
        byteSize: 2,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              bitOffset: 0,
              byteSize: 2,
              structure: {},
            },
          ],
        },
      };
      env.beginStructure(enumStructure);
      const HelloTag = enumStructure.constructor;
      enumStructure.static = {
        members: [
          {
            name: 'pointer',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
            slot: 0,
            structure: enumStructure,
          },
          {
            name: 'number',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
            slot: 1,
            structure: enumStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 0 ]))),
            1: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 1 ]))),
          },
        }
      };
      env.finishStructure(enumStructure);
      const structure = {
        type: StructureType.Union,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot | UnionFlag.HasTag | UnionFlag.HasSelector,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'pointer',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: ptrStructure,
            },
            {
              name: 'number',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 64,
              byteSize: 2,
              structure: enumStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      const Hello = structure.constructor;
      env.finishStructure(structure);
      const object = new Hello({ pointer: new Int32(1234) });
      expect(object.$.pointer['*']).to.equal(1234);
      object.$ = { number: 4567 };
      expect(object.$.pointer).to.be.null;
      expect(object.$.number).to.equal(4567);
    })
    it('should correctly copy a tagged union containing a pointer', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
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
      env.finishStructure(intStructure);
      const Int32 = intStructure.constructor;
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*i32',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const enumStructure = {
        type: StructureType.Enum,
        name: 'HelloTag',
        byteSize: 2,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              bitOffset: 0,
              byteSize: 2,
              structure: {},
            },
          ],
        },
      };
      env.beginStructure(enumStructure);
      const HelloTag = enumStructure.constructor;
      enumStructure.static = {
        members: [
          {
            name: 'pointer',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
            slot: 0,
            structure: enumStructure,
          },
          {
            name: 'number',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
            slot: 1,
            structure: enumStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 0 ]))),
            1: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 1 ]))),
          },
        },
      };
      env.finishStructure(enumStructure);
      const structure = {
        type: StructureType.Union,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | UnionFlag.HasTag | UnionFlag.HasSelector,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'pointer',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: ptrStructure,
            },
            {
              name: 'number',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 64,
              byteSize: 2,
              structure: enumStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello({ pointer: new Int32(1234) });
      const object2 = new Hello(object);
      expect(object2.$.pointer['*']).to.equal(1234);
      object2.$.pointer['*'] = 4567;
      expect(object.$.pointer['*']).to.equal(4567);
    })
    it('should release pointer when a different property is activated', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
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
      env.finishStructure(intStructure);
      const Int32 = intStructure.constructor;
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*i32',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const enumStructure = {
        type: StructureType.Enum,
        name: 'HelloTag',
        byteSize: 2,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              bitOffset: 0,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(enumStructure);
      const HelloTag = enumStructure.constructor;
      enumStructure.static = {
        members: [
          {
            name: 'pointer',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
            slot: 0,
            structure: enumStructure,
          },
          {
            name: 'number',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
            slot: 1,
            structure: enumStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 0 ]))),
            1: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 1 ]))),
          },
        },
      };
      env.finishStructure(enumStructure);
      const structure = {
        type: StructureType.Union,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | UnionFlag.HasTag | UnionFlag.HasSelector,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'pointer',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: ptrStructure,
            },
            {
              name: 'number',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 64,
              byteSize: 2,
              structure: enumStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello({ pointer: new Int32(1234) });
      const pointer = object.pointer;
      object.$ = { number: 4567 };
      expect(pointer[SLOTS][0]).to.be.undefined;
      object[VISIT](function(flags) {
        expect(flags & VisitorFlag.IsInactive).to.equal(VisitorFlag.IsInactive);
      })
    })
    it('should complain about missing union initializer', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasSelector,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              name: 'cat',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      expect(() => new Hello({})).to.throw(TypeError)
        .with.property('message').that.contains('dog, cat')
      const object = new Hello({ cat: 4567 });
      expect(object.cat).to.equal(4567);
    })
    it('should throw when there is more than one initializer', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasSelector,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              name: 'cat',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      expect(() => new Hello({ dog: 1234, cat: 4567 })).to.throw(TypeError);
    })
    it('should throw when an unknown initializer is encountered', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasSelector,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              name: 'cat',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      const Hello = structure.constructor;
      env.finishStructure(structure);
      expect(() => new Hello({ dogg: 1234 })).to.throw(TypeError)
        .with.property('message').that.contains('dogg');
    })
    it('should throw when constructor is given something other than an object', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasSelector,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              name: 'cat',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      expect(() => new Hello(5)).to.throw(TypeError);
    })
    it('should throw when attempting to set an active property', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasSelector,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              name: 'cat',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello({ dog: 1234 });
      expect(() => object.cat = 4567).to.throw(TypeError)
        .with.property('message').that.contains('dog')
    })
    it('should allow switching of active property through dollar property', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        flags: UnionFlag.HasSelector,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              name: 'cat',
              type: MemberType.Int,
              flags: MemberFlag.IsRequired,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello({ dog: 1234 });
      object.$ = { cat: 4567 };
      expect(object.cat).to.equal(4567);
    })
    it('should define an iterator union', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Union,
        purpose: StructurePurpose.Iterator,
        flags: UnionFlag.IsExtern,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'index',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
      };
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*Hello',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure,
              slot: 0,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const optStructure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasValue | StructureFlag.HasSlot | UnionFlag.HasSelector,
        name: '?i32',
        byteSize: 5,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Bool,
              flags: MemberFlag.IsSelector,
              bitSize: 8,
              bitOffset: 32,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(optStructure);
      env.finishStructure(optStructure);
      const argStructure = {
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Argument',
        byteSize: 13,
        length: 1,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'retval',
              type: MemberType.Object,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 5,
              structure: optStructure,
            },
            {
              name: '0',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: optStructure.byteSize * 8,
              byteSize: 8,
              structure: ptrStructure,
              slot: 0,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(argStructure);
      env.finishStructure(argStructure);
      const fnStructure = {
        type: StructureType.Function,
        name: 'fn (*Hello) ?i32',
        byteSize: 0,
        signature: 0n,
        instance: {
          members: [
            {
              byteSize: argStructure.byteSize,
              bitSize: argStructure.byteSize * 8,
              bitOffset: 0,
              structure: argStructure,
            },
          ],
          template: {
            [MEMORY]: (() => {
              const dv = new DataView(new ArrayBuffer(0));
              dv[ZIG] = { address: usize(0x8888) };
              return dv;
            })(),
          },
        },
        static: {},
      };
      env.beginStructure(fnStructure);
      env.finishStructure(fnStructure);
      const Next = fnStructure.constructor;      
      const fnDV = new DataView(new ArrayBuffer(0));
      fnDV[ZIG] = { address: usize(0x1_8888) };
      const next = Next.call(ENVIRONMENT, fnDV);
      structure.static = {
        members: [
          {
            name: 'next',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly | MemberFlag.IsMethod,
            slot: 0,
            structure: fnStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: next,
          }
        },
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      let i = 0, thunkAddress, fnAddress, argBuffer;
      env.runThunk = function(...args) {
        thunkAddress = args[0];
        fnAddress = args[1];
        let argDV;
        if (process.env.TARGET === 'wasm') {
          argDV = new DataView(env.memory.buffer, args[2], 13);
        } else {
          argDV = new DataView(argBuffer, 0, 13);
        }
        if (i++ < 5) {
          argDV.setInt32(0, i, true);
          argDV.setInt8(4, 1);
        } else {
          argDV.setInt32(0, 0, true);
          argDV.setInt8(4, 0);
        }
        return true;
      };
      if (process.env.TARGET === 'wasm') {
        env.allocateScratchMemory = function(len, align) {
          return 0x1000;
        };
        env.freeScratchMemory = function(address) {
        };
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else if (process.env.TARGET === 'node') {
        env.getBufferAddress = function(buffer) {
          argBuffer = buffer;
          return 0x1000n;
        }
      }
      const object = new Hello({ index: 0 });
      const results = [];
      for (const value of object) {
        results.push(value);
      }
      expect(results).to.eql([ 1, 2, 3, 4, 5 ]);
      expect(thunkAddress).to.equal(usize(0x8888));
      expect(fnAddress).to.equal(usize(0x1_8888));
    })
  })
})

function viewOf(ta) {
  return new DataView(ta.buffer);
}