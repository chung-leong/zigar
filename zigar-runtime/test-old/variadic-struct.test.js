import { expect } from 'chai';
import 'mocha-skip-if';

import { WebAssemblyEnvironment } from '../src/environment-wasm.js';
import { ArgumentCountMismatch, InvalidVariadicArgument } from '../src/error.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import { MEMORY, POINTER_VISITOR } from '../src/symbol.js';
import { MemberType, StructureType } from '../src/types.js';

describe('VariadicStruct functions', function() {
  const env = new WebAssemblyEnvironment();
  describe('defineVariadicStruct', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
    })
    it('should define an variadic argument struct', function() {
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
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
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
      });
      env.finalizeShape(floatStructure);
      env.finalizeStructure(floatStructure);
      const { constructor: Float64 } = floatStructure;
      const structStructure = env.beginStructure({
        type: StructureType.ExternStruct,
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
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const { constructor: Struct } = structStructure;
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
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: VariadicStruct } = structure;
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
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*i32',
        byteSize: 4,
        align: 4,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.VariadicStruct,
        name: 'Hello',
        byteSize: 4 + 4 + 4,
        align: 4,
        hasPointer: true,
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
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: VariadicStruct } = structure;
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
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*i32',
        byteSize: 4,
        align: 4,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.VariadicStruct,
        name: 'Hello',
        byteSize: 4 + 4 + 4,
        align: 4,
        hasPointer: true,
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
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: VariadicStruct } = structure;
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

