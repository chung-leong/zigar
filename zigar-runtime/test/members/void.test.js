import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import All, { MemberType } from '../../src/members/all.js';
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
  describe('getDescriptorVoid', function() {
    it('should return descriptor for void', function() {
      const env = new Env();
      const member = {
        type: MemberType.Void,
        byteSize: 0,
        bitSize: 0,
        bitOffset: 0,
        structure: {},
      };
      const { get, set } = env.getDescriptorVoid(member);
      const object = { [MEMORY]: new DataView(new ArrayBuffer(2)) };
      set.call(object, undefined);
      expect(get.call(object)).to.be.undefined;
    })
    it('should be invokable through getDescriptor', function() {
      const env = new Env();
      const member = {
        type: MemberType.Void,
        byteSize: 0,
        bitSize: 0,
        bitOffset: 0,
        structure: {},
      };
      env.getDescriptor(member);
      expect(() => env.getDescriptor(member)).to.not.throw();
    })
  })
})
