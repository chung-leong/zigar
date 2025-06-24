import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

describe('Member: null', function() {
  describe('defineMemberNull', function() {
    it('should return descriptor for comptime', function() {
      const env = new Env();
      const member = {
        type: MemberType.Null,
        structure: {},
      };
      const { get } = env.defineMemberNull(member);
      const object = {};
      expect(get.call(object)).to.null;
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Null,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

