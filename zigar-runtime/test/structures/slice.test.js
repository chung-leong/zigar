import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorBool from '../../src/accessors/bool.js';
import AccessorBool1Unaligned from '../../src/accessors/bool1-unaligned.js';
import AccessorFloat128 from '../../src/accessors/float128.js';
import AccessorIntUnaligned from '../../src/accessors/int-unaligned.js';
import AccessorJumboInt from '../../src/accessors/jumbo-int.js';
import AccessorJumbo from '../../src/accessors/jumbo.js';
import AccessorUintUnaligned from '../../src/accessors/uint-unaligned.js';
import AccessorUnaligned from '../../src/accessors/unaligned.js';
import { MemberType, StructureType } from '../../src/constants.js';
import DataCopying from '../../src/features/data-copying.js';
import RuntimeSafety from '../../src/features/runtime-safety.js';
import StructureAcquisition from '../../src/features/structure-acquisition.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll from '../../src/members/all.js';
import MemberBool from '../../src/members/bool.js';
import MemberInt from '../../src/members/int.js';
import MemberObject from '../../src/members/object.js';
import MemberPrimitive from '../../src/members/primitive.js';
import SpecialMethods from '../../src/members/special-methods.js';
import SpecialProps from '../../src/members/special-props.js';
import MemberTyp from '../../src/members/type.js';
import MemberUint from '../../src/members/uint.js';
import All from '../../src/structures/all.js';
import ArrayLike from '../../src/structures/array-like.js';
import Primitive from '../../src/structures/primitive.js';
import Slice, {
  isNeededByStructure,
} from '../../src/structures/slice.js';
import StructLike from '../../src/structures/struct-like.js';
import Struct from '../../src/structures/struct.js';
import { ENTRIES, FINALIZE, INITIALIZE, SLOTS } from '../../src/symbols.js';

const Env = defineClass('ArrayTest', [
  AccessorAll, MemberInt, MemberPrimitive, MemberAll, All, Primitive, DataCopying, SpecialMethods,
  SpecialProps, StructureAcquisition, ViewManagement, MemberTyp, AccessorJumbo, AccessorJumboInt,
  Struct, AccessorBool, AccessorFloat128, RuntimeSafety, MemberBool, AccessorBool1Unaligned,
  MemberUint, AccessorIntUnaligned, AccessorUintUnaligned, AccessorUnaligned, MemberObject,
  StructLike, Slice, ArrayLike,
]);

describe('Structure: slice', function() {
  describe('isNeededByStructure', function() {
    it('should return true when mixin is needed by a structure', function() {
      const structure = {
        type: StructureType.Slice
      };
      expect(isNeededByStructure(structure)).to.be.true;
    })
    it('should return false when mixin is needed by a structure', function() {
      const structure = {
        type: StructureType.Struct
      };
      expect(isNeededByStructure(structure)).to.be.false;
    })
  })
  describe('defineSlice', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Slice,
        name: '[_]i32',
        byteSize: 4,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 32,
          byteSize: 4,
          structure: {},
        },
      ];
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineSlice(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Slice,
        name: '[4]i32',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 32,
          byteSize: 4,
          structure: {},
        },
      ];
      const env = new Env();
      const descriptors = {};
      env.defineSlice(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors.entries?.value).to.be.a('function');
      expect(descriptors[Symbol.iterator]?.value).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
      expect(descriptors[FINALIZE]?.value).to.be.a('function');
      expect(descriptors[ENTRIES]?.get).to.be.a('function');
    })
  })
  describe('finalizeSlice', function() {
    it('should add static descriptors to the given object', function() {
      const structure = {
        type: StructureType.Slice,
        name: 'Slice',
        byteSize: 2,
        instance: {},
        static: {
          members: [],
          template: {
            [SLOTS]: {},
          }
        },
      };
      structure.instance.members = [
        {
          type: MemberType.Uint,
          bitSize: 16,
          byteSize: 2,
          structure,
        },
      ];
      const env = new Env();
      const descriptors = {};
      env.finalizeSlice(structure, descriptors);
      expect(descriptors.child?.value).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
  })
})