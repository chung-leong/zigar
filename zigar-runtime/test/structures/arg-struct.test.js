import { expect } from 'chai';
import {
  ArgStructFlag, MemberType, PointerFlag, StructFlag, StructureFlag, StructureType,
  VisitorFlag,
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { ArgumentCountMismatch, UndefinedArgument } from '../../src/errors.js';
import '../../src/mixins.js';
import { MEMORY, VISIT, ZIG } from '../../src/symbols.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Structure: arg-struct', function() {
  describe('defineArgStruct', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.ArgStruct,
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
        byteSize: 4 * 3,
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
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      expect(ArgStruct).to.be.a('function');
      const object = new ArgStruct([ 123, 456 ]);
      object.retval = 777;
      expect(object[0]).to.equal(123);
      expect(object[1]).to.equal(456);
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
        byteSize: childStructure.byteSize + 4 + 4,
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
        type: MemberType.Object,
        bitSize: childStructure.byteSize * 8,
        bitOffset: 32,
        byteSize: childStructure.byteSize,
        slot: 0,
        structure: childStructure,
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32 + childStructure.byteSize * 8,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new ArgStruct([ { dog: 1234, cat: 4567 }, 789 ]);
      object[0].valueOf();
      expect(object[0].valueOf()).to.eql({ dog: 1234, cat: 4567 });
    })
    it('should define an argument struct with pointer as return value', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
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
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | PointerFlag.IsSingle,
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
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: ptrStructure.byteSize * 2,
        length: 1,
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
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      const int = new Int32(1234);
      const object = new ArgStruct([ int ]);
      const pointers = [], mutabilities = [];
      object[VISIT](function(flags) {
        pointers.push(this);
        mutabilities.push(!(flags & VisitorFlag.IsImmutable));
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
        byteSize: 4 * 3,
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
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new ArgStruct([ 123 ])).to.throw(ArgumentCountMismatch);
      expect(() => new ArgStruct([ 123, 456, 789 ])).to.throw(ArgumentCountMismatch);
      expect(() => new ArgStruct([ 123, 456 ])).to.not.throw();
    })
    it('should throw when initialized with undefined arguments', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
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
        byteSize: 4 * 3,
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
        type: MemberType.Void,
        bitSize: 0,
        bitOffset: 64,
        byteSize: 0,
        structure: {},
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new ArgStruct([ undefined, undefined ])).to.throw(UndefinedArgument);
      expect(() => new ArgStruct([ 123, undefined ])).to.not.throw();
    })
    it('should throw with argument name in error message when an invalid argument is encountered', function() {
      const env = new Env();
      env.runtimeSafety = true;
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
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
        byteSize: 4 * 3,
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
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new ArgStruct([ 123, -456 ])).to.throw(TypeError)
        .with.property('message').that.contains('args[1]');
    })
    it('should define an argument struct for async call', function() {
      const env = new Env();
      const voidStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'void',
        byteSize: 0,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(voidStructure, {
        type: MemberType.Void,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: voidStructure,
      });
      env.defineStructure(voidStructure);
      env.endStructure(voidStructure);
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
      const resolveArgStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Resolve',
        byteSize: 4,
        length: 1,
      });
      env.attachMember(resolveArgStructure, {
        name: 'retval',
        type: MemberType.Void,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: voidStructure,
      });
      env.attachMember(resolveArgStructure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(resolveArgStructure);
      env.endStructure(resolveArgStructure);
      const resolveStructure = env.beginStructure({
        type: StructureType.Function,
        name: 'fn(i32) void',
        byteSize: 0,
      });
      env.attachMember(resolveStructure, {
        type: MemberType.Object,
        structure: resolveArgStructure,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(resolveStructure, thunk, false);
      const jsThunkController = { [MEMORY]: zig(0x2004) };
      env.attachTemplate(resolveStructure, jsThunkController, true);
      env.defineStructure(resolveStructure);
      env.endStructure(resolveStructure);
      const resolvePtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*const fn(i32) void',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
      });
      env.attachMember(resolvePtrStructure, {
        type: MemberType.Object,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: resolveStructure,
        slot: 0,
      });
      env.defineStructure(resolvePtrStructure);
      env.endStructure(resolvePtrStructure);
      const promiseStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Promise',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | StructFlag.IsPromise,
      });
      env.attachMember(promiseStructure, {
        name: 'callback',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: resolvePtrStructure,
        slot: 0,
      });
      env.defineStructure(promiseStructure);
      env.endStructure(promiseStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | ArgStructFlag.HasOptions | ArgStructFlag.IsAsync,
        byteSize: 8 + 4,
        length: 1,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Void,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: voidStructure,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: promiseStructure,
        slot: 0,
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      expect(ArgStruct).to.be.a('function');
      env.createJsThunk = function(controllerAddress, fnId) {
        return usize(0xf000);
      };
      expect(() => new ArgStruct([ 123 ])).to.not.throw();
      expect(() => new ArgStruct([ 123, {} ])).to.not.throw();
      expect(() => new ArgStruct([ 123, { callback: () => {} } ])).to.not.throw();
      expect(() => new ArgStruct([ 123, { callback: 1234 } ])).to.throw(TypeError);
    })
  })
})

function zig(address, len = 0) {
  const dv = new DataView(new ArrayBuffer(len));
  dv[ZIG] = { address: usize(address), len };
  return dv;
}
