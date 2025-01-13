import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import {
  MemberType, PointerFlag, StructFlag, StructureFlag, StructureType,
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { Exit } from '../../src/errors.js';
import '../../src/mixins.js';
import {
  ALIGN, ATTRIBUTES, CALLBACK, COPY, FINALIZE, MEMORY, PROMISE, SLOTS, VISIT, ZIG,
} from '../../src/symbols.js';
import { defineProperties, defineProperty } from '../../src/utils.js';
import { usize } from '../test-utils.js';

use (ChaiAsPromised);

const Env = defineEnvironment();

describe('Feature: call-marshaling-outbound', function() {
  describe('createOutboundCaller', function() {
    it('should create a caller for invoking a Zig function', function() {
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
      const thunk = {
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      };
      thunk[MEMORY][ZIG] = { address: usize(0x1004) };
      const self = env.createOutboundCaller(thunk, ArgStruct)
      let thunkAddress, fnAddress, argAddress;
      env.runThunk = (...args) => {
        thunkAddress = args[0];
        fnAddress = args[1];
        argAddress = args[2];
        return true;
      };
      self[MEMORY] = new DataView(new ArrayBuffer(0));
      self[MEMORY][ZIG] = { address: usize(0x2008) };
      env.allocateExternMemory = function(type, len, align) {
        return usize(0x4000);
      };
      env.freeExternMemory = function() {
      }
      const bufferMap = new Map(), addressMap = new Map();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else if (process.env.TARGET === 'node') {
        let nextAddress = usize(0xf000_1000);
        env.getBufferAddress = function(buffer) {
          let address = addressMap.get(buffer);
          if (!address) {
            address = nextAddress;
            nextAddress += usize(0x1000);
            bufferMap.set(address, buffer);
            addressMap.set(buffer, address);
          }
          return address;
        }
      }
      self(1, 2);
      expect(thunkAddress).to.equal(usize(0x1004));
      expect(fnAddress).to.equal(usize(0x2008));
      let argDV;
      if (process.env.TARGET === 'wasm') {
        expect(argAddress).to.equal(usize(0x4000));
        argDV = new DataView(env.memory.buffer, 0x4000, 12);
      } else if (process.env.TARGET === 'node') {
        expect(argAddress).to.equal(usize(0xf000_1000));
        argDV = new DataView(bufferMap.get(argAddress));
      }
      const argStruct = ArgStruct(argDV);
      expect(argStruct[0]).to.equal(1);
      expect(argStruct[1]).to.equal(2);
    })
    it('should add function name to argument error', function() {
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
      const thunk = {
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      };
      thunk[MEMORY][ZIG] = { address: usize(0x1004) };
      const self = env.createOutboundCaller(thunk, ArgStruct)
      defineProperty(self, 'name', { value: 'dingo' });
      env.runThunk = () => {};
      expect(() => self('hello', 'world')).to.throw(SyntaxError)
        .with.property('message').that.match(/^dingo\(args\[0\],/);
    })
    if (process.env.TARGET === 'wasm') {
      it('should return promise when thunk runner is not ready', async function() {
        const env = new Env();
        let done;
        env.initPromise = new Promise(resolve => done = resolve);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
          this.retval = 123;
        };
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
        const self = env.createOutboundCaller(thunk, Arg);
        self[MEMORY] = env.obtainZigView(usize(200), 0);
        const promise = self();
        expect(promise).to.be.a('promise');
        let thunkAddress, fnAddress, argAddress;
        env.runThunk = function(...args) {
          thunkAddress = args[0];
          fnAddress = args[1];
          argAddress = args[2];
          return true;
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        done();
        const result = await promise;
        expect(result).to.equal(123);
        expect(thunkAddress).to.equal(100);
        expect(fnAddress).to.equal(200);
        expect(argAddress).to.equal(0x1000);
      })
      it('should not throw when an Exit error with zero is encountered', async function() {
        const env = new Env();
        let done;
        env.initPromise = new Promise(resolve => done = resolve);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
          this.retval = 123;
        };
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
        const self = env.createOutboundCaller(thunk, Arg);
        self[MEMORY] = env.obtainZigView(usize(200), 0);
        const promise = self();
        expect(promise).to.be.a('promise');
        env.runThunk = function(...args) {
          throw new Exit(0);
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        done();
        await expect(promise).to.eventually.be.fulfilled;
      })
      it('should throw when thunk runner eventually returns a false', async function() {
        const env = new Env();
        let done;
        env.initPromise = new Promise(resolve => done = resolve);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
          this.retval = 123;
        };
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
        const self = env.createOutboundCaller(thunk, Arg);
        self[MEMORY] = env.obtainZigView(usize(200), 0);
        const promise = self();
        expect(promise).to.be.a('promise');
        env.runThunk = function(...args) {
          return false;
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        done();
        await expect(promise).to.eventually.be.rejectedWith();
      })
      it('should throw when function exits with non-zero code', async function() {
        const env = new Env();
        let done;
        env.initPromise = new Promise(resolve => done = resolve);
        const Arg = function() {
          this[MEMORY] = new DataView(new ArrayBuffer(4));
          this[MEMORY][ALIGN] = 4;
          this.retval = 123;
        };
        defineProperties(Arg.prototype, {
          [COPY]: env.defineCopier(4),
        });
        env.memory = new WebAssembly.Memory({ initial: 1 });
        const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
        const self = env.createOutboundCaller(thunk, Arg);
        self[MEMORY] = env.obtainZigView(usize(200), 0);
        const promise = self();
        expect(promise).to.be.a('promise');
        env.runThunk = function(...args) {
          throw new Exit(-1);
        };
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.flushStdout = function() {};
        done();
        await expect(promise).to.eventually.be.rejectedWith(Exit).with.property('code', -1);
      })
    }
  })
  describe('copyArguments', function() {
    it('should copy arguments into arg struct', function() {
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
      const members = [
        {
          name: '0',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: intStructure,
        },
        {
          name: '1',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 64,
          byteSize: 4,
          structure: intStructure,
        },
      ];
      const src = [ 1, 2 ];
      const dest = {};
      const options = undefined;
      env.copyArguments(dest, src, members, options);
      expect(dest).to.eql({ [0]: 1, [1]: 2 });
    })
    it('should throw when argument given is undefined', function() {
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
      const members = [
        {
          name: '0',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: intStructure,
        },
        {
          name: '1',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 64,
          byteSize: 4,
          structure: intStructure,
        },
      ];
      const src = [ undefined, 2 ];
      const dest = {};
      const options = undefined;
      expect(() => env.copyArguments(dest, src, members, options)).to.throw();
    })
    it('should not throw when void argument gets an undefined value', function() {
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

      const voidStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Void',
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
      const members = [
        {
          name: '0',
          type: MemberType.Void,
          bitSize: 0,
          bitOffset: 32,
          byteSize: 0,
          structure: voidStructure,
        },
        {
          name: '1',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: intStructure,
        },
      ];
      const src = [ undefined, 2 ];
      const dest = {};
      const options = undefined;
      expect(() => env.copyArguments(dest, src, members, options)).to.not.throw();
    })
    it('should place allocator into the right position', function() {
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
      const Allocator = env.defineStructure(allocatorStructure);
      env.endStructure(allocatorStructure);
      const members = [
        {
          name: '0',
          type: MemberType.Object,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: allocatorStructure,
        },
        {
          name: '1',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 64,
          byteSize: 4,
          structure: intStructure,
        },
      ];
      const src = [ 2 ];
      const dest = {};
      const allocator = new Allocator({ index: 1234 });
      const options = { allocator };
      env.copyArguments(dest, src, members, options);
      expect(dest).to.eql({ [0]: allocator, [1]: 2 });
    })
    it('should correctly handle multiple allocators', function() {
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
      const Allocator = env.defineStructure(allocatorStructure);
      env.endStructure(allocatorStructure);
      const members = [
        {
          name: '0',
          type: MemberType.Object,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: allocatorStructure,
        },
        {
          name: '1',
          type: MemberType.Object,
          bitSize: 32,
          bitOffset: 64,
          byteSize: 4,
          structure: allocatorStructure,
        },
      ];
      const src = [ 2 ];
      const dest = {};
      const allocator1 = new Allocator({ index: 1234 });
      const allocator2 = new Allocator({ index: 1234 });
      const options = { allocator1, allocator2 };
      env.copyArguments(dest, src, members, options);
      expect(dest).to.eql({ [0]: allocator1, [1]: allocator2 });
    })
    it('should use default allocator when one is not provided', function() {
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
      const Allocator = env.defineStructure(allocatorStructure);
      env.endStructure(allocatorStructure);
      const members = [
        {
          name: '0',
          type: MemberType.Object,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: allocatorStructure,
        },
        {
          name: '1',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 64,
          byteSize: 4,
          structure: intStructure,
        },
      ];
      const src = [ 2 ];
      const dest = {};
      const options = undefined;
      const allocator = new Allocator({ index: 1234 });
      env.createDefaultAllocator = function() {
        return allocator;
      };
      env.copyArguments(dest, src, members, options);
      expect(dest).to.eql({ [0]: allocator, [1]: 2 });
    })
    it('should promise place callback into the right position', function() {
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
      const members = [
        {
          name: '0',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: intStructure,
        },
        {
          name: '1',
          type: MemberType.Object,
          bitSize: 64,
          bitOffset: 64,
          byteSize: 8,
          structure: promiseStructure,
        },
      ];
      const src = [ 1 ];
      const dest = {};
      const callback = () => {};
      const options = { callback };
      env.copyArguments(dest, src, members, options);
      expect(dest[0]).to.equal(1);
      expect(dest[1]).to.have.property('callback').that.is.a('function');
    })
    it('should generator place callback into the right position', function() {
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
      const yieldArgStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Resolve',
        byteSize: 4,
        length: 1,
      });
      env.attachMember(yieldArgStructure, {
        name: 'retval',
        type: MemberType.Void,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: voidStructure,
      });
      env.attachMember(yieldArgStructure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(yieldArgStructure);
      env.endStructure(yieldArgStructure);
      const yieldStructure = env.beginStructure({
        type: StructureType.Function,
        byteSize: 0,
      });
      env.attachMember(yieldStructure, {
        type: MemberType.Object,
        structure: yieldArgStructure,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(yieldStructure, thunk, false);
      const jsThunkController = { [MEMORY]: zig(0x2004) };
      env.attachTemplate(yieldStructure, jsThunkController, true);
      env.defineStructure(yieldStructure);
      env.endStructure(yieldStructure);
      const yieldPtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
      });
      env.attachMember(yieldPtrStructure, {
        type: MemberType.Object,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: yieldStructure,
        slot: 0,
      });
      env.defineStructure(yieldPtrStructure);
      env.endStructure(yieldPtrStructure);
      const generatorStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | StructFlag.IsGenerator,
      });
      env.attachMember(generatorStructure, {
        name: 'callback',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: yieldPtrStructure,
        slot: 0,
      });
      env.defineStructure(generatorStructure);
      env.endStructure(generatorStructure);
      const members = [
        {
          name: '0',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: intStructure,
        },
        {
          name: '1',
          type: MemberType.Object,
          bitSize: 64,
          bitOffset: 64,
          byteSize: 8,
          structure: generatorStructure,
        },
      ];
      const src = [ 1 ];
      const dest = {};
      const callback = () => {};
      const options = { callback };
      env.copyArguments(dest, src, members, options);
      expect(dest[0]).to.equal(1);
      expect(dest[1]).to.have.property('callback').that.is.a('function');
    })
    it('should place abort signal into the right position', function() {
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
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
        slot: 0,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const signalStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | StructFlag.IsAbortSignal,
      });
      env.attachMember(signalStructure, {
        name: 'ptr',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: ptrStructure,
        slot: 0,
      });
      env.defineStructure(signalStructure);
      env.endStructure(signalStructure);
      const members = [
        {
          name: '0',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: intStructure,
        },
        {
          name: '1',
          type: MemberType.Object,
          bitSize: 32,
          bitOffset: 64,
          byteSize: 4,
          structure: signalStructure,
        },
      ];
      const src = [ 1 ];
      const dest = {};
      const { signal }  = new AbortController();
      const options = { signal };
      env.copyArguments(dest, src, members, options);
      expect(dest[0]).to.equal(1);
      expect(dest[1]).to.have.property('ptr');
    })
  })
  describe('invokeThunk', function() {
    it('should call runThunk', function() {
      const env = new Env();
      let thunkAddress, fnAddress, argAddress;
      env.runThunk = function(...args) {
        thunkAddress = args[0];
        fnAddress = args[1];
        argAddress = args[2];
        return true;
      };
      if (process.env.TARGET === 'wasm') {
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
        }
      }
      env.flushStdout = function() {};
      const Arg = function() {
        this[MEMORY] = new DataView(new ArrayBuffer(4));
        this[MEMORY][ALIGN] = 4;
      };
      const args = new Arg();
      const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainZigView(usize(200), 0) };
      env.invokeThunk(thunk, fn, args);
      expect(thunkAddress).to.equal(usize(100));
      expect(fnAddress).to.equal(usize(200));
      expect(argAddress).to.equal(usize(0x1000));
    })
    it('should attach finalize function to arg struct of async call', function () {
      const env = new Env();
      env.runThunk = function(...args) {
        return true;
      };
      if (process.env.TARGET === 'wasm') {
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
        }
      }
      env.flushStdout = function() {};
      const Arg = function() {
        this[MEMORY] = new DataView(new ArrayBuffer(4));
        this[MEMORY][ALIGN] = 4;
        this[FINALIZE] = null;
      };
      const args = new Arg();
      const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainZigView(usize(200), 0) };
      env.invokeThunk(thunk, fn, args);
      expect(args[FINALIZE]).to.be.a('function');
    })
    it('should attempt to update pointers in argument struct', function() {
      const env = new Env();
      let thunkAddress, fnAddress, argAddress;
      env.runThunk = function(...args) {
        thunkAddress = args[0];
        fnAddress = args[1];
        argAddress = args[2];
        return true;
      };
      if (process.env.TARGET === 'wasm') {
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
        };
      }
      env.flushStdout = function() {};
      const Arg = function() {
        this[MEMORY] = new DataView(new ArrayBuffer(4));
        this[MEMORY][ALIGN] = 4;
      };
      let called = false;
      defineProperties(Arg.prototype, {
        [VISIT]: {
          value() {
            called = true;
          }
        }
      });
      const args = new Arg();
      const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainZigView(usize(200), 0) };
      env.invokeThunk(thunk, fn, args);
      expect(called).to.equal(true);
    })
    it('should throw when runThunk returns false', function() {
      const env = new Env();
      env.runThunk = function(...args) {
        return false;
      };
      if (process.env.TARGET === 'wasm') {
        env.allocateExternMemory = function(type, len, align) {
          return 0x1000;
        };
        env.freeExternMemory = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
        };
      }
      env.flushStdout = function() {};
      const Arg = function() {
        this[MEMORY] = new DataView(new ArrayBuffer(4));
        this[MEMORY][ALIGN] = 4;
      };
      const args = new Arg();
      const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainZigView(usize(200), 0) };
      expect(() => env.invokeThunk(thunk, fn, args)).to.throw(Error)
        .with.property('message').that.contains('Zig');
    })
    it('should use variadic handler when argument struct has attributes', function() {
      const env = new Env();
      let recv, thunkAddress, fnAddress, argAddress, attrAddress;
      env.runThunk = function() {};
      env.runVariadicThunk = function(...args) {
        recv = this;
        thunkAddress = args[0];
        fnAddress = args[1];
        argAddress = args[2];
        attrAddress = args[3];
        return true;
      };
      let nextAddress = 0x1000;
      if (process.env.TARGET === 'wasm') {
        env.allocateExternMemory = function(type, len, align) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return address;
        };
        env.freeExternMemory = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.getBufferAddress = function(buffer) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return usize(address);
        };
      }
      env.flushStdout = function() {};
      const Attributes = function() {
        this[MEMORY] = new DataView(new ArrayBuffer(16));
      };
      const Arg = function() {
        this[MEMORY] = new DataView(new ArrayBuffer(16));
        this[MEMORY][ALIGN] = 4;
        this[SLOTS] = { 0: {} };
        this[ATTRIBUTES] = new Attributes();
        this.retval = 123;
      };
      const args = new Arg();
      const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainZigView(usize(200), 0) };
      env.invokeThunk(thunk, fn, args);
      expect(recv).to.equal(env);
      expect(thunkAddress).to.equal(usize(100));
      expect(fnAddress).to.equal(usize(200));
      expect(argAddress).to.equal(usize(0x1000));
      expect(attrAddress).to.equal(usize(0x2000));
    })
    it('should return a promise when arg struct has an attached callback', function() {
      const env = new Env();
      env.runThunk = () => true;
      let nextAddress = 0x1000;
      if (process.env.TARGET === 'wasm') {
        env.allocateExternMemory = function(type, len, align) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return address;
        };
        env.freeExternMemory = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.getBufferAddress = function(buffer) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return usize(address);
        };
      }
      const Arg = function() {
        this[MEMORY] = new DataView(new ArrayBuffer(16));
        this[MEMORY][ALIGN] = 4;
        this[PROMISE] = new Promise((resolve) => {
          this[CALLBACK] = (ptr, arg) => resolve(arg);
        });
        this.retval = 1234;
      };
      const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainZigView(usize(200), 0) };
      const args = new Arg();
      const result = env.invokeThunk(thunk, fn, args);
      expect(result).to.be.a('promise');
    })
    it('should reject a promise when retrieval of retval throws', function() {
      const env = new Env();
      env.runThunk = () => true;
      let nextAddress = 0x1000;
      if (process.env.TARGET === 'wasm') {
        env.allocateExternMemory = function(type, len, align) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return address;
        };
        env.freeExternMemory = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.getBufferAddress = function(buffer) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return usize(address);
        };
      }
      const Arg = function() {
        this[MEMORY] = new DataView(new ArrayBuffer(16));
        this[MEMORY][ALIGN] = 4;
        this[PROMISE] = new Promise((resolve) => {
          this[CALLBACK] = (ptr, arg) => resolve(arg);
        });
        defineProperty(this, 'retval', {
          get() {
            throw new Error('Doh!');
          }
        });
      };
      const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainZigView(usize(200), 0) };
      const args = new Arg();
      const result = env.invokeThunk(thunk, fn, args);
      expect(result).to.eventually.be.rejected;
    })
    it('should invoke callback function', function() {
      const env = new Env();
      env.runThunk = () => true;
      let nextAddress = 0x1000;
      if (process.env.TARGET === 'wasm') {
        env.allocateExternMemory = function(type, len, align) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return address;
        };
        env.freeExternMemory = function() {};
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.getBufferAddress = function(buffer) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return usize(address);
        };
      }
      let retval;
      const Arg = function() {
        this[MEMORY] = new DataView(new ArrayBuffer(16));
        this[MEMORY][ALIGN] = 4;
        this[CALLBACK] = (ptr, arg) => retval = arg;
        this.retval = 1234;
      };
      const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainZigView(usize(200), 0) };
      const args = new Arg();
      const result = env.invokeThunk(thunk, fn, args);
      expect(result).to.be.undefined;
      expect(retval).to.equal(1234);
    })

  })
  describe('detectArgumentFeatures', function() {
    it('should set usingDefaultAllocator when a function argument is an allocator', function() {
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
      const Allocator = env.defineStructure(allocatorStructure);
      env.endStructure(allocatorStructure);
      const members = [
        {
          name: '0',
          type: MemberType.Object,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: allocatorStructure,
        },
        {
          name: '1',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 64,
          byteSize: 4,
          structure: intStructure,
        },
      ];
      env.detectArgumentFeatures(members);
      expect(env.usingDefaultAllocator).to.be.true;
    })
    it('should set usingPromise when a function argument is a promise', function() {
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
      const members = [
        {
          name: '0',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: intStructure,
        },
        {
          name: '1',
          type: MemberType.Object,
          bitSize: 64,
          bitOffset: 64,
          byteSize: 8,
          structure: promiseStructure,
        },
      ];
      env.detectArgumentFeatures(members);
      expect(env.usingPromise).to.be.true;
    })
    it('should set usingGenerator when a function argument is a generator', function() {
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
      const yieldArgStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        byteSize: 4,
        length: 1,
      });
      env.attachMember(yieldArgStructure, {
        name: 'retval',
        type: MemberType.Void,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: voidStructure,
      });
      env.attachMember(yieldArgStructure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(yieldArgStructure);
      env.endStructure(yieldArgStructure);
      const yieldStructure = env.beginStructure({
        type: StructureType.Function,
        byteSize: 0,
      });
      env.attachMember(yieldStructure, {
        type: MemberType.Object,
        structure: yieldArgStructure,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(yieldStructure, thunk, false);
      const jsThunkController = { [MEMORY]: zig(0x2004) };
      env.attachTemplate(yieldStructure, jsThunkController, true);
      env.defineStructure(yieldStructure);
      env.endStructure(yieldStructure);
      const yieldPtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
      });
      env.attachMember(yieldPtrStructure, {
        type: MemberType.Object,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: yieldStructure,
        slot: 0,
      });
      env.defineStructure(yieldPtrStructure);
      env.endStructure(yieldPtrStructure);
      const generatorStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | StructFlag.IsGenerator,
      });
      env.attachMember(generatorStructure, {
        name: 'callback',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: yieldPtrStructure,
        slot: 0,
      });
      env.defineStructure(generatorStructure);
      env.endStructure(generatorStructure);
      const members = [
        {
          name: '0',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: intStructure,
        },
        {
          name: '1',
          type: MemberType.Object,
          bitSize: 64,
          bitOffset: 64,
          byteSize: 8,
          structure: generatorStructure,
        },
      ];
      env.detectArgumentFeatures(members);
      expect(env.usingGenerator).to.be.true;
    })
    it('should set usingAbortSignal when a function argument is an abort signal', function() {
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
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
        slot: 0,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const signalStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | StructFlag.IsAbortSignal,
      });
      env.attachMember(signalStructure, {
        name: 'ptr',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: ptrStructure,
        slot: 0,
      });
      env.defineStructure(signalStructure);
      env.endStructure(signalStructure);
      const members = [
        {
          name: '0',
          type: MemberType.Int,
          bitSize: 32,
          bitOffset: 32,
          byteSize: 4,
          structure: intStructure,
        },
        {
          name: '1',
          type: MemberType.Object,
          bitSize: 32,
          bitOffset: 64,
          byteSize: 4,
          structure: signalStructure,
        },
      ];
      env.detectArgumentFeatures(members);
      expect(env.usingAbortSignal).to.be.true;
    })
  })
})

function zig(address, len = 0) {
  const dv = new DataView(new ArrayBuffer(len));
  dv[ZIG] = { address: usize(address), len };
  return dv;
}
