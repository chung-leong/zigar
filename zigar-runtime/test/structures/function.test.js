import { expect } from 'chai';
import { CallResult, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ENVIRONMENT, MEMORY, SIZE, ZIG } from '../../src/symbols.js';
import { defineProperty } from '../../src/utils.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Structure: function', function() {
  describe('defineStructure', function() {
    it('should define a function type', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
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
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        byteSize: 4 * 3,
        length: 2,
      });
      env.attachMember(argStructure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(argStructure);
      env.endStructure(argStructure);
      const structure = env.beginStructure({
        type: StructureType.Function,
        name: 'fn(i32, i32) i32',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        structure: argStructure,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(structure, thunk, false);
      const constructor = env.defineStructure(structure);
      expect(constructor).to.be.a('function');
      const dv = zig(0x2008);
      const f = constructor.call(ENVIRONMENT, dv);
      expect(f).to.be.a('function');
      expect(f).to.be.an.instanceOf(constructor);
      expect(f.constructor).to.equal(constructor);
      expect(f).to.be.an.instanceOf(Function);
      const f2 = constructor.call(ENVIRONMENT, dv);
      expect(f2).to.equal(f);
      expect(f.name).to.equal('');
      defineProperty(f, 'name', { value: 'dingo' });
      expect(f.name).to.equal('dingo');
      let thunkAddress, fnAddress, argAddress, argBuffer;
      env.runThunk = (...args) => {
        thunkAddress = args[0];
        fnAddress = args[1];
        argAddress = args[2];
        return true;
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
        env.allocateExternMemory = function(address, len) {
          return usize(0x4000);
        };
        env.freeExternMemory = function() {
        }
      } else {
        env.getBufferAddress = function(buffer) {
          argBuffer = buffer;
          return usize(0x4000);
        };
      }
      expect(() => f(1, 2)).to.not.throw();
      expect(thunkAddress).to.equal(usize(0x1004));
      expect(fnAddress).to.equal(usize(0x2008));
      expect(argAddress).to.equal(usize(0x4000));
      let argStruct;
      if (process.env.TARGET === 'wasm') {
        argStruct = ArgStruct(new DataView(env.memory.buffer, 0x4000, ArgStruct[SIZE]));
      } else if (process.env.TARGET === 'node') {
        argStruct = ArgStruct(new DataView(argBuffer));
      }
      expect(argStruct[0]).to.equal(1);
      expect(argStruct[1]).to.equal(2);
    })
    it('should define a function type for inbound calls', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
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
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        byteSize: 4 * 3,
        length: 2,
      });
      env.attachMember(argStructure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(argStructure);
      env.endStructure(argStructure);
      const structure = env.beginStructure({
        type: StructureType.Function,
        name: 'fn(i32, i32) i32',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        structure: argStructure,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(structure, thunk, false);
      const jsThunkConstructor = { [MEMORY]: zig(0x8888) };
      env.attachTemplate(structure, jsThunkConstructor, true);
      const constructor = env.defineStructure(structure);
      expect(constructor).to.be.a('function');
      let constructorAddr, fnIds = [];
      let nextThunkAddr = usize(0x10000);
      env.createJsThunk = function(...args) {
        constructorAddr = args[0];
        fnIds.push(args[1]);
        const thunkAddr = nextThunkAddr;
        nextThunkAddr += usize(0x100);
        return thunkAddr;
      };
      const fn = (arg1, arg2) => {
        return arg1 + arg2;
      };
      const f = new constructor(fn);
      expect(f).to.be.a('function');
      const f2 = new constructor(fn);
      expect(f2).to.equal(f);
      expect(constructorAddr).to.equal(usize(0x8888));
      expect(fnIds).to.eql([ 1 ]);
      const argStruct = new ArgStruct([ 123, 456 ], 'hello', 0);
      const result = env.runFunction(1, argStruct[MEMORY]);
      expect(result).to.equal(CallResult.OK);
      expect(argStruct.retval).to.equal(123 + 456);
    })
    it('should throw when constructor is given non-function', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
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
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        byteSize: 4 * 3,
        length: 2,
      });
      env.attachMember(argStructure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(argStructure);
      env.endStructure(argStructure);
      const structure = env.beginStructure({
        type: StructureType.Function,
        name: 'fn(i32, i32) i32',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        structure: argStructure,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(structure, thunk, false);
      const jsThunkConstructor = { [MEMORY]: zig(0x8888) };
      env.attachTemplate(structure, jsThunkConstructor, true);
      const constructor = env.defineStructure(structure);
      expect(() => new constructor()).to.throw(TypeError);
      expect(() => new constructor(123)).to.throw(TypeError);
    })
    it('should throw on attempts to cast to a function', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
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
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        byteSize: 4 * 3,
        length: 2,
      });
      env.attachMember(argStructure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(argStructure);
      env.endStructure(argStructure);
      const structure = env.beginStructure({
        type: StructureType.Function,
        name: 'fn(i32, i32) i32',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        structure: argStructure,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(structure, thunk, false);
      const constructor = env.defineStructure(structure);
      const dv = zig(0x4000);
      expect(() => constructor(dv)).to.throw(TypeError);
      expect(() => constructor(null)).to.throw(TypeError);
    })
    it('should attempt to destroy js thunk when delete is called', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
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
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        byteSize: 4 * 3,
        length: 2,
      });
      env.attachMember(argStructure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(argStructure);
      env.endStructure(argStructure);
      const structure = env.beginStructure({
        type: StructureType.Function,
        name: 'fn(i32, i32) i32',
        byteSize: 0,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        structure: argStructure,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(structure, thunk, false);
      const jsThunkController = { [MEMORY]: zig(0x2004) };
      env.attachTemplate(structure, jsThunkController, true);
      const constructor = env.defineStructure(structure);
      let controllerAddress, thunkAddress;
      env.createJsThunk = function(...args) {
        controllerAddress = args[0];
        return usize(0x8888);
      };
      env.destroyJsThunk = function(...args) {
        controllerAddress = args[0];
        thunkAddress = args[1];
        return 1;
      };
      const fn = new constructor(() => {});
      expect(controllerAddress).to.equal(usize(0x2004));
      fn.delete();
      expect(controllerAddress).to.equal(usize(0x2004));
      expect(thunkAddress).to.equal(usize(0x8888));
    })
  })
})

function zig(address, len = 0) {
  const dv = new DataView(new ArrayBuffer(len));
  dv[ZIG] = { address: usize(address), len };
  return dv;
}
