import { expect } from 'chai';
import { MemberFlag, MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';
import { ENVIRONMENT, FIXED, MEMORY, SLOTS } from '../../src/symbols.js';
import { capture, captureError, delay, usize } from '../test-utils.js';

import AccessorAll from '../../src/accessors/all.js';
import Baseline from '../../src/features/baseline.js';
import CallMarshalingInbound, {
  CallResult,
  isNeededByStructure,
} from '../../src/features/call-marshaling-inbound.js';
import DataCopying from '../../src/features/data-copying.js';
import IntConversion from '../../src/features/int-conversion.js';
import MemoryMapping from '../../src/features/memory-mapping.js';
import PointerSynchronization from '../../src/features/pointer-synchronization.js';
import StreamRedirection from '../../src/features/stream-redirection.js';
import StructureAcquisition from '../../src/features/structure-acquisition.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll from '../../src/members/all.js';
import MemberBool from '../../src/members/bool.js';
import MemberInt from '../../src/members/int.js';
import MemberObject from '../../src/members/object.js';
import MemberPrimitive from '../../src/members/primitive.js';
import MemberUint from '../../src/members/uint.js';
import StructureAll from '../../src/structures/all.js';
import StructureArgStruct from '../../src/structures/arg-struct.js';
import StructureErrorSet from '../../src/structures/error-set.js';
import ErrorUnionStructure from '../../src/structures/error-union.js';
import StructurePrimitive from '../../src/structures/primitive.js';
import StructureStructLike from '../../src/structures/struct-like.js';
import StructureStruct from '../../src/structures/struct.js';

const Env = defineClass('FeatureTest', [
  Baseline, DataCopying, CallMarshalingInbound, MemoryMapping, ViewManagement,
  PointerSynchronization, StreamRedirection, StructureAcquisition, StructureAll,
  StructureArgStruct, MemberUint, MemberAll, MemberBool, MemberInt, IntConversion,
  MemberPrimitive, StructurePrimitive, AccessorAll, StructureStruct, MemberObject,
  StructureStructLike, StructureErrorSet, ErrorUnionStructure,
]);

describe('Feature: call-marshaling-inbound', function() {
  describe('isNeededByStructure', function() {
    it('should return true when structure is a function pointer', function() {
      const structure = {
        type: StructureType.Pointer,
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
      expect(isNeededByStructure(structure)).to.be.true;
    })
    it('should return false when structure is not a function pointer', function() {
      const structure = {
        type: StructureType.Function,
        instance: {}
      };
      expect(isNeededByStructure(structure)).to.be.false;
    })
  })
  describe('getFunctionId', function() {
    it('should allocate different ids for different functions', function() {
      const f1 = () => {};
      const f2 = () => {};
      const env = new Env();
      const id1 = env.getFunctionId(f1);
      const id2 = env.getFunctionId(f2);
      const id3 = env.getFunctionId(f1);
      expect(id1).to.be.a('number').that.is.above(0);
      expect(id2).to.not.equal(id1);
      expect(id3).to.equal(id1);
    })
  })
  describe('getFunctionThunk', function() {
    it('should allocate thunk for JavaScript function', function() {
      const f1 = () => {};
      const f2 = () => {};
      const jsThunkConstructor = {
        [MEMORY]: new DataView(new ArrayBuffer(0))
      };
      jsThunkConstructor[MEMORY][FIXED] = { address: usize(0x8888) };
      const env = new Env();
      let constructorAddr, fnIds = [];
      let nextThunkAddr = usize(0x10000);
      env.createJsThunk = function(...args) {
        constructorAddr = args[0];
        fnIds.push(args[1]);
        const thunkAddr = nextThunkAddr;
        nextThunkAddr += usize(0x100);
        return thunkAddr;
      };
      const thunk1 = env.getFunctionThunk(f1, jsThunkConstructor);
      const thunk2 = env.getFunctionThunk(f2, jsThunkConstructor);
      const thunk3 = env.getFunctionThunk(f1, jsThunkConstructor);
      expect(constructorAddr).to.equal(usize(0x8888));
      expect(fnIds).to.eql([ 1, 2 ]);
      expect(thunk1).to.be.an.instanceOf(DataView);
      expect(thunk2).to.not.equal(thunk1);
      expect(thunk3).to.equal(thunk1);
    })
  })
  describe('createInboundCallers', function() {
    it('should create a caller for invoking a JavaScript function from Zig', async function() {
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
        name: 'Hello',
        byteSize: 4 * 3,
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
      const fn = (arg1, arg2) => {
        console.log(`${arg1} ${arg2}`);
        return arg1 + arg2;
      };
      const { self, binary } = env.createInboundCallers(fn, ArgStruct)
      expect(self).to.be.a('function');
      expect(binary).to.be.a('function');
      const argStruct = new ArgStruct([ 123, 456 ], 'hello', 0);
      const [ line ] = await capture(() => {
        expect(() => binary(argStruct[MEMORY])).to.not.throw();
      });
      expect(line).to.equal('123 456');
      expect(argStruct.retval).to.equal(123 + 456);
    })
  })
  describe('runFunction', function() {
    it('should run JavaScript function registered to function id', async function() {
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
        name: 'Hello',
        byteSize: 4 * 3,
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
      const fn = (arg1, arg2) => {
        console.log(`${arg1} ${arg2}`);
        return arg1 + arg2;
      };
      env.createInboundCallers(fn, ArgStruct)
      const funcId = env.getFunctionId(fn);
      const argStruct = new ArgStruct([ 123, 456 ], 'hello', 0);
      let result;
      const [ line ] = await capture(() => {
        result = env.runFunction(funcId, argStruct[MEMORY]);
      });
      expect(result).to.equal(CallResult.OK);
      expect(line).to.equal('123 456');
      expect(argStruct.retval).to.equal(123 + 456);
    })
    it('should return failure code when JavaScript function throws', async function() {
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
        name: 'Hello',
        byteSize: 4 * 3,
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
      const fn = (arg1, arg2) => {
        throw new Error('Boo!');
      };
      env.createInboundCallers(fn, ArgStruct)
      const funcId = env.getFunctionId(fn);
      const argStruct = new ArgStruct([ 123, 456 ], 'hello', 0);
      let result;
      const [ line ] = await captureError(() => {
        result = env.runFunction(funcId, argStruct[MEMORY]);
      });
      expect(result).to.equal(CallResult.Failure);
      expect(line).to.contain('Boo!');
    })
    it('should return failure code when JavaScript function throws', async function() {
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
        name: 'Hello',
        byteSize: 4 * 3,
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
      const fn = (arg1, arg2) => {
        throw new Error('Boo!');
      };
      env.createInboundCallers(fn, ArgStruct)
      const funcId = env.getFunctionId(fn);
      const argStruct = new ArgStruct([ 123, 456 ], 'hello', 0);
      let result;
      const [ line ] = await captureError(() => {
        result = env.runFunction(funcId, argStruct[MEMORY]);
      });
      expect(result).to.equal(CallResult.Failure);
      expect(line).to.contain('Boo!');
    })
    it('should place error into error union when JavaScript function throws one from error set', async function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'Int32',
        byteSize: 4,
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
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: errorStructure,
      });
      const MyError = env.defineStructure(errorStructure);
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.endStructure(errorStructure);
      const unionStructure = env.beginStructure({
        type: StructureType.ErrorUnion,
        flags: StructureFlag.HasSelector | StructureFlag.HasValue,
        name: 'ErrorUnion',
        byteSize: 6,
      });
      env.attachMember(unionStructure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(unionStructure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitOffset: 32,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.defineStructure(unionStructure);
      env.endStructure(unionStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsThrowing,
        name: 'Hello',
        byteSize: 6 + 4 * 2,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Object,
        bitSize: 48,
        bitOffset: 0,
        byteSize: 6,
        slot: 0,
        structure: unionStructure,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 48,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 80,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      const fn = (arg1, arg2) => {
        throw MyError.UnableToCreateObject;
      };
      env.createInboundCallers(fn, ArgStruct)
      const funcId = env.getFunctionId(fn);
      const argStruct = new ArgStruct([ 123, 456 ], 'hello', 0);
      const result = env.runFunction(funcId, argStruct[MEMORY]);
      expect(result).to.equal(CallResult.OK);
      expect(() => argStruct.retval).to.throw(MyError.UnableToCreateObject);
    })
    it('should return failure code when error is not in error set', async function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'Int32',
        byteSize: 4,
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
      const errorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'MyError',
        byteSize: 2,
      });
      env.attachMember(errorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: errorStructure,
      });
      const MyError = env.defineStructure(errorStructure);
      env.attachMember(errorStructure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly,
        slot: 0,
        structure: errorStructure,
      }, true);
      env.attachMember(errorStructure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly,
        slot: 1,
        structure: errorStructure,
      }, true);
      env.attachTemplate(errorStructure, {
        [SLOTS]: {
          0: MyError.call(ENVIRONMENT, errorData(5)),
          1: MyError.call(ENVIRONMENT, errorData(8)),
        }
      }, true);
      env.endStructure(errorStructure);
      const unionStructure = env.beginStructure({
        type: StructureType.ErrorUnion,
        flags: StructureFlag.HasSelector | StructureFlag.HasValue,
        name: 'ErrorUnion',
        byteSize: 6,
      });
      env.attachMember(unionStructure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(unionStructure, {
        type: MemberType.Uint,
        flags: MemberFlag.IsSelector,
        bitOffset: 32,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      env.defineStructure(unionStructure);
      env.endStructure(unionStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsThrowing,
        name: 'Hello',
        byteSize: 6 + 4 * 2,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Object,
        bitSize: 48,
        bitOffset: 0,
        byteSize: 6,
        slot: 0,
        structure: unionStructure,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 48,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 80,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      const fn = (arg1, arg2) => {
        throw new Error('Boo!');
      };
      env.createInboundCallers(fn, ArgStruct)
      const funcId = env.getFunctionId(fn);
      const argStruct = new ArgStruct([ 123, 456 ], 'hello', 0);
      let result;
      const [ line ] = await captureError(() => {
        result = env.runFunction(funcId, argStruct[MEMORY]);
      });
      expect(result).to.equal(CallResult.Failure);
      expect(line).to.contain('Boo!');
    })
    it('should call finalizeAsyncCall when async function fulfills promise', async function() {
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
        name: 'Hello',
        byteSize: 4 * 3,
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
      const fn = async (arg1, arg2) => {
        await delay(50);
        return arg1 + arg2;
      };
      env.createInboundCallers(fn, ArgStruct)
      const funcId = env.getFunctionId(fn);
      const argStruct = new ArgStruct([ 123, 456 ], 'hello', 0);
      let called = false, futexHandle, result;
      env.finalizeAsyncCall = (...args) => {
        called = true;
        futexHandle = args[0];
        result = args[1];
      };
      env.runFunction(funcId, argStruct[MEMORY], 0x1234);
      await delay(100);
      expect(called).to.be.true;
      expect(futexHandle).to.equal(0x1234);
      expect(result).to.equal(CallResult.OK);
      expect(argStruct.retval).to.equal(123 + 456);
    })
    it('should pass failure code to finalizeAsyncCall when async function rejects', async function() {
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
        name: 'Hello',
        byteSize: 4 * 3,
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
      const fn = async (arg1, arg2) => {
        await delay(50);
        throw new Error('Boo!');
      };
      env.createInboundCallers(fn, ArgStruct)
      const funcId = env.getFunctionId(fn);
      const argStruct = new ArgStruct([ 123, 456 ], 'hello', 0);
      let called = false, futexHandle, result;
      env.finalizeAsyncCall = (...args) => {
        called = true;
        futexHandle = args[0];
        result = args[1];
      };
      await captureError(async () => {
        env.runFunction(funcId, argStruct[MEMORY], 0x1234);
        await delay(100);
      });
      expect(called).to.be.true;
      expect(futexHandle).to.equal(0x1234);
      expect(result).to.equal(CallResult.Failure);
    })
    it('should return code indicating deadlock when no futex is given', function() {
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
        name: 'Hello',
        byteSize: 4 * 3,
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
      const fn = async (arg1, arg2) => {
        await delay(50);
        return arg1 + arg2;
      };
      env.createInboundCallers(fn, ArgStruct)
      const funcId = env.getFunctionId(fn);
      const argStruct = new ArgStruct([ 123, 456 ], 'hello', 0);
      const result = env.runFunction(funcId, argStruct[MEMORY], 0);
      expect(result).to.equal(CallResult.Deadlock);
    })
  })
})

function errorData(index) {
  const ta = new Uint16Array([ index ]);
  return new DataView(ta.buffer, 0, 2);
}
