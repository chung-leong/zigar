import { expect } from 'chai';
import { MemberType, PosixError, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ENVIRONMENT, MEMORY, SIZE, ZIG } from '../../src/symbols.js';
import { defineProperty, usize } from '../../src/utils.js';

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
        env.memory = new WebAssembly.Memory({ initial: 1 });
        env.allocateScratchMemory = function(len, align) {
          return usize(0x4000);
        };
        env.freeScratchMemory = function() {
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
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      const fn = (arg1, arg2) => {
        return arg1 + arg2;
      };
      const f = new constructor(fn);
      expect(f).to.be.a('function');
      const f2 = new constructor(fn);
      expect(f2).to.equal(f);
      expect(constructorAddr).to.equal(usize(0x8888));
      expect(fnIds).to.eql([ 1 ]);

      const len = ArgStruct[SIZE];
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        const buffer = new ArrayBuffer(len);
        env.obtainExternBuffer = function(address, len) {
          return buffer;
        };
      }
      const address = usize(0x1000);
      const dv = env.obtainZigView(address, len);
      const argStruct = ArgStruct(dv);
      argStruct[0] = 123;
      argStruct[1] = 456;
      const result = env.handleJscall(1, address, len);
      expect(result).to.equal(PosixError.NONE);
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
      env.defineStructure(argStructure);
      env.endStructure(argStructure);
      const structure = env.beginStructure({
        type: StructureType.Function,
        byteSize: 0,
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
      env.endStructure(structure);
      expect(() => new constructor()).to.throw(TypeError);
      expect(() => new constructor(123)).to.throw(TypeError);
    })
    it('should throw when a JavaScript function is given and the function takes variadic arguments', function() {
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
        type: StructureType.VariadicStruct,
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
      env.defineStructure(argStructure);
      env.endStructure(argStructure);
      const structure = env.beginStructure({
        type: StructureType.Function,
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
      env.endStructure(structure);
      expect(() => new constructor(() => {})).to.throw(TypeError)
        .with.property('message').that.equal('Unsupported');
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
  })
})

function zig(address, len = 0) {
  const dv = new DataView(new ArrayBuffer(len));
  dv[ZIG] = { address: usize(address), len };
  return dv;
}
