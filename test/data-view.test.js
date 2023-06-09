import { expect } from 'chai';

import { MemberType, getIntRange } from '../src/types.js';
import { obtainDataViewGetter, obtainDataViewSetter } from '../src/data-view.js';

describe('DataView functions', function() {
  describe('obtainDataViewGetter', function() {
    it('should return functions for getting standard int types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setBigUint64(8, 0xFFFFFFFFFFFFFFFFn);
      for (const signed of [ false, true ]) {
        for (const bits of [ 8, 16, 32, 64 ]) {
          const { max } = getIntRange(bits, signed);
          const member = {
            type: MemberType.Int,
            bits,
            bitOffset: 64,
            signed,
            align: bits / 8
          }
          const f = obtainDataViewGetter(member);    
          const res = f.call(dv, 8, true);
          if (signed) {
            expect(Number(res)).to.equal(-1);
          } else {
            expect(res).to.equal(max);
          }
        }      
      }
    })
    it('should return functions for getting standard float types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setFloat32(0, 3.14, true);
      dv.setFloat64(8, 3.14, true);
      for (const bits of [ 32, 64 ]) {
        const member = {
          type: MemberType.Float,
          bits,
          bitOffset: (bits === 32) ? 0 : 64,
          signed: true,
          align: bits / 8
        };
        const f = obtainDataViewGetter(member);    
        const res = f.call(dv, (bits === 32) ? 0 : 8, true);
        expect(res.toFixed(2)).to.equal('3.14');
      }      
    })
    it('should return functions for getting non-standard int types (aligned, < 64-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setBigUint64(8, 0xFFFFFFFFFFFFFFFFn);
      for (const signed of [ false, true ]) {
        const standard = [ 8, 16, 32, 64 ];
        for (let bits = 2; bits < 64; bits++) {
          if (standard.includes(bits)) {
            continue;
          }
          const { max } = getIntRange(bits, signed);
          const member = {
            type: MemberType.Int,
            bits,
            bitOffset: 64,
            signed,
            align: [ 1, 2, 4, 8 ].find(b => b * 8 > bits),
          };
          const f = obtainDataViewGetter(member);
          const res = f.call(dv, 8, true);
          if (signed) {
            expect(Number(res)).to.equal(-1);
          } else {
            expect(res).to.equal(max);
          }
        }      
      }
    })
    it('should return functions for getting non-standard int types (128-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt1
      const bytes = [ 255, 255, 255, 255, 255, 255, 255, 31, 0, 0, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Int,
        bits: 128,
        bitOffset: 0,
        signed: false,
        align: 16,
      };
      const f = obtainDataViewGetter(member);     
      const res1 = f.call(dv, 0, true);
      expect(res1).to.equal(0x01FFFFFFFFFFFFFFFn);
      // from struct-bytes: BigInt2
      const bytesBE = [ 0, 0, 0, 0, 0, 0, 0, 0, 31, 255, 255, 255, 255, 255, 255, 255, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const res2 = f.call(dv, 0, false);
      expect(res1).to.equal(0x01FFFFFFFFFFFFFFFn);
    })
    it('should return functions for getting non-standard int types (72-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt3
      const bytes = [ 255, 255, 255, 255, 255, 255, 255, 31, 0, 0, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Int,
        bits: 72,
        bitOffset: 0,
        signed: false,
        align: 16,
      };
      const f = obtainDataViewGetter(member);     
      const res1 = f.call(dv, 0, true);
      expect(res1).to.equal(0x01FFFFFFFFFFFFFFFn);
      // from struct-bytes: BigInt4
      const bytesBE = [ 0, 31, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const res2 = f.call(dv, 0, false);
      expect(res1).to.equal(0x01FFFFFFFFFFFFFFFn);
    })
    it('should return functions for getting non-standard int types (65-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt5
      const bytes = [ 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, ];
      for (const [ i, b ] of bytes.entries()) {
        dv.setUint8(i, b);
      }
      const member = {
        type: MemberType.Int,
        bits: 65,
        bitOffset: 0,
        signed: true,
        align: 16,
      };
      const f = obtainDataViewGetter(member);     
      const res = f.call(dv, 0, true);
      expect(res).to.equal(-0xFFFFFFFFFFFFFFFFn);
    })
  })
  describe('obtainDataViewSetter', function() {
    it('should return functions for setting standard int types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      dv.setBigUint64(8, 0xFFFFFFFFFFFFFFFFn);
      for (const signed of [ false, true ]) {
        for (const bits of [ 8, 16, 32, 64 ]) {
          const { max } = getIntRange(bits, signed);
          const member = {
            type: MemberType.Int,
            bits,
            bitOffset: 64,
            signed,
            align: bits / 8
          }
          const f = obtainDataViewSetter(member);
          if (signed) {
            f.call(dv, 8, (bits == 64) ? -1n : -1, true);
          } else {
            f.call(dv, 8, max, true);
          }
          expect(dv.getBigUint64(8, true)).equal(0xFFFFFFFFFFFFFFFFn);
          expect(dv.getBigUint64(0, true)).equal(0n);
        }      
      }
    })
    it('should return functions for setting standard float types', function() {
      const dv = new DataView(new ArrayBuffer(16));
      for (const bits of [ 32, 64 ]) {
        const member = {
          type: MemberType.Float,
          bits,
          bitOffset: (bits === 32) ? 0 : 64,
          signed: true,
          align: bits / 8
        };
        const f = obtainDataViewSetter(member);    
        f.call(dv, (bits === 32) ? 0 : 8, 3.14, true);
      }      
      expect(dv.getFloat32(0, true).toFixed(2)).to.equal('3.14');
      expect(dv.getFloat64(8, true).toFixed(2)).to.equal('3.14');
    })
    it('should return functions for setting non-standard int types (aligned, < 64 bits)', function() {
      for (const signed of [ false, true ]) {
        const standard = [ 8, 16, 32, 64 ];
        for (let bits = 2; bits < 64; bits++) {
          const dv = new DataView(new ArrayBuffer(16));
          if (standard.includes(bits)) {
            continue;
          }
          const { min, max } = getIntRange(bits, signed);
          const member = {
            type: MemberType.Int,
            bits,
            bitOffset: 64,
            signed,
            align: [ 1, 2, 4, 8 ].find(b => b * 8 > bits),
          };
          const f = obtainDataViewSetter(member);
          f.call(dv, 0, min, true);
          f.call(dv, 8, max, true);
          // assuming that the getter works properly here
          const get = obtainDataViewGetter(member);
          expect(get.call(dv, 0, true)).to.equal(min);
          expect(get.call(dv, 8, true)).to.equal(max);
        }      
      }
    })
    it('should return functions for setting non-standard int types (128 bits)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt1
      const bytes = [ 255, 255, 255, 255, 255, 255, 255, 31, 0, 0, 0, 0, 0, 0, 0, 0, ];
      const member = {
        type: MemberType.Int,
        bits: 128,
        bitOffset: 0,
        signed: false,
        align: 16,
      };
      const f = obtainDataViewSetter(member);     
      f.call(dv, 0, 0x01FFFFFFFFFFFFFFFn, true);
      for (const [ i, b ] of bytes.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      // from struct-bytes: BigInt2
      const bytesBE = [ 0, 0, 0, 0, 0, 0, 0, 0, 31, 255, 255, 255, 255, 255, 255, 255, ];
      f.call(dv, 0, 0x01FFFFFFFFFFFFFFFn, false);
      for (const [ i, b ] of bytesBE.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    });
    it('should return functions for setting non-standard int types (72 bits)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt3
      const bytes = [ 255, 255, 255, 255, 255, 255, 255, 31, 0, 0, 0, 0, 0, 0, 0, 0, ];
      const member = {
        type: MemberType.Int,
        bits: 72,
        bitOffset: 0,
        signed: false,
        align: 16,
      };
      const f = obtainDataViewSetter(member);     
      f.call(dv, 0, 0x01FFFFFFFFFFFFFFFn, true);
      for (const [ i, b ] of bytes.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
      // from struct-bytes: BigInt4
      const bytesBE = [ 0, 31, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, ];
      f.call(dv, 0, 0x01FFFFFFFFFFFFFFFn, false);
      for (const [ i, b ] of bytesBE.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    });
    it('should return functions for getting non-standard int types (65-bit)', function() {
      const dv = new DataView(new ArrayBuffer(16));
      // from struct-bytes: BigInt5
      const bytes = [ 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, ];
      const member = {
        type: MemberType.Int,
        bits: 65,
        bitOffset: 0,
        signed: true,
        align: 16,
      };
      const f = obtainDataViewSetter(member);     
      f.call(dv, 0, -0xFFFFFFFFFFFFFFFFn, true);
      for (const [ i, b ] of bytes.entries()) {
        expect(dv.getUint8(i)).to.equal(b);
      }
    })
    it('should return functions for setting non-standard int types (> 64 bits)', function() {
      for (const signed of [ false, true ]) {
        for (let bits = 65; bits < 1024; bits += 33) {
          const dv = new DataView(new ArrayBuffer(256));
          const { min, max } = getIntRange(bits, signed);
          const member = {
            type: MemberType.Int,
            bits,
            bitOffset: 0,
            signed,
            align: Math.ceil(bits / 64) * 8,
          };
          const f = obtainDataViewSetter(member);
          f.call(dv, 0, min, true);
          f.call(dv, 128, max, true);
          // assuming that the getter works properly here
          const get = obtainDataViewGetter(member);
          expect(get.call(dv, 0, true)).to.equal(min);
          expect(get.call(dv, 128, true)).to.equal(max);
        }      
      }
    })
  })
})