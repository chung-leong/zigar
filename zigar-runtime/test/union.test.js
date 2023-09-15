import { expect } from 'chai';

import {
  MemberType,
  useBoolEx,
  useIntEx,
  useUintEx,
  useObject,
  useEnumerationItem,
} from '../src/member.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import {
  StructureType,
  usePrimitive,
  usePointer,
  useStruct,
  useArray,
  useExternUnion,
  useBareUnion,
  useTaggedUnion,
  useEnumeration,
  beginStructure,
  attachMember,
  attachTemplate,
  finalizeStructure,
} from '../src/structure.js';

describe('Union functions', function() {
  describe('finalizeUnion', function() {
    beforeEach(function() {
      usePrimitive();
      useExternUnion();
      useBareUnion();
      useTaggedUnion();
      useEnumeration();
      usePointer();
      useStruct();
      useArray();
      useBoolEx();
      useIntEx();
      useUintEx();
      useEnumerationItem();
      useObject();
    })
    it('should define a simple extern union', function() {
      const structure = beginStructure({
        type: StructureType.ExternUnion,
        name: 'Hello',
        size: 4,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4));
          dv.setInt32(0, 1234, true);
          return dv;
        })(),
        [SLOTS]: {},
      })
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const object = new Hello({});
      expect(object).to.be.an.instanceOf(Object);
      expect(object).to.be.an.instanceOf(Hello);
      expect(Object.keys(object)).to.have.lengthOf(2);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(1234);
      object.dog = 777;
      expect(object.dog).to.equal(777);
      expect(object.cat).to.equal(777);
      expect(Object.keys(object)).to.eql([ 'dog', 'cat' ]);
    })
    it('should throw when no initializer is provided', function() {
      const structure = beginStructure({
        type: StructureType.ExternUnion,
        name: 'Hello',
        size: 4,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should define a simple bare union', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setInt32(0, 1234, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const object = new Hello({});
      expect(object).to.be.an.instanceOf(Object);
      expect(object).to.be.an.instanceOf(Hello);
      expect(Object.keys(object)).to.have.lengthOf(2);
      expect(object.dog).to.equal(1234);
      expect(() => object.cat).to.throw(TypeError);
      expect(() => object.cat = 567).to.throw(TypeError);
      object[MEMORY].setInt16(4, 1, true);
      object[MEMORY].setInt32(0, 567, true);
      expect(() => object.dog).to.throw(TypeError);
      expect(object.cat).to.equal(567);
      expect(() => object.cat = 123).to.not.throw();
      expect(object.cat).to.equal(123);
      expect(Object.keys(object)).to.eql([ 'dog', 'cat' ]);
    })
    it('should initialize a simple bare union', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setInt32(0, 1234, true);
          return dv;
        })(),
        [SLOTS]: {},
      })
      const Hello = finalizeStructure(structure);
      const object = new Hello({ cat: 123 });
      expect(object.cat).to.equal(123);
      expect(() => object.dog).to.throw(TypeError);
    })
    it('should allow casting to a simple bare union', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setInt32(0, 1234, true);
      dv.setInt16(4, 1, true);
      const object = Hello(dv.buffer);
      expect(object.cat).to.equal(1234);
      expect(() => object.dog).to.throw(TypeError);
    })
    it('should accept base64 data as initializer', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 6,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      const str = '\u0001\u0000\u0000\u0000\u0000\u0000';
      const base64 = btoa(str);
      const object = new Hello({ base64 });
      expect(object.dog).to.equal(1);
      expect(() => object.cat).to.throw();
    })

    it('should allow assignment of base64 data', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 6,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({ cat: 5 });
      expect(object.cat).to.equal(5);
      const str = '\u0001\u0000\u0000\u0000\u0000\u0000';
      object.base64 = btoa(str);
      expect(object.dog).to.equal(1);
      expect(() => object.cat).to.throw();
    })
    it('should define a bare union containing a struct', function() {
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Aniaml',
        size: 8,
      });
      attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      const Aniaml = finalizeStructure(structStructure);
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: structStructure.size * 8 + 32,
      });
      attachMember(structure, {
        name: 'pets',
        type: MemberType.Object,
        bitSize: structStructure.size * 8,
        bitOffset: 0,
        byteSize: structStructure.size,
        slot: 1,
        structure: structStructure,
      });
      attachMember(structure, {
        name: 'money',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: structStructure.size * 8,
        byteSize: 2,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({ pets: { cat: 7, dog: 9 } });
      expect(object.$.pets.cat).to.equal(7);
      object.$ = { money: 1000 };
      expect(object.$.money).to.equal(1000);
      expect(() => object.$.pets).to.throw(TypeError);
    })
    it('should disable pointers in a bare union', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const ptrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(ptrStructure);
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'SomeStruct',
        size: 8,
        hasPointer: true,
      });
      attachMember(structStructure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      const SomeStruct = finalizeStructure(structStructure);
      const arrayStructure = beginStructure({
        type: StructureType.Array,
        name: '[4]*Int32',
        size: 8 * 4,
        hasPointer: true,
      });
      attachMember(arrayStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: ptrStructure,
      });
      const Int32PtrArray = finalizeStructure(arrayStructure);
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8 * 4,
        hasPointer: false,
      });
      attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      attachMember(structure, {
        name: 'struct',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 1,
        structure: structStructure,
      });
      attachMember(structure, {
        name: 'array',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8 * 4,
        slot: 2,
        structure: arrayStructure,
      });
      attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Hello = finalizeStructure(structure, { runtimeSafety: false });
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
    })
    it('should define a simple tagged union', function() {
      const enumStructure = beginStructure({
        type: StructureType.Enumeration,
        name: 'HelloTag',
      });
      attachMember(enumStructure, {
        name: 'dog',
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(enumStructure, {
        name: 'cat',
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(enumStructure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 100, true);
          dv.setUint32(4, 200, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const HelloType = finalizeStructure(enumStructure);
      const structure = beginStructure({
        type: StructureType.TaggedUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.EnumerationItem,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: enumStructure,
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 100, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const object = new Hello({});
      expect(object).to.be.an.instanceOf(Object);
      expect(object).to.be.an.instanceOf(Hello);
      expect(Object.keys(object)).to.have.lengthOf(1);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.be.null;
      expect(() => object.cat = 567).to.throw(TypeError);
      object[MEMORY].setInt32(4, 200, true);
      object[MEMORY].setInt32(0, 567, true);
      expect(object.dog).to.be.null;
      expect(object.cat).to.equal(567);
      expect(HelloType(object)).to.equal(HelloType.cat);
    })
    it('should only have a single enumerable property', function() {
      const enumStructure = beginStructure({
        type: StructureType.Enumeration,
        name: 'HelloTag',
      });
      attachMember(enumStructure, {
        name: 'dog',
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(enumStructure, {
        name: 'cat',
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(enumStructure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 100, true);
          dv.setUint32(4, 200, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const HelloType = finalizeStructure(enumStructure);
      const structure = beginStructure({
        type: StructureType.TaggedUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.EnumerationItem,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: enumStructure,
      });
      const Hello = finalizeStructure(structure);
      debugger;
      const object = new Hello({ dog: 1234 });
      expect(object.dog).to.equal(1234);
      expect(object.valueOf()).to.eql({ dog: 1234 });
    })
    it('should define a tagged union containing a pointer', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Int32 = finalizeStructure(intStructure);
      const ptrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(ptrStructure);
      const enumStructure = beginStructure({
        type: StructureType.Enumeration,
        name: 'HelloTag',
        size: 2,
      });
      attachMember(enumStructure, {
        name: 'pointer',
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
      });
      attachMember(enumStructure, {
        name: 'number',
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
      });
      attachTemplate(enumStructure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(2 * 2));
          dv.setUint16(0, 0, true);
          dv.setUint16(2, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const HelloTag = finalizeStructure(enumStructure);
      const structure = beginStructure({
        type: StructureType.TaggedUnion,
        name: 'Hello',
        size: 10,
        hasPointer: true,
      });
      attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.EnumerationItem,
        bitSize: 16,
        bitOffset: 64,
        byteSize: 2,
        structure: enumStructure,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({ pointer: new Int32(1234) });
      expect(object.$.pointer['*']).to.equal(1234);
      object.$ = { number: 4567 };
      expect(object.$.pointer).to.be.null;
      expect(object.$.number).to.equal(4567);
    })
    it('should correctly copy a tagged union containing a pointer', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Int32 = finalizeStructure(intStructure);
      const ptrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(ptrStructure);
      const enumStructure = beginStructure({
        type: StructureType.Enumeration,
        name: 'HelloTag',
        size: 2,
      });
      attachMember(enumStructure, {
        name: 'pointer',
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
      });
      attachMember(enumStructure, {
        name: 'number',
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
      });
      attachTemplate(enumStructure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(2 * 2));
          dv.setUint16(0, 0, true);
          dv.setUint16(2, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const HelloTag = finalizeStructure(enumStructure);
      const structure = beginStructure({
        type: StructureType.TaggedUnion,
        name: 'Hello',
        size: 10,
        hasPointer: true,
      });
      attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.EnumerationItem,
        bitSize: 16,
        bitOffset: 64,
        byteSize: 2,
        structure: enumStructure,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({ pointer: new Int32(1234) });
      const object2 = new Hello(object);
      expect(object2.$.pointer['*']).to.equal(1234);
      object2.$.pointer['*'] = 4567;
      expect(object.$.pointer['*']).to.equal(4567);
    })
    it('should release pointer when a different property is activated', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const ptrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(ptrStructure);
      const enumStructure = beginStructure({
        type: StructureType.Enumeration,
        name: 'HelloTag',
        size: 2,
      });
      attachMember(enumStructure, {
        name: 'pointer',
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
      });
      attachMember(enumStructure, {
        name: 'number',
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
      });
      attachTemplate(enumStructure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(2 * 2));
          dv.setUint16(0, 0, true);
          dv.setUint16(2, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const HelloTag = finalizeStructure(enumStructure);
      const structure = beginStructure({
        type: StructureType.TaggedUnion,
        name: 'Hello',
        size: 10,
        hasPointer: true,
      });
      attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.EnumerationItem,
        bitSize: 16,
        bitOffset: 64,
        byteSize: 2,
        structure: enumStructure,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({ pointer: new Int32(1234) });
      const pointer = object.pointer;
      object.$ = { number: 4567 };
      expect(pointer[SLOTS][0]).to.be.null;
    })
    it('should reapply pointer when initialized with no initializer', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const ptrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = finalizeStructure(ptrStructure);
      const enumStructure = beginStructure({
        type: StructureType.Enumeration,
        name: 'HelloTag',
        size: 2,
      });
      attachMember(enumStructure, {
        name: 'pointer',
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
      });
      attachMember(enumStructure, {
        name: 'number',
        type: MemberType.Uint,
        bitSize: 16,
        byteSize: 2,
      });
      attachTemplate(enumStructure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(2 * 2));
          dv.setUint16(0, 0, true);
          dv.setUint16(2, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const HelloTag = finalizeStructure(enumStructure);
      const structure = beginStructure({
        type: StructureType.TaggedUnion,
        name: 'Hello',
        size: 10,
        hasPointer: true,
      });
      attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        isRequired: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.EnumerationItem,
        bitSize: 16,
        bitOffset: 64,
        byteSize: 2,
        structure: enumStructure,
      });
      attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(10)),
        [SLOTS]: { 0: new Int32Ptr(new Int32(1234)) },
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({});
      const pointer = object.pointer;
      expect(object.pointer['*']).to.equal(1234);
      object.$ = { number: 4567 };
      expect(object.pointer).to.be.null;
      object.$ = {};
      expect(object.pointer['*']).to.equal(1234);
    })
    it('should complain about missing union initializer', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello({})).to.throw(TypeError)
        .with.property('message').that.contains('dog, cat')
      const object = new Hello({ cat: 4567 });
      expect(object.cat).to.equal(4567);
    })
    it('should throw when there is more than one initializer', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello({ dog: 1234, cat: 4567 })).to.throw(TypeError);
      const object = new Hello({ dog: 1234 });
      expect(object.dog).to.equal(1234);
      expect(() => { return { ...object } }).to.throw(TypeError);
    })
    it('should throw when an unknown initializer is encountered', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello({ dogg: 1234 })).to.throw(TypeError)
        .with.property('message').that.contains('dogg');
    })
    it('should throw when constructor is given something other than an object', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello(5)).to.throw(TypeError);
    })
    it('should throw when attempting to set an active property', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({ dog: 1234 });
      expect(() => object.cat = 4567).to.throw(TypeError)
        .with.property('message').that.contains('dog')
    })
    it('should allow switching of active property through dollar property', function() {
      const structure = beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      attachMember(structure, {
        name: 'selector',
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello({ dog: 1234 });
      object.$ = { cat: 4567 };
      expect(object.cat).to.equal(4567);
    })
  })
})
