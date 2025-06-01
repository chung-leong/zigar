import { expect } from 'chai';
import 'mocha-skip-if';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ALIGN, MEMORY, SIZE, ZIG } from '../../src/symbols.js';
import { usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Feature: js-allocator', function() {
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
      constructor.noRemap = function() {};
      VTable[SIZE] = 3 * 8;
      VTable[ALIGN] = 8;
      const structure = { constructor };
      let nextAddress = usize(0x1000);
      env.allocateScratchMemory = function(len, align) {
        const address = nextAddress;
        nextAddress += usize(0x1000);
        return address;
      };
      env.freeScratchMemory = function(address, len, align) {};
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
  describe('allocateHostMemory', function() {
    it('should allocate JS memory', function() {
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
      constructor.noRemap = function() {};
      VTable[SIZE] = 3 * 8;
      VTable[ALIGN] = 8;
      const structure = { constructor };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
        env.allocateScratchMemory = function(len, align) {
          return usize(0x1000);
        };
      } else {
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
        };
      }
      const { ptr } = env.createDefaultAllocator(args, structure);
      const dv = env.allocateHostMemory(ptr, 40, 2);
      expect(dv).to.be.a('DataView');
    })
    if (process.env.TARGET === 'wasm') {
      it('should return null when shadow memory cannot be allocated', function() {
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
        constructor.noRemap = function() {};
        VTable[SIZE] = 3 * 8;
        VTable[ALIGN] = 8;
        const structure = { constructor };
        env.memory = new WebAssembly.Memory({ initial: 1 });
        env.allocateScratchMemory = function(len, align) {
          throw new Error('Out of memory');
        };
        const { ptr } = env.createDefaultAllocator(args, structure);
        const dv = env.allocateHostMemory(ptr, 40, 2);
        expect(dv).to.be.null;
      })
    }
  })
  describe('freeHostMemory', function() {
    it('should release JS memory', function() {
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
      constructor.noRemap = function() {};
      VTable[SIZE] = 3 * 8;
      VTable[ALIGN] = 8;
      const structure = { constructor };
      let scratchAllocations = 0, scratchDeallocations = 0;
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
        env.allocateScratchMemory = function(len, align) {
          scratchAllocations++;
          return usize(0x1000);
        };
        env.freeScratchMemory = function(address, len, align) {
          scratchDeallocations++;
          expect(address).to.equal(usize(0x1000));
        };
      } else {
        env.getBufferAddress = function(buffer) {
          return usize(0x1000);
        };
      }
      const { ptr } = env.createDefaultAllocator(args, structure);
      const dv = env.allocateHostMemory(ptr, 40, 2);
      expect(env.memoryList).to.have.lengthOf(1);
      const buf = {
        '*': {
          [MEMORY]: dv,
        }
      };
      env.freeHostMemory(ptr, buf, 2);
      expect(env.memoryList).to.have.lengthOf(0);
      if (process.env.TARGET === 'wasm') {
        expect(scratchAllocations).to.equal(1);
        expect(scratchDeallocations).to.equal(1);
      }
    })
  })
})
