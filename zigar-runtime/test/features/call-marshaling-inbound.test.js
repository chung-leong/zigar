import { expect } from 'chai';
import {
  Action,
  ArgStructFlag, CallResult, MemberFlag, MemberType, PointerFlag, StructureFlag, StructureType,
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ENVIRONMENT, FIXED, MEMORY, SLOTS } from '../../src/symbols.js';
import { capture, captureError, delay, usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: call-marshaling-inbound', function() {
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
    it('should throw when it is unable to create thunk', function() {
      const jsThunkConstructor = {
        [MEMORY]: new DataView(new ArrayBuffer(0))
      };
      jsThunkConstructor[MEMORY][FIXED] = { address: usize(0x8888) };
      const env = new Env();
      env.createJsThunk = () => 0;
      expect(() => env.getFunctionThunk(() => {}, jsThunkConstructor)).to.throw(Error);
    });
  })
  describe('createInboundCaller', function() {
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
      const fn = (arg1, arg2) => {
        console.log(`${arg1} ${arg2}`);
        return arg1 + arg2;
      };
      const self = env.createInboundCaller(fn, ArgStruct)
      expect(self).to.be.a('function');
      const argStruct = new ArgStruct([ 123, 456 ]);
      const binary = env.jsFunctionCallerMap.get(1);
      const [ line ] = await capture(() => {
        expect(() => binary(argStruct[MEMORY])).to.not.throw();
      });
      expect(line).to.equal('123 456');
      expect(argStruct.retval).to.equal(123 + 456);
    })
    it('should create a caller that updates pointers in arguments', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
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
        name: 'Hello',
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
      const fn = arg => arg;
      const self = env.createInboundCaller(fn, ArgStruct)
      const int32 = new Int32(123);
      const argStruct = new ArgStruct([ int32 ]);
      const binary = env.jsFunctionCallerMap.get(1);
      expect(() => binary(argStruct[MEMORY])).to.not.throw();
    })
    it('should create a caller that accept error union as argument', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: {},
      });
      const Int64 = env.defineStructure(intStructure);
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
      // console.log(MyError[CLASS]);
      const euStructure = env.beginStructure({
        type: StructureType.ErrorUnion,
        flags: StructureFlag.HasValue,
        name: '!i64',
        byteSize: 10,
      });
      env.attachMember(euStructure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        structure: intStructure,
      });
      env.attachMember(euStructure, {
        name: 'error',
        type: MemberType.Uint,
        bitOffset: 64,
        bitSize: 16,
        byteSize: 2,
        structure: errorStructure,
      });
      const ErrorUnion = env.defineStructure(euStructure);
      env.endStructure(euStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: 18,
        length: 1,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: intStructure,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        bitSize: 80,
        bitOffset: 64,
        byteSize: 10,
        structure: euStructure,
        slot: 0,
      });
      const ArgStruct = env.defineStructure(structure);
      env.endStructure(structure);
      let error;
      const fn = (arg) => {
        if (arg instanceof Error) {
          error = arg;
          return 0n;
        } else {
          return 1234n;
        }
      };
      const self = env.createInboundCaller(fn, ArgStruct)
      const binary = env.jsFunctionCallerMap.get(1);
      const argStruct1 = new ArgStruct([ 46n ]);
      expect(() => binary(argStruct1[MEMORY])).to.not.throw();
      expect(argStruct1.retval).to.equal(1234n);
      const argStruct2 = new ArgStruct([ MyError.UnableToCreateObject ]);
      expect(() => binary(argStruct2[MEMORY])).to.not.throw();
      expect(argStruct2.retval).to.equal(0n);
      expect(error).to.equal(MyError.UnableToCreateObject);
    })
    it('should return error code when arg struct constructor throws', async function() {
      const env = new Env();
      const fn = () => {};
      const ArgStruct = () => { throw new Error('Doh!') };
      const self = env.createInboundCaller(fn, ArgStruct)
      const binary = env.jsFunctionCallerMap.get(1);
      let result;
      const [ line ] = await captureError(() => {
        result = binary({});
      });
      expect(line).to.equal('Error: Doh!');
      expect(result).to.equal(CallResult.Failure);
    })
    it('should return function that calls the given function', function() {
      const env = new Env();
      const fn = (...args) => args;
      const ArgStruct = function() {
        const self = {};
        self.length = 0;
        return self;
      };
      const self = env.createInboundCaller(fn, ArgStruct)
      const result = self(1, 2, 3, 4);
      expect(result).to.eql([ 1, 2, 3, 4 ]);
    })
    it('should set futex at the end of call', function() {
      const env = new Env();
      const fn = () => {};
      const ArgStruct = function() {
        const self = {};
        self.length = 0;
        return self;
      };
      const self = env.createInboundCaller(fn, ArgStruct)
      const binary = env.jsFunctionCallerMap.get(1);
      env.finalizeAsyncCall = function(futexHandle, result) {
        expect(futexHandle).to.equal(usize(0x1234));
        expect(result).to.equal(CallResult.OK);
      };
      const result = binary(null, usize(0x1234));
      expect(result).to.equal(CallResult.OK);
    })
  })
  describe('performJsAction', function() {
    it('should call runFunction', function() {
      const env = new Env();
      let called;
      env.runFunction = function(id, dv, futexHandle) {
        called = true;
        return CallResult.OK;
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      const result = env.performJsAction(Action.Call, 100, usize(0x1234), 4);
      expect(called).to.be.true;
      expect(result).to.equal(CallResult.OK);
    })
    it('should call releaseFunction', function() {
      const env = new Env();
      let called;
      env.releaseFunction = function(id) {
        called = true;
      };
      env.performJsAction(Action.Release, 100);
      expect(called).to.be.true;
    })
    if (process.env.TARGET === 'node') {
      it('should call writeToConsole when function id is 0', function() {
        const env = new Env();
        let called;
        let success = true;
        env.writeToConsole = function(dv) {
          called = true;
          return success;
        };
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
        env.finalizeAsyncCall = function(futexHandle, value) {
          expect(futexHandle).to.equal(usize(0x4000));
          expect(value).to.equal(success ? CallResult.OK : CallResult.Failure);
        };
        env.performJsAction(Action.Call, 0, usize(0x1234), 4, usize(0x4000));
        expect(called).to.be.true;
        success = false;
        env.performJsAction(Action.Call, 0, usize(0x1234), 4, usize(0x4000));
      })
    }
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
      const fn = (arg1, arg2) => {
        console.log(`${arg1} ${arg2}`);
        return arg1 + arg2;
      };
      env.createInboundCaller(fn, ArgStruct)
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
      const fn = (arg1, arg2) => {
        throw new Error('Boo!');
      };
      env.createInboundCaller(fn, ArgStruct)
      const funcId = env.getFunctionId(fn);
      const argStruct = new ArgStruct([ 123, 456 ], 'hello', 0);
      let result;
      const [ line ] = await captureError(() => {
        result = env.runFunction(funcId, argStruct[MEMORY]);
      });
      expect(result).to.equal(CallResult.Failure);
      expect(line).to.contain('Boo!');
    })
    it('should return failure code when function is not found', async function() {
      const env = new Env();
      const result = env.runFunction(1234, null);
      expect(result).to.equal(CallResult.Failure);
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
        flags: StructureFlag.HasValue,
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
        flags: StructureFlag.HasObject | StructureFlag.HasSlot | ArgStructFlag.IsThrowing,
        name: 'Hello',
        byteSize: 6 + 4 * 2,
        length: 2,
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
      env.createInboundCaller(fn, ArgStruct)
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
        flags: StructureFlag.HasValue,
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
        flags: StructureFlag.HasObject | StructureFlag.HasSlot | ArgStructFlag.IsThrowing,
        name: 'Hello',
        byteSize: 6 + 4 * 2,
        length: 2,
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
      env.createInboundCaller(fn, ArgStruct)
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
      const fn = async (arg1, arg2) => {
        await delay(50);
        return arg1 + arg2;
      };
      env.createInboundCaller(fn, ArgStruct)
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
      const fn = async (arg1, arg2) => {
        await delay(50);
        throw new Error('Boo!');
      };
      env.createInboundCaller(fn, ArgStruct)
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
      const fn = async (arg1, arg2) => {
        await delay(50);
        return arg1 + arg2;
      };
      env.createInboundCaller(fn, ArgStruct)
      const funcId = env.getFunctionId(fn);
      const argStruct = new ArgStruct([ 123, 456 ], 'hello', 0);
      const result = env.runFunction(funcId, argStruct[MEMORY], 0);
      expect(result).to.equal(CallResult.Deadlock);
    })
  })
  describe('releaseFunction', function() {
    it('should free resources associated with function id', function() {
      const env = new Env();
      const fn = () => {};
      const ArgStruct = function() {
        const self = {};
        self.length = 0;
        return self;
      };
      const self = env.createInboundCaller(fn, ArgStruct)
      const dv = new DataView(new ArrayBuffer(0));
      dv[FIXED] = { address: usize(0x1234), len: 0 };
      const controller = { [MEMORY]: dv };
      env.createJsThunk = function() {
        return usize(0x1000);
      };
      let called = true;
      env.destroyJsThunk = function() {
        called = true;
        return 1;
      };
      const thunk = env.getFunctionThunk(fn, controller);
      expect(env.jsFunctionThunkMap.size).to.equal(1);
      expect(env.jsFunctionCallerMap.size).to.equal(1);
      expect(env.jsFunctionControllerMap.size).to.equal(1);
      env.releaseFunction(1);
      expect(env.jsFunctionThunkMap.size).to.equal(0);
      expect(env.jsFunctionCallerMap.size).to.equal(0);
      expect(env.jsFunctionControllerMap.size).to.equal(0);
      expect(called).to.be.true;
    })
  })
  if (process.env.TARGET === 'wasm') {
    describe('queueJsAction', function() {
      it('should call performJsAction', function() {
        const env = new Env();
        let called = true;
        env.performJsAction = function() {
          called = true;
        };
        env.queueJsAction(Action.Call, 1, usize(0x1000), 4, usize(0x4000));
        expect()
      })
    })
  }
})

function errorData(index) {
  const ta = new Uint16Array([ index ]);
  return new DataView(ta.buffer, 0, 2);
}
