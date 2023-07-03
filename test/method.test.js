import { expect } from 'chai';

import {
  MemberType,
  useBool,
  useIntEx,
  useFloatEx,
  useEnumerationItem,
  useObject,
} from '../src/member.js';
import {
  StructureType,
  useStruct,
  useEnumeration,
  beginStructure,
  attachMember,
  attachMethod,
  attachTemplate,
  finalizeStructure,
} from '../src/structure.js';
import { MEMORY, SLOTS, ZIG } from '../src/symbol.js';
import {
  invokeThunk,
} from '../src/method.js';

describe('Method functions', function() {
  describe('invokeThunk', function() {
    beforeEach(function() {
      useStruct();
      useEnumeration();
      useIntEx();
      useBool();
      useFloatEx();
      useEnumerationItem();
      useObject();
    })
    it('should invoke the given thunk with the expected arguments', function() {
      const argStruct = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
        [SLOTS]: { 0: {} },
      };
      let recv, slots, symbol1, symbol2, symbol3;
      function thunk(...args) {
        recv = this;
        slots = args[0];
        symbol1 = args[1];
        symbol2 = args[2];
        symbol3 = args[3];
      }
      invokeThunk(thunk, argStruct);
      expect(recv).to.be.equal(argStruct);
      expect(slots).to.be.an('object');
      expect(symbol1).to.equal(SLOTS);
      expect(symbol2).to.equal(MEMORY);
      expect(symbol3).to.equal(ZIG);
    })
    it('should throw an error if the thunk returns a string', function() {
      const argStruct = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
        [SLOTS]: { 0: {} },
      };
      function thunk(...args) {
        return `JellyDonutInsurrection`;
      }
      expect(() => invokeThunk(thunk, argStruct)).to.throw(Error)
        .with.property('message').that.equals('Jelly donut insurrection') ;
    })
  })
  describe('addMethods', function() {
    beforeEach(function() {
      useStruct();
      useBool();
      useIntEx();
      useFloatEx();
      useEnumerationItem();
      useObject();
    })
    it('should attach methods to a struct', function() {
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      const argStruct = beginStructure({
        type: StructureType.Struct,
        name: 'Argument',
        size: 12,
      });
      attachMember(argStruct, {
        name: '0',
        type: MemberType.Object,
        isStatic: false,
        bitSize: structure.size * 8,
        bitOffset: 0,
        byteSize: structure.size,
        structure,
      });
      attachMember(argStruct, {
        name: 'retval',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
      });
      finalizeStructure(argStruct);
      const thunk = function() {
        this.retval = this[0].dog + this[0].cat;
      };
      attachMethod(structure, {
        name: 'merge',
        argStruct,
        isStaticOnly: false,
        thunk,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello();
      expect(Hello.merge).to.be.a('function');
      expect(Hello.merge).to.have.property('name', 'merge');
      expect(Hello.prototype.merge).to.be.a('function');
      expect(Hello.prototype.merge).to.have.property('name', 'merge');
      object.dog = 10;
      object.cat = 13;
      const res1 = object.merge();
      expect(res1).to.equal(23);
      const res2 = Hello.merge(object);
      expect(res2).to.equal(23);
    })
    it('should attach methods to enum items', function() {
      const structure = beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        size: 4,
      });
      attachMember(structure, {
        name: 'Dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(4 * 2));
            dv.setUint32(0, 0, true);
            dv.setUint32(4, 1, true);
            return dv;
          })(),
          [SLOTS]: {},
        }
      });
      const argStruct = beginStructure({
        type: StructureType.Struct,
        name: 'Arguments',
        size: 12,
      });
      attachMember(argStruct, {
        name: '0',
        type: MemberType.EnumerationItem,
        isStatic: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      attachMember(argStruct, {
        name: '1',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      attachMember(argStruct, {
        name: 'retval',
        type: MemberType.Bool,
        isStatic: false,
        bitSize: 1,
        bitOffset: 64,
        byteSize: 1,
      });
      finalizeStructure(argStruct);
      let arg1, arg2, symbol1, symbol2, argDV, slots;
      const thunk = function(...args) {
        slots = args[0];
        symbol1 = args[1];
        symbol2 = args[2];
        arg1 = this[0];
        arg2 = this[1];
        this.retval = true;
        argDV = this[symbol2];
      };
      attachMethod(structure, {
        name: 'foo',
        argStruct,
        isStaticOnly: false,
        thunk,
      });
      const Hello = finalizeStructure(structure);
      expect(Hello.foo).to.be.a('function');
      expect(Hello.foo).to.have.property('name', 'foo');
      expect(Hello.prototype.foo).to.be.a('function');
      expect(Hello.prototype.foo).to.have.property('name', 'foo');
      const res1 = Hello.Cat.foo(1234);
      expect(res1).to.be.true;
      expect(arg1).to.equal(Hello.Cat);
      expect(arg2).to.equal(1234);
      const res2 = Hello.foo(Hello.Dog, 4567);
      expect(res2).to.be.true;
      expect(arg1).to.equal(Hello.Dog);
      expect(arg2).to.equal(4567);
      expect(symbol1).to.be.a('symbol');
      expect(symbol2).to.be.a('symbol');
      expect(slots).to.be.an('object');
      expect(argDV).to.be.an.instanceOf(DataView);
      expect(argDV).to.have.property('byteLength', 12);
    })
  })
})
