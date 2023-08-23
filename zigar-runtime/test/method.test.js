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
    it('should invoke the given thunk with the expected arguments for C++', function() {
      process.env.ZIGAR_TARGET = 'NODE-CPP-EXT';
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
    it('should return a promise when trunk returns a promise', async function() {
      process.env.ZIGAR_TARGET = 'WASM-RUNTIME';
      const argStruct = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
        [SLOTS]: { 0: {} },
      };
      let resolve, reject, ready = false;
      const promise = new Promise((r1, r2) => {
        resolve = r1;
        reject = r2;
      });
      let called = false;
      function thunk(args) {
        if (!ready) {
          return promise;
        }
        called = true;
        args.retval = 123;
      }
      const result = invokeThunk(thunk, argStruct);
      expect(result).to.be.a('promise');
      expect(called).to.be.false;
      ready = true;
      resolve();
      thunk(argStruct);
      const value = await result;
      expect(value).to.equal(123);
    })
    it('should throw an error if C++ addon returns a string', function() {
      process.env.ZIGAR_TARGET = 'NODE-CPP-EXT';
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
    it('should throw an error if WASM code returns a string', function() {
      process.env.ZIGAR_TARGET = 'WASM-RUNTIME';
      const argStruct = {
        [MEMORY]: new DataView(new ArrayBuffer(16)),
        [SLOTS]: { 0: {} },
      };
      function thunk(...args) {
        return `ChickensEvolvedIntoCats`;
      }
      expect(() => invokeThunk(thunk, argStruct)).to.throw(Error)
        .with.property('message').that.equals('Chickens evolved into cats') ;
    })

  })
  describe('addMethods', function() {
    beforeEach(function() {
      process.env.ZIGAR_TARGET = 'NODE-CPP-EXT';
      useStruct();
      useEnumeration();
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
        isSigned: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
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
        bitSize: structure.size * 8,
        bitOffset: 0,
        byteSize: structure.size,
        structure,
        slot: 0,
      });
      attachMember(argStruct, {
        name: 'retval',
        type: MemberType.Int,
        isSigned: true,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
      });
      const c = finalizeStructure(argStruct);
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
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      const argStruct = beginStructure({
        type: StructureType.Struct,
        name: 'Arguments',
        size: 12,
      });
      attachMember(argStruct, {
        name: '0',
        type: MemberType.EnumerationItem,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      attachMember(argStruct, {
        name: '1',
        type: MemberType.Int,
        isSigned: true,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      attachMember(argStruct, {
        name: 'retval',
        type: MemberType.Bool,
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
