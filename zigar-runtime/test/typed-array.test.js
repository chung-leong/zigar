import { expect } from 'chai';

import { MemberType } from '../src/member.js';
import {
  getTypedArrayClass,
  isTypedArray,
} from '../src/typed-array.js';

describe('Typed array functions', function() {
  describe('getTypedArrayClass', function() {
    it('should a typed array class when element type is standard', function() {
      let index = 0;
      const types = [
        Int8Array,
        Uint8Array,
        Int16Array,
        Uint16Array,
        Int32Array,
        Uint32Array,
        BigInt64Array,
        BigUint64Array,
      ];
      for (const byteSize of [ 1, 2, 4, 8 ]) {
        for (const isSigned of [ true, false ]) {
          const member = {
            type: MemberType.Int,
            isSigned,
            bitSize: byteSize * 8,
            byteSize,
          };
          const f = getTypedArrayClass(member);
          expect(f).to.be.a('function');
          expect(f).to.equal(types[index++]);
        }
      }
    })
    it('should a typed array class that fits the non-standard type', function() {
      const member = {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 36,
        byteSize: 8,
      };
      const f = getTypedArrayClass(member);
      expect(f).to.equal(BigUint64Array);
    })
    it('should a typed array class for floating point numbers', function() {
      let index = 0;
      const types = [
        Float32Array,
        Float64Array,
      ];
      for (const byteSize of [ 4, 8 ]) {
        const member = {
          type: MemberType.Float,
          isSigned: false,
          bitSize: byteSize * 8,
          byteSize,
        };
        const f = getTypedArrayClass(member);
        expect(f).to.equal(types[index++]);
      }
    })
  })
  describe('isTypedArray', function() {
    it('should return true when given the correct TypedArray', function() {
      const ta = new Int32Array(4);
      expect(isTypedArray(ta, Int32Array)).to.be.true;
    })
    it('should return false when the array type is different', function() {
      const ta = new Int32Array(4);
      expect(isTypedArray(ta, Uint32Array)).to.be.false;
    })
    it('should return false when given no array type', function() {
      const ta = new Int32Array(4);
      expect(isTypedArray(ta)).to.be.false;
    })
  })
})
