import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { MEMORY } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Member: float', function() {
  describe('defineMemberFloat', function() {
    it('should return descriptor for float', function() {
      const env = new Env();
      const member = {
        type: MemberType.Float,
        byteSize: 2,
        bitSize: 16,
        bitOffset: 8,
        structure: {},
      };
      const { get, set } = env.defineMemberFloat(member);
      const object = { [MEMORY]: new DataView(new ArrayBuffer(3)) };
      set.call(object, 3.25);
      expect(get.call(object)).to.equal(3.25);
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Float,
        byteSize: 2,
        bitSize: 16,
        bitOffset: 8,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

