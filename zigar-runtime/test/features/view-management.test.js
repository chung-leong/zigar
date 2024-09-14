import { expect } from 'chai';
import { MemberType, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { COPY, MEMORY, TYPED_ARRAY } from '../../src/symbols.js';
import { defineProperties } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Feature: view-management', function() {
  describe('extractView', function() {
    it('should return a DataView when given an ArrayBuffer', function() {
      const structure = {
        type: StructureType.Array,
        name: 'Test',
        byteSize: 8
      };
      const arg = new ArrayBuffer(8);
      const env = new Env();
      const dv = env.extractView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an SharedArrayBuffer', function() {
      const structure = {
        type: StructureType.Array,
        name: 'Test',
        byteSize: 8
      };
      const arg = new SharedArrayBuffer(8);
      const env = new Env();
      const dv = env.extractView(structure, arg);
      expect(dv).to.be.instanceOf(DataView);
    })
    it('should return a DataView when given an DataView', function() {
      const structure = {
        type: StructureType.Array,
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
        name: 'Test',
        byteSize: 17
      };
      const structure2 = {
        type: StructureType.Slice,
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
      debugger;
      const dv = env.extractView(structure, array);
      expect(dv).to.be.an.instanceOf(DataView);
    })
    it('should return memory of compatible slice', function() {
      const elementConstructor = function() {};
      const structure = {
        type: StructureType.Array,
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
        [COPY]: env.defineCopier(16),
        length: { value: 16 },
      });
      const dv = new DataView(new ArrayBuffer(16));
      env.assignView(target, dv, structure, false, false, {});
    })
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
    it('should try to create a buffer in fixed memory', function() {
      const env = new Env();
      env.allocateFixedMemory = (len, align) => {
        const buffer = new ArrayBuffer(len);
        buffer.align = align;
        return new DataView(buffer);
      }
      const dv = env.allocateMemory(32, 4, true);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(32);
      expect(dv.buffer.align).to.equal(4);
    })
  })
  describe('allocateRelocMemory', function() {
    if (process.env.TARGET === 'wasm') {
      it('should allocate relocable memory', function() {
        const env = new Env();
        const dv = env.allocateRelocMemory(64, 32);
        expect(dv.byteLength).to.equal(64);
        expect(dv.buffer.byteLength).to.equal(64);
      })
    } else if (process.env.TARGET === 'node') {
      it('should allocate extra bytes to account for alignment', function() {
        const env = new Env();
        env.getBufferAddress = function(buffer) {
          return 0x1000n;
        };
        const dv = env.allocateRelocMemory(64, 32);
        expect(dv.byteLength).to.equal(64);
        expect(dv.buffer.byteLength).to.equal(96);
      })
    }
  })
})
