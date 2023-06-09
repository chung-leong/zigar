import { expect } from 'chai';

import { copyBits, applyBits, obtainCopyFunction } from '../src/memory.js';

describe('Memory copying functions', function() {
  describe('obtainCopyFunction', function() {
    it ('should return a function for copying unaligned data', function() {
      const te = new TextEncoder();
      const ta = te.encode('123456789'.repeat(5));
      expect(ta.byteLength).to.equal(45);
      const src = new DataView(ta.buffer);
      const dest = new DataView(new ArrayBuffer(src.byteLength));
      const f = obtainCopyFunction(src.byteLength);
      f(dest, src);
      const td = new TextDecoder();
      const s = td.decode(dest);
      expect(s).to.equal('123456789'.repeat(5));
    })
    it ('should return a function for copying aligned data', function() {
      const te = new TextEncoder();
      const ta = te.encode('123456789'.repeat(8));
      expect(ta.byteLength).to.equal(72);
      const src = new DataView(ta.buffer);
      const dest = new DataView(new ArrayBuffer(src.byteLength));
      const f = obtainCopyFunction(src.byteLength);
      const f2 = obtainCopyFunction(45);
      expect(f).to.not.equal(f2);
      f(dest, src);
      const td = new TextDecoder();
      const s = td.decode(dest);
      expect(s).to.equal('123456789'.repeat(8));      
    })
  })
  describe('copyBits', function() {
    it('should copy unaligned bits into an aligned buffer', function() {
      const src = new DataView(new ArrayBuffer(8));
      // create this bit pattern
      //  byte 7                                                         byte 0
      // 11111111 11111111 11111111 11111111 11100000 00010000 00011111 11111111
      //                                                v        ^- bit 5
      //                                        00000000 10000000
      src.setUint8(7, 0xFF);
      src.setUint8(6, 0xFF);
      src.setUint8(5, 0xFF);
      src.setUint8(4, 0xFF);
      src.setUint8(3, 0xE0);
      src.setUint8(2, 0x10);
      src.setUint8(1, 0x1F);
      src.setUint8(0, 0xFF);
      const dest1 = new DataView(new ArrayBuffer(2));
      copyBits(dest1, src, 1, 5, 16);
      expect(dest1.getUint8(0)).to.equal(0x80);
      expect(dest1.getUint8(1)).to.equal(0x00);
      // copy 3 more bits to get 00000111 00000000 10000000
      const dest2 = new DataView(new ArrayBuffer(3));
      copyBits(dest2, src, 1, 5, 19);
      expect(dest2.getUint8(0)).to.equal(0x80);
      expect(dest2.getUint8(1)).to.equal(0x00);
      expect(dest2.getUint8(2)).to.equal(0x07);
      // copy 3 bits at bit 3 to get 00000011
      const dest3 = new DataView(new ArrayBuffer(1))
      copyBits(dest3, src, 1, 3, 3);
      expect(dest3.getUint8(0)).to.equal(3);
    })
  })
  describe('applyBits', function() {
    it('should insert bits into unaligned positions at destination buffer', function() {
      const dest = new DataView(new ArrayBuffer(8));
      // create this bit pattern
      //  byte 7                                                         byte 0
      // 11111111 11111111 11111111 11111111 11100000 00010000 00011111 11111111
      //                                                         ^- bit 5
      dest.setUint8(7, 0xFF);
      dest.setUint8(6, 0xFF);
      dest.setUint8(5, 0xFF);
      dest.setUint8(4, 0xFF);
      dest.setUint8(3, 0xE0);
      dest.setUint8(2, 0x10);
      dest.setUint8(1, 0x1F);
      dest.setUint8(0, 0xFF);
      // insert 11110000 00101111 to get:
      //  byte 7                                                         byte 0 
      // 11111111 11111111 11111111 11111111 11111110 00000101 11111111 11111111 
      const src1 = new DataView(new ArrayBuffer(2));
      src1.setUint8(0, 0x2F);
      src1.setUint8(1, 0xF0);
      applyBits(dest, src1, 1, 5, 16);
      expect(dest.getUint8(1)).to.equal(0xFF);
      expect(dest.getUint8(2)).to.equal(0x05);
      expect(dest.getUint8(3)).to.equal(0xFE);
      // insert 000 00000000 00000000 to get:
      // 11111111 11111111 11111111 11111111 00000000 00000000 00011111 11111111
      const src2 = new DataView(new ArrayBuffer(3));
      applyBits(dest, src2, 1, 5, 19);
      expect(dest.getUint8(1)).to.equal(0x1F);
      expect(dest.getUint8(2)).to.equal(0x00);
      expect(dest.getUint8(3)).to.equal(0x00);
      expect(dest.getUint8(4)).to.equal(0xFF);
    })
  })
})