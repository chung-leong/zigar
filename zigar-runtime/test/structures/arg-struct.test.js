import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorBool from '../../src/accessors/bool.js';
import AccessorFloat128 from '../../src/accessors/float128.js';
import AccessorIntUnaligned from '../../src/accessors/int-unaligned.js';
import AccessorUintUnaligned from '../../src/accessors/uint-unaligned.js';
import AccessorUnaligned from '../../src/accessors/unaligned.js';
import { MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { ArgumentCountMismatch } from '../../src/errors.js';
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
import MemberUint from '../../src/members/uint.js';
import All from '../../src/structures/all.js';
import ArgStruct, {
  isNeededByStructure,
} from '../../src/structures/arg-struct.js';
import Primitive from '../../src/structures/primitive.js';
import StructLike from '../../src/structures/struct-like.js';
import Struct from '../../src/structures/struct.js';

const Env = defineClass('StructureTest', [
  AccessorAll, MemberInt, MemberPrimitive, MemberAll, All, Primitive, DataCopying,
  StructureAcquisition, ViewManagement, ArgStruct, AccessorBool, AccessorFloat128, RuntimeSafety,
  MemberBool, MemberUint, AccessorIntUnaligned, AccessorUintUnaligned, AccessorUnaligned,
  MemberObject, Struct, StructLike, SpecialMethods,
]);

describe('Structure: arg-struct', function() {
  describe('isNeededByStructure', function() {
    it('should return true when mixin is needed by a structure', function() {
      const structure = {
        type: StructureType.ArgStruct
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
  describe('defineArgStruct', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          name: "retval",
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 0,
          byteSize: 4,
          structure: {},
        },
        {
          name: "0",
          type: MemberType.Bool,
          bitSize: 1,
          bitOffset: 32,
          byteSize: 1,
          structure: {},
        },
      ];
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineArgStruct(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          name: "retval",
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 0,
          byteSize: 4,
          structure: {},
        },
        {
          name: "0",
          type: MemberType.Bool,
          bitSize: 1,
          bitOffset: 32,
          byteSize: 1,
          structure: {},
        },
      ];
      const env = new Env();
      const descriptors = {};
      env.defineArgStruct(structure, descriptors);
      expect(descriptors.retval?.get).to.be.a('function');
      expect(descriptors.retval?.set).to.be.a('function');
      expect(descriptors[0]?.get).to.be.a('function');
      expect(descriptors[0]?.set).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define an argument struct', function() {
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
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 4 * 3,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      expect(ArgStruct).to.be.a('function');
      const object = new ArgStruct([ 123, 456 ], 'hello', 0);
      object.retval = 777;
      expect(object.cat).to.equal(123);
      expect(object.dog).to.equal(456);
      expect(object.retval).to.equal(777);
    })
    it('should define an argument struct that contains a struct', function() {
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
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const childStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(childStructure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(childStructure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(childStructure);
      env.endStructure(childStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: childStructure.byteSize + 4 + 4,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: 'pet',
        type: MemberType.Object,
        bitSize: childStructure.byteSize * 8,
        bitOffset: 32,
        byteSize: childStructure.byteSize,
        slot: 0,
        structure: childStructure,
      });
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32 + childStructure.byteSize * 8,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new ArgStruct([ { dog: 1234, cat: 4567 }, 789 ], 'hello', 0);
      object.pet.valueOf();
      expect(object.pet.valueOf()).to.eql({ dog: 1234, cat: 4567 });
    })
    it('should define an argument struct with pointer as return value', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      })
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.IsSingle,
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
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: ptrStructure.byteSize * 2,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Object,
        bitSize: ptrStructure.byteSize * 8,
        bitOffset: 0,
        byteSize: ptrStructure.byteSize,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        bitSize: ptrStructure.byteSize * 8,
        bitOffset: ptrStructure.byteSize * 8,
        byteSize: ptrStructure.byteSize,
        slot: 1,
        structure: ptrStructure,
      });
      env.defineStructure(structure);
      const ArgStruct = env.endStructure(structure);
      const int = new Int32(1234);
      const object = new ArgStruct([ int ], 'hello', 0);
      const pointers = [], mutabilities = [];
      object[POINTER_VISITOR](function({ isMutable }) {
        pointers.push(this);
        mutabilities.push(isMutable(this));
      }, { vivificate: true });
      expect(pointers).to.have.lengthOf(2);
      expect(pointers[0]).to.equal(object['retval']);
      expect(pointers[1]).to.equal(object['0']);
      expect(mutabilities[0]).to.be.true;
      expect(mutabilities[1]).to.be.false;
    })
    it('should throw when initialized with the wrong number of arguments', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      })
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 4 * 3,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new ArgStruct([ 123 ], 'hello', 0)).to.throw(ArgumentCountMismatch);
      expect(() => new ArgStruct([ 123, 456, 789 ], 'hello', 0)).to.throw(ArgumentCountMismatch);
    })
    it('should throw with argument name in error message when an invalid argument is encountered', function() {
      const env = new Env();
      env.runtimeSafety = true;
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      })
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 4 * 3,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new ArgStruct([ 123, -456 ], 'hello', 0)).to.throw(TypeError)
        .with.property('message').that.contains('args[1]');
    })
  })
})