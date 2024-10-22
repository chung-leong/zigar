import { expect } from 'chai';
import { CallResult, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { FIXED, MEMORY, SIZE } from '../../src/symbols.js';
import { defineProperty } from '../../src/utils.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Structure: function', function() {
  describe('defineStructure', function() {
    it('should define a function type', function() {
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
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 4 * 3,
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
      const thunk = { [MEMORY]: fixed(0x1004) };
      env.attachTemplate(structure, thunk, false);
      const constructor = env.defineStructure(structure);
      expect(constructor).to.be.a('function');
      const dv = fixed(0x2008);
      const f = constructor(dv);
      expect(f).to.be.a('function');
      expect(f).to.be.an.instanceOf(constructor);
      expect(f.constructor).to.equal(constructor);
      expect(f).to.be.an.instanceOf(Function);
      const f2 = constructor(dv);
      expect(f2).to.equal(f);
      expect(f.name).to.equal('');
      defineProperty(f, 'name', { value: 'dingo' });
      expect(f.name).to.equal('dingo');
      let thunkAddress, fnAddress, argStruct;
      env.runThunk = (...args) => {
        thunkAddress = args[0];
        fnAddress = args[1];
        argStruct = args[2];
        return true;
      };
      env.allocateExternMemory = function(address, len) {
        return usize(0x4000);
      };
      env.freeExternMemory = function() {
      }
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      }
      expect(() => f(1, 2)).to.not.throw();
      expect(thunkAddress).to.equal(usize(0x1004));
      expect(fnAddress).to.equal(usize(0x2008));
      if (process.env.TARGET === 'wasm') {
        expect(argStruct).to.equal(usize(0x4000));
        argStruct = ArgStruct(new DataView(env.memory.buffer, 0x4000, ArgStruct[SIZE]));
      } else if (process.env.TARGET === 'node') {
        expect(argStruct).to.be.instanceOf(DataView);
        argStruct = ArgStruct(argStruct);
      }
      expect(argStruct[0]).to.equal(1);
      expect(argStruct[1]).to.equal(2);
    })
    it('should define a function type for inbound calls', function() {
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
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 4 * 3,
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
      const thunk = { [MEMORY]: fixed(0x1004) };
      env.attachTemplate(structure, thunk, false);
      const jsThunkConstructor = { [MEMORY]: fixed(0x8888) };
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
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 4 * 3,
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
      const thunk = { [MEMORY]: fixed(0x1004) };
      env.attachTemplate(structure, thunk, false);
      const jsThunkConstructor = { [MEMORY]: fixed(0x8888) };
      env.attachTemplate(structure, jsThunkConstructor, true);
      const constructor = env.defineStructure(structure);
      expect(() => new constructor()).to.throw(TypeError);
      expect(() => new constructor(123)).to.throw(TypeError);
    })
  })
})

function fixed(address, len = 0) {
  const dv = new DataView(new ArrayBuffer(len));
  dv[FIXED] = { address: usize(address), len };
  return dv;
}
