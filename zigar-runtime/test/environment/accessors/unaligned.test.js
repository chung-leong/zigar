import { expect } from 'chai';
import { defineEnvironment, reset } from '../../../src/environment/class.js';
import { MemberType } from '../../../src/environment/members/all.js';

import '../../../src/environment/accessors/all.js?dep=unaligned';
import {
  getBitAlignFunction,
  isNeededByMember,
} from '../../../src/environment/accessors/unaligned.js';

const Env = defineEnvironment();
reset();

describe('Accessor: unaligned', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const members = [
        { type: MemberType.Int, bitSize: 7, bitOffset: 2 },
        { type: MemberType.Float, bitSize: 15, bitOffset: 3 },
        { type: MemberType.Uint, bitSize: 31, bitOffset: 4 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.true;
      }
    })
    it('should return false when mixin is not needed by a member', function() {
      const members = [
        { type: MemberType.Object, slot: 1 },
        { type: MemberType.Bool, bitSize: 1, bitOffset: 3 },
        { type: MemberType.Int, bitSize: 7, bitOffset: 1 },
      ];
      for (const member of members) {
        expect(isNeededByMember(member)).to.be.false;
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
  describe('getAccessorUnaligned', function() {
    it('should return methods for accessing non-standard ints', function() {
      const env = new Env();
      const members = [
        { type: MemberType.Int, bitSize: 7, byteSize: 1, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 15, byteSize: 2, bitOffset: 0 },
        { type: MemberType.Int, bitSize: 30, byteSize: 4, bitOffset: 0 },
      ];
    })
  })
})