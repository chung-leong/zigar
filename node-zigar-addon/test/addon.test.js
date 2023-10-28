import { expect } from 'chai';

import { MEMORY, SLOTS, ZIG } from '../../zigar-runtime/src/symbol.js';
import {
  invokeFactory,
} from '../src/addon.js';

describe('Addon functions', function() {
  describe('invokeFactory', function() {
    it('should run the given thunk function with the expected arguments and return a constructor', function() {
      process.env.ZIGAR_TARGET = 'NODE-CPP-EXT';
      let recv, slots, symbol1, symbol2, symbol3;
      const constructor = function() {};
      function thunk(...args) {
        recv = this;
        slots = args[0];
        symbol1 = args[1];
        symbol2 = args[2];
        symbol3 = args[3];
        recv[SLOTS][0] = { constructor };
      }
      const result = invokeFactory(thunk);
      expect(recv[SLOTS]).to.be.an('object');
      expect(slots).to.be.an('object');
      expect(symbol1).to.equal(SLOTS);
      expect(symbol2).to.equal(MEMORY);
      expect(symbol3).to.equal(ZIG);
      expect(result).to.equal(constructor);
      expect(result).to.have.property('__zigar');
    })
    it('should throw if the thunk function returns a string', function() {
      const constructor = function() {};
      function thunk(...args) {
        return 'TotalBrainFart';
      }
      expect(() => invokeFactory(thunk)).to.throw(Error)
        .with.property('message').that.equal('Total brain fart');
    })
  })
})
