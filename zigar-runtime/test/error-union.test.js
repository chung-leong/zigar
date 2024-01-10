import { expect } from 'chai';

import { NodeEnvironment } from '../src/environment-node.js';
import { initializeErrorSets } from '../src/error-set.js';
import { MemberType, useAllMemberTypes } from '../src/member.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import { ENVIRONMENT, MEMORY, SLOTS } from '../src/symbol.js';

describe('Error union functions', function() {
  const env = new NodeEnvironment();
  describe('defineErrorUnion', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
      initializeErrorSets();
    })
    it('should define an error union', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = Hello(new ArrayBuffer(10));
      expect(object.$).to.equal(0n);
      object.$ = 1234n;
      expect(object.$).to.equal(1234n);
      expect(object.valueOf()).to.equal(1234n);
      object.$ = MyError.UnableToCreateObject;
      expect(() => object.valueOf()).to.throw(Hello.UnableToCreateObject);
      expect(JSON.stringify(object)).to.equal('{"error":"Unable to create object"}');
    })
    it('should cast the same buffer to the same object', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const buffer = new ArrayBuffer(10);
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
    })
    it('should throw when no initializer is provided', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should define an error union with internal struct', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Animal',
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: '!Animal',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({ dog: 17, cat: 234 });
      expect(object).to.be.an('!Animal');
      expect(object.$).to.be.an('Animal');
      object.$ = MyError.UnableToCreateObject;
      expect(() => object.$).to.throw(MyError)
        .with.property('message').that.equal('Unable to create object');
      object.$ = { dog: 1, cat: 1234 };
      expect(object.valueOf()).to.eql({ dog: 1, cat: 1234 });
    })
    it('should define an error union with a pointer', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const { constructor: Int32Ptr } = ptrStructure;
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = Hello(new ArrayBuffer(16));
      object[MEMORY].setInt16(8, 16, true)
      expect(() => object.$).to.throw();
      object.$ = new Int32(0);
      object.$['*'] = 5;
      expect(object.$['*']).to.equal(5);
    })
    it('should define an error union with a slice', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        name: '[_]Uint8',
        byteSize: 1,
      })
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array },
      });
      env.finalizeShape(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const { constructor: Uint8Slice } = sliceStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '[]Uint8',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 128,
        bitOffset: 0,
        byteSize: 16,
        slot: 0,
        structure: sliceStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 18,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const encoder = new TextEncoder();
      const array = encoder.encode('This is a test');
      const object = new Hello(array);
      expect(object.$.string).to.equal('This is a test');
      expect(object.$.typedArray).to.eql(array);
      expect(JSON.stringify(object)).to.eql(JSON.stringify([ ...array ]));
    })
    it('should correctly copy an error union containing a pointer', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(new Int32(777));
      const object2 = new Hello(object);
      expect(object.$['*']).to.equal(777);
      expect(object2.$['*']).to.equal(777);
    })
    it('should release pointer when error union is set to an error', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 16,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(new Int32(777));
      const ptr = object.$;
      object.$ = MyError.UnableToCreateObject;
      expect(ptr[SLOTS][0]).to.be.null;
    })
    it('should throw an error when error number is unknown', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const dv = new DataView(new ArrayBuffer(10));
      dv.setInt16(8, 32, true)
      const object = Hello(dv);
      expect(() => object.$).to.throw()
        .with.property('message').that.contains('32');
    })
    it('should throw when attempting to set an error that is not in the error set', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(123n);
      expect(object.$).to.equal(123n);
      expect(() => object.$ = new Error('Doh!')).to.throw(TypeError)
        .with.property('message').that.contains('Error');
    })
    it('should throw error when invalid value is given', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello(null)).to.throw(TypeError);
      expect(() => new Hello({})).to.throw(SyntaxError);
    })    
    it('should recreate object when initialized with base64 string', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object1 = new Hello(123n);
      const object2 = new Hello(MyError.UnableToCreateObject);
      const object3 = new Hello({ base64: object1.base64 });
      const object4 = new Hello({ base64: object2.base64 });
      expect(object3.$).to.equal(123n);
      expect(() => object4.$).to.throw(MyError.UnableToCreateObject);
    })    
    it('should be able to create read-only object', function() {
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = Hello(new ArrayBuffer(10), { writable: false });
      expect(() => object.$ = 1234n).to.throw(TypeError);
    })
    it('should make child object read-only too', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
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
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: true,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
      });     
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: structStructure.byteSize + 2,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: structStructure.byteSize * 8,
        byteSize: structStructure.byteSize,
        structure: structStructure,
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: structStructure.byteSize * 8,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = Hello(new ArrayBuffer(structure.byteSize), { writable: false });
      const pets = object.$;
      expect(() => pets.dog = 123).to.throw(TypeError)
        .with.property('message').that.contains('read-only');
      expect(() => pets.$ = { cat: 123 }).to.throw(TypeError)
        .with.property('message').that.contains('read-only');
    });
    it('should initialize error union object from toJSON output', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
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
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: true,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
      });     
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });      
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(errorStructure);
      const { constructor: MyError } = errorStructure;
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.finalizeStructure(errorStructure);
      const structure = env.beginStructure({
        type: StructureType.ErrorUnion,
        name: 'Hello',
        byteSize: structStructure.byteSize + 2,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: structStructure.byteSize * 8,
        byteSize: structStructure.byteSize,
        structure: structStructure,
      });
      env.attachMember(structure, {
        name: 'error',
        type: MemberType.Error,
        bitOffset: structStructure.byteSize * 8,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object1 = new Hello(MyError.UnableToCreateObject);
      const json = object1.toJSON();
      const object2 = new Hello(json);
      expect(() => object2.$).to.throw(MyError.UnableToCreateObject);
      expect(() => new Hello({ error: 'Something' })).to.throw(TypeError)
        .with.property('message').to.contain('Something');
    })    
  })
})

function errorData(index) {
  const ta = new Uint16Array([ index ]);
  return new DataView(ta.buffer, 0, 2);
}
