import { expect } from 'chai';
import { MemberFlag, MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Feature: int-conversion', function() {
  describe('addIntConversion', function() {
    it('should put wrapper around setter', function() {
      const env = new Env();
      const list = [];
      const getAccessor = env.addIntConversion(function(access, member) {
        return function(offset, value) {
          list.push(value)
        };
      });
      const member1 = {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
        bitOffset: 1,
      };
      const set1 = getAccessor('set', member1);
      const member2 = {
        type: MemberType.Uint,
        bitSize: 64,
        byteSize: 8,
        bitOffset: 1,
      };
      const set2 = getAccessor('set', member2);
      set1.call(null, 1, 1234n);
      set1.call(null, 1, 1234);
      set2.call(null, 1, 1234n);
      set2.call(null, 1, 1234);
      expect(list).to.eql([ 1234, 1234, 1234n, 1234n ]);
    })
    it('should put wrapper around setter', function() {
      const env = new Env();
      const getAccessor = env.addIntConversion(function(access, member) {
        return () => 1234n;
      });
      const member = {
        type: MemberType.Uint,
        flags: MemberFlag.IsSize,
        bitSize: 64,
        byteSize: 8,
        bitOffset: 1,
      };
      const get = getAccessor('get', member);
      expect(get.call(null, 1, true)).to.equal(1234);
    })

  })
})

