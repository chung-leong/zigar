import { expect } from 'chai';
import { MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { FALLBACK, LENGTH, MEMORY, RESTORE, SHAPE, TYPED_ARRAY, ZIG } from '../../src/symbols.js';
import { defineProperties, usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Feature: view-management', function() {
  describe('extractView', function() {
    it('should return a DataView when given an ArrayBuffer', function() {
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasProxy,
        name: 'Test',
        byteSize: 8
      };
      const arg = new ArrayBuffer(8);
      const env = new Env();
      const dv = env.extractView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an DataView', function() {
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasProxy,
        name: 'Test',
        byteSize: 8
      };
      const arg = new DataView(new ArrayBuffer(8));
      const env = new Env();
      const dv = env.extractView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an DataView with length that is multiple of given size', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 8
      };
      const arg = new DataView(new ArrayBuffer(64));
      const env = new Env();
      const dv = env.extractView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an empty DataView', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 8
      };
      const arg = new DataView(new ArrayBuffer(0));
      const env = new Env();
      const dv = env.extractView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should throw when argument is not a data view or buffer', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 8
      };
      const arg = {};
      const env = new Env();
      expect(() => env.extractView(structure, arg)).to.throw(TypeError)
        .with.property('message').that.contains('8');
    })
    it('should return undefined when argument is not a data view or buffer and required is false', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 8
      };
      const arg = {};
      const env = new Env();
      const dv = env.extractView(structure, arg, null);
      expect(dv).to.be.undefined;
    })
    it('should throw when there is a size mismatch', function() {
      const structure1 = {
        type: StructureType.Array,
        flags: StructureFlag.HasProxy,
        name: 'Test',
        byteSize: 17
      };
      const structure2 = {
        type: StructureType.Slice,
        flags: StructureFlag.HasProxy,
        name: 'Test',
        byteSize: 3
      };
      const env = new Env();
      const arg = new DataView(new ArrayBuffer(8));
      expect(() => env.extractView(structure1, arg)).to.throw(TypeError)
        .with.property('message').that.contains('17');
      expect(() => env.extractView(structure2, arg)).to.throw(TypeError)
        .with.property('message').that.contains('3');
    })
    it('should accept compatible TypedArray', function() {
      const constructor = function() {};
      constructor[TYPED_ARRAY] = Uint32Array;
      const structure = {
        type: StructureType.Slice,
        flags: StructureFlag.HasProxy,
        name: 'Test',
        byteSize: 3,
        constructor,
      };
      const env = new Env();
      const ta1 = new Uint32Array([ 1, 2, 3 ]);
      const ta2 = new Int32Array([ 1, 2, 3 ]);
      const dv1 = env.extractView(structure, ta1, null);
      const dv2 = env.extractView(structure, ta2, null);
      expect(dv1).to.be.an.instanceOf(DataView);
      expect(dv2).to.be.undefined;
    })
    it('should return memory of compatible array', function() {
      const elementConstructor = function() {};
      const structure = {
        type: StructureType.Slice,
        flags: StructureFlag.HasProxy,
        name: 'Test',
        byteSize: 2,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              byteSize: 2,
              structure: { constructor: elementConstructor }
            }
          ]
        },
        constructor: function() {},
      };
      const arrayConstructor = function() {};
      arrayConstructor.child = elementConstructor;
      const array = new arrayConstructor();
      array[MEMORY] = new DataView(new ArrayBuffer(6));
      array.length = 3;
      const env = new Env();
      const dv = env.extractView(structure, array);
      expect(dv).to.be.an.instanceOf(DataView);
    })
    it('should return memory of compatible slice', function() {
      const elementConstructor = function() {};
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasProxy,
        name: 'Test',
        byteSize: 6,
        length: 3,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              byteSize: 2,
              structure: { constructor: elementConstructor }
            }
          ]
        },
        constructor: function() {},
      };
      const arrayConstructor = function() {};
      arrayConstructor.child = elementConstructor;
      const array = new arrayConstructor();
      array[MEMORY] = new DataView(new ArrayBuffer(6));
      array.length = 3;
      const env = new Env();
      const dv = env.extractView(structure, array);
      expect(dv).to.equal(array[MEMORY]);
    })
    it('should fail when slice length does not match size of array', function() {
      const elementConstructor = function() {};
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasProxy,
        name: 'Test',
        byteSize: 6,
        length: 3,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              byteSize: 2,
              structure: { constructor: elementConstructor }
            }
          ]
        },
        constructor: function() {},
      };
      const arrayConstructor = function() {};
      arrayConstructor.child = elementConstructor;
      const array = new arrayConstructor();
      array[MEMORY] = new DataView(new ArrayBuffer(8));
      array.length = 4;
      const env = new Env();
      expect(() => dv = env.extractView(structure, array)).to.throw(TypeError);
    })
    it('should return memory of compatible object', function() {
      const elementConstructor = function() {};
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 2,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              byteSize: 2,
              structure: { constructor: elementConstructor }
            }
          ]
        },
        constructor: function() {},
      };
      const object = new elementConstructor();
      object[MEMORY] = new DataView(new ArrayBuffer(2));
      const env = new Env();
      const dv = env.extractView(structure, object);
      expect(dv).to.equal(object[MEMORY]);
    })
  })
  describe('obtainView', function() {
    it('should obtain the same view object for the same offset and length', function() {
      const env = new Env();
      const buffer = new ArrayBuffer(48);
      const dv1 = env.obtainView(buffer, 4, 8);
      expect(dv1.byteOffset).to.equal(4);
      expect(dv1.byteLength).to.equal(8);
      const dv2 = env.obtainView(buffer, 4, 8);
      expect(dv2).to.equal(dv1);
    })
    it('should be able to keep track of multiple views', function() {
      const env = new Env();
      const buffer = new ArrayBuffer(48);
      const dv1 = env.obtainView(buffer, 4, 8);
      expect(dv1.byteOffset).to.equal(4);
      const dv2 = env.obtainView(buffer, 8, 16);
      expect(dv2.byteOffset).to.equal(8);
      const dv3 = env.obtainView(buffer, 8, 16);
      expect(dv3).to.equal(dv2);
      const dv4 = env.obtainView(buffer, 4, 8);
      expect(dv4).to.equal(dv1);
    })
  })
  describe('registerView', function() {
    it('should register views with their underlying buffer', function() {
      const env = new Env();
      const buffer = new ArrayBuffer(48);
      const dv1 = new DataView(buffer, 4, 8);
      env.registerView(dv1);
      expect(env.obtainView(buffer, 4, 8)).to.equal(dv1);
      const dv2 = new DataView(buffer, 8, 16);
      env.registerView(dv2);
      expect(env.obtainView(buffer, 4, 8)).to.equal(dv1);
      expect(env.obtainView(buffer, 8, 16)).to.equal(dv2);
      const dv3 = new DataView(buffer, 8, 32);
      env.registerView(dv3);
      expect(env.obtainView(buffer, 8, 32)).to.equal(dv3);
      const dv4 = new DataView(buffer);
      env.registerView(dv4);
      expect(env.obtainView(buffer, 0, 48)).to.equal(dv4);
      expect(env.obtainView(buffer, 4, 8)).to.equal(dv1);
      expect(env.obtainView(buffer, 8, 16)).to.equal(dv2);
      expect(env.obtainView(buffer, 8, 32)).to.equal(dv3);
    })
  })
  describe('assignView', function() {
    it('should assume element size of one when structure has no shape', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Slice,
        name: 'Opaque',
        byteSize: undefined,
      };
      const target = {
      };
      defineProperties(target, {
        [MEMORY]: { value: new DataView(new ArrayBuffer(16)) },
        [RESTORE]: { value: function() { return this[MEMORY] } },
        length: { value: 16 },
      });
      const dv = new DataView(new ArrayBuffer(16));
      env.assignView(target, dv, structure, false, null);
    })
    it('should copy data when target is in Zig memory', function() {
      const env = new Env();
      const structure = {
        type: StructureType.Slice,
        name: 'Opaque',
        byteSize: undefined,
      };
      const target = {
      };
      defineProperties(target, {
        [MEMORY]: { value: null },
        [RESTORE]: { value: function() { return this[MEMORY] } },
        [SHAPE]: {
          value(dv, length, allocator) {
            if (!dv) {
              dv = env.allocateMemory(length * 1, 1, allocator);
            }
            this[MEMORY] = dv;
            this[LENGTH] = length;
          }
        },
        length: { value: 16 },
      });
      const viewMap = new Map(), addressMap = new Map();
      let nextAddress = usize(0x1000);
      const allocator = {
        alloc(len, align) {
          const address = nextAddress;
          nextAddress += usize(0x1000);
          const dv = new DataView(new ArrayBuffer(len));
          dv[ZIG] = { address, len, allocator: this };
          viewMap.set(address, dv);
          addressMap.set(dv, address);
          return dv;
        },
        free(dv) {
        },
      };
      const dv = new DataView(new ArrayBuffer(16));
      dv.setInt8(9, 123);
      env.assignView(target, dv, structure, false, allocator);
      expect(target[MEMORY]).to.not.equal(dv);
      expect(target[MEMORY].getInt8(9)).to.equal(123);
    })
    if (process.env.TARGET === 'node') {
      it('should call syncExternalBuffer when target buffer requires fallback support', function() {
        const env = new Env();
        const buffer = new ArrayBuffer(16);
        buffer[FALLBACK] = usize(0x1000);
        const target = {
          [MEMORY]: new DataView(buffer),
        };
        const dv = new DataView(new ArrayBuffer(16));
        const structure = { byteSize: 16, type: StructureType.Array };
        env.requireBufferFallback = () => true;
        let targetBuffer, targetAddress, syncTo;
        env.syncExternalBuffer = (buffer, address, to) => {
          targetBuffer = buffer;
          targetAddress = address;
          syncTo = to;
        };
        env.assignView(target, dv, structure);
        expect(targetBuffer).to.equal(buffer);
        expect(targetAddress).to.equal(usize(0x1000));
        expect(syncTo).to.be.true;
      })
    }
  })
  describe('allocateMemory', function() {
    it('should return a data view of a newly created array buffer', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000;
      const dv = env.allocateMemory(32, 4);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(32);
      expect(dv.byteOffset).to.equal(0);
    })
    it('should allocate memory from given allocator', function() {
      const env = new Env();
      const viewMap = new Map(), addressMap = new Map();
      let nextAddress = usize(0x1000);
      const allocator = {
        alloc(len, align) {
          const address = nextAddress;
          nextAddress += usize(0x1000);
          const dv = new DataView(new ArrayBuffer(len));
          dv[ZIG] = { address, len, allocator: this };
          viewMap.set(address, dv);
          addressMap.set(dv, address);
          return dv;
        },
        free(dv) {
        },
      };
      const dv = env.allocateMemory(32, 4, allocator);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(32);
      expect(dv[ZIG]).to.be.an('object');
    })
  })
  describe('allocateJSMemory', function() {
    if (process.env.TARGET === 'wasm') {
      it('should allocate relocable memory', function() {
        const env = new Env();
        const dv = env.allocateJSMemory(64, 32);
        expect(dv.byteLength).to.equal(64);
        expect(dv.buffer.byteLength).to.equal(64);
      })
    } else if (process.env.TARGET === 'node') {
      it('should allocate extra bytes to account for alignment', function() {
        const env = new Env();
        env.getBufferAddress = function(buffer) {
          return 0x1000n;
        };
        const dv = env.allocateJSMemory(64, 32);
        expect(dv.byteLength).to.equal(64);
        expect(dv.buffer.byteLength).to.equal(96);
      })
    }
  })
  if (process.env.TARGET === 'node') {
    describe('usingBufferFallback', function() {
      it('should call requireBufferFallback if it exists', function() {
        const env = new Env();
        let called = false;
        env.requireBufferFallback = function() {
          called = true;
          return false;
        };
        const result = env.usingBufferFallback();
        expect(result).to.be.false;
        expect(called).to.be.true;
      })
    })
  }
})
