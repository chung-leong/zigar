import { expect } from 'chai';

import {
  throwOverflow,
  throwSizeMismatch,
  throwNoNewEnum,
  throwOutOfBound,
  rethrowRangeError,
  decamelizeErrorName,
} from '../src/error.js';

describe('Error functions', function() {
  describe('throwOverflow', function() {
    it('should throw a type error', function() {
      expect(() => throwOverflow(8, true, 1024)).to.throw(TypeError);
    })
  })
  describe('throwSizeMismatch', function() {
    it('should throw a type error', function() {
      expect(() => throwSizeMismatch(8, 16)).to.throw(TypeError);
    })
  })
  describe('throwNoNewEnum', function() {
    it('should throw a type error', function() {
      expect(() => throwNoNewEnum(8, 16)).to.throw(TypeError);
    })
  })
  describe('throwInvalidEnum', function() {
    it('should throw a type error', function() {
      expect(() => throwNoNewEnum(18)).to.throw(TypeError);
    })
  })
  describe('throwOutOfBound', function() {
    it('should throw a range error', function() {
      expect(() => throwOutOfBound(8, 4, 16)).to.throw(RangeError);
    })
  })
  describe('rethrowRangeError', function() {
    it('should throw range error when given a range error', function() {
      expect(() => rethrowRangeError(new RangeError, 8, 4, 16)).to.throw(RangeError);
      expect(() => rethrowRangeError(new TypeError, 8, 4, 16)).to.throw(TypeError);
    })
  })
  describe('decamelizeErrorName', function() {
    it('should turn error name into readable sentence', function() {
      const name = 'UnableToRetrieveMemoryLocation';
      const result = decamelizeErrorName(name);
      expect(result).to.equal('Unable to retrieve memory location');
    })
    it('should keep acronyms in uppercase', function() {
      const name1 = 'InvalidHTMLEncountered';
      const result1 = decamelizeErrorName(name1);
      expect(result1).to.equal('Invalid HTML encountered');
      const name2 = 'InvalidHTML';
      const result2 = decamelizeErrorName(name2);
      expect(result2).to.equal('Invalid HTML');
      const name3 = 'HTMLIsInvalid';
      const result3 = decamelizeErrorName(name3);
      expect(result3).to.equal('HTML is invalid');
    })
  })
})