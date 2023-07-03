import { expect } from 'chai';

import { MemberType } from '../src/member.js';
import {
  getTypedArrayClass,
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
    })
    it('should return nothing when element type is non-standard', function() {
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 36,
        byteSize: 5,
      };
      const f = getTypedArrayClass(member);
      expect(f).to.be.undefined;
    })
  })
})
