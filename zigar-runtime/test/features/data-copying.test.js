import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import DataCopying, {
  getCopyFunction,
  getResetFunction,
  isNeededByStructure,
} from '../../src/features/data-copying.js';

const Env = defineClass('FeatureTest', [ DataCopying ]);

describe('Feature: data-copying', function() {
  describe('isNeededByStructure', function() {
    it('should return true', function() {
      expect(isNeededByStructure()).to.be.true;
    })
  })
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
    it('should return function for copying buffers of unknown size', function() {
      const src = new DataView(new ArrayBuffer(23));
      for (let i = 0; i < 23; i++) {
        src.setInt8(i, i);
      }
      const dest = new DataView(new ArrayBuffer(23));
      const f = getCopyFunction(undefined);
      f(dest, src);
      for (let i = 0; i < 23; i++) {
        expect(dest.getInt8(i)).to.equal(i);
      }
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
        f(dest, 0, size);
        for (let i = 0; i < size; i++) {
          expect(dest.getInt8(i)).to.equal(0);
        }
      }
      expect(functions).to.have.lengthOf(10);
    })
  })
})

