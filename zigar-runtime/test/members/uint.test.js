import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { MEMORY } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Member: uint', function() {
  describe('defineMemberUint', function() {
    it('should return descriptor for uint', function() {
      const env = new Env();
      const member = {
        type: MemberType.Uint,
        byteSize: 4,
        bitSize: 24,
        bitOffset: 8,
        structure: {},
      };
      const { get, set } = env.defineMemberUint(member);
      const object = { [MEMORY]: new DataView(new ArrayBuffer(5)) };
      set.call(object, 1234);
      expect(get.call(object)).to.equal(1234);
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Uint,
        byteSize: 1,
        bitSize: 2,
        bitOffset: 0,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

