import { expect } from 'chai';

import {
  StructureType,
  usePrimitive,
  useArray,
  useSlice,
  useStruct,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';
import {
  MemberType,
  useIntEx,
  useFloatEx,
  useObject,
} from '../src/member.js';
import { MEMORY } from '../src/symbol.js';
import {
  getDataViewAccessors,
  getBase64Accessors,
  getStringAccessors,
  getSpecialKeys,
  getTypedArrayAccessors,
  getValueOf,
  checkDataView,
  getDataViewFromBase64,
  getDataViewFromUTF8,
  getDataViewFromTypedArray,
} from '../src/special.js';

describe('Special property functions', function() {
  beforeEach(() => {
    process.env.ZIGAR_TARGET = 'NODE-CPP-EXT';
    useArray();
    useSlice();
    useStruct();
    useIntEx();
    useFloatEx();
    useObject();
  })
  describe('getDataViewAccessors', function() {
    it('should return getter and setter for data view', function() {
      const structure = {
        type: StructureType.Primitive,
        name: 'i32',
        size: 4,
      };
      const { get, set } = getDataViewAccessors(structure);
      expect(get).to.be.a('function');
      expect(set).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(4));
      const object = {
        [MEMORY]: dv
      };
      expect(get.call(object)).to.equal(dv);
      const dv2 = new DataView(new ArrayBuffer(4));
      dv2.setInt32(0, 1234, true);
      set.call(object, dv2);
      expect(dv2.getInt32(0, true)).to.equal(1234);
    })
    it('should restore WASM memory data view', function() {
      process.env.ZIGAR_TARGET = 'WASM-RUNTIME';
      const structure = {
        type: StructureType.Primitive,
        name: 'i32',
        size: 4,
      };
      const { get, set } = getDataViewAccessors(structure);
      const memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      const dv = new DataView(memory.buffer, 0, 4);
      dv[MEMORY] = { memory, address: 0, len: 4 };
      const object = {
        [MEMORY]: dv,
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
        size: 4,
      };
      const { set } = getDataViewAccessors(structure);
      const dv = new DataView(new ArrayBuffer(4));
      const object = {
        [MEMORY]: dv
      };
      const dv2 = new DataView(new ArrayBuffer(5));
      dv2.setInt32(0, 1234, true);
      expect(() => set.call(object, dv2)).to.throw(TypeError)
        .with.property('message').that.contains('i32');
    })
  })
  describe('getBase64Accessors', function() {
    it('should return getter and setter for base64 encoded binary', function() {
      const { get, set } = getBase64Accessors();
      expect(get).to.be.a('function');
      expect(set).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(4));
      const object = {
        dataView: dv
      };
      dv.setInt32(0, 1234);
      const base64 = get.call(object);
      expect(base64).to.be.a('string');
      const dv2 = new DataView(new ArrayBuffer(4));
      const object2 = {
        dataView: dv2
      };
      set.call(object2, base64);
      expect(object2.dataView.getInt32(0)).to.equal(1234);
    })
  })
  describe('getStringAccessors', function() {
    it('should return getter and setter for UTF-8 string', function() {
      const { get, set } = getStringAccessors(1);
      expect(get).to.be.a('function');
      expect(set).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(4));
      const object = {
        dataView: dv
      };
      dv.setUint8(0, 'A'.charCodeAt(0));
      dv.setUint8(1, 'B'.charCodeAt(0));
      dv.setUint8(2, 'C'.charCodeAt(0));
      dv.setUint8(3, 'D'.charCodeAt(0));
      expect(get.call(object)).to.equal('ABCD');
      set.call(object, '1234');
      for (let i = 0; i < 4; i++) {
        expect(dv.getUint8(i, `${i}`.charCodeAt(0)));
      }
    })
    it('should return getter and setter for UTF-16 string', function() {
      const { get, set } = getStringAccessors(2);
      expect(get).to.be.a('function');
      expect(set).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(8));
      const object = {
        dataView: dv
      };
      dv.setUint16(0, 'A'.charCodeAt(0), true);
      dv.setUint16(2, 'B'.charCodeAt(0), true);
      dv.setUint16(4, 'C'.charCodeAt(0), true);
      dv.setUint16(6, 'D'.charCodeAt(0), true);
      expect(get.call(object)).to.equal('ABCD');
      set.call(object, '1234');
      for (let i = 0; i < 4; i++) {
        expect(dv.getUint16(i, `${i}`.charCodeAt(0)));
      }
    })
  })
  describe('getTypedArrayAccessors', function() {
    it('should return getter and setter for typed array', function() {
      const { get, set } = getTypedArrayAccessors(Int32Array, 4);
      expect(get).to.be.a('function');
      expect(set).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(16));
      const object = {
        dataView: dv
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
  })
  describe('getValueOf', function() {
    it('should return a plain object', function() {
      const object = Object.defineProperties({}, {
        dog: { get() { return 1234; }, enumerable: true },
        cat: { get() { return 4567; }, enumerable: true },
        food: { get() { return [ 1, 2, 3, 4 ] }, enumerable: true },
        self: { get() { return this }, enumerable: true },
        $: { get() { return this } }
      });
      const result = getValueOf.call(object);
      expect(result.dog).to.equal(1234);
      expect(result.cat).to.equal(4567);
      expect(result.food).to.eql([ 1, 2, 3, 4 ]);
      expect(result.self).to.equal(result);
    })
    it('should return a number', function() {
      const object = Object.defineProperties({}, {
        $: { get() { return 1234 } }
      });
      const result = getValueOf.call(object);
      expect(result).to.equal(1234);
    })
    it('should enable correct output from JSON.stringify()', function() {
      usePrimitive();
      useStruct();
      useArray();
      useIntEx();
      useFloatEx();
      useObject();
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 4 * 2,
      });
      attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        isSigned: true,
        isRequired: true,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
      });
      attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isSigned: true,
        isRequired: true,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
      });
      const Hello = finalizeStructure(structStructure);
      const arrayStructure = beginStructure({
        type: StructureType.Array,
        name: 'HelloArray',
        size: structStructure.size * 4,
      });
      attachMember(arrayStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      const HelloArray = finalizeStructure(arrayStructure);
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Complex',
        size: arrayStructure.size + 8 * 2,
      });
      attachMember(structure, {
        name: 'animals',
        type: MemberType.Object,
        bitSize: arrayStructure.size * 8,
        bitOffset: 0,
        byteSize: arrayStructure.size,
        structure: arrayStructure,
        slot: 0,
        isRequired: true,
      });
      attachMember(structure, {
        name: 'donut',
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: arrayStructure.size * 8,
        byteSize: 8,
        isRequired: true,
      })
      attachMember(structure, {
        name: 'turkey',
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: (arrayStructure.size + 8) * 8,
        byteSize: 8,
        isRequired: true,
      });
      const Complex = finalizeStructure(structure);
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
  describe('getSpecialKeys', function() {
    it('should include string and typedArray when structure is an u8 array', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: '[4]u8',
        size: 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array },
      });
      finalizeStructure(structure);
      const keys = getSpecialKeys(structure);
      expect(keys).to.eql([ 'dataView', 'base64', 'string', 'typedArray' ]);
    })
    it('should include typedArray only when structure is an i8 array', function() {
      const structure = beginStructure({
        type: StructureType.Array,
        name: '[4]i8',
        size: 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Int8Array },
      });
      finalizeStructure(structure);
      const keys = getSpecialKeys(structure);
      expect(keys).to.eql([ 'dataView', 'base64', 'typedArray' ]);
    })
    it('should include string and typedArray when structure is an u8 slice', function() {
      const structure = beginStructure({
        type: StructureType.Slice,
        name: '[_]u8',
        size: 1,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 8,
        byteSize: 1,
        structure: { constructor: function() {}, typedArray: Uint8Array },
      });
      finalizeStructure(structure);
      const keys = getSpecialKeys(structure);
      expect(keys).to.eql([ 'dataView', 'base64', 'string', 'typedArray' ]);
    })
    it('should include string and typedArray when structure is an u16 slice', function() {
      const structure = beginStructure({
        type: StructureType.Slice,
        name: '[_]u16',
        size: 2,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 16,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array },
      });
      finalizeStructure(structure);
      const keys = getSpecialKeys(structure);
      expect(keys).to.eql([ 'dataView', 'base64', 'string', 'typedArray' ]);
    })
    it('should not include string if structure is an u15 slice', function() {
      const structure = beginStructure({
        type: StructureType.Slice,
        name: '[_]u15',
        size: 2,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 15,
        byteSize: 2,
        structure: { constructor: function() {}, typedArray: Uint16Array },
      });
      finalizeStructure(structure);
      const keys = getSpecialKeys(structure);
      expect(keys).to.eql([ 'dataView', 'base64', 'typedArray' ]);
    })
  })
  describe('checkDataView', function() {
    it('should not throw when a DataView is given', function() {
      const arg = new DataView(new ArrayBuffer(4));
      expect(() => checkDataView(arg)).to.not.throw();
    })
    it('should throw when the given object is not a DataView', function() {
      const arg = new ArrayBuffer(4);
      expect(() => checkDataView(arg)).to.throw(TypeError);
      expect(() => checkDataView(1)).to.throw(TypeError);
      expect(() => checkDataView(null)).to.throw(TypeError);
      expect(() => checkDataView(undefined)).to.throw(TypeError);
    })
  })
  describe('getDataViewFromBase64', function() {
    it('should return a data view with decoded data from a base64 string', function() {
      const bstr = btoa('\u0001\u0002\u0003\u0004');
      const dv = getDataViewFromBase64(bstr);
      for (let i = 0; i < 4; i++) {
        expect(dv.getUint8(i)).to.equal(i + 1);
      }
    })
    it('should throw when it does not get a string', function() {
      expect(() => getDataViewFromBase64(1)).to.throw(TypeError);
    })
  })
  describe('getDataViewFromUTF8', function() {
    it('should return a data view with u8 data from a string', function() {
      const dv = getDataViewFromUTF8('Hello', 1);
      expect(dv).to.have.property('byteLength', 5);
      expect(dv.getUint8(0)).to.equal('H'.charCodeAt(0));
    })
    it('should return a data view with u16 data from a string', function() {
      const dv = getDataViewFromUTF8('Cześć', 2);
      expect(dv).to.have.property('byteLength', 10);
      expect(dv.getUint16(3 * 2, true)).to.equal('ś'.charCodeAt(0));
    })
    it('should throw when it does not get a string', function() {
      expect(() => getDataViewFromUTF8(1)).to.throw(TypeError);
    })
    it('should add sentinel value', function() {
      const dv = getDataViewFromUTF8('Hello', 1, 0);
      expect(dv).to.have.property('byteLength', 6);
      expect(dv.getUint8(5)).to.equal(0);
    })
  })
  describe('getDataViewFromTypedArray', function() {
    it('should return a data view from a typed array', function() {
      const buffer = new ArrayBuffer(20);
      const ta = new Float32Array(buffer, 4, 4);
      const dv = getDataViewFromTypedArray(ta, Float32Array);
      expect(dv).to.have.property('byteLength', 16);
      expect(dv).to.have.property('byteOffset', 4);
    })
    it('should throw when it receives a typed array of the wrong type', function() {
      const ta = new Float32Array([ 1, 2, 3, 4 ]);
      expect(() => getDataViewFromTypedArray(ta, Float64Array)).to.throw(TypeError);
      expect(() => getDataViewFromTypedArray(undefined, Float64Array)).to.throw(TypeError);
      expect(() => getDataViewFromTypedArray(1, Float64Array)).to.throw(TypeError);
    })
  })
})

