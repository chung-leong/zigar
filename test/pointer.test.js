import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
  useObject,
} from '../src/member.js';
import {
  StructureType,
  usePrimitive,
  usePointer,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';
import { getMemoryCopier } from '../src/memory.js';
import { MEMORY, SLOTS, SOURCE } from '../src/symbol.js';
import {
  getPointerAccessors,
} from '../src/pointer.js';

describe('Pointer functions', function() {
  describe('finalizePointer', function() {
    beforeEach(function() {
      useIntEx();
      useObject();
      usePrimitive();
      usePointer();
    })
    it('should define a pointer for pointing to integers', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const PInt32 = finalizeStructure(structure);
      const int32 = new Int32(1234);
      const intPointer = new PInt32(int32);
      expect(intPointer['*']).to.equal(int32);
    })
  })
  describe('getPointerAccessors', function() {
    it('should return a function for retrieving a pointer from an object', function() {
      function FakePointer() {}
      const fakePointer = new FakePointer();
      const member = {
        type: MemberType.Object,
        bitOffset: 8,
        bitSize: 64,
        byteSize: 8,
        slot: 4,
        structure: {
          type: StructureType.Pointer,
          constructor: FakePointer,
        },
      };
      const { get } = getPointerAccessors(member, {});
      const object = {
        [SLOTS]: { 4: fakePointer },
      };
      const ptrObject = {
        [SOURCE]: object,
      };
      const result = get.call(ptrObject);
      expect(result).to.equal(fakePointer);
    })
    it('should return a function for setting a pointer', function() {
      function FakePointer(object, address) {
        this[MEMORY] = new DataView(new ArrayBuffer(8));
        this[MEMORY].setBigUint64(0, address);
        this[SLOTS] = { 0: object };
      }
      const target = {};
      const fakePointer = new FakePointer(target, 1234n);
      const copy = getMemoryCopier(8);
      const member = {
        type: MemberType.Object,
        bitOffset: 8,
        bitSize: 64,
        byteSize: 8,
        slot: 4,
        structure: {
          type: StructureType.Pointer,
          constructor: FakePointer,
          initializer: function(arg) {
            copy(this[MEMORY], arg[MEMORY]);
            this[SLOTS][0] = arg[SLOTS][0];
          },
        },
      };
      const { set } = getPointerAccessors(member, {});
      const object = {
        [SLOTS]: { 4: fakePointer },
      };
      const ptrObject = {
        [SOURCE]: object,
      };
      const newTarget = {};
      set.call(ptrObject, new FakePointer(newTarget, 4567n));
      expect(fakePointer[MEMORY].getBigUint64(0)).to.equal(4567n);
      expect(fakePointer[SLOTS][0]).to.equal(newTarget);
    })
    it('should return a function for retrieving a pointer from an array', function() {
      function FakePointer() {}
      const fakePointer = new FakePointer();
      const member = {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: {
          type: StructureType.Pointer,
          constructor: FakePointer,
        },
      };
      const { get } = getPointerAccessors(member, {});
      const array = {
        [SLOTS]: { 4: fakePointer },
      };
      const ptrObject = {
        [SOURCE]: array,
      };
      const result = get.call(ptrObject, 4);
      expect(result).to.equal(fakePointer);
    })
    it('should return a function for setting a pointer in an array', function() {
      function FakePointer(object, address) {
        this[MEMORY] = new DataView(new ArrayBuffer(8));
        if (address !== undefined) {
          this[MEMORY].setBigUint64(0, address);
        }
        this[SLOTS] = { 0: object };
      }
      const target = {};
      const fakePointer = new FakePointer(target, 1234n);
      const copy = getMemoryCopier(8);
      const member = {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: {
          type: StructureType.Pointer,
          constructor: FakePointer,
          initializer: function(arg) {
            copy(this[MEMORY], arg[MEMORY]);
            this[SLOTS][0] = arg[SLOTS][0];
          },
        },
      };
      const { set } = getPointerAccessors(member, {});
      const array = {
        [SLOTS]: { 4: fakePointer },
      };
      const ptrObject = {
        [SOURCE]: array,
      };
      const newTarget = {};
      set.call(ptrObject, 4, new FakePointer(newTarget, 4567n));
      expect(fakePointer[MEMORY].getBigUint64(0)).to.equal(4567n);
      expect(fakePointer[SLOTS][0]).to.equal(newTarget);
    })
  })
})
