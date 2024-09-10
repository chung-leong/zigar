import { expect } from 'chai';
import { MemberType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorBool from '../../src/accessors/bool.js';
import Baseline from '../../src/features/baseline.js';
import All, {
  isNeededByMember,
} from '../../src/members/all.js';
import Bool from '../../src/members/bool.js';
import Primitive from '../../src/members/primitive.js';

const Env = defineClass('MemberTest', [
  Baseline, All, Bool, Primitive, AccessorAll, AccessorBool
]);

describe('Member: all', function() {
  describe('isNeededByMember', function() {
    it('should return true', function() {
      expect(isNeededByMember()).to.be.true;
    })
  })
  describe('defineMember', function() {
    it('should invoke the correct descriptor mixin', function() {
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

