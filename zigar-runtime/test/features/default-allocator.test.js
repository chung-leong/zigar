import { expect } from 'chai';
import 'mocha-skip-if';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ALIGN, CONTEXT, MEMORY, SIZE, ZIG } from '../../src/symbols.js';
import { CallContext, usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Feature: default-allocator', function() {
  describe('createDefaultAllocator', function() {
    it('should an allocator that allocates memory from JavaScript', async function() {
      const env = new Env();
      const args = {
        [CONTEXT]: new CallContext(),
      };
      const constructor = function({ vtable, ptr }) {
        this.vtable = vtable;
        this.ptr = {
          ['*']: {
            [MEMORY]: ptr
          },
        };
      };
      const VTable = constructor.VTable = function(dv) {
        const self = {};
        self[MEMORY] = dv;
        return self;
      };
      VTable[SIZE] = 3 * 8;
      VTable[ALIGN] = 8;
      const structure = { constructor };
      let nextAddress = usize(0x1000);
      env.allocateExternMemory = function(len, align) {
        const address = nextAddress;
        nextAddress += usize(0x1000);
        return address;
      };
      env.freeExternMemory = function(type, address, len, align) {};
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          const buffer = new ArrayBuffer(len);
          buffer[ZIG] = { address, len };
          return buffer;
        };
        env.getBufferAddress = function(buffer) {
          return buffer[ZIG]?.address ?? usize(0xf_0000);
        };
      }
      const allocator = env.createDefaultAllocator(args, structure);
      const dv1 = allocator.vtable.alloc(allocator.ptr, 16, 0, 3);
      expect(dv1).to.be.a('DataView');
      const buf = {
        ['*']: {
          [MEMORY]: dv1
        },
      };
      allocator.vtable.free(allocator.ptr, buf, 3);
      env.releaseCallContext(args[CONTEXT]);
      const dv2 = allocator.vtable.alloc(allocator.ptr, 16, 0, 3);
      expect(dv2).to.be.null;
    })
  })
  describe('freeDefaultAllocator', function() {
    it('should free default allocator vtable', function() {
      const env = new Env();
      const args = {
        [CONTEXT]: new CallContext(),
      };
      const constructor = function({ vtable, ptr }) {
        this.vtable = vtable;
        this.ptr = {
          ['*']: {
            [MEMORY]: ptr
          },
        };
      };
      const VTable = constructor.VTable = function(dv) {
        const self = {};
        self[MEMORY] = dv;
        return self;
      };
      VTable[SIZE] = 3 * 8;
      VTable[ALIGN] = 8;
      const structure = { constructor };
      let nextAddress = usize(0x1000);
      env.allocateExternMemory = function(len, align) {
        const address = nextAddress;
        nextAddress += usize(0x1000);
        return address;
      };
      let freed;
      env.freeExternMemory = function(type, address, len, align) {
        freed = { type, address, len, align };
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          const buffer = new ArrayBuffer(len);
          buffer[ZIG] = { address, len };
          return buffer;
        };
      }
      env.createDefaultAllocator(args, structure);
      env.freeDefaultAllocator();
      expect(freed).to.eql({ type: 0, address: usize(0x1000), len: 24, align: 8 });
    })
  })
})
