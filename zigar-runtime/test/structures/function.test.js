import { expect } from 'chai';
import { MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import Baseline from '../../src/features/baseline.js';
import CallMarshalingInbound, { CallResult } from '../../src/features/call-marshaling-inbound.js';
import CallMarshalingOutbound from '../../src/features/call-marshaling-outbound.js';
import DataCopying from '../../src/features/data-copying.js';
import IntConversion from '../../src/features/int-conversion.js';
import MemoryMapping from '../../src/features/memory-mapping.js';
import StructureAcquisition from '../../src/features/structure-acquisition.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll from '../../src/members/all.js';
import MemberInt from '../../src/members/int.js';
import MemberPrimitive from '../../src/members/primitive.js';
import MemberTypeMixin from '../../src/members/type.js';
import MemberUint from '../../src/members/uint.js';
import All from '../../src/structures/all.js';
import StructureArgStruct from '../../src/structures/arg-struct.js';
import FunctionMixin, {
  isNeededByStructure,
} from '../../src/structures/function.js';
import Primitive from '../../src/structures/primitive.js';
import { FIXED, MEMORY, SIZE, VARIANTS } from '../../src/symbols.js';
import { defineProperty } from '../../src/utils.js';
import { usize } from '../test-utils.js';

const Env = defineClass('PrimitiveTest', [
  AccessorAll, MemberInt, MemberPrimitive, MemberAll, All, Primitive, DataCopying,
  StructureAcquisition, ViewManagement, MemberTypeMixin, IntConversion, MemberUint, Baseline,
  FunctionMixin, StructureArgStruct, CallMarshalingOutbound, CallMarshalingInbound, MemoryMapping,
]);

describe('Structure: function', function() {
  describe('isNeededByStructure', function() {
    it('should return true when structure is a function', function() {
      const structure = {
        type: StructureType.Function,
        instance: {}
      };
      expect(isNeededByStructure(structure)).to.be.true;
    })
    it('should return true when structure is not a function', function() {
      const structure = {
        type: StructureType.SinglePointer,
        instance: {
          members: [
            {
              type: MemberType.Object,
              structure: {
                type: StructureType.Function,
              }
            }
          ]
        }
      };
      expect(isNeededByStructure(structure)).to.be.false;
    })
  })
  describe('defineFunction', function() {
  })
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
      const thunk = {
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      };
      thunk[MEMORY][FIXED] = { address: usize(0x1004) };
      env.attachTemplate(structure, thunk, false);
      const constructor = env.defineStructure(structure);
      expect(constructor).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(0));
      dv[FIXED] = { address: usize(0x2008) };
      const f = constructor(dv);
      expect(f).to.be.a('function');
      const f2 = constructor(dv);
      expect(f2).to.equal(f);
      expect(f.name).to.equal('');
      const { method } = f[VARIANTS];
      expect(method).to.be.a('function');
      defineProperty(f, 'name', { value: 'dingo' });
      expect(f.name).to.equal('dingo');
      expect(method.name).to.equal('dingo');
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
      const thunk = {
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      };
      thunk[MEMORY][FIXED] = { address: usize(0x1004) };
      env.attachTemplate(structure, thunk, false);
      const jsThunkConstructor = {
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      };
      jsThunkConstructor[MEMORY][FIXED] = { address: usize(0x8888) };
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
      const thunk = {
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      };
      thunk[MEMORY][FIXED] = { address: usize(0x1004) };
      env.attachTemplate(structure, thunk, false);
      const jsThunkConstructor = {
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      };
      jsThunkConstructor[MEMORY][FIXED] = { address: usize(0x8888) };
      env.attachTemplate(structure, jsThunkConstructor, true);
      const constructor = env.defineStructure(structure);
      expect(() => new constructor()).to.throw(TypeError);
      expect(() => new constructor(123)).to.throw(TypeError);
    })
  })
})