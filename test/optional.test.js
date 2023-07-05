import { expect } from 'chai';

import {
  MemberType,
  useBool,
  useIntEx,
  useFloatEx,
  useObject,
} from '../src/member.js';
import {
  StructureType,
  useStruct,
  useOptional,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import {
  getOptionalAccessors,
} from '../src/optional.js';

describe('Optional functions', function() {
  describe('finalizeOptional', function() {
    beforeEach(function() {
      useOptional();
      useStruct();
      useBool();
      useIntEx();
      useFloatEx();
    })
    it('should define a structure for storing an optional value', function() {
      const structure = beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        size: 18,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Float,
        bitOffset: 0,
        bitSize: 128,
        byteSize: 16,
      });
      attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
      });
      const Hello = finalizeStructure(structure);
      const object = Hello(new ArrayBuffer(18));
      expect(object.get()).to.equal(null);
      object.set(3.14);
      expect(object.get()).to.equal(3.14);
      object.set(null);
      expect(object.get()).to.equal(null);
    })
    it('should define a structure for storing an optional struct', function() {
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Aniaml',
        size: 8,
      });
      attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      const Aniaml = finalizeStructure(structStructure);
      const structure = beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        size: 18,
      });
      attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: structStructure,
      });
      attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 128,
        bitSize: 1,
        byteSize: 1,
      });
      const Hello = finalizeStructure(structure);
      const object = Hello(new ArrayBuffer(18));
      expect(object.get()).to.equal(null);
      object.set({ dog: 1, cat: 2 });
      expect(object.get()).to.be.an('object');
      object.set(null);
      expect(object.get()).to.equal(null);
    })
  })
  describe('getOptionalAccessors', function() {
    beforeEach(function() {
      useBool();
      useFloatEx();
      useObject();
    })
    it('should return a function for getting optional float', function() {
      const members = [
        {
          type: MemberType.Float,
          bitOffset: 0,
          bitSize: 64,
          byteSize: 8,
        },
        {
          type: MemberType.Bool,
          isSigned: false,
          bitOffset: 64,
          bitSize: 1,
          byteSize: 1,
        },
      ];
      const dv = new DataView(new ArrayBuffer(10));
      dv.setFloat64(0, 3.14, true);
      dv.setUint8(8, 1, true);
      const object = {
        [MEMORY]: dv,
      };
      const { get } = getOptionalAccessors(members, {});
      const result1 = get.call(object);
      expect(result1).to.equal(3.14);
      dv.setUint8(8, 0, true);
      const result2 = get.call(object);
      expect(result2).to.be.null;
    })
    it('should return a function for getting optional object value', function() {
      const DummyClass = function() {};
      const members = [
        {
          type: MemberType.Object,
          bitOffset: 0,
          bitSize: 64,
          byteSize: 8,
          slot: 0,
          structure: {
            type: StructureType.Struct,
            constructor: DummyClass,
          }
        },
        {
          type: MemberType.Bool,
          bitOffset: 64,
          bitSize: 1,
          byteSize: 1,
        },
      ];
      const dv = new DataView(new ArrayBuffer(10));
      const object = {
        [MEMORY]: dv,
        [SLOTS]: { 0: null },
      };
      const dummyObject = new DummyClass();
      const { get } = getOptionalAccessors(members, {});
      const result1 = get.call(object);
      expect(result1).to.equal(null);
      dv.setUint8(8, 1, true);
      object[SLOTS][0] = dummyObject;
      const result2 = get.call(object);
      expect(result2).to.equal(dummyObject);
    })
    it('should return a function for setting float or null', function() {
      const members = [
        {
          type: MemberType.Float,
          bitOffset: 0,
          bitSize: 64,
          byteSize: 8,
        },
        {
          type: MemberType.Bool,
          isSigned: false,
          bitOffset: 64,
          bitSize: 1,
          byteSize: 1,
        },
      ];
      const dv = new DataView(new ArrayBuffer(10));
      dv.setInt8(8, 1, true);
      dv.setFloat64(0, 3.14, true);
      const object = {
        [MEMORY]: dv,
      };
      const { get, set } = getOptionalAccessors(members, {});
      expect(get.call(object)).to.equal(3.14);
      set.call(object, null);
      expect(dv.getUint8(8, true)).to.equal(0);
      expect(dv.getFloat64(0, true)).to.equal(0);
      set.call(object, 1234.5678);
      expect(dv.getUint8(8, true)).to.equal(1);
      expect(dv.getFloat64(0, true)).to.equal(1234.5678);
    })
    it('should return a function for setting object or error', function() {
      const DummyClass = function(value) {
        this.value = value;
      };
      const members = [
        {
          type: MemberType.Object,
          bitOffset: 0,
          bitSize: 64,
          byteSize: 8,
          slot: 0,
          structure: {
            type: StructureType.Struct,
            constructor: DummyClass,
            copier: (dest, src) => {
              dest.value = src.value;
            },
            resetter: (dest) => {
              dest.value = 0;
            },
          }
        },
        {
          type: MemberType.Bool,
          bitOffset: 64,
          bitSize: 1,
          byteSize: 1,
        },
      ];
      const dummyObject = new DummyClass(123);
      const dv = new DataView(new ArrayBuffer(10));
      const object = {
        [MEMORY]: dv,
        [SLOTS]: { 0: dummyObject },
      };
      const { get, set } = getOptionalAccessors(members, {});
      set.call(object, null);
      expect(dv.getUint8(8, true)).to.equal(0);
      // TODO: implement resetter
      //expect(object[SLOTS][0].value).to.equal(0);
      set.call(object, 456);
      expect(dv.getUint8(8, true)).to.equal(1);
      expect(object[SLOTS][0].value).to.equal(456);
    })
  })
})
