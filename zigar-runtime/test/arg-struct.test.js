import { expect } from 'chai';
import 'mocha-skip-if';

import {
  MemberType,
  useIntEx,
  useUintEx,
  useObject,
} from '../src/member.js';
import {
  StructureType,
  useArgStruct,
  useStruct,
  usePointer,
  usePrimitive,
} from '../src/structure.js';
import { NodeEnvironment } from '../src/environment.js'

describe('ArgStruct functions', function() {
  const env = new NodeEnvironment();
  describe('finalizeArgStruct', function() {
    beforeEach(function() {
      useArgStruct();
      usePointer();
      usePrimitive();
      useIntEx();
      useUintEx();
      useStruct();
      useObject();
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
      const ArgStruct = env.finalizeStructure(structure);
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
      const ArgStruct = env.finalizeStructure(structure);
      const object = new ArgStruct([ { dog: 1234, cat: 4567 }, 789 ]);
      expect(object.pet.valueOf()).to.eql({ dog: 1234, cat: 4567 });
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
      const ArgStruct = env.finalizeStructure(structure);
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
      const ArgStruct = env.finalizeStructure(structure);
      expect(() => new ArgStruct([ 123, 456n ])).to.throw(TypeError)
        .with.property('message').that.contains('args[1]');
    })
  })
})