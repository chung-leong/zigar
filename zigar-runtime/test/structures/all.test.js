import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import DataCopying from '../../src/features/data-copying.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll, { MemberType } from '../../src/members/all.js';
import MemberInt from '../../src/members/int.js';
import MemberPrimitive from '../../src/members/primitive.js';
import All, {
  isNeededByStructure,
  StructureType,
} from '../../src/structures/all.js';
import Primitive from '../../src/structures/primitive.js';

const Env = defineClass('StructureTest', [
  AccessorAll, MemberInt, MemberPrimitive, MemberAll, All, Primitive, DataCopying, ViewManagement,
]);

describe('Structure: all', function() {
  describe('isNeededByStructure', function() {
    it('should return true', function() {
      expect(isNeededByStructure()).to.be.true;
    })
  })
  describe('defineStructure', function() {
    it('should define a structure for holding a integer', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
            }
          ],
        },
      };
      const Hello = env.defineStructure(structure);
      expect(Hello).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigUint64(0, 0x7FFFFFFFFFFFFFFFn, true);
      const object = Hello(dv);
      expect(object.$).to.equal(0x7FFFFFFFFFFFFFFFn);
      expect(object.valueOf()).to.equal(0x7FFFFFFFFFFFFFFFn);
      expect(BigInt(object)).to.equal(0x7FFFFFFFFFFFFFFFn);
      object.$ = BigInt(Number.MAX_SAFE_INTEGER);
      expect(JSON.stringify(object)).to.equal(`${Number.MAX_SAFE_INTEGER}`);
      object.$ = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
      expect(() => JSON.stringify(object)).to.throw(TypeError);
      object.$ = BigInt(Number.MIN_SAFE_INTEGER);
      expect(JSON.stringify(object)).to.equal(`${Number.MIN_SAFE_INTEGER}`);
      object.$ = BigInt(Number.MIN_SAFE_INTEGER) - 1n;
      expect(() => JSON.stringify(object)).to.throw(TypeError);
    })
  })
  describe('attachDescriptors', function() {
    it('should attach descriptors to a constructor', function() {
    })
  })
  describe('createConstructor', function() {
    it('should return define a primitive', function() {
    })
  })
  describe('createDestructor', function() {
    it('should return define a primitive', function() {
    })
  })
  describe('createApplier', function() {
    it('should return define a primitive', function() {
    })
  })
  describe('createDestructor', function() {
    it('should return define a primitive', function() {
    })
  })
})

