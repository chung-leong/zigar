import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorBool from '../../src/accessors/bool.js';
import AccessorFloat128 from '../../src/accessors/float128.js';
import AccessorJumboInt from '../../src/accessors/jumbo-int.js';
import AccessorJumbo from '../../src/accessors/jumbo.js';
import { MemberFlag, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import DataCopying from '../../src/features/data-copying.js';
import StructureAcquisition from '../../src/features/structure-acquisition.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll from '../../src/members/all.js';
import MemberBool from '../../src/members/bool.js';
import MemberFloat from '../../src/members/float.js';
import MemberInt from '../../src/members/int.js';
import MemberObject from '../../src/members/object.js';
import MemberPrimitive from '../../src/members/primitive.js';
import SpecialMethods from '../../src/members/special-methods.js';
import SpecialProps from '../../src/members/special-props.js';
import MemberTyp from '../../src/members/type.js';
import All from '../../src/structures/all.js';
import Optional, {
  isNeededByStructure,
} from '../../src/structures/optional.js';
import Primitive from '../../src/structures/primitive.js';
import StructLike from '../../src/structures/struct-like.js';
import Struct from '../../src/structures/struct.js';
import { INITIALIZE } from '../../src/symbols.js';

const Env = defineClass('OptionalTest', [
  AccessorAll, MemberInt, MemberPrimitive, MemberAll, All, Primitive, DataCopying, SpecialMethods,
  SpecialProps, StructureAcquisition, ViewManagement, MemberTyp, AccessorJumbo, AccessorJumboInt,
  Optional, AccessorBool, AccessorFloat128, MemberBool, MemberFloat, MemberObject, Struct,
  StructLike,
]);

describe('Structure: optional', function() {
  describe('isNeededByStructure', function() {
    it('should return true when mixin is needed by a structure', function() {
      const structure = {
        type: StructureType.Optional
      };
      expect(isNeededByStructure(structure)).to.be.true;
    })
    it('should return false when mixin is needed by a structure', function() {
      const structure = {
        type: StructureType.Struct
      };
      expect(isNeededByStructure(structure)).to.be.false;
    })
  })
  describe('defineOptional', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
        flags: StructureFlag.HasSelector,
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
      const constructor = env.defineOptional(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
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
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 18,
        flags: StructureFlag.HasSelector,
      });
      env.attachMember(structure, {
        type: MemberType.Float,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        structure: {
          type: StructureType.Primitive,
        }
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
        flags: MemberFlag.IsSelector,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
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
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 18,
        flags: StructureFlag.HasSelector,
      });
      env.attachMember(structure, {
        type: MemberType.Float,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        structure: {
          type: StructureType.Primitive,
        }
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
        flags: MemberFlag.IsSelector,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const buffer = new ArrayBuffer(18);
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
    })
    it('should throw when no initializer is provided', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 18,
        flags: StructureFlag.HasSelector,
      });
      env.attachMember(structure, {
        type: MemberType.Float,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        structure: {
          type: StructureType.Primitive,
        }
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
        flags: MemberFlag.IsSelector,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should initialize an optional value based on argument given', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 18,
        flags: StructureFlag.HasSelector,
      });
      env.attachMember(structure, {
        type: MemberType.Float,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        structure: {
          type: StructureType.Primitive,
        }
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
        flags: MemberFlag.IsSelector,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(null);
      expect(object.$).to.equal(null);
      object.$ = 3.14;
      expect(object.$).to.equal(3.14);
    })
    it('should initialize an optional value from object of same type', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 18,
        flags: StructureFlag.HasSelector,
      });
      env.attachMember(structure, {
        type: MemberType.Float,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
        structure: {
          type: StructureType.Primitive,
        }
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
        flags: MemberFlag.IsSelector,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      object.$ = 3.14;
      const object2 = new Hello(object);
      expect(object2.$).to.equal(3.14);
    })
    it('should define a structure for storing an optional struct', function() {
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
      const { constructor: Animal } = structStructure;
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 18,
        flags: StructureFlag.HasSelector | StructureFlag.HasValue | StructureFlag.HasSlot | StructureFlag.HasObject,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
        flags: MemberFlag.IsSelector,
        structure: {},
      });
      env.defineStructure(structure);
      env.endStructure(structure);
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
  })
})