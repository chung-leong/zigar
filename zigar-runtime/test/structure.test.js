import { expect } from 'chai';

import { MemberType } from '../src/member.js';
import {
  StructureType,
  useOpaque,
  getStructureFeature,
  getStructureName,
  getStructureFactory,
  defineProperties,
  removeSetters,
  needSlots,
  getSelf,
  findAllObjects,
  ObjectCache,
} from '../src/structure.js';
import { Environment } from '../src/environment.js'
import { MEMORY, SLOTS } from '../src/symbol.js';

describe('Structure functions', function() {
  const env = new Environment();
  describe('useOpaque', function() {
    it(`should enable the creation of opaque structure`, function() {
      useOpaque();
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        byteSize: 0
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(Hello).to.be.an('function');
    })
  })
  describe('getStructureFeature', function() {
    it(`should return the name of the function needed by structure`, function() {
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        byteSize: 0
      });
      const name = getStructureFeature(structure);
      expect(name).to.equal('useOpaque');
    })
  })
  describe('getStructureName', function() {
    it('should shorten names by removing namespace qualifiers', function() {
      expect(getStructureName({ name: 'u8' })).to.equal('u8');
      expect(getStructureName({ name: 'zig.Hello' })).to.equal('Hello');
      expect(getStructureName({ name: '[]const zig.Hello' })).to.equal('[]const Hello');
      expect(getStructureName({ name: '[]const zig.world.joga.Hello' })).to.equal('[]const Hello');
      expect(getStructureName({ name: '?@TypeOf(.enum_literal)' })).to.equal('?@TypeOf(.enum_literal)');
    })
  })
  describe('getStructureFactory', function() {
    it('should return function for defining shape of structure', function() {
      useOpaque();
      const f = getStructureFactory(StructureType.Opaque);
      expect(f).to.be.a('function');
    })
  })
  describe('defineProperties', function() {
    it('should define properties on an object', function() {
      const object = {};
      defineProperties(object, {
        hello: { value: 5 },
        world: { get: () => 6 },
        universe: false,
      });
      expect(object.hello).to.equal(5);
      expect(object.world).to.equal(6);
      expect(object).to.not.have.property('universe');
    })
  })
  describe('removeSetters', function() {
    it('should remove setters from an object', function() {
      const object = {};
      Object.defineProperties(object, {
        hello: { get: () => 5, configurable: true },
        world: { get: () => 6, set: () => {}, configurable: true },
      });
      expect(() => object.world = 6).to.not.throw();
      const descriptors = Object.getOwnPropertyDescriptors(object);
      const newDescriptors = removeSetters(descriptors);
      Object.defineProperties(object, newDescriptors);
      expect(() => object.world = 6).to.throw();
    })
  })
  describe('needSlots', function() {
    it('should return true when a structure has object members', function() {
      const structure = {
        type: StructureType.Struct,
        instance: {
          members: [
            {
              type: MemberType.Object,
            }
          ]
        }
      };
      expect(needSlots(structure)).to.be.true;
    });
    it('should return true when a structure has comptime fields', function() {
      const structure = {
        type: StructureType.Struct,
        instance: {
          members: [
            {
              type: MemberType.Comptime,
            }
          ]
        }
      };
      expect(needSlots(structure)).to.be.true;
    });
  })
  describe('getSelf', function() {
    it('should return this', function() {
      const object = {};
      const result = getSelf.call(object);
      expect(result).to.equal(object);
    })
  })
  describe('findAllObjects', function() {
    it('should return a list of objects used by the given list of structures', function() {
      const object1 = {};
      const object2 = {};
      const object3 = {
        [SLOTS]: { 4: object1, 5: object2 },
      };
      const object4 = {};
      const object5 = {
        [SLOTS]: { 4: object1, 5: object4 },
      };
      const structures = [
        {
          instance: { template: object3 },
          static: {},
        },
        {
          instance: {},
          static: { template: object5 },
        }
      ];
      const list = findAllObjects(structures, SLOTS);
      expect(list).to.have.lengthOf(5);
      expect(list).to.contain(object1);
      expect(list).to.contain(object2);
      expect(list).to.contain(object3);
      expect(list).to.contain(object4);
      expect(list).to.contain(object5);
    })
  })
  describe('ObjectCache', function() {
    describe('save/find', function() {
      it('should save object to cache', function() {
        const cache = new ObjectCache();
        const dv = new DataView(new ArrayBuffer(4));
        expect(cache.find(dv, false)).to.be.undefined;
        const object = { [MEMORY]: dv };
        cache.save(dv, false, object);
        expect(cache.find(dv, false)).to.equal(object);
        expect(cache.find(dv, true)).to.be.undefined;
      })
      it('should save writabl object separately', function() {
        const cache = new ObjectCache();
        const dv = new DataView(new ArrayBuffer(4));
        expect(cache.find(dv, true)).to.be.undefined;
        const object = { [MEMORY]: dv };
        cache.save(dv, true, object);
        expect(cache.find(dv, true)).to.equal(object);
        expect(cache.find(dv, false)).to.be.undefined;
      })
    })
  })
})
