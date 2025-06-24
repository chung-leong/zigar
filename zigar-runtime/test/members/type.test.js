import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { SLOTS } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Member: type', function() {
  describe('defineMemberType', function() {
    it('should return descriptor for type', function() {
      const env = new Env();
      const member = {
        type: MemberType.Type,
        slot: 1,
        structure: {},
      };
      const { get } = env.defineMemberType(member);
      const constructor = function() {};
      const object = {
        [SLOTS]: {
          1: { constructor },
        }
      };
      expect(get.call(object)).to.equal(constructor);
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Type,
        slot: 1,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

