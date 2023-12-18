import { expect } from 'chai';

import { MemberType, useAllMemberTypes } from '../src/member.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import { NodeEnvironment } from '../src/environment-node.js';

describe('Method functions', function() {
  beforeEach(function() {
    useAllMemberTypes();
    useAllStructureTypes();
  })
  const env = new NodeEnvironment();
  describe('addMethods', function() {
    it('should attach methods to a struct', function() {
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
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
      const argStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Argument',
        byteSize: 12,
      });
      env.attachMember(argStruct, {
        name: '0',
        type: MemberType.Object,
        bitSize: structure.byteSize * 8,
        bitOffset: 0,
        byteSize: structure.byteSize,
        structure,
        slot: 0,
      });
      env.attachMember(argStruct, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
      });
      env.finalizeShape(argStruct);
      env.finalizeStructure(argStruct);
      let recv;
      const thunk = function(dv) {
        recv = this;
        const dog = dv.getInt32(0, true);
        const cat = dv.getInt32(4, true);
        dv.setInt32(8, dog + cat, true);
      };
      env.attachMethod(structure, {
        name: 'merge',
        argStruct,
        isStaticOnly: false,
        thunk,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({});
      expect(Hello.merge).to.be.a('function');
      expect(Hello.merge).to.have.property('name', 'merge');
      expect(Hello.prototype.merge).to.be.a('function');
      expect(Hello.prototype.merge).to.have.property('name', 'merge');
      object.dog = 10;
      object.cat = 13;
      const res1 = object.merge();
      expect(recv).to.be.equal(env);
      expect(res1).to.equal(23);
      const res2 = Hello.merge(object);
      expect(res2).to.equal(23);
    })
    it('should attach methods to enum items', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const argStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Arguments',
        byteSize: 12,
      });
      env.attachMember(argStruct, {
        name: '0',
        type: MemberType.EnumerationItem,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      env.attachMember(argStruct, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachMember(argStruct, {
        name: 'retval',
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 64,
        byteSize: 1,
      });
      env.finalizeStructure(argStruct);
      let recv, arg1, arg2;
      const thunk = function(dv) {
        recv = this;
        arg1 = dv.getInt32(0, true);
        arg2 = dv.getInt32(4, true);
        dv.setInt32(8, 1, true);
      };
      env.attachMethod(structure, {
        name: 'foo',
        argStruct,
        isStaticOnly: false,
        thunk,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(Hello.foo).to.be.a('function');
      expect(Hello.foo).to.have.property('name', 'foo');
      expect(Hello.prototype.foo).to.be.a('function');
      expect(Hello.prototype.foo).to.have.property('name', 'foo');
      const res1 = Hello.Cat.foo(1234);
      expect(recv).to.equal(env);
      expect(res1).to.be.true;
      expect(arg1).to.equal(Number(Hello.Cat));
      expect(arg2).to.equal(1234);
      const res2 = Hello.foo(Hello.Dog, 4567);
      expect(res2).to.be.true;
      expect(arg1).to.equal(Number(Hello.Dog));
      expect(arg2).to.equal(4567);
    })
    it('should attach getter and setter to a struct', function() {
      const env = new NodeEnvironment();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
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
      const getterArgStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Argument',
        byteSize: 12,
      });
      env.attachMember(getterArgStruct, {
        name: '0',
        type: MemberType.Object,
        bitSize: structure.byteSize * 8,
        bitOffset: 0,
        byteSize: structure.byteSize,
        structure,
        slot: 0,
      });
      env.attachMember(getterArgStruct, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
      });
      env.finalizeShape(getterArgStruct);
      env.finalizeStructure(getterArgStruct);
      env.attachMethod(structure, {
        name: 'get  apple',
        argStruct: getterArgStruct,
        isStaticOnly: false,
        thunkId: 1,
      });
      const setterArgStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Argument',
        byteSize: 12,
      });
      env.attachMember(setterArgStruct, {
        name: '0',
        type: MemberType.Object,
        bitSize: structure.byteSize * 8,
        bitOffset: 0,
        byteSize: structure.byteSize,
        structure,
        slot: 0,
      });
      env.attachMember(setterArgStruct, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
      });
      env.attachMember(setterArgStruct, {
        name: 'retval',
        type: MemberType.Void,
        bitSize: 0,
        bitOffset: 96,
        byteSize: 0,
      });
      env.finalizeShape(setterArgStruct);
      env.finalizeStructure(setterArgStruct);
      env.attachMethod(structure, {
        name: 'set apple',
        argStruct: setterArgStruct,
        isStaticOnly: false,
        thunkId: 2,
      });
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello({ dog: 1, cat: 2 });
      let apple = 123;
      env.invokeThunk = (thunkId, args) => {
        switch (thunkId) {
          case 1: // getter
             args.retval = apple;
            break;
          case 2: // setter
            apple = args[1];
            break;
        }
        return args.retval;
      };
      expect(object.apple).to.equal(123);
      object.apple = 456;
      expect(apple).to.equal(456);
    })
    it('should attach static getter and setter to a struct', function() {
      const env = new NodeEnvironment();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 0,
      });
      env.finalizeShape(structure);
      const getterArgStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Argument',
        byteSize: 4,
      });
      env.attachMember(getterArgStruct, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(getterArgStruct);
      env.finalizeStructure(getterArgStruct);
      env.attachMethod(structure, {
        name: 'get apple',
        argStruct: getterArgStruct,
        isStaticOnly: false,
        thunkId: 1,
      });
      const setterArgStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Argument',
        byteSize: 4,
      });
      env.attachMember(setterArgStruct, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(setterArgStruct, {
        name: 'retval',
        type: MemberType.Void,
        bitSize: 0,
        bitOffset: 32,
        byteSize: 0,
      });
      env.finalizeShape(setterArgStruct);
      env.finalizeStructure(setterArgStruct);
      env.attachMethod(structure, {
        name: 'set apple',
        argStruct: setterArgStruct,
        isStaticOnly: false,
        thunkId: 2,
      });
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      let apple = 123;
      env.invokeThunk = (thunkId, args) => {
        switch (thunkId) {
          case 1: // getter
             args.retval = apple;
            break;
          case 2: // setter
            apple = args[0];
            break;
        }
        return args.retval;
      };
      expect(Hello.apple).to.equal(123);
      Hello.apple = 456;
      expect(apple).to.equal(456);
    })
  })
})
