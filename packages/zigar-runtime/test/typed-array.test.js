import { expect } from 'chai';

import { MemberType } from '../src/member.js';
import {
  getTypedArrayClass,
  isTypedArray,
} from '../src/typed-array.js';

describe('Typed array functions', function() {
  describe('getTypedArrayGetter', function() {
    it('should a typed array class when element type is standard', function() {
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
      };
      const f = getTypedArrayClass(member);
      expect(f).to.be.a('function');
      expect(f).to.equal(Int32Array);
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
