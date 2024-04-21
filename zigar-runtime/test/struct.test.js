import { expect } from 'chai';

import { useAllExtendedTypes } from '../src/data-view.js';
import { NodeEnvironment } from '../src/environment-node.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import { ENVIRONMENT, MEMORY, SLOTS } from '../src/symbol.js';
import { encodeBase64 } from '../src/text.js';
import { MemberType, StructureType } from '../src/types.js';

describe('Struct functions', function() {
  const env = new NodeEnvironment();
  describe('defineStructShape', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
      useAllExtendedTypes();
    })
    it('should define a simple struct', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(Hello).to.be.a('function');
      const object = new Hello({});
      expect(object).to.be.an.instanceOf(Object);
      expect(object).to.be.an.instanceOf(Hello);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
      expect([ ...object ]).to.eql([ [ 'dog', 1234 ], [ 'cat', 4567 ] ]);
      expect(object.valueOf()).to.eql({ dog: 1234, cat: 4567 });
    })
    it('should cast the same buffer to the same object', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const buffer = new ArrayBuffer(8)
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
      const dv = env.obtainView(buffer, 0, 8);
      const object3 = Hello(dv);
      expect(object3).to.equal(object1);
    })
    it('should initialize fields from object', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({ dog: 5, cat: 6 });
      expect(object.dog).to.equal(5);
      expect(object.cat).to.equal(6);
    })
    it('should initialize fields from object whose fields are not enumerable', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const initObj = Object.create({ dog: 5 });
      Object.defineProperty(initObj, 'cat', { value: 6 });
      const object = new Hello(initObj);
      expect('dog' in initObj).to.be.true;
      expect('cat' in initObj).to.be.true;
      expect(object.dog).to.equal(5);
      expect(object.cat).to.equal(6);
    })
    it('should throw when no initializer is provided', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should work correctly with big-endian data', function() {
      const env = new NodeEnvironment();
      env.littleEndian = false;
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, false);
          dv.setInt32(4, 4567, false);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(Hello).to.be.a('function');
      const object = new Hello({});
      expect(object.valueOf()).to.eql({ dog: 1234, cat: 4567 });
    })
    it('should create functional setters', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      object.dog = 72;
      expect(object.dog).to.equal(72);
      expect(object.cat).to.equal(4567);
      object.cat = 882;
      expect(object.cat).to.equal(882);
      expect(object.dog).to.equal(72);
    })
    it('should have dataView property', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(object.dataView).to.be.instanceOf(DataView);
    })
    it('should throw when a value exceed the maximum capability of the type', function () {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(() => object.dog = 0x1FFFFFFFF).to.throw(TypeError);
    })
    it('should permit overflow when runtime safety is off', function () {
      const env = new NodeEnvironment();
      env.runtimeSafety = false;
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(() => object.dog = 0x1FFFFFFFF).to.not.throw();
    })
    it('should be able to handle bitfields', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 1,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 1,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(1));
          dv.setInt8(0, 2, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(object.dog).to.be.false;
      expect(object.cat).to.be.true;
      expect(object.typedArray).to.be.undefined;
      object.dog = true;
      object.cat = false;
      expect(object.dog).to.be.true;
      expect(object.cat).to.be.false;
    })
    it('should be able to handle small int type', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 1,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        bitSize: 2,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 3,
        bitOffset: 2,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(1));
          dv.setInt8(0, 7, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(object.dog).to.equal(3);
      expect(object.cat).to.equal(1);
      expect(() => object.dog = 4).to.throw();
      expect(() => object.cat = 4).to.throw();
      expect(() => object.cat = -3).to.not.throw();
      expect(object.cat).to.equal(-3);
      object.cat = 1;
      expect(object.cat).to.equal(1);
      expect(object.dog).to.equal(3);
    })
    it('should be able to handle bit-misalignment', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 5,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        bitSize: 2,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 2,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(5));
          dv.setUint32(0, 8, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(object.dog).to.equal(0);
      expect(object.cat).to.equal(2);
    })
    it('should complain about missing required initializers', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 32,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello({})).to.throw(TypeError)
        .with.property('message').that.contains('dog, cat');
      expect(() => new Hello({ dog: 1234 })).to.throw(TypeError)
        .with.property('message').that.does.not.contain('dog');
      const object = new Hello({ dog: 1234, cat: 4567 });
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
    it('should complain about invalid initializers', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 32,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello({ dog: 1234, cat: 4567, turkey: 1 })).to.throw(TypeError)
        .with.property('message').that.contains('turkey');
    })
    it('should complain about invalid initializers', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 32,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello(5)).to.throw(TypeError)
        .with.property('message').that.does.not.contain('dog');
    })
    it('should apply default value when only some properties are provided', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 32,
      });
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 1234, true);
      env.attachTemplate(structure, {
        [MEMORY]: dv,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello({})).to.throw();
      const object = new Hello({ cat: 4567 });
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
    it('should accept base64 data as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 32,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 1, true);
      dv.setUint32(4, 7, true);
      const base64 = encodeBase64(dv);
      const object = new Hello({ base64 });
      expect(object.dog).to.equal(1);
      expect(object.cat).to.equal(7);
    })
    it('should allow assignment of base64 data', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 32,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(undefined);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 15, true);
      dv.setUint32(4, 10, true);
      object.base64 = encodeBase64(dv);
      expect(object.dog).to.equal(15);
      expect(object.cat).to.equal(10);
    })
    it('should accept data view as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 32,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const typedArray = new Uint32Array([ 123, 456 ]);
      const dataView = new DataView(typedArray.buffer);
      const object = new Hello({ dataView });
      expect(object.dog).to.equal(123);
      expect(object.cat).to.equal(456);
    })
    it('should allow assignment of data view', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        isRequired: true,
        bitSize: 32,
        bitOffset: 32,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(undefined);
      const typedArray = new Uint32Array([ 123, 456 ]);
      object.dataView = new DataView(typedArray.buffer);
      expect(object.dog).to.equal(123);
      expect(object.cat).to.equal(456);
    })
    it('should allow assignment through the dollar property', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        isRequired: false,
        bitSize: 32,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        isRequired: false,
        bitSize: 32,
        bitOffset: 32,
      });
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 1234, true);
      dv.setUint32(4, 4567, true);
      env.attachTemplate(structure, {
        [MEMORY]: dv,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(object.valueOf()).to.eql({ dog: 1234, cat: 4567 });
      object.dog = 777;
      expect(object.valueOf()).to.eql({ dog: 777, cat: 4567 });
      object.$ = { cat: 999 };
      expect(object.valueOf()).to.eql({ dog: 1234, cat: 999 });
      object.$ = {};
      expect(object.valueOf()).to.eql({ dog: 1234, cat: 4567 });
    })
    it('should define a struct that contains another struct', function() {
      const structureA = env.beginStructure({
        type: StructureType.Struct,
        name: 'StructA',
        byteSize: 4,
      });
      env.attachMember(structureA, {
        type: MemberType.Int,
        name: 'number',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structureA);
      env.finalizeStructure(structureA);
      const { constructor: StructA } = structureA;
      const structureB = env.beginStructure({
        type: StructureType.Struct,
        name: 'StructB',
        byteSize: 4,
      });
      env.attachMember(structureB, {
        type: MemberType.Object,
        name: 'a',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 0,
        structure: structureA,
      });
      env.finalizeShape(structureB);
      env.finalizeStructure(structureB);
      const { constructor: StructB } = structureB;
      const buffer = new ArrayBuffer(8);
      const dv = new DataView(buffer, 4, 4);
      dv.setInt32(0, 1234, true);
      const object = StructB(dv);
      expect(object.a.number).to.equal(1234);
    })
    it('should define a packed struct that contains another struct', function() {
      const structureA = env.beginStructure({
        type: StructureType.Struct,
        name: 'StructA',
        byteSize: 4,
      });
      env.attachMember(structureA, {
        type: MemberType.Int,
        name: 'number',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structureA);
      env.finalizeStructure(structureA);
      const { constructor: StructA } = structureA;
      const structureB = env.beginStructure({
        type: StructureType.Struct,
        name: 'StructB',
        byteSize: 4,
      });
      env.attachMember(structureB, {
        type: MemberType.Object,
        name: 'a',
        bitSize: 32,
        bitOffset: 0,
        slot: 0,
        structure: structureA,
      });
      env.finalizeShape(structureB);
      env.finalizeStructure(structureB);
      const { constructor: StructB } = structureB;
      const buffer = new ArrayBuffer(8);
      const dv = new DataView(buffer, 4, 4);
      dv.setInt32(0, 1234, true);
      const object = StructB(dv);
      expect(object.a.number).to.equal(1234);
    })
    it('should throw when child struct is not on a byte-boundary', function() {
      const structureA = env.beginStructure({
        type: StructureType.Struct,
        name: 'StructA',
        byteSize: 4,
      });
      env.attachMember(structureA, {
        type: MemberType.Int,
        name: 'number',
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structureA);
      env.finalizeStructure(structureA);
      const { constructor: StructA } = structureA;
      const structureB = env.beginStructure({
        type: StructureType.Struct,
        name: 'StructB',
        byteSize: 5,
      });
      env.attachMember(structureB, {
        type: MemberType.Object,
        name: 'a',
        bitSize: 32,
        bitOffset: 3,
        slot: 0,
        structure: structureA,
      });
      env.finalizeShape(structureB);
      env.finalizeStructure(structureB);
      const { constructor: StructB } = structureB;
      const buffer = new ArrayBuffer(8);
      const dv = new DataView(buffer, 3, 5);
      dv.setInt32(0, 1234, true);
      const object = StructB(dv);
      expect(() => object.a.number).to.throw(TypeError);
    })
    it('should define a struct that contains pointers', function() {
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
        hasPointer: true
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
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8 * 2,
        hasPointer: true
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: ptrStructure,
      })
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      const intPtr1 = new Int32Ptr(int1);
      const intPtr2 = new Int32Ptr(int2);
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8 * 2));
          dv.setBigUint64(0, 0xaaaaaaaaaaaaaaaan, true);
          dv.setBigUint64(8, 0xaaaaaaaaaaaaaaaan, true);
          return dv;
        })(),
        [SLOTS]: {
          0: intPtr1,
          1: intPtr2,
        }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(object.dog['*']).to.equal(1234);
      expect(object.cat['*']).to.equal(4567);
      object.dog = new Int32(7788);
      expect(object.dog['*']).to.equal(7788);
      const object2 = new Hello(object);
      expect(object2.dog['*']).to.equal(7788);
    })
    it('should not when default values are not available for all pointers', function() {
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
        hasPointer: true
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
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8 * 2,
        hasPointer: true
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Object,
        isRequired: true,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: ptrStructure,
      })
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      const intPtr2 = new Int32Ptr(int2);
      env.attachTemplate(structure, {
        [MEMORY]: new DataView(new ArrayBuffer(8 * 2)),
        [SLOTS]: {
          1: intPtr2,
        }
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({ dog: int1 });
      expect(object.dog['*']).to.equal(1234);
      expect(object.cat['*']).to.equal(4567);
    })
    it('should have correct string tag', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'zig.super.Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(Hello.name).to.equal('zig.super.Hello');
      const object = new Hello({});
      const desc = Object.prototype.toString.call(object);
      expect(desc).to.equal('[object zig.super.Hello]');
    })
    it('should handle comptime fields', function() {
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
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'zig.super.Hello',
        byteSize: 0,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Comptime,
        slot: 0,
        structure: { type: StructureType.Primitive }
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Comptime,
        slot: 1,
        structure: { type: StructureType.Primitive }
      });
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Int32.call(ENVIRONMENT, viewOf(new Int32Array([ 123 ]))),
          1: Int32.call(ENVIRONMENT, viewOf(new Int32Array([ 456 ]))),
        },
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(object.dog).to.equal(123);
      expect(object.cat).to.equal(456);
    })
    it('should define a tuple', function() {
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
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'zig.super.Hello',
        byteSize: 0,
        isTuple: true,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Comptime,
        slot: 0,
        structure: { type: StructureType.Primitive }
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Comptime,
        slot: 1,
        structure: { type: StructureType.Primitive }
      });
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Int32.call(ENVIRONMENT, viewOf(new Int32Array([ 123 ]))),
          1: Int32.call(ENVIRONMENT, viewOf(new Int32Array([ 456 ]))),
        },
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(object[0]).to.equal(123);
      expect(object[1]).to.equal(456);
      expect(object.valueOf()).to.eql([ 123, 456 ]);
    })
    it('should define an empty tuple', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'zig.super.Hello',
        byteSize: 0,
        isTuple: true,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(object.valueOf()).to.eql([]);
    })
    it('should throw when copying a struct with pointer in reloc memory to one in fixed memory', function() {
      const env = new NodeEnvironment();
      env.allocateExternMemory = function(len, align) {
        return 0x1000n;
      };
      env.obtainExternBuffer = function(address, len) {
        return new ArrayBuffer(len);
      };
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
        hasPointer: true
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
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8 * 2,
        hasPointer: true
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: ptrStructure,
      })
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object1 = new Hello({
        cat: new Int32(1234),
        dog: new Int32(4567),
      });
      const object2 = new Hello(undefined, { fixed: true });
      expect(() => object2.$ = object1).to.throw(TypeError)
        .with.property('message').that.contains('cannot point to garbage-collected');
    })  
  })
})

function viewOf(ta) {
  return new DataView(ta.buffer);
}