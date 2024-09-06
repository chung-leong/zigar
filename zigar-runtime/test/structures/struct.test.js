import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorBool from '../../src/accessors/bool.js';
import AccessorBool1Unaligned from '../../src/accessors/bool1-unaligned.js';
import AccessorFloat128 from '../../src/accessors/float128.js';
import AccessorIntUnaligned from '../../src/accessors/int-unaligned.js';
import AccessorJumboInt from '../../src/accessors/jumbo-int.js';
import AccessorJumbo from '../../src/accessors/jumbo.js';
import AccessorUintUnaligned from '../../src/accessors/uint-unaligned.js';
import AccessorUnaligned from '../../src/accessors/unaligned.js';
import { MemberFlag, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import DataCopying from '../../src/features/data-copying.js';
import RuntimeSafety from '../../src/features/runtime-safety.js';
import StructureAcquisition from '../../src/features/structure-acquisition.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll from '../../src/members/all.js';
import MemberBool from '../../src/members/bool.js';
import MemberInt from '../../src/members/int.js';
import MemberObject from '../../src/members/object.js';
import MemberPrimitive from '../../src/members/primitive.js';
import SpecialMethods from '../../src/members/special-methods.js';
import SpecialProps from '../../src/members/special-props.js';
import MemberTypeMixin from '../../src/members/type.js';
import MemberUint from '../../src/members/uint.js';
import All from '../../src/structures/all.js';
import Primitive from '../../src/structures/primitive.js';
import StructLike from '../../src/structures/struct-like.js';
import Struct, {
  isNeededByStructure,
} from '../../src/structures/struct.js';
import { ENTRIES, ENVIRONMENT, INITIALIZE, MEMORY, SLOTS } from '../../src/symbols.js';
import { encodeBase64 } from '../../src/utils.js';

const Env = defineClass('StructureTest', [
  AccessorAll, MemberInt, MemberPrimitive, MemberAll, All, Primitive, DataCopying, SpecialMethods,
  SpecialProps, StructureAcquisition, ViewManagement, MemberTypeMixin, AccessorJumbo, AccessorJumboInt,
  Struct, AccessorBool, AccessorFloat128, RuntimeSafety, MemberBool, AccessorBool1Unaligned,
  MemberUint, AccessorIntUnaligned, AccessorUintUnaligned, AccessorUnaligned, MemberObject,
  StructLike,
]);

describe('Structure: struct', function() {
  describe('isNeededByStructure', function() {
    it('should return true when mixin is needed by a structure', function() {
      const structure = {
        type: StructureType.Struct
      };
      expect(isNeededByStructure(structure)).to.be.true;
    })
    it('should return false when mixin is needed by a structure', function() {
      const structure = {
        type: StructureType.Optional
      };
      expect(isNeededByStructure(structure)).to.be.false;
    })
  })
  describe('defineStruct', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
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
          bitOffset: 32,
          byteSize: 1,
          structure: {},
        },
      ];
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineStruct(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
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
          bitOffset: 32,
          byteSize: 1,
          structure: {},
        },
      ];
      const env = new Env();
      const descriptors = {};
      env.defineStruct(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors.number?.get).to.be.a('function');
      expect(descriptors.number?.set).to.be.a('function');
      expect(descriptors.boolean?.get).to.be.a('function');
      expect(descriptors.boolean?.set).to.be.a('function');
      expect(descriptors[Symbol.iterator]?.value).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
      expect(descriptors[ENTRIES]?.get).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define a simple struct', function() {
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
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
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
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
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
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
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const buffer = new ArrayBuffer(8)
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
      const dv = env.obtainView(buffer, 0, 8);
      const object3 = Hello(dv);
      expect(object3).to.equal(object1);
    })
    it('should initialize fields from object', function() {
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({ dog: 5, cat: 6 });
      expect(object.dog).to.equal(5);
      expect(object.cat).to.equal(6);
    })
    it('should initialize fields from object whose fields are not enumerable', function() {
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const initObj = Object.create({ dog: 5 });
      Object.defineProperty(initObj, 'cat', { value: 6 });
      const object = new Hello(initObj);
      expect('dog' in initObj).to.be.true;
      expect('cat' in initObj).to.be.true;
      expect(object.dog).to.equal(5);
      expect(object.cat).to.equal(6);
    })
    it('should throw when no initializer is provided', function() {
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should work correctly with big-endian data', function() {
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
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
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(Hello).to.be.a('function');
      const object = new Hello({});
      expect(object.valueOf()).to.eql({ dog: 1234, cat: 4567 });
    })
    it('should create functional setters', function() {
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
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
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({});
      object.dog = 72;
      expect(object.dog).to.equal(72);
      expect(object.cat).to.equal(4567);
      object.cat = 882;
      expect(object.cat).to.equal(882);
      expect(object.dog).to.equal(72);
    })
    it('should have dataView property', function() {
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
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
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({});
      expect(object.dataView).to.be.instanceOf(DataView);
    })
    it('should throw when a value exceed the maximum capability of the type and runtime safety is on', function () {
      const env = new Env();
      env.runtimeSafety = true;
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
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
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({});
      expect(() => object.dog = 0x1FFFFFFFF).to.throw(TypeError);
    })
    it('should permit overflow when runtime safety is off', function () {
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
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
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({});
      expect(() => object.dog = 0x1FFFFFFFF).to.not.throw();
    })
    it('should be able to handle bitfields', function() {
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 1,
        structure: {},
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(1));
          dv.setInt8(0, 2, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
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
      const env = new Env();
      env.runtimeSafety = true;
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 3,
        bitOffset: 2,
        structure: {},
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(1));
          dv.setInt8(0, 7, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
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
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 2,
        structure: {},
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(5));
          dv.setUint32(0, 8, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({});
      expect(object.dog).to.equal(0);
      expect(object.cat).to.equal(2);
    })
    it('should complain about missing required initializers', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 32,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Hello({})).to.throw(TypeError)
        .with.property('message').that.contains('dog, cat');
      expect(() => new Hello({ dog: 1234 })).to.throw(TypeError)
        .with.property('message').that.does.not.contain('dog');
      const object = new Hello({ dog: 1234, cat: 4567 });
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
    it('should complain about invalid initializers', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 32,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Hello({ dog: 1234, cat: 4567, turkey: 1 })).to.throw(TypeError)
        .with.property('message').that.contains('turkey');
    })
    it('should apply default value when only some properties are provided', function() {
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 32,
        structure: {},
      });
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 1234, true);
      env.attachTemplate(structure, {
        [MEMORY]: dv,
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Hello({})).to.throw();
      const object = new Hello({ cat: 4567 });
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
    it('should accept base64 data as initializer', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 32,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 1, true);
      dv.setUint32(4, 7, true);
      const base64 = encodeBase64(dv);
      const object = new Hello({ base64 });
      expect(object.dog).to.equal(1);
      expect(object.cat).to.equal(7);
    })
    it('should allow assignment of base64 data', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 32,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello(undefined);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 15, true);
      dv.setUint32(4, 10, true);
      object.base64 = encodeBase64(dv);
      expect(object.dog).to.equal(15);
      expect(object.cat).to.equal(10);
    })
    it('should accept data view as initializer', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 32,
        structure: {},
      });
      const Hello= env.defineStructure(structure);
      env.endStructure(structure);
      const typedArray = new Uint32Array([ 123, 456 ]);
      const dataView = new DataView(typedArray.buffer);
      const object = new Hello({ dataView });
      expect(object.dog).to.equal(123);
      expect(object.cat).to.equal(456);
    })
    it('should allow assignment of data view', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 32,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello(undefined);
      const typedArray = new Uint32Array([ 123, 456 ]);
      object.dataView = new DataView(typedArray.buffer);
      expect(object.dog).to.equal(123);
      expect(object.cat).to.equal(456);
    })
    it('should allow assignment through the dollar property', function() {
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        isRequired: false,
        bitSize: 32,
        bitOffset: 32,
        structure: {},
      });
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(0, 1234, true);
      dv.setUint32(4, 4567, true);
      env.attachTemplate(structure, {
        [MEMORY]: dv,
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
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
      const env = new Env();
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
        structure: {},
      });
      env.defineStructure(structureA);
      env.endStructure(structureA);
      const structureB = env.beginStructure({
        type: StructureType.Struct,
        name: 'StructB',
        byteSize: 4,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
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
      const StructB = env.defineStructure(structureB);
      const buffer = new ArrayBuffer(8);
      const dv = new DataView(buffer, 4, 4);
      dv.setInt32(0, 1234, true);
      const object = StructB(dv);
      expect(object.a.number).to.equal(1234);
    })
    it('should define a packed struct', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Packed',
        byteSize: 4,
        align: 4,
        flags: StructureFlag.IsPacked,
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        name: 'nice',
        bitSize: 1,
        bitOffset: 0,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        name: 'rich',
        bitSize: 1,
        bitOffset: 1,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        name: 'young',
        bitSize: 1,
        bitOffset: 2,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsBackingInt,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Packed = env.defineStructure(structure);
      env.endStructure(structure);
      const packed = new Packed({});
      packed.rich = true;
      packed.nice = true;
      packed.young = true;
      const number = Number(packed);
      expect(number).to.equal(0x07);
      expect(packed == 7).to.be.true;
      expect(String(packed)).to.equal('[object Packed]');
      const another = new Packed(1 << 0 | 1 << 2);
      expect(another.nice).to.be.true;
      expect(another.young).to.be.true;
      expect(another.rich).to.be.false;
    })
    it('should throw when child struct is not on a byte-boundary', function() {
      const env = new Env();
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
        structure: {},
      });
      env.defineStructure(structureA);
      env.endStructure(structureA);
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
      const StructB = env.defineStructure(structureB);
      env.endStructure(structureB);
      const buffer = new ArrayBuffer(8);
      const dv = new DataView(buffer, 3, 5);
      dv.setInt32(0, 1234, true);
      const object = StructB(dv);
      expect(() => object.a.number).to.throw(TypeError);
    })
    it('should allow child struct in packed struct when it is on a byte-boundary', function() {
      const env = new Env();
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
        structure: {},
      });
      env.defineStructure(structureA);
      env.endStructure(structureA);
      const structureB = env.beginStructure({
        type: StructureType.Struct,
        name: 'StructB',
        byteSize: 5,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
      });
      env.attachMember(structureB, {
        type: MemberType.Object,
        name: 'a',
        bitSize: 32,
        bitOffset: 8,
        slot: 0,
        structure: structureA,
      });
      const StructB = env.defineStructure(structureB);
      env.endStructure(structureB);
      const buffer = new ArrayBuffer(8);
      const dv = new DataView(buffer, 3, 5);
      dv.setInt32(1, 1234, true);
      const object = StructB(dv);
      expect(object.a.valueOf()).to.eql({ number: 1234 });
    })
    it('should have correct string tag', function() {
      const env = new Env();
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
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
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
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      expect(Hello.name).to.equal('zig.super.Hello');
      const object = new Hello({});
      const desc = Object.prototype.toString.call(object);
      expect(desc).to.equal('[object zig.super.Hello]');
    })
    it('should handle comptime fields', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'zig.super.Hello',
        byteSize: 0,
        flags: StructureFlag.HasSlot,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly,
        slot: 0,
        structure: intStructure
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly,
        slot: 1,
        structure: intStructure
      });
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Int32.call(ENVIRONMENT, viewOf(new Int32Array([ 123 ]))),
          1: Int32.call(ENVIRONMENT, viewOf(new Int32Array([ 456 ]))),
        },
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(object.dog).to.equal(123);
      expect(object.cat).to.equal(456);
    })
    it('should define a tuple', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'zig.super.Hello',
        byteSize: 0,
        flags: StructureFlag.IsTuple | StructureFlag.HasSlot,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly,
        slot: 0,
        structure: intStructure
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly,
        slot: 1,
        structure: intStructure
      });
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Int32.call(ENVIRONMENT, viewOf(new Int32Array([ 123 ]))),
          1: Int32.call(ENVIRONMENT, viewOf(new Int32Array([ 456 ]))),
        },
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({});
      expect(object[0]).to.equal(123);
      expect(object[1]).to.equal(456);
      expect(object.valueOf()).to.eql([ 123, 456 ]);
    })
    it('should define an empty tuple', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'zig.super.Hello',
        byteSize: 0,
        flags: StructureFlag.IsTuple,
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({});
      expect(object.valueOf()).to.eql([]);
    })
    it('should define a struct that contains pointers', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*i32',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.IsSingle,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8 * 2,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
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
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({});
      expect(object.dog['*']).to.equal(1234);
      expect(object.cat['*']).to.equal(4567);
      object.dog = new Int32(7788);
      expect(object.dog['*']).to.equal(7788);
      const object2 = new Hello(object);
      expect(object2.dog['*']).to.equal(7788);
    })
    it('should handle default pointers', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*i32',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8 * 2,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Object,
        flags: MemberFlag.IsRequired,
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
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Hello({})).to.throw(TypeError);
      const object = new Hello({ dog: int1 });
      expect(object.dog['*']).to.equal(1234);
      expect(object.cat['*']).to.equal(4567);
    })
    it('should throw when copying a struct with pointer in reloc memory to one in fixed memory', function() {
      const env = new Env();
      let nextAddress = 0x1000n;
      env.allocateExternMemory = function(type, len, align) {
        const address = nextAddress;
        nextAddress += BigInt(len * 0x0F);
        return address;
      };
      env.obtainExternBuffer = function(address, len) {
        return new ArrayBuffer(len);
      };
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*i32',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8 * 2,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
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
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object1 = new Hello({
        cat: new Int32(1234),
        dog: new Int32(4567),
      });
      const object2 = new Hello(undefined, { fixed: true });
      expect(() => object2.$ = object1).to.throw(TypeError)
        .with.property('message').that.contains('cannot point to garbage-collected');
    })
    it('should define an iterator struct', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4,
        flags: StructureFlag.isIterator,
      });
      env.attachMember(structure, {
        name: 'index',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.IsSingle,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure,
        slot: 0,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const optStructure = env.beginStructure({
        type: StructureType.Optional,
        name: '?i32',
        byteSize: 5,
        flags: StructureFlag.HasValue | StructureFlag.HasSelector | StructureFlag.HasSlot,
      });
      env.attachMember(optStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(optStructure, {
        type: MemberType.Bool,
        flags: MemberFlag.IsSelector,
        bitSize: 8,
        bitOffset: 32,
        byteSize: 1,
        structure: {},
      });
      env.defineStructure(optStructure);
      env.endStructure(optStructure);
      const argStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Argument',
        byteSize: 13,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot,
      });
      env.attachMember(argStruct, {
        name: 'retval',
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 5,
        slot: 0,
        structure: optStructure,
      });
      env.attachMember(argStruct, {
        name: '0',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: optStructure.byteSize * 8,
        byteSize: 8,
        structure: ptrStructure,
        slot: 1,
      });
      env.defineStructure(argStruct);
      env.endStructure(argStruct);
      env.attachMethod(structure, {
        name: 'next',
        argStruct,
        isStaticOnly: false,
        thunkId: 1234,
      });
      env.endStructure(structure);
      let i = 0;
      env.runThunk = function(thunkId, argDV) {
        if (i++ < 5) {
          argDV.setInt32(0, i, true);
          argDV.setInt8(4, 1);
        } else {
          argDV.setInt32(0, 0, true);
          argDV.setInt8(4, 0);
        }
      };
      env.getBufferAddress = function(buffer) {
        return 0x1000n;
      }
      const { constructor: Hello } = structure;
      const object = new Hello({ index: 0 });
      const results = [];
      for (const value of object) {
        results.push(value);
      }
      expect(results).to.eql([ 1, 2, 3, 4, 5 ]);
    })

  })
})

function viewOf(ta) {
  return new DataView(ta.buffer);
}
