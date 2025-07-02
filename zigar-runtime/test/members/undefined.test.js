import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';

const Env = defineEnvironment();

describe('Member: undefined', function() {
  describe('defineMemberUndefined', function() {
    it('should return descriptor for undefined', function() {
      const env = new Env();
      const member = {
        type: MemberType.Undefined,
        structure: {},
      };
      const { get } = env.defineMemberUndefined(member);
      const object = {};
      expect(get.call(object)).to.be.undefined;
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Undefined,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

