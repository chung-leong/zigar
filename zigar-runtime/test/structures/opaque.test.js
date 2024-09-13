import { expect } from 'chai';
import 'mocha-skip-if';
import { MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';
import { ENVIRONMENT, INITIALIZE } from '../../src/symbols.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorBool from '../../src/accessors/bool.js';
import Baseline from '../../src/features/baseline.js';
import DataCopying from '../../src/features/data-copying.js';
import IntConversion from '../../src/features/int-conversion.js';
import StructureAcquisition from '../../src/features/structure-acquisition.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll from '../../src/members/all.js';
import MemberBool from '../../src/members/bool.js';
import MemberInt from '../../src/members/int.js';
import MemberObject from '../../src/members/object.js';
import PointerInStruct from '../../src/members/pointer-in-struct.js';
import MemberPrimitive from '../../src/members/primitive.js';
import SpecialMethods from '../../src/members/special-methods.js';
import MemberUint from '../../src/members/uint.js';
import All from '../../src/structures/all.js';
import ArgStruct from '../../src/structures/arg-struct.js';
import Opaque, {
  isNeededByStructure,
} from '../../src/structures/opaque.js';
import Optional from '../../src/structures/optional.js';
import Pointer from '../../src/structures/pointer.js';
import StructLike from '../../src/structures/struct-like.js';

const Env = defineClass('StructureTest', [
  All, Opaque, DataCopying, StructureAcquisition, ViewManagement, SpecialMethods, Pointer,
  MemberAll, MemberPrimitive, MemberUint, IntConversion, AccessorAll, Optional, MemberInt,
  MemberBool, AccessorBool, ArgStruct, MemberObject, StructLike, PointerInStruct, Baseline,
]);

describe('Structure: opaque', function() {
  describe('isNeededByStructure', function() {
    it('should return true when mixin is needed by a structure', function() {
      const structure = {
        type: StructureType.Opaque
      };
      expect(isNeededByStructure(structure)).to.be.true;
    })
    it('should return false when mixin is needed by a structure', function() {
      const structure = {
        type: StructureType.Optional
      };
      expect(isNeededByStructure(structure)).to.be.false;
    })
  })
  describe('defineOpaque', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Opaque,
        name: 'Hello',
        instance: { members: [] },
        static: { members: [] },
      };
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineOpaque(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Opaque,
        name: 'Hello',
        instance: { members: [] },
        static: { members: [] },
      };
      const env = new Env();
      const descriptors = {};
      env.defineOpaque(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define an opaque structure', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        byteSize: 0,
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(Hello).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(0));
      const object = Hello.call(ENVIRONMENT, dv);
      expect(String(object)).to.equal('[opaque Hello]');
      expect(Number(object)).to.be.NaN;
      expect(object.valueOf()).to.eql({});
      expect(JSON.stringify(object)).to.equal('{}');
      expect(() => object.$).to.throw(TypeError);
      expect(() => new Hello(undefined)).to.throw(TypeError);
    })
    it('should not allow the creation of opaque instances', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Hello()).to.throw(TypeError);
    })
    skip.
    it('should define an iterator opaque', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        flags: StructureFlag.IsIterator,
        name: 'Hello',
        byteSize: 4,
        isIterator: true,
      });
      const Hello = env.defineStructure(structure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
        name: '*Hello',
        byteSize: 8,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure,
        slot: 0,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const optStructure = env.beginStructure({
        type: StructureType.Optional,
        flags: StructureFlag.HasValue | StructureFlag.HasSelector,
        name: '?i32',
        byteSize: 5,
      });
      env.attachMember(optStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(optStructure, {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 32,
        byteSize: 1,
        structure: {},
      });
      env.defineStructure(optStructure);
      env.endStructure(optStructure);
      const argStruct = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Argument',
        byteSize: 13,
      });
      env.attachMember(argStruct, {
        name: 'retval',
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 5,
        structure: optStructure,
      });
      env.attachMember(argStruct, {
        name: '0',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: optStructure.byteSize * 8,
        byteSize: 8,
        structure: ptrStructure,
        slot: 0,
      });
      env.defineStructure(argStruct);
      env.endStructure(argStruct);
      throw new Error('FIXME')
      env.attachMethod(structure, {
        name: 'next',
        argStruct,
        isStaticOnly: false,
        thunkId: 1234,
      });
      env.endStructure(structure);
      let i = 0;
      env.runThunk = function(thunkId, argDV) {
        if (i++ < 5) {
          argDV.setInt32(0, i, true);
          argDV.setInt8(4, 1);
        } else {
          argDV.setInt32(0, 0, true);
          argDV.setInt8(4, 0);
        }
      };
      env.getBufferAddress = function(buffer) {
        return 0x1000n;
      }
      const dv = new DataView(new ArrayBuffer(4));
      const object = Hello(dv);
      const results = [];
      for (const value of object) {
        results.push(value);
      }
      expect(results).to.eql([ 1, 2, 3, 4, 5 ]);
    })
  })
})