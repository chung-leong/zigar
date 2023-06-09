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
    it('should return functions for getting non-standard int types (aligned, < 64 bits)', function() {
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
    it('should return functions for getting standard float types', function() {
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
      for (const signed of [ true ]) {
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
  })
})