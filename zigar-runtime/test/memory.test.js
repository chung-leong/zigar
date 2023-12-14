import { expect } from 'chai';

import {
  getCopyFunction,
  getResetFunction,
  getBitAlignFunction,
  restoreMemory,
  getMemoryResetter,
} from '../src/memory.js';
import { MEMORY } from '../src/symbol.js';

describe('Memory functions', function() {
  describe('getCopyFunction', function() {
    it('should return optimal function for copying buffers of various sizes', function() {
      const functions = [];
      for (let size = 1; size <= 64; size++) {
        const src = new DataView(new ArrayBuffer(size));
        for (let i = 0; i < size; i++) {
          src.setInt8(i, i);
        }
        const dest = new DataView(new ArrayBuffer(size));
        const f = getCopyFunction(size);
        if (!functions.includes(f)) {
          functions.push(f);
        }
        f(dest, src);
        for (let i = 0; i < size; i++) {
          expect(dest.getInt8(i)).to.equal(i);
        }
      }
      for (let size = 1; size <= 64; size++) {
        const src = new DataView(new ArrayBuffer(size * 16));
        for (let i = 0; i < size; i++) {
          src.setInt8(i, i);
        }
        const dest = new DataView(new ArrayBuffer(size * 16));
        const f = getCopyFunction(size, true);
        if (!functions.includes(f)) {
          functions.push(f);
        }
        f(dest, src);
        for (let i = 0; i < size; i++) {
          expect(dest.getInt8(i)).to.equal(i);
        }
      }
      expect(functions).to.have.lengthOf(10);
    })
  })
  describe('getResetFunction', function() {
    it('should return optimal function for clearing buffers of various sizes', function() {
      const functions = [];
      for (let size = 1; size <= 64; size++) {
        const dest = new DataView(new ArrayBuffer(size));
        for (let i = 0; i < size; i++) {
          dest.setInt8(i, i);
        }
        const f = getResetFunction(size);
        if (!functions.includes(f)) {
          functions.push(f);
        }
        f(dest, 0);
        for (let i = 0; i < size; i++) {
          expect(dest.getInt8(i)).to.equal(0);
        }
      }
      expect(functions).to.have.lengthOf(10);
    })
  })
  describe('getMemoryResetter', function() {
    it('should return function for clearing memory of objects', function() {
      const dest = new DataView(new ArrayBuffer(32));
      for (let i = 0; i < 32; i++) {
        dest.setInt8(i, i);
      }
      const object = { [MEMORY]: dest };
      const f = getMemoryResetter(16, 16);
      f.call(object);
      for (let i = 0; i < 32; i++) {
        expect(dest.getInt8(i)).to.equal(i < 16 ? i : 0);
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
  describe('restoreMemory', function() {
    it('should restore WASM memory buffer that has become detached', function() {
      const memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      const dv = new DataView(memory.buffer, 0, 8);
      dv[MEMORY] = { memory, address: 0, len: 8 };
      const object = {
        [MEMORY]: dv,
      };
      memory.grow(1);
      expect(() => dv.getInt8(0)).to.throw(TypeError);
      restoreMemory.call(object);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(() => object[MEMORY].getInt8(0)).to.not.throw();
    })
  })
})