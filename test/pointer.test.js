import { expect } from 'chai';

import { StructureType } from '../src/structure.js';
import { MemberType } from '../src/member.js';
import { MEMORY, SLOTS,  SOURCE } from '../src/symbol.js';
import { getCopyFunction } from '../src/memory.js';
import {
  getPointerAccessors,
} from '../src/pointer.js';

describe('Pointer acquisition functions', function() {
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
      const copy = getCopyFunction(8);
      const member = {
        type: MemberType.Object,
        bitOffset: 8,
        bitSize: 64,
        byteSize: 8,
        slot: 4,
        structure: {
          type: StructureType.Pointer,
          constructor: FakePointer,
          copier: function(dest, src) {
            copy(dest[MEMORY], src[MEMORY]);
            Object.assign(dest[SLOTS], src[SLOTS]);
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
        slot: 4,
        structure: {
          type: StructureType.Pointer,
          constructor: FakePointer,
        },
      };
      const get = getPointerAccessors(member, {});
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
        this[MEMORY].setBigUint64(0, address);
        this[SLOTS] = { 0: object };
      }
      const target = {};
      const fakePointer = new FakePointer(target, 1234n);
      const copy = getCopyFunction(8);
      const member = {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        slot: 4,
        structure: {
          type: StructureType.Pointer,
          constructor: FakePointer,
          copier: function(dest, src) {
            copy(dest[MEMORY], src[MEMORY]);
            Object.assign(dest[SLOTS], src[SLOTS]);
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
