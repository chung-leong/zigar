import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';

const Env = defineEnvironment();

describe('Member: unsupported', function() {
  describe('defineMemberUndefined', function() {
    it('should return descriptor for unsupported', function() {
      const env = new Env();
      const member = {
        type: MemberType.Unsupported,
        structure: {},
      };
      const { get } = env.defineMemberUnsupported(member);
      const object = {};
      expect(() => get.call(object)).to.throw(TypeError)
        .with.property('message').that.contains('Unsupported');
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Unsupported,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

