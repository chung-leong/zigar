import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorBool from '../../src/accessors/bool.js';
import AccessorFloat128 from '../../src/accessors/float128.js';
import AccessorIntUnaligned from '../../src/accessors/int-unaligned.js';
import AccessorUintUnaligned from '../../src/accessors/uint-unaligned.js';
import AccessorUnaligned from '../../src/accessors/unaligned.js';
import { MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { ArgumentCountMismatch, InvalidVariadicArgument } from '../../src/errors.js';
import DataCopying from '../../src/features/data-copying.js';
import RuntimeSafety from '../../src/features/runtime-safety.js';
import StructureAcquisition from '../../src/features/structure-acquisition.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll from '../../src/members/all.js';
import MemberBool from '../../src/members/bool.js';
import MemberFloat from '../../src/members/float.js';
import MemberInt from '../../src/members/int.js';
import MemberObject from '../../src/members/object.js';
import MemberPrimitive from '../../src/members/primitive.js';
import SpecialMethods from '../../src/members/special-methods.js';
import MemberUint from '../../src/members/uint.js';
import All from '../../src/structures/all.js';
import Primitive from '../../src/structures/primitive.js';
import StructLike from '../../src/structures/struct-like.js';
import Struct from '../../src/structures/struct.js';
import VariadicStruct, {
  isNeededByStructure,
} from '../../src/structures/variadic-struct.js';
import { MEMORY } from '../../src/symbols.js';

const Env = defineClass('StructureTest', [
  AccessorAll, MemberInt, MemberPrimitive, MemberAll, All, Primitive, DataCopying,
  StructureAcquisition, ViewManagement, VariadicStruct, AccessorBool, AccessorFloat128,
  RuntimeSafety, MemberBool, MemberUint, AccessorIntUnaligned, AccessorUintUnaligned,
  AccessorUnaligned, MemberObject, Struct, StructLike, SpecialMethods, MemberFloat,
]);

describe('Structure: variadic-struct', function() {
  describe('isNeededByStructure', function() {
    it('should return true when mixin is needed by a structure', function() {
      const structure = {
        type: StructureType.VariadicStruct
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
  describe('defineVariadicStruct', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.VariadicStruct,
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
      const constructor = env.defineVariadicStruct(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.VariadicStruct,
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
      env.defineVariadicStruct(structure, descriptors);
      expect(descriptors.retval?.get).to.be.a('function');
      expect(descriptors.retval?.set).to.be.a('function');
      expect(descriptors[0]?.get).to.be.a('function');
      expect(descriptors[0]?.set).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define an variadic argument struct', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
        align: 4,
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
      const floatStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'f64',
        byteSize: 8,
        align: 8,
      });
      env.attachMember(floatStructure, {
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: floatStructure,
      });
      const Float64 = env.defineStructure(floatStructure);
      env.endStructure(floatStructure);
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.IsExtern,
        name: 'Struct',
        byteSize: 8,
        align: 8,
      });
      env.attachMember(structStructure, {
        name: 'number',
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: floatStructure,
      });
      const Struct = env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const structure = env.beginStructure({
        type: StructureType.VariadicStruct,
        name: 'Hello',
        byteSize: 4 * 3,
        align: 4,
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
      const VariadicStruct = env.defineStructure(structure);
      env.endStructure(structure);
      expect(VariadicStruct).to.be.a('function');
      const args1 = new VariadicStruct([ 123, 456 ], 'hello', 0);
      args1.retval = 777;
      expect(args1.cat).to.equal(123);
      expect(args1.dog).to.equal(456);
      expect(args1.retval).to.equal(777);
      expect(args1[MEMORY].byteLength).to.equal(12);
      const args2 = new VariadicStruct([ 123, 456, new Int32(1), new Int32(2) ], 'hello', 0);
      expect(args2[MEMORY].byteLength).to.equal(20);
      const args3 = new VariadicStruct([ 123, 456, new Int32(1), new Float64(2) ], 'hello', 0);
      expect(args3[MEMORY].byteLength).to.equal(24);
      const args4 = new VariadicStruct([ 123, 456, new Int32(1), new Struct({ number: 123 }) ], 'hello', 0);
      expect(args4[MEMORY].byteLength).to.equal(24);
      expect(() => new VariadicStruct([ 123 ], 'hello', 0)).to.throw(ArgumentCountMismatch);
      expect(() => new VariadicStruct([ 123, 0xFFFF_FFFF_FFFFn ], 'hello', 0)).to.throw(TypeError);
      expect(() => new VariadicStruct([ 123, 456, 1, 2 ], 'hello', 0)).to.throw(InvalidVariadicArgument)
        .with.property('message').that.contains('args[2]');
    })
    it('should define an variadic argument struct containing a pointer argument', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
        align: 4,
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
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
        name: '*i32',
        byteSize: 4,
        align: 4,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.VariadicStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: 4 + 4 + 4,
        align: 4,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
        slot: 0,
      });
      env.attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: ptrStructure,
        slot: 1,
      });
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const VariadicStruct = env.defineStructure(structure);
      env.endStructure(structure);
      expect(VariadicStruct).to.be.a('function');
      const args1 = new VariadicStruct([ 88, -123 ], 'hello', 0);
      expect(args1[MEMORY].byteLength).to.equal(12);
      const pointers = [], active = [], mutable = [];
      args1[POINTER_VISITOR](function({ isActive, isMutable }) {
        pointers.push(this);
        active.push(isActive());
        mutable.push(isMutable());
      }, { vivificate: true });
      expect(pointers).to.have.lengthOf(1);
      expect(pointers[0]['*']).to.equal(88);
      expect(active).to.eql([ true ]);
      expect(mutable).to.eql([ false ]);
    })
    it('should define an variadic argument struct containing a pointer argument and pointer retval', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
        align: 4,
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
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
        name: '*i32',
        byteSize: 4,
        align: 4,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.VariadicStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: 4 + 4 + 4,
        align: 4,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: ptrStructure,
        slot: 0,
      });
      env.attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: ptrStructure,
        slot: 1,
      });
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const VariadicStruct = env.defineStructure(structure);
      env.endStructure(structure);
      expect(VariadicStruct).to.be.a('function');
      const args1 = new VariadicStruct([ 88, -123 ], 'hello', 0);
      expect(args1[MEMORY].byteLength).to.equal(12);
      const pointers = [], active = [], mutable = [];
      args1[POINTER_VISITOR](function({ isActive, isMutable }) {
        pointers.push(this);
        active.push(isActive());
        mutable.push(isMutable());
      }, { vivificate: true });
      expect(pointers).to.have.lengthOf(2);
      expect(pointers[1]['*']).to.equal(88);
      expect(active).to.eql([ true, true ]);
      expect(mutable).to.eql([ false, false ]);
    })
  })
})
