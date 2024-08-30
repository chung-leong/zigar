import { expect } from 'chai';
import { defineClass } from '../../../src/environment/class.js';

import AccessorAll from '../../../src/environment/accessors/all.js';
import AccessorBool from '../../../src/environment/accessors/bool.js';
import All, {
  isNeededByMember,
  MemberType
} from '../../../src/environment/members/all.js';
import Bool from '../../../src/environment/members/bool.js';
import Primitive from '../../../src/environment/members/primitive.js';

const Env = defineClass('MemberTest', [ All, Bool, Primitive, AccessorAll, AccessorBool ]);

describe('Member: all', function() {
  describe('isNeededByMember', function() {
    it('should return true', function() {
      expect(isNeededByMember()).to.be.true;
    })
  })
  describe('getDescriptor', function() {
    it('should invoke the correct descriptor mixin', function() {
      const env = new Env();
      const member = {
        type: MemberType.Bool,
        byteSize: 1,
        bitSize: 1,
        bitOffset: 0,
        structure: {},
      };
      env.getDescriptor(member);
      expect(() => env.getDescriptor(member)).to.not.throw();
    })
  })
})

