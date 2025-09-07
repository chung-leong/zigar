import { expect } from 'chai';
import { ErrorSetFlag, MemberFlag, MemberType, PointerFlag, SliceFlag, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ENVIRONMENT, INITIALIZE, MEMORY, SLOTS } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Structure: error-union', function() {
  describe('defineErrorUnion', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.ErrorUnion,
        flags: 0,
        byteSize: 8,
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
              type: MemberType.Int,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              flags: MemberFlag.IsSelector,
              structure: {},
            },
          ],
        },
        static: {},
      };
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineErrorUnion(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.ErrorUnion,
        flags: 0,
        byteSize: 8,
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
              type: MemberType.Int,
              bitSize: 16,
              bitOffset: 32,
              byteSize: 2,
              flags: MemberFlag.IsSelector,
              structure: {},
            },
          ],
        },
        static: {},
      };
      const env = new Env();
      const descriptors = {};
      env.defineErrorUnion(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define an error union', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,      
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: errorStructure,
          },
        ],
      },
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const structure = {
        type: StructureType.ErrorUnion,
        flags: 0,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              structure: {},
            },
            {
              type: MemberType.Uint,
              flags: MemberFlag.IsSelector,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = Hello(new ArrayBuffer(10));
      expect(object.$).to.equal(0n);
      object.$ = 1234n;
      expect(object.$).to.equal(1234n);
      expect(object.valueOf()).to.equal(1234n);
      object.$ = MyError.UnableToCreateObject;
      expect(() => object.valueOf()).to.throw(Hello.UnableToCreateObject);
      const json = JSON.stringify(object);
      expect(json).to.equal('{"error":"Unable to create object"}');
    })
    it('should allow the initialization of an error union with an object literal', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: {},
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          },
        },
      };
      env.finishStructure(errorStructure);
      const structure = {
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              structure: {},
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello({ error: 'Unable to create object' });
      expect(() => object.$).to.throw(MyError.UnableToCreateObject);
    })
    it('should define an error union that accepts anyerror', function() {
      const env = new Env();
      const anyErrorStructure = {
        type: StructureType.ErrorSet,
        flags: ErrorSetFlag.IsGlobal,
        name: 'anyerror',
        byteSize: 2,
        signature: 0n,
        static: {},
      };
      anyErrorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: anyErrorStructure,
          },
        ],
      };
      env.beginStructure(anyErrorStructure);
      env.finishStructure(anyErrorStructure);
      const errorStructure = {
        name: 'MyError',
        type: StructureType.ErrorSet,
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: errorStructure,
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const structure = {
        type: StructureType.ErrorUnion,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              structure: {
                name: 'int',
              },
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: anyErrorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = Hello(new ArrayBuffer(10));
      expect(object.$).to.equal(0n);
      object.$ = 1234n;
      expect(object.$).to.equal(1234n);
      expect(object.valueOf()).to.equal(1234n);
      object.$ = MyError.UnableToCreateObject;
      expect(() => object.valueOf()).to.throw(Hello.UnableToCreateObject);
      object.$ = new Error('Unable to create object');
      expect(() => object.valueOf()).to.throw(Hello.UnableToCreateObject);
    })
    it('should cast the same buffer to the same object', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: {},
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const structure = {
        type: StructureType.ErrorUnion,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              structure: {},
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },            
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const buffer = new ArrayBuffer(10);
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
    })
    it('should throw when no initializer is provided', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: {},
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          }, 
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const structure = {
        type: StructureType.ErrorUnion,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              structure: {},
            },
            {
              name: 'error',
              type: MemberType.Int,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
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
    it('should define an error union with internal struct', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: errorStructure,
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
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
        type: StructureType.ErrorUnion,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '!Animal',
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              slot: 0,
              structure: structStructure,
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello({ dog: 17, cat: 234 });
      expect(object).to.be.an('!Animal');
      expect(object.$).to.be.an('Animal');
      object.$ = MyError.UnableToCreateObject;
      expect(() => object.$).to.throw(MyError.UnableToCreateObject)
        .with.property('message').that.equal('Unable to create object');
      object.$ = { dog: 1, cat: 1234 };
      expect(object.valueOf()).to.eql({ dog: 1, cat: 1234 });
    })
    it('should define an error union with a pointer', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: {},
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'Int32',
        byteSize: 4,
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
        type: StructureType.ErrorUnion,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: 16,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              slot: 0,
              structure: ptrStructure,
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = Hello(new ArrayBuffer(16));
      object[MEMORY].setInt16(8, 16, true)
      expect(() => object.$).to.throw();
      object.$ = new Int32(0);
      object.$['*'] = 5;
      expect(object.$['*']).to.equal(5);
    })
    it('should define an error union with a slice', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: errorStructure,
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      Object.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const uintStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 1,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(uintStructure);
      env.finishStructure(uintStructure);
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
              structure: uintStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(sliceStructure);
      env.finishStructure(sliceStructure);
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
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
        type: StructureType.ErrorUnion,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: 18,
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
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
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
      expect(JSON.stringify(object)).to.eql(JSON.stringify([ ...array ]));
    })
    it('should correctly copy an error union containing a pointer', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            flags: StructureFlag.HasValue,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: errorStructure,
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
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
        type: StructureType.ErrorUnion,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.HasValue,
        byteSize: 16,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              slot: 0,
              structure: ptrStructure,
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello(new Int32(777));
      const object2 = new Hello(object);
      expect(object.$['*']).to.equal(777);
      expect(object2.$['*']).to.equal(777);
    })
    it('should release pointer when error union is set to an error', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: errorStructure,
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const intStructure = {
        type: StructureType.Primitive,
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
        type: StructureType.ErrorUnion,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: 16,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              slot: 0,
              structure: ptrStructure,
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello(new Int32(777));
      const ptr = object.$;
      object.$ = MyError.UnableToCreateObject;
      expect(ptr[SLOTS][0]).to.be.undefined;
    })
    it('should throw an error when error number is unknown', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: {},
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const structure = {
        type: StructureType.ErrorUnion,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              structure: {},
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const dv = new DataView(new ArrayBuffer(10));
      dv.setInt16(8, 32, true)
      const object = Hello(dv);
      expect(() => object.$).to.throw()
        .with.property('message').that.contains('32');
    })
    it('should throw when attempting to set an error that is not in the error set', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: errorStructure,
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const structure = {
        type: StructureType.ErrorUnion,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              structure: {},
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello(123n);
      expect(object.$).to.equal(123n);
      expect(() => object.$ = new Error('Doh!')).to.throw(TypeError)
        .with.property('message').that.contains('Error');
    })
    it('should throw error when invalid value is given', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: {},
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const structure = {
        type: StructureType.ErrorUnion,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              structure: {},
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      expect(() => new Hello(null)).to.throw(TypeError);
      expect(() => new Hello({})).to.throw(SyntaxError);
      expect(() => new Hello('Evil')).to.throw(SyntaxError);
    })
    it('should recreate object when initialized with base64 string', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: {},
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const structure = {
        type: StructureType.ErrorUnion,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              structure: {},
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object1 = new Hello(123n);
      const object2 = new Hello(MyError.UnableToCreateObject);
      const object3 = new Hello({ base64: object1.base64 });
      const object4 = new Hello({ base64: object2.base64 });
      expect(object3.$).to.equal(123n);
      expect(() => object4.$).to.throw(MyError.UnableToCreateObject);
    })
    it('should do nothing when undefined is assigned to it', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: errorStructure,
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const structure = {
        type: StructureType.ErrorUnion,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              structure: {},
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello(1234n);
      expect(object.$).to.equal(1234n);
      object.$ = undefined;
      expect(object.$).to.equal(1234n);
    })
    it('should work correctly when value is void', function() {
      const env = new Env();
      const errorStructure = {
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
        signature: 0n,
      };
      errorStructure.instance = {
        members: [
          {
            type: MemberType.Uint,
            bitSize: 16,
            bitOffset: 0,
            byteSize: 2,
            structure: {},
          },
        ],
      };
      env.beginStructure(errorStructure);
      const MyError = errorStructure.constructor;
      errorStructure.static = {
        members: [
          {
            name: 'UnableToRetrieveMemoryLocation',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 0,
            structure: errorStructure,
          },
          {
            name: 'UnableToCreateObject',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly,
            slot: 1,
            structure: errorStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: MyError.call(ENVIRONMENT, errorData(5)),
            1: MyError.call(ENVIRONMENT, errorData(8)),
          }
        },
      };
      env.finishStructure(errorStructure);
      const structure = {
        type: StructureType.ErrorUnion,
        byteSize: 10,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'value',
              type: MemberType.Void,
              bitOffset: 0,
              bitSize: 0,
              byteSize: 0,
              structure: {},
            },
            {
              name: 'error',
              type: MemberType.Uint,
              bitOffset: 64,
              bitSize: 16,
              byteSize: 2,
              structure: errorStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Hello = structure.constructor;
      const object = new Hello(MyError.UnableToCreateObject);
      expect(() => object.$).to.throw(MyError.UnableToCreateObject);
      object.$ = undefined;
      expect(object.$).to.equal(undefined);
    })
  })
})

function errorData(index) {
  const ta = new Uint16Array([ index ]);
  return new DataView(ta.buffer, 0, 2);
}
