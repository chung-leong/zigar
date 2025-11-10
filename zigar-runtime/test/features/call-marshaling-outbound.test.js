import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import {
  MemberType, PointerFlag, StructureFlag, StructurePurpose, StructureType
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import { Exit } from '../../src/errors.js';
import '../../src/mixins.js';
import {
  ALIGN, ATTRIBUTES, FINALIZE, MEMORY, PROMISE, RETURN, SETTERS, SLOTS, VISIT, ZIG,
} from '../../src/symbols.js';
import { defineProperties, defineProperty, usize } from '../../src/utils.js';
import { addressByteSize, addressSize } from '../test-utils.js';

use (ChaiAsPromised);

const Env = defineEnvironment();

describe('Feature: call-marshaling-outbound', function() {
  describe('createOutboundCaller', function() {
    it('should create a caller for invoking a Zig function', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const structure = {
        type: StructureType.ArgStruct,
        byteSize: 4 * 3,
        length: 2,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'retval',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
            },
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
          ]
        },
        static: {},
      }
      env.beginStructure(structure);
      env.finishStructure(structure);
      const ArgStruct = structure.constructor;
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
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
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
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
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
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const voidStructure = {
        type: StructureType.Primitive,
        name: 'Void',
        byteSize: 0,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Void,
              bitSize: 0,
              bitOffset: 0,
              byteSize: 0,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(voidStructure);
      env.finishStructure(voidStructure);
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
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const allocatorStructure = {
        type: StructureType.Struct,
        purpose: StructurePurpose.Allocator,
        flags: 0,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'index',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(allocatorStructure);
      env.finishStructure(allocatorStructure);
      const Allocator = allocatorStructure.constructor;
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
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const allocatorStructure = {
        type: StructureType.Struct,
        purpose: StructurePurpose.Allocator,
        flags: 0,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'index',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(allocatorStructure);
      env.finishStructure(allocatorStructure);
      const Allocator = allocatorStructure.constructor;
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
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const allocatorStructure = {
        type: StructureType.Struct,
        purpose: StructurePurpose.Allocator,
        flags: 0,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'index',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(allocatorStructure);
      env.finishStructure(allocatorStructure);
      const Allocator = allocatorStructure.constructor;
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
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      }
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const voidStructure = {
        type: StructureType.Primitive,
        name: 'void',
        byteSize: 0,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Void,
              bitSize: 0,
              bitOffset: 0,
              byteSize: 0,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(voidStructure);
      env.finishStructure(voidStructure);
      const resolveArgStructure = {
        type: StructureType.ArgStruct,
        name: 'Resolve',
        byteSize: 4,
        length: 1,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'retval',
              type: MemberType.Void,
              bitSize: 0,
              bitOffset: 0,
              byteSize: 0,
              structure: voidStructure,
            },
            {
              name: '0',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 32,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(resolveArgStructure);
      env.finishStructure(resolveArgStructure);
      const resolveStructure = {
        type: StructureType.Function,
        byteSize: 0,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              structure: resolveArgStructure,
            },
          ],
          instance: { 
            [MEMORY]: zig(0x1004),
          },
        },
        static: {
          instance: { 
            [MEMORY]: zig(0x2004),
          },
        },
      };
      env.beginStructure(resolveStructure);
      env.finishStructure(resolveStructure);
      const resolvePtrStructure = {
        type: StructureType.Pointer,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 0,
              bitOffset: 0,
              byteSize: 0,
              structure: resolveStructure,
              slot: 0,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(resolvePtrStructure);
      env.finishStructure(resolvePtrStructure);
      const promiseStructure = {
        type: StructureType.Struct,
        purpose: StructurePurpose.Promise,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'callback',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure: resolvePtrStructure,
              slot: 0,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(promiseStructure);
      env.finishStructure(promiseStructure);
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
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const voidStructure = {
        type: StructureType.Primitive,
        name: 'void',
        byteSize: 0,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Void,
              bitSize: 0,
              bitOffset: 0,
              byteSize: 0,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(voidStructure);
      env.finishStructure(voidStructure);
      const yieldArgStructure = {
        type: StructureType.ArgStruct,
        name: 'Resolve',
        byteSize: 4,
        length: 1,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'retval',
              type: MemberType.Void,
              bitSize: 0,
              bitOffset: 0,
              byteSize: 0,
              structure: voidStructure,
            },
            {
              name: '0',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 32,
              byteSize: 4,
              structure: intStructure,
            },
          ]
        },
        static: {},
      };
      env.beginStructure(yieldArgStructure);
      env.finishStructure(yieldArgStructure);
      const yieldStructure = {
        type: StructureType.Function,
        byteSize: 0,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              structure: yieldArgStructure,
            },
          ],
          template: { 
            [MEMORY]: zig(0x1004) 
          },
        },
        static: {
          template: {
            [MEMORY]: zig(0x2004),
          },
        },
      };
      env.beginStructure(yieldStructure);
      env.finishStructure(yieldStructure);
      const yieldPtrStructure = {
        type: StructureType.Pointer,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 0,
              bitOffset: 0,
              byteSize: 0,
              structure: yieldStructure,
              slot: 0,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(yieldPtrStructure);
      env.finishStructure(yieldPtrStructure);
      const generatorStructure = {
        type: StructureType.Struct,
        purpose: StructurePurpose.Generator,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'callback',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure: yieldPtrStructure,
              slot: 0,
            }
          ],
        },
        static: {},
      };
      env.beginStructure(generatorStructure);
      env.finishStructure(generatorStructure);
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
      const intStructure = {
        type: StructureType.Primitive,
        byteSize: 4,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const ptrStructure = {
        type: StructureType.Pointer,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
              slot: 0,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const signalStructure = {
        type: StructureType.Struct,
        purpose: StructurePurpose.AbortSignal,
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'ptr',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure: ptrStructure,
              slot: 0,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(signalStructure);
      env.finishStructure(signalStructure);
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
    it('should convert web stream writer to File struct', function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.setSyscallTrap = () => {};
      }
      const usizeStructure = {
        type: StructureType.Primitive,
        byteSize: addressByteSize,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: addressSize,
              bitOffset: 0,
              byteSize: addressByteSize,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(usizeStructure);
      env.finishStructure(usizeStructure);
      const fileStructure = {
        type: StructureType.Struct,
        purpose: StructurePurpose.File,
        byteSize: addressByteSize,
        flags: 0,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'handle',
              type: MemberType.Uint,
              bitSize: addressSize,
              bitOffset: 0,
              byteSize: addressByteSize,
              structure: {},
            },
          ],
        },
        static: {},
      }
      env.beginStructure(fileStructure);
      env.finishStructure(fileStructure);
      const members = [
        {
          name: '0',
          type: MemberType.Int,
          bitSize: usizeStructure.byteSize * 8,
          bitOffset: 0,
          byteSize: usizeStructure.byteSize,
          structure: usizeStructure,
        },
        {
          name: '1',
          type: MemberType.Object,
          bitSize: fileStructure.byteSize * 8,
          bitOffset: 64,
          byteSize: fileStructure.byteSize,
          structure: fileStructure,
        },
      ];
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
      const stream = new WritableStream({
        async write(buf) {}
      });
      const writer = stream.getWriter();
      const src = [ 1n, writer ];
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
      env.copyArguments(dest, src, members, {});
      expect(dest[0]).to.equal(1n);
      expect(dest[1]).to.have.property('handle').that.is.a('number');
    })
    it('should convert Map to Dir struct', function() {
      const env = new Env();
      if (process.env.TARGET === 'node') {
        env.setSyscallTrap = () => {};
      }
      const usizeStructure = {
        type: StructureType.Primitive,
        byteSize: addressByteSize,
        flags: StructureFlag.HasValue,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: addressSize,
              bitOffset: 0,
              byteSize: addressByteSize,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(usizeStructure);
      env.finishStructure(usizeStructure);
      const dirStructure = {
        type: StructureType.Struct,
        purpose: StructurePurpose.Directory,
        byteSize: addressByteSize,
        flags: 0,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'handle',
              type: MemberType.Uint,
              bitSize: addressSize,
              bitOffset: 0,
              byteSize: addressByteSize,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(dirStructure);
      env.finishStructure(dirStructure);
      const members = [
        {
          name: '0',
          type: MemberType.Int,
          bitSize: usizeStructure.byteSize * 8,
          bitOffset: 0,
          byteSize: usizeStructure.byteSize,
          structure: usizeStructure,
        },
        {
          name: '1',
          type: MemberType.Object,
          bitSize: dirStructure.byteSize * 8,
          bitOffset: 64,
          byteSize: dirStructure.byteSize,
          structure: dirStructure,
        },
      ];
      const ArgStruct = class {};
      ArgStruct.prototype[SETTERS] = {
        0: function(v) { this[0] = v },
        1: function(v) { this[1] = v },
      };
      const dest = new ArgStruct();
      const map = new Map();
      const src = [ 2n, map ];
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }      
      env.copyArguments(dest, src, members, {});
      expect(dest[0]).to.equal(2n);
      expect(dest[1]).to.have.property('fd').that.is.a('number');
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
})

function zig(address, len = 0) {
  const dv = new DataView(new ArrayBuffer(len));
  dv[ZIG] = { address: usize(address), len };
  return dv;
}
