import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import { MemberType } from '../../src/constants.js';
import All from '../../src/members/all.js';
import Void, {
  isNeededByMember,
} from '../../src/members/void.js';
import { MEMORY } from '../../src/symbols.js';

const Env = defineClass('MemberTest', [ All, Void ]);

describe('Member: void', function() {
  describe('isNeededByMember', function() {
    it('should return true when mixin is needed by a member', function() {
      const member = { type: MemberType.Void, bitSize: 0, byteSize: 0, bitOffset: 0 };
      expect(isNeededByMember(member)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const member = { type: MemberType.Object, slot: 1 };
      expect(isNeededByMember(member)).to.be.false;
    })
  })
  describe('defineMemberVoid', function() {
    it('should return descriptor for void', function() {
      const env = new Env();
      const member = {
        type: MemberType.Void,
        byteSize: 0,
        bitSize: 0,
        bitOffset: 0,
        structure: {},
      };
      const { get, set } = env.defineMemberVoid(member);
      const object = { [MEMORY]: new DataView(new ArrayBuffer(2)) };
      set.call(object, undefined);
      expect(() => set.call(object, 0)).to.throw(TypeError);
      expect(get.call(object)).to.be.undefined;
    })
    it('should return descriptor for void array', function() {
      const env = new Env();
      const member = {
        type: MemberType.Void,
        byteSize: 0,
        bitSize: 0,
        structure: {},
      };
      const { get, set } = env.defineMemberVoid(member);
      const object =
      {
        [MEMORY]: new DataView(new ArrayBuffer(2)),
        length: 4,
      };
      set.call(object, 1, undefined);
      set.call(object, 2, undefined);
      expect(() => set.call(object, 3, 0)).to.throw(TypeError);
      expect(() => set.call(object, 5, undefined)).to.throw(RangeError);
      expect(get.call(object, 1)).to.be.undefined;
      expect(get.call(object, 2)).to.be.undefined;
    })
    it('should be invokable through defineMember', function() {
      const env = new Env();
      const member = {
        type: MemberType.Void,
        byteSize: 0,
        bitSize: 0,
        bitOffset: 0,
        structure: {},
      };
      env.defineMember(member);
      expect(() => env.defineMember(member)).to.not.throw();
    })
  })
})

