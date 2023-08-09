import { expect } from 'chai';

import { MEMORY, SLOTS, ZIG } from '../../zigar-runtime/src/symbol.js';
import {
  invokeFactory,
  getArgumentBuffers,
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
  describe('getArgumentBuffers', function() {
    it('should recursively find all buffers in the argument struct', function() {
      const buffer1 = new ArrayBuffer(32);
      const buffer2 = new ArrayBuffer(32);
      const buffer3 = new ArrayBuffer(32);
      const buffer4 = new SharedArrayBuffer(32);
      const argStruct = {
        [MEMORY]: new DataView(buffer1),
        [SLOTS]: {
          0: {
            [MEMORY]: new DataView(buffer2),
            [SLOTS]: {
              0: {
                [MEMORY]: new DataView(buffer2, 0, 4),
              },
              1: {
                [MEMORY]: new DataView(buffer3),
              }
            }
          },
          1: {
            [MEMORY]: new DataView(buffer4),
          },
          2: null,
        }
      };
      argStruct[SLOTS][0][SLOTS][2] = argStruct;
      const result = getArgumentBuffers(argStruct);
      expect(result).to.be.an('array');
      expect(result).to.be.eql([ buffer1, buffer2, buffer3 ]);
    })
  })
})
