import { expect } from 'chai';

import {
  getCopyFunction,
  getClearFunction,
  getBitAlignFunction,
} from '../src/memory.js';

describe('Memory copying functions', function() {
  describe('getCopyFunction', function() {
    it ('should return a function for copying unaligned data', function() {
      const te = new TextEncoder();
      const ta = te.encode('123456789'.repeat(5));
      expect(ta.byteLength).to.equal(45);
      const src = new DataView(ta.buffer);
      const dest = new DataView(new ArrayBuffer(src.byteLength));
      const f = getCopyFunction(src.byteLength);
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
      const f = getCopyFunction(src.byteLength);
      const f2 = getCopyFunction(45);
      expect(f).to.not.equal(f2);
      f(dest, src);
      const td = new TextDecoder();
      const s = td.decode(dest);
      expect(s).to.equal('123456789'.repeat(8));
    })
  })
  describe('getClearFunction', function() {
    it ('should return a function for clearing unaligned data', function() {
      const dest = new DataView(new ArrayBuffer(45));
      for (let i = 0; i < dest.byteLength; i++) {
        dest.setUint8(i, 0xAA);
      }
      const f = getClearFunction(dest.byteLength);
      f(dest);
      for (let i = 0; i < dest.byteLength; i++) {
        expect(dest.getUint8(i)).to.equal(0);
      }
    })
    it ('should return a function for copying aligned data', function() {
      const dest = new DataView(new ArrayBuffer(64));
      for (let i = 0; i < dest.byteLength; i++) {
        dest.setUint8(i, 0xAA);
      }
      const f = getClearFunction(dest.byteLength);
      f(dest);
      for (let i = 0; i < dest.byteLength; i++) {
        expect(dest.getUint8(i)).to.equal(0);
      }
    })
  })
  describe('getBitAlignFunction', function() {
    it ('should return functions for copying to and from a bit offset (not crossing byte boundary)', function() {
      const misaligned = new DataView(new ArrayBuffer(4));
      const aligned = new DataView(new ArrayBuffer(1));
      misaligned.setUint8(2, 0xE0); // 11100000
                                    //    ^ bit 4
      const toAligned = getBitAlignFunction(4, 3, true);
      toAligned(aligned, misaligned, 2);
      expect(aligned.getUint8(0)).to.equal(0x06);
      const fromAligned = getBitAlignFunction(4, 3, false);
      misaligned.setUint8(2, 0);
      fromAligned(misaligned, aligned, 2);
      expect(misaligned.getUint8(2)).to.equal(0x60);
      misaligned.setUint8(2, 0xFF);
      fromAligned(misaligned, aligned, 2);
      expect(misaligned.getUint8(2)).to.equal(0xEF);
    })
    it ('should return functions for copying to and from a bit offset (crossing one byte boundary, less than 8 bits)', function() {
      const misaligned = new DataView(new ArrayBuffer(4));
      const aligned = new DataView(new ArrayBuffer(1));
      misaligned.setUint8(2, 0xE0); //          11100000
      misaligned.setUint8(3, 0x03); // 00000011    ^ bit 4
      const toAligned = getBitAlignFunction(4, 7, true);
      toAligned(aligned, misaligned, 2);
      expect(aligned.getUint8(0)).to.equal(0x3E);
      const fromAligned = getBitAlignFunction(4, 7, false);
      misaligned.setUint8(2, 0);
      misaligned.setUint8(3, 0xFF);
      fromAligned(misaligned, aligned, 2);
      expect(misaligned.getUint8(2)).to.equal(0xE0);
      expect(misaligned.getUint8(3)).to.equal(0xFB);
    })
    it ('should return functions for copying to and from a bit offset (crossing one byte boundary, more than 8 bits)', function() {
      const misaligned = new DataView(new ArrayBuffer(4));
      const aligned = new DataView(new ArrayBuffer(2));
      misaligned.setUint8(2, 0xE0); //          11100000
      misaligned.setUint8(3, 0x1B); // 00011011       ^ bit 1
      const toAligned = getBitAlignFunction(1, 10, true);
      toAligned(aligned, misaligned, 2);
      expect(aligned.getUint8(0)).to.equal(0xF0);
      expect(aligned.getUint8(1)).to.equal(0x01);
      const fromAligned = getBitAlignFunction(1, 10, false);
      misaligned.setUint8(2, 0);
      misaligned.setUint8(3, 0xFF);
      fromAligned(misaligned, aligned, 2);
      expect(misaligned.getUint8(2)).to.equal(0xE0);
      expect(misaligned.getUint8(3)).to.equal(0xFB);
      misaligned.setUint8(3, 0x0C);
      fromAligned(misaligned, aligned, 2);
      expect(misaligned.getUint8(3)).to.equal(0x0B);
      // 9-bit int: -256, offset 1
      misaligned.setUint8(1, 0x00);
      misaligned.setUint8(2, 0x02)
      toAligned(aligned, misaligned, 1);
      expect(aligned.getUint8(0)).to.equal(0x00);
      expect(aligned.getUint8(1)).to.equal(0x01);
    })
    it ('should return functions for copying to and from a bit offset (crossing multiple byte boundaries)', function() {
      const misaligned = new DataView(new ArrayBuffer(5));
      const aligned = new DataView(new ArrayBuffer(3));
      misaligned.setUint8(0, 0xFF); //                                     11111111
      misaligned.setUint8(1, 0x1F); //                            00011111
      misaligned.setUint8(2, 0x10); //                   00010000   ^- bit 5
      misaligned.setUint8(3, 0xE0); //          11100000
      misaligned.setUint8(4, 0xFF); // 11111111
      const toAligned = getBitAlignFunction(5, 20, true);
      toAligned(aligned, misaligned, 1);
      expect(aligned.getUint8(0)).to.equal(0x80);
      expect(aligned.getUint8(1)).to.equal(0x00);
      expect(aligned.getUint8(2)).to.equal(0x0F);
      const fromAligned = getBitAlignFunction(5, 20, false);
      fromAligned(misaligned, aligned, 1);
      expect(misaligned.getUint8(1)).to.equal(0x1F);
      expect(misaligned.getUint8(2)).to.equal(0x10);
      expect(misaligned.getUint8(3)).to.equal(0xE0);
      expect(misaligned.getUint8(4)).to.equal(0xFF);
    })
  })
})