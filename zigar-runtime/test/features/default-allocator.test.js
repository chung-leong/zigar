import { expect } from 'chai';
import 'mocha-skip-if';
import { defineEnvironment } from '../../src/environment.js';
import { MemoryType } from '../../src/features/memory-mapping.js';
import '../../src/mixins.js';
import { ALIGN, MEMORY, SIZE, ZIG } from '../../src/symbols.js';
import { usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Feature: default-allocator', function() {
  describe('createDefaultAllocator', function() {
    it('should create an allocator that allocates memory from JavaScript', async function() {
      const env = new Env();
      const args = {};
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
    })
  })
  describe('freeDefaultAllocator', function() {
    it('should free default allocator', function() {
      const env = new Env();
      const args = {};
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
      env.createDefaultAllocator(args, structure);
      env.freeDefaultAllocator();
      expect(env.defaultAllocator).to.be.null;
      expect(env.vtableFnIds).to.be.null;
    })
  })
  describe('allocateHostMemory', function() {
    it('should allocate JS memory', function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
        env.allocateExternMemory = function(type, len, align) {
          return usize(0x1000);
        };
      } else {
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
        };
      }
      const dv = env.allocateHostMemory(40, 4);
      expect(dv).to.be.a('DataView');
    })
  })
  describe('freeHostMemory', function() {
    it('should release JS memory', function() {
      const env = new Env();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
        env.allocateExternMemory = function(type, len, align) {
          return usize(0x1000);
        };
        env.freeExternMemory = function(type, address, len, align) {
          expect(type).to.equal(MemoryType.Scratch);
          expect(address).to.equal(usize(0x1000));
        };
      } else {
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
        };
      }
      const dv = env.allocateHostMemory(40, 4);
      expect(env.memoryList).to.have.lengthOf(1);
      const address = env.getViewAddress(dv);
      env.freeHostMemory(address, 40, 4);
      expect(env.memoryList).to.have.lengthOf(0);
    })
  })
})
