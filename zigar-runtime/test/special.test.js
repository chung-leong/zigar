import { expect } from 'chai';

import { useAllExtendedTypes } from '../src/data-view.js';
import { Environment } from '../src/environment.js';
import { useAllMemberTypes } from '../src/member.js';
import { getMemoryCopier } from '../src/memory.js';
import {
  getBase64Descriptor, getDataViewDescriptor, getStringDescriptor,
  getTypedArrayDescriptor
} from '../src/special.js';
import { useAllStructureTypes } from '../src/structure.js';
import { COPIER, MEMORY } from '../src/symbol.js';
import { MemberType, StructureType } from '../src/types.js';

describe('Special property functions', function() {
  const env = new Environment();
  beforeEach(() => {
    useAllStructureTypes();
    useAllMemberTypes();
    useAllExtendedTypes();
  })
  describe('getDataViewDescriptor', function() {
    it('should return getter and setter for data view', function() {
      const structure = {
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      };
      const { get, set } = getDataViewDescriptor(structure);
      expect(get).to.be.a('function');
      expect(set).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(4));
      const object = {
        [MEMORY]: dv,
        [COPIER]: getMemoryCopier(4),
      };
      expect(get.call(object)).to.equal(dv);
      const dv2 = new DataView(new ArrayBuffer(4));
      dv2.setInt32(0, 1234, true);
      set.call(object, dv2);
      expect(dv2.getInt32(0, true)).to.equal(1234);
    })
    it('should restore WASM memory data view', function() {
      const structure = {
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      };
      const { get, set } = getDataViewDescriptor(structure);
      const memory = new WebAssembly.Memory({ initial: 1 });
      const dv = new DataView(memory.buffer, 0, 4);
      dv[MEMORY] = { memory, address: 0, len: 4 };
      const object = {
        [MEMORY]: dv,
        [COPIER]: getMemoryCopier(4),
      };
      memory.grow(1);
      expect(get.call(object)).to.have.property('byteLength', 4);
      memory.grow(1);
      const dv2 = new DataView(new ArrayBuffer(4));
      dv2.setInt32(0, 1234, true);
      set.call(object, dv2);
      memory.grow(1);
      expect(get.call(object).getInt32(0, true)).to.equal(1234);
    })
    it('should throw when source data view has a different length', function() {
      const structure = {
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      };
      const { set } = getDataViewDescriptor(structure);
      const dv = new DataView(new ArrayBuffer(4));
      const object = {
        [MEMORY]: dv,
        [COPIER]: getMemoryCopier(4),
      };
      const dv2 = new DataView(new ArrayBuffer(5));
      dv2.setInt32(0, 1234, true);
      expect(() => set.call(object, dv2)).to.throw(TypeError)
        .with.property('message').that.contains('i32');
    })
  })
  describe('getBase64Descriptor', function() {
    it('should return getter and setter for base64 encoded binary', function() {
      const structure = { 
        name: 'int',
        byteSize: 4,
      };
      const { get, set } = getBase64Descriptor(structure);
      expect(get).to.be.a('function');
      expect(set).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(4));
      dv.setInt32(0, 1234);
      const object = {
        dataView: dv,
        [MEMORY]: dv,
        [COPIER]: getMemoryCopier(4, false),
      };
      const base64 = get.call(object);
      expect(base64).to.be.a('string');
      const dv2 = new DataView(new ArrayBuffer(4));
      const object2 = {
        dataView: dv2,
        [MEMORY]: dv2,
        [COPIER]: getMemoryCopier(4, false),
      };
      set.call(object2, base64);
      expect(object2.dataView.getInt32(0)).to.equal(1234);
      expect(() => set.call(object2, undefined)).to.throw(TypeError)
        .with.property('message').that.contains('a string').and.contains('undefined');
    })
  })
  describe('getStringDescriptor', function() {
    it('should return getter and setter for UTF-8 string', function() {
      const structure = {
        name: '[4]u8',
        byteSize: 4,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
            }
          ]
        }
      };
      const { get, set } = getStringDescriptor(structure);
      expect(get).to.be.a('function');
      expect(set).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(4));
      const object = {
        dataView: dv,
        [MEMORY]: dv,
        [COPIER]: getMemoryCopier(4, false),
      };
      dv.setUint8(0, 'A'.charCodeAt(0));
      dv.setUint8(1, 'B'.charCodeAt(0));
      dv.setUint8(2, 'C'.charCodeAt(0));
      dv.setUint8(3, 'D'.charCodeAt(0));
      expect(get.call(object)).to.equal('ABCD');
      set.call(object, '1234');
      const dv2 = object.dataView;
      for (let i = 0; i < 4; i++) {
        expect(dv2.getUint8(i)).to.equal(`1234`.charCodeAt(i));
      }
    })
    it('should return getter and setter for UTF-16 string', function() {
      const structure = {
        name: '[4]u16',
        byteSize: 8,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 16,
              byteSize: 2,
            }
          ]
        }
      };
      const { get, set } = getStringDescriptor(structure);
      expect(get).to.be.a('function');
      expect(set).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(8));
      const object = {
        dataView: dv,
        length: 4,
        [MEMORY]: dv,
        [COPIER]: getMemoryCopier(4, true),        
      };
      dv.setUint16(0, 'A'.charCodeAt(0), true);
      dv.setUint16(2, 'B'.charCodeAt(0), true);
      dv.setUint16(4, 'C'.charCodeAt(0), true);
      dv.setUint16(6, 'D'.charCodeAt(0), true);
      expect(get.call(object)).to.equal('ABCD');
      set.call(object, '1234');
      const dv2 = object.dataView;
      for (let i = 0; i < 4; i++) {
        expect(dv2.getUint16(i * 2, true)).to.equal(`1234`.charCodeAt(i));
      }
    })
    it('should return getter and setter for array with sentinel value', function() {
      const structure = {
        name: '[4]u8',
        byteSize: 5,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
            }
          ]
        },
        sentinel: {
          value: 0,
          validateValue: () => {},
          validateData: () => {},
        },
      };
      const { get, set } = getStringDescriptor(structure);
      expect(get).to.be.a('function');
      expect(set).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(5));
      const object = {
        dataView: dv,
        [MEMORY]: dv,
        [COPIER]: getMemoryCopier(4, false),
      };
      dv.setUint8(0, 'A'.charCodeAt(0));
      dv.setUint8(1, 'B'.charCodeAt(0));
      dv.setUint8(2, 'C'.charCodeAt(0));
      dv.setUint8(3, 'D'.charCodeAt(0));
      dv.setUint8(4, 0);
      expect(get.call(object)).to.equal('ABCD');
      set.call(object, '1234');
      const dv2 = object.dataView;
      for (let i = 0; i < 4; i++) {
        expect(dv2.getUint8(i)).to.equal(`1234`.charCodeAt(i));
      }
      expect(dv2.getUint8(4)).to.equal(0);
    })
    it('should throw when argument is not a string', function() {
      const structure = {
        name: '[4]u8',
        byteSize: 4,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 1,
            }
          ]
        }
      };
      const { get, set } = getStringDescriptor(structure);
      expect(get).to.be.a('function');
      expect(set).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(4));
      const object = {
        dataView: dv,
        [MEMORY]: dv,
        [COPIER]: getMemoryCopier(4, false),
      };
      expect(() => set.call(object, 1234)).to.throw(TypeError);
    })
  })
  describe('getTypedArrayDescriptor', function() {
    it('should return getter and setter for typed array', function() {
      const structure = { 
        name: '[4]i32',
        byteSize: 16,
        typedArray: Int32Array 
      };
      const { get, set } = getTypedArrayDescriptor(structure);
      expect(get).to.be.a('function');
      expect(set).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(16));
      const object = {
        dataView: dv,
        [MEMORY]: dv,
        [COPIER]: getMemoryCopier(4, true),
      };
      for (let i = 0; i < 4; i++) {
        dv.setInt32(i * 4, i * 100, true);
      }
      const ta = get.call(object);
      expect([ ...ta ]).to.eql([ 0, 100, 200, 300 ]);
      const ta2 = new Int32Array([ 1, 2, 3, 4 ]);
      set.call(object, ta2);
      expect(object.dataView.getInt32(0, true)).to.equal(1);
    })
    it('should throw when setter receives a typed array of the wrong type', function() {
      const structure = { typedArray: Float64Array };
      const { set } = getTypedArrayDescriptor(structure);
      const dv = new DataView(new ArrayBuffer(8 * 4));
      const object = {
        dataView: dv
      };
      const ta = new Float32Array([ 1, 2, 3, 4 ]);
      expect(() => set.call(object, ta)).to.throw(TypeError);
      expect(() => set.call(object, undefined)).to.throw(TypeError);
      expect(() => set.call(object, 1)).to.throw(TypeError);
    })
  })
  describe('convertToJSON', function() {
    it('should enable correct output from JSON.stringify()', function() {
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 4 * 2,
      });
      env.attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        isRequired: true,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
      });
      env.attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isRequired: true,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        name: 'HelloArray',
        length: 4,
        byteSize: structStructure.byteSize * 4,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      env.finalizeShape(arrayStructure);
      env.finalizeStructure(arrayStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Complex',
        byteSize: arrayStructure.byteSize + 8 * 2,
      });
      env.attachMember(structure, {
        name: 'animals',
        type: MemberType.Object,
        bitSize: arrayStructure.byteSize * 8,
        bitOffset: 0,
        byteSize: arrayStructure.byteSize,
        structure: arrayStructure,
        slot: 0,
        isRequired: true,
      });
      env.attachMember(structure, {
        name: 'donut',
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: arrayStructure.byteSize * 8,
        byteSize: 8,
        isRequired: true,
      })
      env.attachMember(structure, {
        name: 'turkey',
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: (arrayStructure.byteSize + 8) * 8,
        byteSize: 8,
        isRequired: true,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Complex } = structure;
      const data = {
        animals: [
          { dog: 1, cat: 2 },
          { dog: 3, cat: 4 },
          { dog: 5, cat: 6 },
          { dog: 7, cat: 8 },
        ],
        donut: 3.5,
        turkey: 1e7,
      };
      const object = new Complex(data);
      expect(JSON.stringify(object)).to.equal(JSON.stringify(data));
    })
  })
})

