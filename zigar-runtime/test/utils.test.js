import { expect } from 'chai';

import {
  add,
  alignForward,
  decodeBase64,
  decodeText,
  encodeBase64,
  encodeText,
  findSortedIndex,
  isInvalidAddress,
  isMisaligned,
} from '../src/utils.js';

describe('Utility functions', function() {
  describe('decodeText', function() {
    it('should convert a Uint8Array into a string', function() {
      const text = 'Hello world!';
      const ta = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        ta[i] = text.charCodeAt(i);
      }
      const result = decodeText(ta, 'utf-8');
      expect(result).to.equal(text);
    })
    it('should convert a Uint16Array into a string', function() {
      const text = 'Cześć świecie!';
      const ta = new Uint16Array(text.length);
      for (let i = 0; i < text.length; i++) {
        ta[i] = text.charCodeAt(i);
      }
      const result = decodeText(ta, 'utf-16');
      expect(result).to.equal(text);
    })
    it('should convert an array of Uint16Arrays into a string', function() {
      const text = 'Cześć świecie!';
      const ta1 = new Uint16Array(text.length);
      const ta2 = new Uint16Array(text.length);
      const ta3 = new Uint16Array(text.length);
      for (let i = 0; i < text.length; i++) {
        ta1[i] = text.charCodeAt(i);
        ta2[i] = text.charCodeAt(i);
        ta3[i] = text.charCodeAt(i);
      }
      const result = decodeText([ ta1, ta2, ta3 ], 'utf-16');
      expect(result).to.equal(text.repeat(3));
    })
    it('should convert an array Uint8Array into a string', function() {
      const text = 'Hello world!';
      const ta1 = new Uint16Array(text.length);
      for (let i = 0; i < text.length; i++) {
        ta1[i] = text.charCodeAt(i);
      }
      const result = decodeText([ ta1 ], 'utf-16');
      expect(result).to.equal(text.repeat(1));
    })
  })
  describe('encodeText', function() {
    it('should convert a string to Uint8Array', function() {
      const text = 'Hello world!';
      const ta = encodeText(text, 'utf-8');
      for (const [ index, c ] of ta.entries()) {
        expect(c).to.equal(text.charCodeAt(index));
      }
    })
    it('should convert a string to Uint16Array', function() {
      const text = 'Cześć świecie!';
      const ta = encodeText(text, 'utf-16');
      for (const [ index, c ] of ta.entries()) {
        expect(c).to.equal(text.charCodeAt(index));
      }
    })
  })
  describe('encodeBase64', function() {
    it('should encode data view to base64 string', function() {
      const dv = new DataView(new ArrayBuffer(5));
      for (let i = 0; i < dv.byteLength; i++) {
        dv.setUint8(i, i);
      }
      const s = encodeBase64(dv);
      expect(s).to.equal('AAECAwQ=');
    })
    it('should use browser function to encode data into base64', function() {
      const buffer = global.Buffer;
      global.Buffer = 'removed';
      try {
        const dv = new DataView(new ArrayBuffer(5));
        for (let i = 0; i < dv.byteLength; i++) {
          dv.setUint8(i, i);
        }
        const s = encodeBase64(dv);
        expect(s).to.equal('AAECAwQ=');
      } finally {
        global.Buffer = buffer;
      }
    })
  })
  describe('decodeBase64', function() {
    it('should decode base64 string', function() {
      const s = 'AAECAwQ=';
      const dv = decodeBase64(s);
      for (let i = 0; i < dv.byteLength; i++) {
        expect(dv.getUint8(i)).to.equal(i);
      }
    })
    it('should use browser function to decode base64', function() {
      const buffer = global.Buffer;
      global.Buffer = 'removed';
      try {
        const s = 'AAECAwQ=';
        const dv = decodeBase64(s);
        for (let i = 0; i < dv.byteLength; i++) {
          expect(dv.getUint8(i)).to.equal(i);
        }
      } finally {
        global.Buffer = buffer;
      }
    })
  })
  describe('findSortedIndex', function() {
    it('should return correct indices for the addresses given', function() {
      const list = [
        { address: 10 },
        { address: 20 },
        { address: 30 },
      ];
      expect(findSortedIndex(list, 5, m => m.address)).to.equal(0);
      expect(findSortedIndex(list, 15, m => m.address)).to.equal(1);
      expect(findSortedIndex(list, 25, m => m.address)).to.equal(2);
      expect(findSortedIndex(list, 35, m => m.address)).to.equal(3);
      expect(findSortedIndex(list, 30, m => m.address)).to.equal(3);
      expect(findSortedIndex(list, 10, m => m.address)).to.equal(1);
    })
  })
  describe('isMisaligned', function() {
    it(`should determine whether address is misaligned`, function() {
      expect(isMisaligned(0x1000, 2)).to.be.false;
      expect(isMisaligned(0x1001, 2)).to.be.true;
      expect(isMisaligned(0x1002, 2)).to.be.false;
      expect(isMisaligned(0x1002, 4)).to.be.true;
      expect(isMisaligned(0x1004, 4)).to.be.false;
      expect(isMisaligned(0x1004, 8)).to.be.true;
    })
    it(`should handle bigInt addresses`, function() {
      expect(isMisaligned(0xF000000000001000n, 2)).to.be.false;
      expect(isMisaligned(0xF000000000001001n, 2)).to.be.true;
      expect(isMisaligned(0xF000000000001002n, 2)).to.be.false;
      expect(isMisaligned(0xF000000000001002n, 4)).to.be.true;
      expect(isMisaligned(0xF000000000001004n, 4)).to.be.false;
      expect(isMisaligned(0xF000000000001004n, 8)).to.be.true;
    })
    it(`should return false when align is undefined`, function() {
      expect(isMisaligned(0x1000, undefined)).to.be.false;
      expect(isMisaligned(0xF000000000001000n, undefined)).to.be.false;
    })
  })
  describe('alignForward', function() {
    it('should create an aligned address from one that is not aligned', function() {
      expect(alignForward(0x0001, 4)).to.equal(0x0004)
    })
  })
  describe('isInvalidAddress', function() {
    it(`should return true when 0xaaaaaaaa is given`, function() {
      expect(isInvalidAddress(0xaaaaaaaa)).to.be.true;
    })
    it(`should return true when 0xaaaaaaaaaaaaaaaan is given`, function() {
      expect(isInvalidAddress(0xaaaaaaaaaaaaaaaan)).to.be.true;
    })
    it(`should return false when address valid`, function() {
      expect(isInvalidAddress(0x1000n)).to.be.false;
    })
  })
  describe('add', function() {
    it(`should add a number to another`, function() {
      expect(add(5, 5)).to.equal(10);
    })
    it(`should add a number to a bigint`, function() {
      expect(add(5n, 5)).to.equal(10n);
    })
    it(`should add a bigint to a bigint`, function() {
      expect(add(5n, 5n)).to.equal(10n);
    })
  })
})
