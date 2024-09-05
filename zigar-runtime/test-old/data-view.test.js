import { expect } from 'chai';

import {
  checkDataView,
  isTypedArray,
  useAllExtendedTypes
} from '../src/data-view.js';
import { Environment } from '../src/environment.js';

describe('Data view functions', function() {
  beforeEach(function() {
    useAllExtendedTypes();
  })
  const env = new Environment();
  describe('isTypedArray', function() {
    it('should return true when given the correct TypedArray', function() {
      const ta = new Int32Array(4);
      expect(isTypedArray(ta, Int32Array)).to.be.true;
    })
    it('should return false when the array type is different', function() {
      const ta = new Int32Array(4);
      expect(isTypedArray(ta, Uint32Array)).to.be.false;
    })
    it('should return false when given no array type', function() {
      const ta = new Int32Array(4);
      expect(isTypedArray(ta)).to.be.false;
    })
  })
  describe('checkDataView', function() {
    it('should not throw when a DataView is given', function() {
      const arg = new DataView(new ArrayBuffer(4));
      expect(() => checkDataView(arg)).to.not.throw();
    })
    it('should throw when the given object is not a DataView', function() {
      const arg = new ArrayBuffer(4);
      expect(() => checkDataView(arg)).to.throw(TypeError);
      expect(() => checkDataView(1)).to.throw(TypeError);
      expect(() => checkDataView(null)).to.throw(TypeError);
      expect(() => checkDataView(undefined)).to.throw(TypeError);
    })
  })
})
