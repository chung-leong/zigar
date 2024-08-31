import { expect } from 'chai';
import { defineClass } from '../../../src/environment/class.js';

import AccessorAll from '../../../src/environment/accessors/all.js';
import MemberAll, { MemberType } from '../../../src/environment/members/all.js';
import MemberPrimitive from '../../../src/environment/members/primitive.js';
import Sentinel, {
  isNeededByStructure,
} from '../../../src/environment/members/sentinel.js';
import MemberUint from '../../../src/environment/members/uint.js';
import { StructureType } from '../../../src/environment/structures/all.js';
import { MEMORY } from '../../../src/symbol.js';

const Env = defineClass('MemberTest', [ AccessorAll, MemberUint, MemberPrimitive, MemberAll, Sentinel ]);

describe('Member: sentinel', function() {
  describe('isNeededByStructure', function() {
    it('should return true when mixin is needed by a member', function() {
      const structure = {
        type: StructureType.Slice,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 8,
            },
            {
              name: 'sentinel',
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 8,
              bitOffset: 0,
            }
          ],
          template: {
            [MEMORY]: new DataView(new ArrayBuffer(1)),
          },
        },
      };
      const env = new Env();
      expect(isNeededByStructure.call(env, structure)).to.be.true;
    })
    it('should return false when mixin is not needed by a member', function() {
      const structure = {
        type: StructureType.Slice,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 8,
            },
          ],
        },
      };
      const env = new Env();
      expect(isNeededByStructure.call(env, structure)).to.be.false;
    })
  })
  describe('getSentinel', function() {
    it('should return sentinel descriptor when there is one', function() {
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(1));
      dv.setUint8(0, 0xff);
      const structure = {
        type: StructureType.Slice,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 8,
            },
            {
              name: 'sentinel',
              type: MemberType.Uint,
              bitSize: 8,
              byteSize: 8,
              bitOffset: 0,
              isRequired: true,
            }
          ],
          template: {
            [MEMORY]: dv,
          },
        },
      };
      const sentinel = env.getSentinel(structure);
      expect(sentinel).to.be.an('object');
      expect(sentinel.validateValue).to.be.a('function');
      expect(sentinel.validateData).to.be.a('function');
      expect(sentinel.value).to.equal(0xff);
      expect(sentinel.bytes).to.equal(dv);
      expect(sentinel.isRequired).to.be.true;
    })
  })
})

