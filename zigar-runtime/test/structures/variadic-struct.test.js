import { expect } from 'chai';
import { MemberType, PointerFlag, StructFlag, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { ArgumentCountMismatch, InvalidVariadicArgument, UndefinedArgument } from '../../src/errors.js';
import '../../src/mixins.js';
import { MEMORY, VISIT } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Structure: variadic-struct', function() {
  describe('defineVariadicStruct', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.VariadicStruct,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
        length: 1,
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
        length: 1,
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
      env.runtimeSafety = true;
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
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
        flags: StructureFlag.HasValue,
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
        flags: StructFlag.IsExtern,
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
        length: 2,
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
      expect(args1[0]).to.equal(123);
      expect(args1[1]).to.equal(456);
      expect(args1.retval).to.equal(777);
      expect(args1[MEMORY].byteLength).to.equal(12);
      const args2 = new VariadicStruct([ 123, 456, new Int32(1), new Int32(2) ], 'hello', 0);
      expect(args2[MEMORY].byteLength).to.equal(20);
      const args3 = new VariadicStruct([ 123, 456, new Int32(1), new Float64(2) ], 'hello', 0);
      expect(args3[MEMORY].byteLength).to.equal(24);
      const args4 = new VariadicStruct([ 123, 456, new Int32(1), new Struct({ number: 123 }) ], 'hello', 0);
      expect(args4[MEMORY].byteLength).to.equal(24);
      expect(() => new VariadicStruct([ 123 ], 'hello', 0)).to.throw(ArgumentCountMismatch);
      expect(() => new VariadicStruct([ undefined, 2 ], 'hello', 0)).to.throw(UndefinedArgument);
      expect(() => new VariadicStruct([ 123, 0xFFFF_FFFF_FFFFn ], 'hello', 0)).to.throw(TypeError);
      expect(() => new VariadicStruct([ 123, 456, 1, 2 ], 'hello', 0)).to.throw(InvalidVariadicArgument)
        .with.property('message').that.contains('args[2]');
    })
    it('should define an variadic argument struct containing a pointer argument', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
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
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
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
        length: 2,
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
        name: '0',
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: ptrStructure,
        slot: 1,
      });
      env.attachMember(structure, {
        name: '1',
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
      args1[VISIT](function({ isActive, isMutable }) {
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
        flags: StructureFlag.HasValue,
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
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
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
        length: 2,
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
        name: '0',
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: ptrStructure,
        slot: 1,
      });
      env.attachMember(structure, {
        name: '1',
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
      args1[VISIT](function({ isActive, isMutable }) {
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
