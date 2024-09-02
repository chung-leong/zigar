import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';
import {
  COPIER, ENVIRONMENT, MEMORY,
  PROTECTOR,
  VISITOR
} from '../../src/symbols.js';

import DataCopying from '../../src/features/data-copying.js';
import ViewManagement, {
  isNeededByStructure,
} from '../../src/features/view-management.js';
import { MemberType } from '../../src/members/all.js';
import { StructureType } from '../../src/structures/all.js';
import { defineProperties } from '../../src/utils.js';

const Env = defineClass('FeatureTest', [ ViewManagement, DataCopying ]);

describe('Feature: view-management', function() {
  describe('isNeededByStructure', function() {
    it('should return true', function() {
      expect(isNeededByStructure()).to.be.true;
    })
  })
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
      const dv = env.extractView(structure, arg, false);
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
      const structure = {
        type: StructureType.Slice,
        name: 'Test',
        byteSize: 3,
        typedArray: Uint32Array
      };
      const env = new Env();
      const ta1 = new Uint32Array([ 1, 2, 3 ]);
      const ta2 = new Int32Array([ 1, 2, 3 ]);
      const dv1 = env.extractView(structure, ta1, false);
      const dv2 = env.extractView(structure, ta2, false);
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
        [COPIER]: env.getCopierDescriptor(16),
        length: { value: 16 },
      });
      const dv = new DataView(new ArrayBuffer(16));
      env.assignView(target, dv, structure, false, false, {});
    })
  })
  describe('captureView', function() {
    it('should allocate new buffer and copy data using copyBytes', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000;
      env.copyBytes = (dv, address, len) => {
        dv.setInt32(0, address, true);
        dv.setInt32(4, len, true);
      };
      const dv = env.captureView(1234, 32, true);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.getInt32(0, true)).to.equal(1234);
      expect(dv.getInt32(4, true)).to.equal(32);
    })
    it('should get view of memory using obtainFixedView', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000;
      env.obtainFixedView = (address, len) => {
        return { address, len };
      };
      const result = env.captureView(1234, 32, false);
      expect(result).to.eql({ address: 1234, len: 32 });
    })
  })
  describe('castView', function() {
    it('should call constructor without the use of the new operator', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000;
      env.copyBytes = (dv, address, len) => {};
      let recv, arg;
      const structure = {
        constructor: function(dv) {
          recv = this;
          arg = dv;
          return {
            [PROTECTOR]: () => {},
          };
        }
      };
      const object = env.castView(1234, 0, true, structure);
      expect(recv).to.equal(ENVIRONMENT);
    })
    it('should try to create targets of pointers', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000;
      env.copyBytes = (dv, address, len) => {};
      let visitor;
      const structure = {
        constructor: function(dv) {
          return {
            [VISITOR]: function(f) { visitor = f },
            [PROTECTOR]: () => {},
          };
        },
        hasPointer: true,
      };
      const object = env.castView(1234, 8, true, structure);
    })
  })
  describe('allocateMemory', function() {
    it('should return a data view of a newly created array buffer', function() {
      const env = new Environment();
      env.getBufferAddress = () => 0x10000;
      const dv = env.allocateMemory(32, 4);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(32);
      expect(dv.byteOffset).to.equal(0);
    })
    it('should try to create a buffer in fixed memory', function() {
      const env = new Environment();
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
})

