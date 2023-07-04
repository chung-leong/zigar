import { expect } from 'chai';

import { MemberType } from '../src/member.js';
import { MEMORY } from '../src/symbol.js';
import {
  getStringGetter,
} from '../src/string.js';

describe('String functions', function() {
  describe('getStringGetter', function() {
    it('should return getter function for u8', function() {
      const member = {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 8,
        byteSize: 1,
      };
      const get = getStringGetter(member);
      expect(get).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(4));
      const object = {
        [MEMORY]: dv
      };
      dv.setUint8(0, 'A'.charCodeAt(0));
      dv.setUint8(1, 'B'.charCodeAt(0));
      dv.setUint8(2, 'C'.charCodeAt(0));
      dv.setUint8(3, 'D'.charCodeAt(0));
      expect(get.call(object)).to.equal('ABCD');
    })
    it('should return getter function for u16', function() {
      const member = {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 16,
        byteSize: 2,
      };
      const get = getStringGetter(member);
      expect(get).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(8));
      const object = {
        [MEMORY]: dv
      };
      dv.setUint16(0, 'A'.charCodeAt(0), true);
      dv.setUint16(2, 'B'.charCodeAt(0), true);
      dv.setUint16(4, 'C'.charCodeAt(0), true);
      dv.setUint16(6, 'D'.charCodeAt(0), true);
      expect(get.call(object)).to.equal('ABCD');
    })
  })
})
