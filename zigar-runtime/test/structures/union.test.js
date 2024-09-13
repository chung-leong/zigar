import { expect } from 'chai';
import 'mocha-skip-if';
import { MemberFlag, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';
import {
  ENTRIES, ENVIRONMENT, INITIALIZE, KEYS, MEMORY, SETTERS, SLOTS, VISIT
} from '../../src/symbols.js';
import { defineValue, encodeBase64 } from '../../src/utils.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorBool from '../../src/accessors/bool.js';
import AccessorBool1Unaligned from '../../src/accessors/bool1-unaligned.js';
import AccessorFloat128 from '../../src/accessors/float128.js';
import AccessorIntUnaligned from '../../src/accessors/int-unaligned.js';
import AccessorJumboInt from '../../src/accessors/jumbo-int.js';
import AccessorJumbo from '../../src/accessors/jumbo.js';
import AccessorUintUnaligned from '../../src/accessors/uint-unaligned.js';
import AccessorUnaligned from '../../src/accessors/unaligned.js';
import Baseline from '../../src/features/baseline.js';
import DataCopying from '../../src/features/data-copying.js';
import IntConversion from '../../src/features/int-conversion.js';
import RuntimeSafety from '../../src/features/runtime-safety.js';
import StructureAcquisition from '../../src/features/structure-acquisition.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll from '../../src/members/all.js';
import MemberBool from '../../src/members/bool.js';
import MemberInt from '../../src/members/int.js';
import MemberObject from '../../src/members/object.js';
import PointerInArray from '../../src/members/pointer-in-array.js';
import PointerInStruct from '../../src/members/pointer-in-struct.js';
import MemberPrimitive from '../../src/members/primitive.js';
import SpecialMethods from '../../src/members/special-methods.js';
import SpecialProps from '../../src/members/special-props.js';
import MemberTypeMixin from '../../src/members/type.js';
import MemberUint from '../../src/members/uint.js';
import All from '../../src/structures/all.js';
import ArgStruct from '../../src/structures/arg-struct.js';
import ArrayLike from '../../src/structures/array-like.js';
import Array from '../../src/structures/array.js';
import Enum from '../../src/structures/enum.js';
import Optional from '../../src/structures/optional.js';
import Pointer from '../../src/structures/pointer.js';
import Primitive from '../../src/structures/primitive.js';
import StructLike from '../../src/structures/struct-like.js';
import Struct from '../../src/structures/struct.js';
import Union, {
  isNeededByStructure,
} from '../../src/structures/union.js';

const Env = defineClass('StructureTest', [
  AccessorAll, MemberInt, MemberPrimitive, MemberAll, All, Primitive, DataCopying, SpecialMethods,
  SpecialProps, StructureAcquisition, ViewManagement, MemberTypeMixin, AccessorJumbo,
  AccessorJumboInt, Union, AccessorBool, AccessorFloat128, RuntimeSafety, MemberBool,
  AccessorBool1Unaligned, MemberUint, AccessorIntUnaligned, AccessorUintUnaligned,
  AccessorUnaligned, MemberObject, StructLike, Enum, Struct, IntConversion, Pointer,
  PointerInStruct, Optional, ArgStruct, Array, ArrayLike, PointerInArray, Baseline,
]);

describe('Structure: union', function() {
  describe('isNeededByStructure', function() {
    it('should return true when mixin is needed by a structure', function() {
      const structure = {
        type: StructureType.Union
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
  describe('defineUnion', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Union,
        name: 'Hello',
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
        name: 'Hello',
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
      expect(descriptors[ENTRIES]?.get).to.be.a('function');
      expect(keys).to.eql([ 'number', 'boolean' ]);
      expect(setters.number).to.be.a('function');
      expect(setters.boolean).to.be.a('function');
    })
  })
  describe('finalizeUnion', function() {
    it('should add static descriptors to the given object', function() {
      const structure = {
        type: StructureType.Union,
        flags: StructureFlag.HasTag,
        name: 'Hello',
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
      ];
      const env = new Env();
      const descriptors = {};
      env.finalizeUnion(structure, descriptors);
      expect(descriptors.tag?.value).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define a simple extern union', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.IsExtern,
        name: 'Hello',
        byteSize: 4,
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
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
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
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.IsExtern,
        name: 'Hello',
        byteSize: 4,
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
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const buffer = new ArrayBuffer(4);
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
    })
    it('should throw when no initializer is provided', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.IsExtern,
        name: 'Hello',
        byteSize: 4,
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
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should define a simple bare union', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 8,
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
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
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
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 8,
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
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
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
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 8,
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
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const initObj = Object.create({ cat: 123 })
      const object = new Hello(initObj);
      expect(object.cat).to.equal(123);
    })
    it('should allow casting to a simple bare union', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 8,
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
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setInt32(0, 1234, true);
      dv.setInt16(4, 1, true);
      const object = Hello(dv.buffer);
      expect(object.cat).to.equal(1234);
      expect(() => object.dog).to.throw(TypeError);
    })
    it('should accept base64 data as initializer', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 6,
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
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const dv = new DataView(new ArrayBuffer(6));
      dv.setUint32(0, 1234, true);
      const base64 = encodeBase64(dv);
      const object = new Hello({ base64 });
      expect(object.dog).to.equal(1234);
      expect(() => object.cat).to.throw();
    })
    it('should allow assignment of base64 data', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 6,
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
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
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
        structure: {},
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: structStructure.byteSize * 8 + 32,
      });
      env.attachMember(structure, {
        name: 'pets',
        type: MemberType.Object,
        bitSize: structStructure.byteSize * 8,
        bitOffset: 0,
        byteSize: structStructure.byteSize,
        slot: 1,
        structure: structStructure,
      });
      env.attachMember(structure, {
        name: 'money',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: structStructure.byteSize * 8,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({ pets: { cat: 7, dog: 9 } });
      expect(object.$.pets.cat).to.equal(7);
      object.$ = { money: 1000 };
      expect(object.$.money).to.equal(1000);
      expect(() => object.$.pets).to.throw(TypeError);
    })
    skip.
    it('should disable pointers in a bare union', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'i32',
        byteSize: 4,
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
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
        name: '*i32',
        byteSize: 8,
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
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'SomeStruct',
        byteSize: 8,
      });
      env.attachMember(structStructure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: '[4]*Int32',
        length: 4,
        byteSize: 8 * 4,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: ptrStructure,
      });
      env.defineStructure(arrayStructure);
      env.endStructure(arrayStructure);
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector | StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: 8 * 4,
      });
      env.attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'struct',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 1,
        structure: structStructure,
      });
      env.attachMember(structure, {
        name: 'array',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8 * 4,
        slot: 2,
        structure: arrayStructure,
      });
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
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
      const enumStructure = env.beginStructure({
        type: StructureType.Enum,
        name: 'HelloTag',
        byteSize: 2,
      });
      env.attachMember(enumStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: enumStructure,
      });
      const HelloTag = env.defineStructure(enumStructure);
      env.attachMember(enumStructure, {
        name: 'dog',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
        slot: 0,
        structure: enumStructure,
      }, true);
      env.attachMember(enumStructure, {
        name: 'cat',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
        slot: 1,
        structure: enumStructure,
      }, true);
      env.attachTemplate(enumStructure, {
        [SLOTS]: {
          0: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 100 ]))),
          1: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 200 ]))),
        },
      }, true);
      env.endStructure(enumStructure);
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasTag | StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 6,
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
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: enumStructure,
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
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
      const enumStructure = env.beginStructure({
        type: StructureType.Enum,
        name: 'HelloTag',
        byteSize: 4,
      });
      env.attachMember(enumStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: enumStructure,
      });
      const HelloTag = env.defineStructure(enumStructure);
      env.attachMember(enumStructure, {
        name: 'dog',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
        slot: 0,
        structure: enumStructure,
      }, true);
      env.attachMember(enumStructure, {
        name: 'cat',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
        slot: 1,
        structure: enumStructure,
      }, true);
      env.attachTemplate(enumStructure, {
        [SLOTS]: {
          0: HelloTag.call(ENVIRONMENT, viewOf(new Uint32Array([ 100 ]))),
          1: HelloTag.call(ENVIRONMENT, viewOf(new Uint32Array([ 200 ]))),
        },
      }, true);
      env.endStructure(enumStructure);
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasTag | StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 8,
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
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: enumStructure,
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({ dog: 1234 });
      expect(object.dog).to.equal(1234);
      expect(object.valueOf()).to.eql({ dog: 1234 });
    })
    it('should define a tagged union containing a pointer', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'i32',
        byteSize: 4,
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
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
        name: '*i32',
        byteSize: 8,
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
      const enumStructure = env.beginStructure({
        type: StructureType.Enum,
        name: 'HelloTag',
        byteSize: 2,
      });
      env.attachMember(enumStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: enumStructure,
      });
      const HelloTag = env.defineStructure(enumStructure);
      env.attachMember(enumStructure, {
        name: 'pointer',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
        slot: 0,
        structure: enumStructure,
      }, true);
      env.attachMember(enumStructure, {
        name: 'number',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
        slot: 1,
        structure: enumStructure,
      }, true);
      env.attachTemplate(enumStructure, {
        [SLOTS]: {
          0: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 0 ]))),
          1: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 1 ]))),
        },
      }, true);
      env.endStructure(enumStructure);
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasTag | StructureFlag.HasSelector | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 64,
        byteSize: 2,
        structure: enumStructure,
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({ pointer: new Int32(1234) });
      expect(object.$.pointer['*']).to.equal(1234);
      object.$ = { number: 4567 };
      expect(object.$.pointer).to.be.null;
      expect(object.$.number).to.equal(4567);
    })
    it('should correctly copy a tagged union containing a pointer', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'i32',
        byteSize: 4,
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
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
        name: '*i32',
        byteSize: 8,
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
      const enumStructure = env.beginStructure({
        type: StructureType.Enum,
        name: 'HelloTag',
        byteSize: 2,
      });
      env.attachMember(enumStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: enumStructure,
      });
      const HelloTag = env.defineStructure(enumStructure);
      env.attachMember(enumStructure, {
        name: 'pointer',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
        slot: 0,
        structure: enumStructure,
      }, true);
      env.attachMember(enumStructure, {
        name: 'number',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
        slot: 1,
        structure: enumStructure,
      }, true);
      env.attachTemplate(enumStructure, {
        [SLOTS]: {
          0: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 0 ]))),
          1: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 1 ]))),
        },
      }, true);
      env.endStructure(enumStructure);
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasTag | StructureFlag.HasSelector | StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 64,
        byteSize: 2,
        structure: enumStructure,
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({ pointer: new Int32(1234) });
      const object2 = new Hello(object);
      expect(object2.$.pointer['*']).to.equal(1234);
      object2.$.pointer['*'] = 4567;
      expect(object.$.pointer['*']).to.equal(4567);
    })
    it('should release pointer when a different property is activated', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'i32',
        byteSize: 4,
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
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
        name: '*i32',
        byteSize: 8,
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
      const enumStructure = env.beginStructure({
        type: StructureType.Enum,
        name: 'HelloTag',
        byteSize: 2,
      });
      env.attachMember(enumStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: enumStructure,
      });
      const HelloTag = env.defineStructure(enumStructure);
      env.attachMember(enumStructure, {
        name: 'pointer',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
        slot: 0,
        structure: enumStructure,
      }, true);
      env.attachMember(enumStructure, {
        name: 'number',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
        slot: 1,
        structure: enumStructure,
      }, true);
      env.attachTemplate(enumStructure, {
        [SLOTS]: {
          0: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 0 ]))),
          1: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 1 ]))),
        },
      }, true);
      env.endStructure(enumStructure);
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasTag | StructureFlag.HasSelector | StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 64,
        byteSize: 2,
        structure: enumStructure,
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({ pointer: new Int32(1234) });
      const pointer = object.pointer;
      object.$ = { number: 4567 };
      expect(pointer[SLOTS][0]).to.be.undefined;
      object[VISIT](function({ isActive }) {
        expect(isActive(this)).to.be.false;
      })
    })
    it('should release pointer when a different property is activated externally', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'i32',
        byteSize: 4,
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
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
        name: '*i32',
        byteSize: 8,
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
      const enumStructure = env.beginStructure({
        type: StructureType.Enum,
        name: 'HelloTag',
        byteSize: 2,
      });
      env.attachMember(enumStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: enumStructure,
      });
      const HelloTag = env.defineStructure(enumStructure);
      env.attachMember(enumStructure, {
        name: 'pointer',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
        slot: 0,
        structure: enumStructure,
      }, true);
      env.attachMember(enumStructure, {
        name: 'number',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
        slot: 1,
        structure: enumStructure,
      }, true);
      env.attachTemplate(enumStructure, {
        [SLOTS]: {
          0: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 0 ]))),
          1: HelloTag.call(ENVIRONMENT, viewOf(new Uint16Array([ 1 ]))),
        },
      }, true);
      env.endStructure(enumStructure);
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasTag | StructureFlag.HasSelector | StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: 10,
      });
      env.attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 64,
        byteSize: 2,
        structure: enumStructure,
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({ pointer: new Int32(1234) });
      const pointer = object.pointer;
      object[MEMORY].setInt32(0, 1234, true);
      object[MEMORY].setInt16(8, 1, true);
      expect(object.number).to.equal(1234);
      expect(pointer[SLOTS][0]).to.be.undefined;
      object[VISIT](function({ isActive }) {
        expect(isActive(this)).to.be.false;
      })
    })
    // TODO: make sure that it's possible to create union with default values
    // it('should reapply pointer when initialized with no initializer', function() {
    //   const env = new Env();
    //   const intStructure = env.beginStructure({
    //     type: StructureType.Primitive,
    //     flags: StructureFlag.HasValue,
    //     name: 'i32',
    //     byteSize: 4,
    //   });
    //   env.attachMember(intStructure, {
    //     type: MemberType.Uint,
    //     bitSize: 32,
    //     bitOffset: 0,
    //     byteSize: 4,
    //     structure: intStructure,
    //   });
    //   const Int32 = env.defineStructure(intStructure);
    //   env.endStructure(intStructure);
    //   const ptrStructure = env.beginStructure({
    //     type: StructureType.Pointer,
    //     flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
    //     name: '*i32',
    //     byteSize: 8,
    //   });
    //   env.attachMember(ptrStructure, {
    //     type: MemberType.Object,
    //     bitSize: 64,
    //     bitOffset: 0,
    //     byteSize: 8,
    //     slot: 0,
    //     structure: intStructure,
    //   });
    //   const Int32Ptr = env.defineStructure(ptrStructure);
    //   env.endStructure(ptrStructure);
    //   const enumStructure = env.beginStructure({
    //     type: StructureType.Enum,
    //     name: 'HelloTag',
    //     byteSize: 2,
    //   });
    //   env.attachMember(enumStructure, {
    //     type: MemberType.Uint,
    //     bitSize: 16,
    //     bitOffset: 0,
    //     byteSize: 2,
    //     structure: enumStructure,
    //   });
    //   const HelloTag = env.defineStructure(enumStructure);
    //   env.attachMember(enumStructure, {
    //     name: 'pointer',
    //     type: MemberType.Object,
    //     flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
    //     slot: 0,
    //     structure: enumStructure,
    //   }, true);
    //   env.attachMember(enumStructure, {
    //     name: 'number',
    //     type: MemberType.Object,
    //     flags: MemberFlag.IsReadOnly | MemberFlag.IsPartOfSet,
    //     slot: 1,
    //     structure: enumStructure,
    //   }, true);
    //   env.endStructure(enumStructure);
    //   const structure = env.beginStructure({
    //     type: StructureType.Union,
    //     flags: StructureFlag.HasTag | StructureFlag.HasSelector | StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
    //     name: 'Hello',
    //     byteSize: 10,
    //   });
    //   env.attachMember(structure, {
    //     name: 'pointer',
    //     type: MemberType.Object,
    //     bitSize: 64,
    //     bitOffset: 0,
    //     byteSize: 8,
    //     slot: 0,
    //     structure: ptrStructure,
    //   });
    //   env.attachMember(structure, {
    //     name: 'number',
    //     type: MemberType.Int,
    //     flags: MemberFlag.IsRequired,
    //     bitSize: 32,
    //     bitOffset: 0,
    //     byteSize: 4,
    //     structure: {},
    //   });
    //   env.attachMember(structure, {
    //     type: MemberType.Uint,
    //     flags: MemberFlag.IsSelector,
    //     bitSize: 16,
    //     bitOffset: 64,
    //     byteSize: 2,
    //     structure: enumStructure,
    //   });
    //   env.attachTemplate(structure, {
    //     [MEMORY]: new DataView(new ArrayBuffer(10)),
    //     [SLOTS]: { 0: new Int32Ptr(new Int32(1234)) },
    //   });
    //   const Hello = env.defineStructure(structure);
    //   env.endStructure(structure);
    //   const object = new Hello({});
    //   expect(object.pointer['*']).to.equal(1234);
    //   object.$ = { number: 4567 };
    //   expect(object.pointer).to.be.null;
    //   object.$ = {};
    //   expect(object.pointer['*']).to.equal(1234);
    // })
    it('should complain about missing union initializer', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Hello({})).to.throw(TypeError)
        .with.property('message').that.contains('dog, cat')
      const object = new Hello({ cat: 4567 });
      expect(object.cat).to.equal(4567);
    })
    it('should throw when there is more than one initializer', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Hello({ dog: 1234, cat: 4567 })).to.throw(TypeError);
    })
    it('should throw when an unknown initializer is encountered', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Hello({ dogg: 1234 })).to.throw(TypeError)
        .with.property('message').that.contains('dogg');
    })
    it('should throw when constructor is given something other than an object', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Hello(5)).to.throw(TypeError);
    })
    it('should throw when attempting to set an active property', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({ dog: 1234 });
      expect(() => object.cat = 4567).to.throw(TypeError)
        .with.property('message').that.contains('dog')
    })
    it('should allow switching of active property through dollar property', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.HasSelector,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        flags: MemberFlag.IsRequired,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitSize: 16,
        bitOffset: 32,
        byteSize: 2,
        structure: {},
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({ dog: 1234 });
      object.$ = { cat: 4567 };
      expect(object.cat).to.equal(4567);
    })
    skip.
    it('should define an iterator union', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Union,
        flags: StructureFlag.IsExtern,
        name: 'Hello',
        byteSize: 4,
        isIterator: true,
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
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
        name: '*Hello',
        byteSize: 8,
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
      });
      env.attachMember(optStructure, {
        name: 'value',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(optStructure, {
        name: 'present',
        type: MemberType.Bool,
        bitSize: 8,
        bitOffset: 32,
        byteSize: 1,
        structure: {},
      });
      const Hello = env.defineStructure(optStructure);
      env.endStructure(optStructure);
      const argStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Argument',
        byteSize: 13,
      });
      env.attachMember(argStruct, {
        name: 'retval',
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 5,
        structure: optStructure,
      });
      env.attachMember(argStruct, {
        name: '0',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: optStructure.byteSize * 8,
        byteSize: 8,
        structure: ptrStructure,
        slot: 0,
      });
      env.defineStructure(argStruct);
      env.endStructure(argStruct);
      throw new Error('FIXME');
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