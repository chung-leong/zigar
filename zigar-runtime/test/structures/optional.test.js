import { expect } from 'chai';
import { MemberFlag, MemberType, OptionalFlag, PointerFlag, SliceFlag, StructureFlag, StructureType, VisitorFlag } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { INITIALIZE, MEMORY, SLOTS, VISIT } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Structure: optional', function() {
  describe('defineOptional', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Optional,
        byteSize: 8,
        flags: StructureFlag.HasValue | OptionalFlag.HasSelector,
        signature: 0n,
      };
      structure.instance = { 
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
            bitSize: 1,
            bitOffset: 32,
            byteSize: 1,
            flags: MemberFlag.IsSelector,
            structure: {},
          },
        ],
      };
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineOptional(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Optional,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
          ],
        },
        static: {},
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 0,
          byteSize: 4,
          structure: {},
        },
        {
          type: MemberType.Bool,
          bitSize: 1,
          bitOffset: 32,
          byteSize: 1,
          flags: MemberFlag.IsSelector,
          structure: {},
        },
      ];
      const env = new Env();
      const descriptors = {};
      env.defineOptional(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define a structure for storing an optional value', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: 18,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitOffset: 0,
              bitSize: 128,
              byteSize: 16,
              structure: {
                type: StructureType.Primitive,
              }
            },
            {
              type: MemberType.Bool,
              bitOffset: 128,
              bitSize: 1,
              byteSize: 1,
              flags: MemberFlag.IsSelector,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const { constructor: Hello } = structure;
      const object = Hello(new ArrayBuffer(18));
      expect(object.$).to.equal(null);
      object.$ = 3.14;
      expect(object.$).to.equal(3.14);
      expect(object.valueOf()).to.equal(3.14);
      object.$ = null;
      expect(object.$).to.equal(null);
      expect(object.valueOf()).to.equal(null);
    })
    it('should cast the same buffer to the same object', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: 18,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitOffset: 0,
              bitSize: 128,
              byteSize: 16,
              structure: {}
            },
            {
              type: MemberType.Bool,
              bitOffset: 128,
              bitSize: 1,
              byteSize: 1,
              flags: MemberFlag.IsSelector,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const { constructor: Hello } = structure;
      const buffer = new ArrayBuffer(18);
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
    })
    it('should throw when no initializer is provided', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: 18,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitOffset: 0,
              bitSize: 128,
              byteSize: 16,
              structure: {}
            },
            {
              type: MemberType.Bool,
              bitOffset: 128,
              bitSize: 1,
              byteSize: 1,
              flags: MemberFlag.IsSelector,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should initialize an optional value based on argument given', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: 18,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitOffset: 0,
              bitSize: 128,
              byteSize: 16,
              structure: {}
            },
            {
              type: MemberType.Bool,
              bitOffset: 128,
              bitSize: 1,
              byteSize: 1,
              flags: MemberFlag.IsSelector,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(null);
      expect(object.$).to.equal(null);
      object.$ = 3.14;
      expect(object.$).to.equal(3.14);
    })
    it('should initialize an optional value from object of same type', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: 18,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitOffset: 0,
              bitSize: 128,
              byteSize: 16,
              structure: {}
            },
            {
              type: MemberType.Bool,
              bitOffset: 128,
              bitSize: 1,
              byteSize: 1,
              flags: MemberFlag.IsSelector,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      object.$ = 3.14;
      const object2 = new Hello(object);
      expect(object2.$).to.equal(3.14);
    })
    it('should define a structure for storing an optional struct', function() {
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
      const { constructor: Animal } = structStructure;
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasValue | StructureFlag.HasSlot | StructureFlag.HasObject | OptionalFlag.HasSelector,
        byteSize: 18,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              slot: 0,
              structure: structStructure,
            },
            {
              type: MemberType.Bool,
              bitOffset: 128,
              bitSize: 1,
              byteSize: 1,
              flags: MemberFlag.IsSelector,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const { constructor: Hello } = structure;
      const object = Hello(new ArrayBuffer(18));
      expect(object.$).to.equal(null);
      object.$ = { dog: 1, cat: 2 };
      expect(object.$).to.be.instanceOf(Animal);
      object.$ = null;
      expect(object.valueOf()).to.equal(null);
      expect(object.$).to.equal(null);
      object.$ = new Hello({ dog: 3, cat: 3 });
      expect(object.valueOf()).to.eql({ dog: 3, cat: 3 });
    })
    it('should do nothing when undefined is assigned to it', function() {
      const env = new Env();
      const floatStructure = {
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 16,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitSize: 128,
              bitOffset: 0,
              byteSize: 16,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(floatStructure);
      env.finishStructure(floatStructure);
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: 18,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitOffset: 0,
              bitSize: 128,
              byteSize: 16,
              structure: floatStructure,
            },
            {
              type: MemberType.Bool,
              flags: MemberFlag.IsSelector,
              bitOffset: 128,
              bitSize: 1,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello(3.14);
      expect(object.$).to.equal(3.14);
      object.$ = undefined;
      expect(object.$).to.equal(3.14);
    })
    it('should work correctly when value is void', function() {
      const env = new Env();
      const voidStructure = {
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 0,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Void,
              bitSize: 0,
              bitOffset: 0,
              byteSize: 0,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(voidStructure);
      env.finishStructure(voidStructure);
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Void,
              bitOffset: 0,
              bitSize: 0,
              byteSize: 0,
              structure: voidStructure,
            },
            {
              type: MemberType.Bool,
              flags: MemberFlag.IsSelector,
              bitOffset: 0,
              bitSize: 1,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = Hello(new ArrayBuffer(1));
      expect(object.$).to.equal(null);
      object.$ = undefined;
      expect(object.$).to.equal(undefined);
      expect(object.valueOf()).to.equal(undefined);
      object.$ = null;
      expect(object.$).to.equal(null);
      expect(object.valueOf()).to.equal(null);
    })
    it('should define a structure for storing an optional pointer', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'Int32',
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
        name: '*Int32',
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
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              slot: 0,
              structure: ptrStructure,
            },
            {
              type: MemberType.Bool,
              flags: MemberFlag.IsSelector,
              bitOffset: 0,
              bitSize: 1,
              byteSize: 8,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = Hello(new ArrayBuffer(8));
      expect(object.$).to.equal(null);
      object.$ = new Int32(0);
      object.$['*'] = 5;
      expect(object.$['*']).to.equal(5);
    })
    it('should define a structure for storing an optional slice', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
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
      env.finishStructure(intStructure);
      const sliceStructure = {
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray,
        name: '[_]Uint8',
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(sliceStructure)
      env.finishStructure(sliceStructure);
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        name: '[]Uint8',
        byteSize: 16,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 128,
              bitOffset: 0,
              byteSize: 16,
              slot: 0,
              structure: sliceStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: 16,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: 128,
              byteSize: 16,
              slot: 0,
              structure: ptrStructure,
            },
            {
              name: 'present',
              type: MemberType.Bool,
              bitOffset: 0,
              bitSize: 1,
              byteSize: 8,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const encoder = new TextEncoder();
      const array = encoder.encode('This is a test');
      const object = new Hello(array);
      expect(object.$.string).to.equal('This is a test');
      expect(object.$.typedArray).to.eql(array);
      object.valueOf();
      expect(JSON.stringify(object)).to.eql(JSON.stringify([ ...array ]));
      const object2 = new Hello(null);
      expect(object2.$).to.be.null;
    })
    it('should copy pointers where initialized from an optional of the same type', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
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
      env.finishStructure(intStructure);
      const sliceStructure = {
        type: StructureType.Slice,
        flags: SliceFlag.IsString | SliceFlag.IsTypedArray,
        name: '[_]u8',
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(sliceStructure)
      env.finishStructure(sliceStructure);
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.HasLength | PointerFlag.IsMultiple,
        name: '[]u8',
        byteSize: 16,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 128,
              bitOffset: 0,
              byteSize: 16,
              slot: 0,
              structure: sliceStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: 16,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: 128,
              byteSize: 16,
              slot: 0,
              structure: ptrStructure,
            },
            {
              type: MemberType.Bool,
              flags: MemberFlag.IsSelector,
              bitOffset: 0,
              bitSize: 1,
              byteSize: 8,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const encoder = new TextEncoder();
      const array = encoder.encode('This is a test');
      const object = new Hello(array);
      expect(object.$.string).to.equal('This is a test');
      const object2 = new Hello(object);
      expect(object2.$.string).to.equal('This is a test');
    })
    it('should release pointers in struct when it is set to null', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'Int32',
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
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureType.IsSingle,
        name: '*Int32',
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
        byteSize: 8 * 2,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: ptrStructure,
            },
            {
              name: 'cat',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 64,
              byteSize: 8,
              slot: 1,
              structure: ptrStructure,
            }
          ],
        },
        static: {},
      };
      env.beginStructure(structStructure);
      env.finishStructure(structStructure);
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: structStructure.byteSize + 32,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: structStructure.byteSize * 8,
              byteSize: structStructure.byteSize,
              slot: 0,
              structure: structStructure,
            },
            {
              type: MemberType.Bool,
              flags: MemberFlag.IsSelector,
              bitOffset: structStructure.byteSize * 8,
              bitSize: 1,
              byteSize: 8,
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
      const ptr = object.$.cat;
      expect(ptr[SLOTS][0]).to.not.be.undefined;
      object.$ = null;
      expect(ptr[SLOTS][0]).to.be.undefined;
      object[VISIT](function(flags) {
        expect(flags & VisitorFlag.IsInactive).to.equal(VisitorFlag.IsInactive);
      });
    })
    it('should release pointers in struct when it is set to null externally', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'Int32',
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureType.IsSingle,
        name: '*Int32',
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
        byteSize: 8 * 2,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              slot: 0,
              structure: ptrStructure,
            },
            {
              name: 'cat',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 64,
              byteSize: 8,
              slot: 1,
              structure: ptrStructure,
            }          
          ],
        },
        static: {},
      };
      env.beginStructure(structStructure);
      env.finishStructure(structStructure);
      const structure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: structStructure.byteSize + 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: structStructure.byteSize * 8,
              byteSize: structStructure.byteSize,
              slot: 0,
              structure: structStructure,
            },
            {
              type: MemberType.Bool,
              flags: MemberType.IsSelector,
              bitOffset: structStructure.byteSize * 8,
              bitSize: 1,
              byteSize: 1,
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
      const ptr = object.$.cat;
      expect(ptr[SLOTS][0]).to.not.be.undefined;
      object[MEMORY].setUint8(structStructure.byteSize, 0);
      expect(object.$).to.be.null;
      expect(ptr[SLOTS][0]).to.be.undefined;
    })
    it('should release pointers in array when it is set to null', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'Int32',
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
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
        name: '*Int32',
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
      const arrayStructure = {
        type: StructureType.Array,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
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
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasValue | OptionalFlag.HasSelector,
        byteSize: arrayStructure.byteSize + 32,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: arrayStructure.byteSize * 8,
              byteSize: arrayStructure.byteSize,
              slot: 0,
              structure: arrayStructure,
            },
            {
              type: MemberType.Bool,
              flags: MemberFlag.IsSelector,
              bitOffset: arrayStructure.byteSize * 8,
              bitSize: 1,
              byteSize: 8,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello([ new Int32(1234), new Int32(4567), new Int32(7890), new Int32(12345) ]);
      const array = object.$;
      for (let i = 0; i < 4; i++) {
        expect(array[SLOTS][i][SLOTS][0]).to.not.be.undefined;
      }
      object.$ = null;
      for (let i = 0; i < 4; i++) {
        expect(array[SLOTS][i][SLOTS][0]).to.be.undefined;
      }
    })
  })
})