import { expect } from 'chai';

import {
  throwOverflow,
  throwSizeMismatch,
  throwOutOfBound,
  rethrowRangeError,
} from '../src/errors.js';

describe('Error functions', function() {
  describe('#throwOverflow', function() {
    it('should throw a type error', function() {
      expect(() => throwOverflow(8, true, 1024)).to.throw(TypeError);
    })
  })
  describe('#throwSizeMismatch', function() {
    it('should throw a type error', function() {
      expect(() => throwSizeMismatch(8, 16)).to.throw(TypeError);
    })
  })
  describe('#throwOutOfBound', function() {
    it('should throw a range error', function() {
      expect(() => throwOutOfBound(8, 4, 16)).to.throw(RangeError);
    })
  })
  describe('#rethrowRangeError', function() {
    it('should throw range error when given a range error', function() {
      expect(() => rethrowRangeError(new RangeError, 8, 4, 16)).to.throw(RangeError);
      expect(() => rethrowRangeError(new TypeError, 8, 4, 16)).to.throw(TypeError);
    })
  })
})