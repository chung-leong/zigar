import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { MEMORY, RESTORE } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Member: bool', function() {
  describe('defineMemberBool', function() {
    it('should return descriptor for bool', function() {
      const env = new Env();
      const member = {
        type: MemberType.Bool,
        byteSize: 1,
        bitSize: 1,
        bitOffset: 8,
        structure: {},
      };
      const { get, set } = env.defineMemberBool(member);
      const object = { 
        [MEMORY]: new DataView(new ArrayBuffer(2)),
        [RESTORE]() { return this[MEMORY] },
      };
      set.call(object, true);
      expect(get.call(object)).to.equal(true);
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Bool,
        byteSize: 1,
        bitSize: 1,
        bitOffset: 0,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

