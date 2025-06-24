import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { SLOTS } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Member: literal', function() {
  describe('defineMemberLiteral', function() {
    it('should return descriptor for literal', function() {
      const env = new Env();
      const member = {
        type: MemberType.Literal,
        slot: 1,
        structure: {},
      };
      const { get } = env.defineMemberLiteral(member);
      const object = {
        [SLOTS]: {
          1: { string: 'hello' }
        }
      };
      expect(get.call(object)).to.equal('hello');
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Literal,
        slot: 1,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

