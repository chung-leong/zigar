import { expect } from 'chai';
import {
  ArgStructFlag, CallResult, MemberFlag, MemberType, PointerFlag, SliceFlag, StructFlag, 
  StructureFlag, StructureType,
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ENVIRONMENT, MEMORY, RETURN, SLOTS, THROWING, YIELD, ZIG } from '../../src/symbols.js';
import {
  addressByteSize, addressSize, capture, captureError, delay, usize
} from '../test-utils.js';

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
      jsThunkConstructor[MEMORY][ZIG] = { address: usize(0x100) };
      const env = new Env();
      let constructorAddr, fnIds = [];
      let nextThunkAddr = usize(0x200);
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
      const thunk1 = env.getFunctionThunk(f1, jsThunkConstructor);
      const thunk2 = env.getFunctionThunk(f2, jsThunkConstructor);
      const thunk3 = env.getFunctionThunk(f1, jsThunkConstructor);
      expect(constructorAddr).to.equal(usize(0x100));
      expect(fnIds).to.eql([ 1, 2 ]);
      expect(thunk1).to.be.an.instanceOf(DataView);
      expect(thunk2).to.not.equal(thunk1);
      expect(thunk3).to.equal(thunk1);
    })
    it('should throw when it is unable to create thunk', function() {
      const jsThunkConstructor = {
        [MEMORY]: new DataView(new ArrayBuffer(0))
      };
      jsThunkConstructor[MEMORY][ZIG] = { address: usize(0x8888) };
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
        byteSize: addressByteSize,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
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
      const fn = arg => arg;
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        const map = new Map();
        env.obtainExternBuffer = function(address, len) {
          let buffer = map.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            map.set(address, buffer);
          }
          return buffer;
        };
      }
      const self = env.createInboundCaller(fn, ArgStruct)
      const dv = env.obtainZigView(usize(0x1000), 4);
      const int32 = Int32(dv);
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
        self[Symbol.iterator] = function() {
          const array = [];
          return array[Symbol.iterator]();
        };
        self[RETURN] = function() {};
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
    it('should pass async result to promise callback function', async function() {
      const env = new Env();
      const fn = async () => 777;
      let result;
      const ArgStruct = function() {
        const self = {};
        self.length = 0;
        self[Symbol.iterator] = function() {
          const array = [];
          return array[Symbol.iterator]();
        };
        self[RETURN] = function(arg) {
          result = arg;
        };
        return self;
      };
      const self = env.createInboundCaller(fn, ArgStruct)
      const binary = env.jsFunctionCallerMap.get(1);
      binary(null, usize(0x1234));
      await delay(0);
      expect(result).to.equal(777);
    })
    it('should pass async error to promise callback function', async function() {
      const env = new Env();
      const fn = async () => { throw new Error('Doh!') };
      let result;
      const ArgStruct = function() {
        const self = {};
        self.length = 0;
        self[Symbol.iterator] = function() {
          const array = [];
          return array[Symbol.iterator]();
        };
        self[RETURN] = function(arg) {
          result = arg;
        };
        return self;
      };
      ArgStruct[THROWING] = true;
      const self = env.createInboundCaller(fn, ArgStruct)
      const binary = env.jsFunctionCallerMap.get(1);
      binary(null, usize(0x1234));
      await delay(0);
      expect(result).to.be.an('error').with.property('message', 'Doh!');
    })
    it('should output error to console when callback throws', async function() {
      const env = new Env();
      const fn = async () => 777;
      let result;
      const ArgStruct = function() {
        const self = {};
        self.length = 0;
        self[Symbol.iterator] = function() {
          const array = [];
          return array[Symbol.iterator]();
        };
        self[RETURN] = function(arg) {
          throw new Error('Doh!');
        };
        return self;
      };
      const self = env.createInboundCaller(fn, ArgStruct)
      const binary = env.jsFunctionCallerMap.get(1);
      const [ line ] = await captureError(async () => {
        binary(null, usize(0x1234));
        await delay(10);
      });
      expect(line).to.equal('Error: Doh!');
    })
    it('should pass result from async generator to callback function', async function() {
      const env = new Env();
      env.finalizeAsyncCall = function() {
      };
      const fn = async function*() {
        for (let i = 0; i < 5; i++) yield i;
      };
      const result = [];
      const ArgStruct = function() {
        const self = {};
        self.length = 0;
        self[Symbol.iterator] = function() {
          const array = [];
          return array[Symbol.iterator]();
        };
        self[YIELD] = function(arg) {
          result.push(arg);
          return true;
        };
        return self;
      };
      const self = env.createInboundCaller(fn, ArgStruct)
      const binary = env.jsFunctionCallerMap.get(1);
      binary(null, usize(0x1234));
      await delay(0);
      expect(result).to.eql([ 0, 1, 2, 3, 4, null ]);
    })
    it('should display error when async generator is not expected', async function() {
      const env = new Env();
      env.finalizeAsyncCall = function() {
      };
      const fn = async function*() {
        for (let i = 0; i < 5; i++) yield i;
      };
      const ArgStruct = function() {
        const self = {};
        self.length = 0;
        self[Symbol.iterator] = function() {
          const array = [];
          return array[Symbol.iterator]();
        };
        return self;
      };
      const self = env.createInboundCaller(fn, ArgStruct)
      const binary = env.jsFunctionCallerMap.get(1);
      const [ line ] = await captureError(() => {
        binary(null, usize(0x1234));
      });
      expect(line).to.contain('Unexpected');
    })
  })
  describe('defineArgIterator', function() {
    it('should return descriptor for iterator that makes copies of objects in Zig memory', function() {
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
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 4,
      });
      env.attachMember(structStructure, {
        name: 'index',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      const Struct = env.defineStructure(structStructure);
      env.endStructure(structStructure);
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasSlot | StructureFlag.HasObject,
        byteSize: 12,
        length: 1,
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
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: structStructure,
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
      let buffer;
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      const dv = env.obtainZigView(usize(0x1000), 12);
      dv.setInt32(4, 1234, true);
      dv.setInt32(8, 5678, true);
      const args = [ ...ArgStruct(dv) ];
      expect(args).to.have.lengthOf(2);
      expect(args[0]).to.be.an.instanceOf(Struct);
      expect(args[1]).to.be.a('number');
      expect(args[0].index).to.equal(1234);
      expect(args[0][MEMORY]).to.not.have.property(ZIG);
    })
    it('should return descriptor for iterator that places allocator into options object', function() {
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
      const allocatorStructure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructFlag.IsAllocator,
        byteSize: 4,
      });
      env.attachMember(allocatorStructure, {
        name: 'index',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(allocatorStructure);
      env.endStructure(allocatorStructure);
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasSlot | StructureFlag.HasObject | ArgStructFlag.HasOptions,
        byteSize: 12,
        length: 1,
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
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: allocatorStructure,
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
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(4, 1234, true);
      dv.setInt32(8, 5678, true);
      const args = [ ...ArgStruct(dv) ];
      expect(args).to.have.lengthOf(2);
      expect(args[1]).to.be.an('object').with.property('allocator');
    })
    it('should return descriptor for iterator that places multiple allocators into options object', function() {
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
      const allocatorStructure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructFlag.IsAllocator,
        byteSize: 4,
      });
      env.attachMember(allocatorStructure, {
        name: 'index',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.defineStructure(allocatorStructure);
      env.endStructure(allocatorStructure);
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasSlot | StructureFlag.HasObject | ArgStructFlag.HasOptions,
        byteSize: 16,
        length: 1,
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
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: allocatorStructure,
      });
      env.attachMember(argStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '2',
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 96,
        byteSize: 4,
        structure: allocatorStructure,
      });
      const ArgStruct = env.defineStructure(argStructure);
      env.endStructure(argStructure);
      const dv = new DataView(new ArrayBuffer(16));
      dv.setInt32(4, 1234);
      dv.setInt32(8, 5678);
      const args = [ ...ArgStruct(dv) ];
      expect(args).to.have.lengthOf(2);
      expect(args[1]).to.be.an('object').with.property('allocator1');
      expect(args[1]).to.be.an('object').with.property('allocator2');
    })
    it('should return descriptor for iterator that places promise into options object', function() {
      const env = new Env();
      const byteStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 1,
      });
      env.attachMember(byteStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: {},
      });
      env.defineStructure(byteStructure);
      env.endStructure(byteStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsOpaque,
        byteSize: 1,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: byteStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const optionalPtrStructure = env.beginStructure({
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: addressByteSize,
      });
      env.attachMember(optionalPtrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(optionalPtrStructure, {
        type: MemberType.Bool,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        structure: {},
      });
      env.defineStructure(optionalPtrStructure);
      env.endStructure(optionalPtrStructure);
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
      const voidStructure = env.beginStructure({
        type: StructureType.Primitive,
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
      const cbArgStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject,
        byteSize: addressByteSize + 4,
        length: 2,
      })
      env.attachMember(cbArgStructure, {
        name: 'retval',
        type: MemberType.Void,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: voidStructure,
      });
      env.attachMember(cbArgStructure, {
        name: '0',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        structure: optionalPtrStructure,
        slot: 0,
      });
      env.attachMember(cbArgStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: addressSize,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(cbArgStructure);
      env.endStructure(cbArgStructure);
      const cbStructure = env.beginStructure({
        type: StructureType.Function,
        byteSize: 0,
        length: 1,
      })
      env.attachMember(cbStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: cbArgStructure,
        slot: 0,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(cbStructure, thunk, false);
      const jsControllerThunk = { [MEMORY]: zig(0x2004) };
      env.attachTemplate(cbStructure, jsControllerThunk, true);
      env.defineStructure(cbStructure);
      env.endStructure(cbStructure);
      const cbPtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(cbPtrStructure, {
        type: MemberType.Object,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: cbStructure,
        slot: 0,
      });
      env.defineStructure(cbPtrStructure);
      env.endStructure(cbPtrStructure);
      const promiseStructure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructFlag.IsPromise,
        byteSize: addressByteSize * 2,
      });
      env.attachMember(promiseStructure, {
        name: 'ptr',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        structure: optionalPtrStructure,
        slot: 0,
      });
      env.attachMember(promiseStructure, {
        name: 'callback',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: addressSize,
        byteSize: addressByteSize,
        structure: cbPtrStructure,
        slot: 1,
      });
      env.defineStructure(promiseStructure);
      env.endStructure(promiseStructure);
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | ArgStructFlag.HasOptions,
        byteSize: 4 + addressByteSize * 2 + 4,
        length: 1,
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
        type: MemberType.Object,
        bitSize: addressSize * 2,
        bitOffset: 32,
        byteSize: addressByteSize * 2,
        structure: promiseStructure,
        slot: 0,
      });
      env.attachMember(argStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: (4 + addressByteSize * 2) * 8,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(argStructure);
      env.endStructure(argStructure);
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 4 });
      } else {
        const bufferMap = new Map();
        env.obtainExternBuffer = function(address, len) {
          let buffer = bufferMap.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            bufferMap.set(address, buffer);
          }
          return buffer;
        };
      }
      const dv = env.obtainZigView(usize(0x1000), argStructure.byteSize);
      if (addressByteSize === 4) {
        dv.setInt32(4, 0x3000, true);
        dv.setInt32(8, 0x2000, true);
        dv.setInt32(12, 1234, true);
      } else {
        dv.setBigInt64(4, 0x3000n, true);
        dv.setBigInt64(12, 0x2000n, true);
        dv.setInt32(20, 1234, true);
      }
      const args = [ ...ArgStruct(dv) ];
      expect(args).to.have.lengthOf(2);
      expect(args[1]).to.be.an('object').with.property('callback');
      const { callback } = args[1];
      let arg;
      env.invokeThunk = function(thunk, fn, argStruct) {
        arg = argStruct['1'];
      };
      env.runThunk = function() {};
      expect(() => callback(44)).to.not.throw();
      expect(arg).to.equal(44);
      expect(() => callback(null, 33)).to.not.throw();
      expect(arg).to.equal(33);
    })
    it('should return descriptor for iterator that places generator into options object', function() {
      const env = new Env();
      const byteStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 1,
      });
      env.attachMember(byteStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: {},
      });
      env.defineStructure(byteStructure);
      env.endStructure(byteStructure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsOpaque,
        byteSize: 1,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: byteStructure,
      });
      env.defineStructure(sliceStructure);
      env.endStructure(sliceStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const optionalPtrStructure = env.beginStructure({
        type: StructureType.Optional,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        byteSize: addressByteSize,
      });
      env.attachMember(optionalPtrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(optionalPtrStructure, {
        type: MemberType.Bool,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        structure: {},
      });
      env.defineStructure(optionalPtrStructure);
      env.endStructure(optionalPtrStructure);
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
      const voidStructure = env.beginStructure({
        type: StructureType.Primitive,
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
      const cbArgStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject,
        byteSize: addressByteSize + 4,
        length: 2,
      })
      env.attachMember(cbArgStructure, {
        name: 'retval',
        type: MemberType.Void,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: voidStructure,
      });
      env.attachMember(cbArgStructure, {
        name: '0',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        structure: optionalPtrStructure,
        slot: 0,
      });
      env.attachMember(cbArgStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: addressSize,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(cbArgStructure);
      env.endStructure(cbArgStructure);
      const cbStructure = env.beginStructure({
        type: StructureType.Function,
        byteSize: 0,
        length: 1,
      })
      env.attachMember(cbStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: cbArgStructure,
        slot: 0,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(cbStructure, thunk, false);
      const jsControllerThunk = { [MEMORY]: zig(0x2004) };
      env.attachTemplate(cbStructure, jsControllerThunk, true);
      env.defineStructure(cbStructure);
      env.endStructure(cbStructure);
      const cbPtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(cbPtrStructure, {
        type: MemberType.Object,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: cbStructure,
        slot: 0,
      });
      env.defineStructure(cbPtrStructure);
      env.endStructure(cbPtrStructure);
      const generatorStructure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructFlag.IsGenerator,
        byteSize: addressByteSize * 2,
      });
      env.attachMember(generatorStructure, {
        name: 'ptr',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        structure: optionalPtrStructure,
        slot: 0,
      });
      env.attachMember(generatorStructure, {
        name: 'callback',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: addressSize,
        byteSize: addressByteSize,
        structure: cbPtrStructure,
        slot: 1,
      });
      env.defineStructure(generatorStructure);
      env.endStructure(generatorStructure);
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | ArgStructFlag.HasOptions,
        byteSize: 4 + addressByteSize * 2 + 4,
        length: 1,
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
        type: MemberType.Object,
        bitSize: addressSize * 2,
        bitOffset: 32,
        byteSize: addressByteSize * 2,
        structure: generatorStructure,
        slot: 0,
      });
      env.attachMember(argStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: (4 + addressByteSize * 2) * 8,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(argStructure);
      env.endStructure(argStructure);
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 4 });
      } else {
        const bufferMap = new Map();
        env.obtainExternBuffer = function(address, len) {
          let buffer = bufferMap.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            bufferMap.set(address, buffer);
          }
          return buffer;
        };
      }
      const dv = env.obtainZigView(usize(0x1000), argStructure.byteSize);
      if (addressByteSize === 4) {
        dv.setInt32(4, 0x3000, true);
        dv.setInt32(8, 0x2000, true);
        dv.setInt32(12, 1234, true);
      } else {
        dv.setBigInt64(4, 0x3000n, true);
        dv.setBigInt64(12, 0x2000n, true);
        dv.setInt32(20, 1234, true);
      }
      const args = [ ...ArgStruct(dv) ];
      expect(args).to.have.lengthOf(2);
      expect(args[1]).to.be.an('object').with.property('callback');
      const { callback } = args[1];
      let arg;
      env.invokeThunk = function(thunk, fn, argStruct) {
        arg = argStruct['1'];
      };
      env.runThunk = function() {};
      expect(() => callback(44)).to.not.throw();
      expect(arg).to.equal(44);
      expect(() => callback(null, 33)).to.not.throw();
      expect(arg).to.equal(33);
    })

    it('should return descriptor for iterator that places abort signal into options object', async function() {
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
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 0,
        structure: intStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const signalStructure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructFlag.IsAbortSignal,
        byteSize: addressByteSize,
      });
      env.attachMember(signalStructure, {
        name: 'ptr',
        type: MemberType.Object,
        bitSize: addressByteSize * 8,
        bitOffset: 0,
        byteSize: addressByteSize,
        structure: ptrStructure,
        slot: 0,
      });
      env.defineStructure(signalStructure);
      env.endStructure(signalStructure);
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasSlot | StructureFlag.HasObject | ArgStructFlag.HasOptions,
        byteSize: 4 + addressByteSize + 4 + addressByteSize,
        length: 1,
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
        type: MemberType.Object,
        bitSize: addressByteSize * 8,
        bitOffset: 32,
        byteSize: addressByteSize,
        structure: signalStructure,
        slot: 0,
      });
      env.attachMember(argStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: (4 + addressByteSize) * 8,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '2',
        type: MemberType.Object,
        bitSize: addressByteSize * 8,
        bitOffset: (4 + addressByteSize + 4) * 8,
        byteSize: addressByteSize,
        structure: signalStructure,
        slot: 1,
      });
      const ArgStruct = env.defineStructure(argStructure);
      env.endStructure(argStructure);
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 4 });
      } else {
        const bufferMap = new Map();
        env.obtainExternBuffer = function(address, len) {
          let buffer = bufferMap.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            bufferMap.set(address, buffer);
          }
          return buffer;
        };
      }
      const dv = env.obtainZigView(usize(0x1000), argStructure.byteSize);
      if (addressByteSize === 4) {
        dv.setInt32(4, 0x2000, true);
        dv.setInt32(8, 1234, true);
        dv.setInt32(12, 0x3000, true);
      } else {
        dv.setBigInt64(4, 0x2000n, true);
        dv.setBigInt64(12, 1234n, true);
        dv.setBigInt64(16, 0x3000n, true);
      }
      const args = [ ...ArgStruct(dv) ];
      expect(args).to.have.lengthOf(2);
      expect(args[1]).to.be.an('object').with.property('signal');
      const { signal } = args[1];
      expect(signal.aborted).to.be.false;
      setTimeout(() => {
        const int = env.obtainZigView(usize(0x2000), 4);
        int.setInt32(0, 1, true);
      }, 10);
      await delay(100);
      expect(signal.aborted).to.be.true;
    })
    it('should set abort signal to signaled initially if integer is already non-zero', async function() {
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
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        slot: 0,
        structure: intStructure,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const signalStructure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructFlag.IsAbortSignal,
        byteSize: addressByteSize,
      });
      env.attachMember(signalStructure, {
        name: 'ptr',
        type: MemberType.Object,
        bitSize: addressByteSize * 8,
        bitOffset: 0,
        byteSize: addressByteSize,
        structure: ptrStructure,
        slot: 0,
      });
      env.defineStructure(signalStructure);
      env.endStructure(signalStructure);
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasSlot | StructureFlag.HasObject | ArgStructFlag.HasOptions,
        byteSize: 4 + addressByteSize + 4 + addressByteSize,
        length: 1,
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
        type: MemberType.Object,
        bitSize: addressByteSize * 8,
        bitOffset: 32,
        byteSize: addressByteSize,
        structure: signalStructure,
        slot: 0,
      });
      env.attachMember(argStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: (4 + addressByteSize) * 8,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '2',
        type: MemberType.Object,
        bitSize: addressByteSize * 8,
        bitOffset: (4 + addressByteSize + 4) * 8,
        byteSize: addressByteSize,
        structure: signalStructure,
        slot: 1,
      });
      const ArgStruct = env.defineStructure(argStructure);
      env.endStructure(argStructure);
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 4 });
      } else {
        const bufferMap = new Map();
        env.obtainExternBuffer = function(address, len) {
          let buffer = bufferMap.get(address);
          if (!buffer) {
            buffer = new ArrayBuffer(len);
            bufferMap.set(address, buffer);
          }
          return buffer;
        };
      }
      const dv = env.obtainZigView(usize(0x1000), argStructure.byteSize);
      if (addressByteSize === 4) {
        dv.setInt32(4, 0x2000, true);
        dv.setInt32(8, 1234, true);
        dv.setInt32(12, 0x3000, true);
      } else {
        dv.setBigInt64(4, 0x2000n, true);
        dv.setBigInt64(12, 1234n, true);
        dv.setBigInt64(16, 0x3000n, true);
      }
      const int = env.obtainZigView(usize(0x2000), 4);
      int.setInt32(0, 1, true);
      const args = [ ...ArgStruct(dv) ];
      expect(args).to.have.lengthOf(2);
      expect(args[1]).to.be.an('object').with.property('signal');
      const { signal } = args[1];
      expect(signal.aborted).to.be.true;
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
      dv[ZIG] = { address: usize(0x1234), len: 0 };
      const controller = { [MEMORY]: dv };
      env.createJsThunk = function() {
        return usize(0x1000);
      };
      let called = true;
      env.destroyJsThunk = function() {
        called = true;
        return 1;
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
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

function zig(address, len = 0) {
  const dv = new DataView(new ArrayBuffer(len));
  dv[ZIG] = { address: usize(address), len };
  return dv;
}
