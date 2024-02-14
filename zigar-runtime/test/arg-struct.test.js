import { expect } from 'chai';
import 'mocha-skip-if';

import { NodeEnvironment } from '../src/environment-node.js';
import { MemberType, useAllMemberTypes } from '../src/member.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import { POINTER_VISITOR } from '../src/symbol.js';

describe('ArgStruct functions', function() {
  const env = new NodeEnvironment();
  describe('defineArgStruct', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
    })
    it('should define an argument struct', function() {
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 4 * 3,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: ArgStruct } = structure;
      expect(ArgStruct).to.be.a('function');
      const object = new ArgStruct([ 123, 456 ]);
      object.retval = 777;
      expect(object.cat).to.equal(123);
      expect(object.dog).to.equal(456);
      expect(object.retval).to.equal(777);
    })
    it('should define an argument struct that contains a struct', function() {
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
      });
      env.attachMember(childStructure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.finalizeShape(childStructure);
      env.finalizeStructure(childStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: childStructure.byteSize + 4 + 4,
      });
      env.attachMember(structure, {
        name: 'pet',
        type: MemberType.Object,
        bitSize: childStructure.byteSize * 8,
        bitOffset: 0,
        byteSize: childStructure.byteSize,
        slot: 0,
        structure: childStructure,
      });
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: childStructure.byteSize * 8,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: ArgStruct } = structure;
      const object = new ArgStruct([ { dog: 1234, cat: 4567 }, 789 ]);
      expect(object.pet.valueOf()).to.eql({ dog: 1234, cat: 4567 });
    })
    it('should define an argument struct with pointer as return value', function() {      
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
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*i32',
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
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: ptrStructure.byteSize * 2,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        bitSize: ptrStructure.byteSize * 8,
        bitOffset: 0,
        byteSize: ptrStructure.byteSize,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Object,
        bitSize: ptrStructure.byteSize * 8,
        bitOffset: ptrStructure.byteSize * 8,
        byteSize: ptrStructure.byteSize,
        slot: 1,
        structure: ptrStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Int32 } = intStructure;
      const { constructor: ArgStruct } = structure;
      const int = new Int32(1234);
      const object = new ArgStruct([ int ]);
      const pointers = [], mutabilities = [];
      object[POINTER_VISITOR](function({ isMutable }) {
        pointers.push(this);
        mutabilities.push(isMutable(this));
      }, { vivificate: true });
      expect(pointers).to.have.lengthOf(2);
      expect(pointers[0]).to.equal(object['0']);
      expect(pointers[1]).to.equal(object['retval']);
      expect(mutabilities[0]).to.be.false;
      expect(mutabilities[1]).to.be.true;
    })
    it('should throw when initialized with the wrong number of arguments', function() {
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 4 * 3,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: ArgStruct } = structure;
      expect(() => new ArgStruct([ 123 ])).to.throw();
      expect(() => new ArgStruct([ 123, 456, 789 ])).to.throw();
    })
    it('should throw with argument name in error message when an invalid argument is encountered', function() {
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 4 * 3,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: ArgStruct } = structure;
      expect(() => new ArgStruct([ 123, -456 ])).to.throw(TypeError)
        .with.property('message').that.contains('args[1]');
    })
  })
})