import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { INITIALIZE } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Member: string', function() {
  describe('defineStringArray', function() {
    it('should return descriptor for string array', function() {
      const env = new Env();
      // structure doesn't actually affect the descriptor
      const { get, set } = env.defineStringArray({});
      const list = get.call([
        { string: 'hello' },
        { string: 'world' },
      ]);
      expect(list).to.eql([ 'hello', 'world' ]);
      let received;
      const target = {
        [INITIALIZE](arg, allocator) {
          received = arg;
        }
      };
      set.call(target, list);
      expect(received).to.eql([ 'hello', 'world' ]);
    })
  })
})
