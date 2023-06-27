import { expect } from 'chai';

import { StructureType, MemberType } from '../src/type.js';
import { MEMORY, SLOTS,  SOURCE } from '../src/symbol.js';
import { obtainCopyFunction } from '../src/memory.js';
import {
  obtainPointerGetter,
  obtainPointerSetter,
  obtainPointerArrayGetter,
  obtainPointerArraySetter,
  obtainPointerArrayLengthGetter,
} from '../src/pointer.js';

describe('Pointer acquisition functions', function() {
  describe('obtainPointerGetter', function() {
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
      const get = obtainPointerGetter(member, {});
      const object = {
        [SLOTS]: { 4: fakePointer },
      };
      const ptrObject = {
        [SOURCE]: object,
      };
      const result = get.call(ptrObject);
      expect(result).to.equal(fakePointer);
    })
  })
  describe('obtainPointerSetter', function() {
    it('should return a function for setting a pointer', function() {
      function FakePointer(object, address) {
        this[MEMORY] = new DataView(new ArrayBuffer(8));
        this[MEMORY].setBigUint64(0, address);
        this[SLOTS] = { 0: object };
      }
      const target = {};
      const fakePointer = new FakePointer(target, 1234n);
      const copy = obtainCopyFunction(8);
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
      const set = obtainPointerSetter(member, {});
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
  })
  describe('obtainPointerArrayGetter', function() {
    it('should return a function for retrieving a pointer from an array', function() {
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
      const get = obtainPointerArrayGetter(member, {});
      const array = {
        [SLOTS]: { 4: fakePointer },
      };
      const ptrObject = {
        [SOURCE]: array,
      };
      const result = get.call(ptrObject, 4);
      expect(result).to.equal(fakePointer);
    })
  })
  describe('obtainPointerArraySetter', function() {
    it('should return a function for setting a pointer in an array', function() {
      function FakePointer(object, address) {
        this[MEMORY] = new DataView(new ArrayBuffer(8));
        this[MEMORY].setBigUint64(0, address);
        this[SLOTS] = { 0: object };
      }
      const target = {};
      const fakePointer = new FakePointer(target, 1234n);
      const copy = obtainCopyFunction(8);
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
      const set = obtainPointerArraySetter(member, {});
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
  describe('obtainPointerArrayLengthGetter', function() {
    it('should return the length of the source object', function() {
      const array = {
        length: 16,
      };
      const ptrObject = {
        [SOURCE]: array,
      };
      const getLength = obtainPointerArrayLengthGetter({}, {});
      const result = getLength.call(ptrObject);
      expect(result).to.equal(16);
    })
  })
})
