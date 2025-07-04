import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import {
  ErrorSetFlag,
  MemberType, PointerFlag, SliceFlag, StructFlag, StructureFlag, StructureType,
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { Exit } from '../../src/errors.js';
import '../../src/mixins.js';
import {
  ALIGN, ATTRIBUTES, COPY, FINALIZE, MEMORY, PROMISE, RETURN, SETTERS, SLOTS, VISIT, ZIG,
} from '../../src/symbols.js';
import { defineProperties, defineProperty } from '../../src/utils.js';
import { addressByteSize, addressSize, usize } from '../test-utils.js';

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
      env.allocateScratchMemory = function(len, align) {
        return usize(0x4000);
      };
      env.freeScratchMemory = function() {
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
        env.allocateScratchMemory = function(len, align) {
          return 0x1000;
        };
        env.freeScratchMemory = function() {};
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
        env.allocateScratchMemory = function(len, align) {
          return 0x1000;
        };
        env.freeScratchMemory = function() {};
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
        env.allocateScratchMemory = function(len, align) {
          return 0x1000;
        };
        env.freeScratchMemory = function() {};
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
        env.allocateScratchMemory = function(len, align) {
          return 0x1000;
        };
        env.freeScratchMemory = function() {};
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
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
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
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
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
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
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
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
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
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
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
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
      const options = undefined;
      const allocator = new Allocator({ index: 1234 });
      env.createDefaultAllocator = function() {
        return allocator;
      };
      env.copyArguments(dest, src, members, options);
      expect(dest).to.eql({ [0]: allocator, [1]: 2 });
    })
    it('should place promise callback into the right position', function() {
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
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
      const callback = () => {};
      const options = { callback };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
      env.copyArguments(dest, src, members, options);
      expect(dest[0]).to.equal(1);
      expect(dest[1]).to.have.property('callback').that.is.a('function');
    })
    it('should place generator callback into the right position', function() {
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
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
      const callback = () => {};
      const options = { callback };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
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
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
      const { signal }  = new AbortController();
      const options = { signal };
      env.copyArguments(dest, src, members, options);
      expect(dest[0]).to.equal(1);
      expect(dest[1]).to.have.property('ptr');
    })
    it('should convert web stream reader to AnyReader struct', function() {
      const env = new Env();
      const usizeStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: addressByteSize,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(usizeStructure, {
        type: MemberType.Int,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        structure: usizeStructure,
      });
      env.defineStructure(usizeStructure);
      env.endStructure(usizeStructure);
      const anyErrorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        flags: ErrorSetFlag.IsGlobal,
        name: 'anyerror',
        byteSize: 2,
      });
      env.attachMember(anyErrorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: anyErrorStructure,
      });
      env.defineStructure(anyErrorStructure);
      const retvalStructure = env.beginStructure({
        type: StructureType.ErrorUnion,
        byteSize: addressByteSize + 2,
      });
      env.attachMember(retvalStructure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: addressSize,
        byteSize: addressByteSize,
        structure: usizeStructure,
      });
      env.attachMember(retvalStructure, {
        name: 'error',
        type: MemberType.Uint,
        bitOffset: addressSize,
        bitSize: 16,
        byteSize: 2,
        structure: anyErrorStructure,
      });
      env.defineStructure(retvalStructure);
      const u8Structure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(u8Structure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: u8Structure,
      });
      env.defineStructure(u8Structure);
      env.finalizeStructure(u8Structure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsTypedArray,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: u8Structure,
      });
      env.defineStructure(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const slicePtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength | PointerFlag.IsConst,
        name: '[]const u8',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(slicePtrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(slicePtrStructure);
      env.endStructure(slicePtrStructure);
      const opaqueSliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsOpaque,
        byteSize: 1,
      });
      env.attachMember(opaqueSliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: u8Structure,
      });
      env.defineStructure(opaqueSliceStructure);
      env.endStructure(opaqueSliceStructure);
      const opaquePtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        byteSize: addressByteSize,
      });
      env.attachMember(opaquePtrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: opaqueSliceStructure,
      });
      env.defineStructure(opaquePtrStructure);
      env.endStructure(opaquePtrStructure);
      const readArgStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        byteSize: retvalStructure.byteSize + addressByteSize * 3,
        length: 2,
      });
      env.attachMember(readArgStructure, {
        name: 'retval',
        type: MemberType.Object,
        bitSize: retvalStructure.byteSize * 8,
        bitOffset: 0,
        byteSize: retvalStructure.byteSize,
        structure: retvalStructure,
      });
      env.attachMember(readArgStructure, {
        name: '0',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: retvalStructure.byteSize * 8,
        byteSize: addressByteSize,
        structure: opaquePtrStructure,
      });
      env.attachMember(readArgStructure, {
        name: '1',
        type: MemberType.Object,
        bitSize: addressSize * 2,
        bitOffset: retvalStructure.byteSize * 8 + addressSize,
        byteSize: addressByteSize * 2,
        structure: slicePtrStructure,
      });
      env.defineStructure(readArgStructure);
      env.endStructure(readArgStructure);
      const readStructure = env.beginStructure({
        type: StructureType.Function,
        byteSize: 0,
      });
      env.attachMember(readStructure, {
        type: MemberType.Object,
        structure: readArgStructure,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(readStructure, thunk, false);
      const jsThunkController = { [MEMORY]: zig(0x2004) };
      env.attachTemplate(readStructure, jsThunkController, true);
      env.defineStructure(readStructure);
      env.endStructure(readStructure);
      const readPtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
      });
      env.attachMember(readPtrStructure, {
        type: MemberType.Object,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: readStructure,
        slot: 0,
      });
      env.defineStructure(readPtrStructure);
      env.endStructure(readPtrStructure);
      const readerStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: addressByteSize * 2,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | StructFlag.IsReader,
      });
      env.attachMember(readerStructure, {
        name: 'context',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        structure: opaquePtrStructure,
        slot: 0,
      });
      env.attachMember(readerStructure, {
        name: 'readFn',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: addressSize,
        byteSize: addressByteSize,
        structure: readPtrStructure,
        slot: 1,
      });
      env.defineStructure(readerStructure);
      env.endStructure(readerStructure);
      const members = [
        {
          name: '0',
          type: MemberType.Int,
          bitSize: 8,
          bitOffset: 32,
          byteSize: 1,
          structure: u8Structure,
        },
        {
          name: '1',
          type: MemberType.Object,
          bitSize: readerStructure.byteSize * 8,
          bitOffset: 64,
          byteSize: readerStructure.byteSize,
          structure: readerStructure,
        },
      ];
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
      let count = 0;
      const stream = new ReadableStream({
        async pull(controller) {
          if (count++ < 4) {
            controller.enqueue(new Uint8Array(8));
          } else {
            controller.close();
          }
        }
      });
      const reader = stream.getReader();
      const src = [ 1, reader ];
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
      env.copyArguments(dest, src, members, {});
      expect(dest[0]).to.equal(1);
      expect(dest[1]).to.have.property('context').that.is.an.instanceOf(DataView);
      expect(dest[1]).to.have.property('readFn').that.is.a('function');
    })
    it('should convert web stream reader to AnyWriter struct', function() {
      const env = new Env();
      const usizeStructure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: addressByteSize,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(usizeStructure, {
        type: MemberType.Int,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        structure: usizeStructure,
      });
      env.defineStructure(usizeStructure);
      env.endStructure(usizeStructure);
      const anyErrorStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        flags: ErrorSetFlag.IsGlobal,
        name: 'anyerror',
        byteSize: 2,
      });
      env.attachMember(anyErrorStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: anyErrorStructure,
      });
      env.defineStructure(anyErrorStructure);
      const retvalStructure = env.beginStructure({
        type: StructureType.ErrorUnion,
        byteSize: addressByteSize + 2,
      });
      env.attachMember(retvalStructure, {
        name: 'value',
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: addressSize,
        byteSize: addressByteSize,
        structure: usizeStructure,
      });
      env.attachMember(retvalStructure, {
        name: 'error',
        type: MemberType.Uint,
        bitOffset: addressSize,
        bitSize: 16,
        byteSize: 2,
        structure: anyErrorStructure,
      });
      env.defineStructure(retvalStructure);
      const u8Structure = env.beginStructure({
        type: StructureType.Primitive,
        byteSize: 1,
      });
      env.attachMember(u8Structure, {
        type: MemberType.Uint,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 1,
        structure: u8Structure,
      });
      env.defineStructure(u8Structure);
      env.finalizeStructure(u8Structure);
      const sliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsTypedArray,
        name: '[_]u8',
        byteSize: 1,
      });
      env.attachMember(sliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: u8Structure,
      });
      env.defineStructure(sliceStructure);
      env.finalizeStructure(sliceStructure);
      const slicePtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength | PointerFlag.IsConst,
        name: '[]const u8',
        byteSize: addressByteSize * 2,
      });
      env.attachMember(slicePtrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: sliceStructure,
      });
      env.defineStructure(slicePtrStructure);
      env.endStructure(slicePtrStructure);
      const opaqueSliceStructure = env.beginStructure({
        type: StructureType.Slice,
        flags: SliceFlag.IsOpaque,
        byteSize: 1,
      });
      env.attachMember(opaqueSliceStructure, {
        type: MemberType.Uint,
        bitSize: 8,
        byteSize: 1,
        structure: u8Structure,
      });
      env.defineStructure(opaqueSliceStructure);
      env.endStructure(opaqueSliceStructure);
      const opaquePtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsMultiple | PointerFlag.HasLength,
        byteSize: addressByteSize,
      });
      env.attachMember(opaquePtrStructure, {
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: opaqueSliceStructure,
      });
      env.defineStructure(opaquePtrStructure);
      env.endStructure(opaquePtrStructure);
      const writeArgStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        byteSize: retvalStructure.byteSize + addressByteSize * 3,
        length: 2,
      });
      env.attachMember(writeArgStructure, {
        name: 'retval',
        type: MemberType.Object,
        bitSize: retvalStructure.byteSize * 8,
        bitOffset: 0,
        byteSize: retvalStructure.byteSize,
        structure: retvalStructure,
      });
      env.attachMember(writeArgStructure, {
        name: '0',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: retvalStructure.byteSize * 8,
        byteSize: addressByteSize,
        structure: opaquePtrStructure,
      });
      env.attachMember(writeArgStructure, {
        name: '1',
        type: MemberType.Object,
        bitSize: addressSize * 2,
        bitOffset: retvalStructure.byteSize * 8 + addressSize,
        byteSize: addressByteSize * 2,
        structure: slicePtrStructure,
      });
      env.defineStructure(writeArgStructure);
      env.endStructure(writeArgStructure);
      const writeStructure = env.beginStructure({
        type: StructureType.Function,
        byteSize: 0,
      });
      env.attachMember(writeStructure, {
        type: MemberType.Object,
        structure: writeArgStructure,
      });
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(writeStructure, thunk, false);
      const jsThunkController = { [MEMORY]: zig(0x2004) };
      env.attachTemplate(writeStructure, jsThunkController, true);
      env.defineStructure(writeStructure);
      env.endStructure(writeStructure);
      const writePtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
      });
      env.attachMember(writePtrStructure, {
        type: MemberType.Object,
        bitSize: 0,
        bitOffset: 0,
        byteSize: 0,
        structure: writeStructure,
        slot: 0,
      });
      env.defineStructure(writePtrStructure);
      env.endStructure(writePtrStructure);
      const writerStructure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: addressByteSize * 2,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | StructFlag.IsWriter,
      });
      env.attachMember(writerStructure, {
        name: 'context',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        structure: opaquePtrStructure,
        slot: 0,
      });
      env.attachMember(writerStructure, {
        name: 'writeFn',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: addressSize,
        byteSize: addressByteSize,
        structure: writePtrStructure,
        slot: 1,
      });
      env.defineStructure(writerStructure);
      env.endStructure(writerStructure);
      const members = [
        {
          name: '0',
          type: MemberType.Int,
          bitSize: 8,
          bitOffset: 32,
          byteSize: 1,
          structure: u8Structure,
        },
        {
          name: '1',
          type: MemberType.Object,
          bitSize: writerStructure.byteSize * 8,
          bitOffset: 64,
          byteSize: writerStructure.byteSize,
          structure: writerStructure,
        },
      ];
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
      let count = 0;
      const stream = new WritableStream({
        async write(buf) {
        }
      });
      const writer = stream.getWriter();
      const src = [ 1, writer ];
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
      env.copyArguments(dest, src, members, {});
      expect(dest[0]).to.equal(1);
      expect(dest[1]).to.have.property('context').that.is.an.instanceOf(DataView);
      expect(dest[1]).to.have.property('writeFn').that.is.a('function');
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
        env.allocateScratchMemory = function(len, align) {
          return 0x1000;
        };
        env.freeScratchMemory = function() {};
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
        env.allocateScratchMemory = function(len, align) {
          return 0x1000;
        };
        env.freeScratchMemory = function() {};
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
        env.allocateScratchMemory = function(len, align) {
          return 0x1000;
        };
        env.freeScratchMemory = function() {};
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
        env.allocateScratchMemory = function(len, align) {
          return 0x1000;
        };
        env.freeScratchMemory = function() {};
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
        env.allocateScratchMemory = function(len, align) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return address;
        };
        env.freeScratchMemory = function() {};
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
        env.allocateScratchMemory = function(len, align) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return address;
        };
        env.freeScratchMemory = function() {};
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
        this[PROMISE] = new Promise(resolve => this[RETURN] = resolve);
        this[FINALIZE] = function() {};
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
        env.allocateScratchMemory = function(len, align) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return address;
        };
        env.freeScratchMemory = function() {};
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
        this[PROMISE] = new Promise(resolve => this[RETURN] = resolve);
        this[FINALIZE] = function() {};
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
        env.allocateScratchMemory = function(len, align) {
          const address = nextAddress;
          nextAddress += 0x1000;
          return address;
        };
        env.freeScratchMemory = function() {};
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
        this.retval = 1234;
      };
      const thunk = { [MEMORY]: env.obtainZigView(usize(100), 0) };
      const fn = { [MEMORY]: env.obtainZigView(usize(200), 0) };
      const args = new Arg();
      const result = env.invokeThunk(thunk, fn, args);
      expect(result).to.equal(1234);
    })
  })
  describe('detectArgumentFeatures', function() {
    it('should set usingJsAllocator when a function argument is an allocator', function() {
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
      expect(env.usingJsAllocator).to.be.true;
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
