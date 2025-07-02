import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { defineProperties } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Iterator: for-zig', function() {
  describe('defineZigIterator', function() {
    it('should return an iterator for a Zig iterator', function() {
      const env = new Env();
      const object = defineProperties({ index: 0 }, {
        next: {
          value() {
            if (this.index < 4) {
              return this.index++;
            } else {
              return null;
            }
          },
        },
        [Symbol.iterator]: env.defineZigIterator(),
      });
      expect([ ...object ]).to.eql([ 0, 1, 2, 3 ]);
    })
    it('should pass empty object as argument when one is expected', function() {
      const env = new Env();
      let options;
      const object = defineProperties({ index: 0 }, {
        next: {
          value(arg) {
            options = arg;
            if (this.index < 4) {
              return this.index++;
            } else {
              return null;
            }
          },
        },
        [Symbol.iterator]: env.defineZigIterator(),
      });
      expect([ ...object ]).to.eql([ 0, 1, 2, 3 ]);
      expect(options).to.eql({});
    })
  })
})