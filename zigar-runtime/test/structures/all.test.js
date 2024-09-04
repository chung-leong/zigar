import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import { MemberType, StructureType } from '../../src/constants.js';
import DataCopying from '../../src/features/data-copying.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll from '../../src/members/all.js';
import MemberInt from '../../src/members/int.js';
import MemberPrimitive from '../../src/members/primitive.js';
import SpecialMethods from '../../src/members/special-methods.js';
import SpecialProps from '../../src/members/special-props.js';
import All, {
  isNeededByStructure,
} from '../../src/structures/all.js';
import Primitive from '../../src/structures/primitive.js';
import { ALIGN, MEMORY, SIZE, TYPED_ARRAY } from '../../src/symbols.js';
import { defineProperty } from '../../src/utils.js';

const Env = defineClass('StructureTest', [
  AccessorAll, MemberInt, MemberPrimitive, MemberAll, All, Primitive, DataCopying, SpecialMethods,
  SpecialProps, ViewManagement
]);

describe('Structure: all', function() {
  describe('isNeededByStructure', function() {
    it('should return true', function() {
      expect(isNeededByStructure()).to.be.true;
    })
  })
  describe('defineStructure', function() {
    it('should define a structure for holding an integer', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      const Hello = env.defineStructure(structure);
      expect(Hello).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigUint64(0, 0x7FFF_FFFF_FFFF_FFFFn, true);
      const object = Hello(dv);
      expect(object.$).to.equal(0x7FFF_FFFF_FFFF_FFFFn);
      expect(BigInt(object)).to.equal(0x7FFF_FFFF_FFFF_FFFFn);
      expect(String(object)).to.equal(`${0x7FFF_FFFF_FFFF_FFFFn}`);
    })
    it('should add special methods to structure', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      const Hello = env.defineStructure(structure);
      // the special methods relies on the property [TYPE] on the constructor, which is added by
      // finalizeStructure();
      env.finalizeStructure(structure);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setBigUint64(0, 12345n, true);
      const object = Hello(dv);
      expect(object.$).to.equal(12345n);
      expect(object.valueOf()).to.equal(12345n);
      expect(JSON.stringify(object)).to.equal(`${12345n}`);
    })
  })
  describe('createConstructor', function() {
    it('should create a constructor for the structure', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      const Hello = env.defineStructure(structure);
      const object = new Hello(77n);
      expect(object.$).to.equal(77n);
      object.$ = 1234n,
      expect(object.$).to.equal(1234n);
    })
  })
  describe('createApplier', function() {
    it('should create property applier for the structure', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      // the applier function depends on the prop [SETTERS] and [KEYS], which are set
      // by defineStructure()
      const Hello = env.defineStructure(structure);
      const object = new Hello(undefined);
      const f = env.createApplier(structure);
      expect(f).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(16), 8);
      dv.setBigInt64(0, 1234n, true);
      const count1 = f.call(object, { dataView: dv });
      expect(count1).to.equal(1);
      expect(object.$).to.equal(1234n);
      const count2 = f.call(object, {});
      expect(count2).to.equal(0);
    })
    it('should throw when an unrecognized prop is encountered', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure: {},
        }
      ];
      // the applier function depends on the prop [SETTERS] and [KEYS], which are set
      // by defineStructure()
      const Hello = env.defineStructure(structure);
      const object = new Hello(undefined);
      const f = env.createApplier(structure);
      expect(() => f.call(object, { cow: 1234 })).to.throw(TypeError)
        .with.property('message').that.contains('cow');
    })
  })
  describe('defineDestructor', function() {
    const env = new Env;
    it('should return descriptor for destructor', function() {
      const env = new Env;
      const descriptor = env.defineDestructor();
      expect(descriptor.value).to.be.a('function');
      const object = defineProperty({
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      }, 'delete', descriptor);
      let target;
      env.releaseFixedView = (dv) => {
        target = dv;
      };
      expect(() => object.delete()).to.not.throw();
      expect(target).to.be.a('DataView');
    })
  })
  describe('finalizeStructure', function() {
    it('should add special properties to constructor', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        align: 4,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure,
        }
      ];
      const Hello = env.defineStructure(structure);
      env.finalizeStructure(structure);
      expect(Hello.name).to.equal('Hello');
      expect(Hello[ALIGN]).to.equal(4);
      expect(Hello[SIZE]).to.equal(8);
    })
    it('should call type-specific finalization method', function() {
      const env = new Env;
      const structure = {
        type: StructureType.Primitive,
        name: 'Hello',
        byteSize: 8,
        align: 4,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 64,
          bitOffset: 0,
          byteSize: 8,
          structure,
        }
      ];
      const Hello = env.defineStructure(structure);
      env.finalizeStructure(structure);
      // finalizePrimitive() in mixin "structure/primitive" adds property [TYPE_ARRAY]
      expect(Hello[TYPED_ARRAY]).to.equal(BigInt64Array);
    })
  })
})

