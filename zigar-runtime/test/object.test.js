import { expect } from 'chai';

import { Environment } from '../src/environment.js';
import {
  ObjectCache,
  defineProperties,
  getSelf,
  needSlots,
} from '../src/object.js';
import { MEMORY } from '../src/symbol.js';
import { MemberType, StructureType } from '../src/types.js';

describe('Object functions', function() {
  const env = new Environment();
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
  describe('attachDescriptors', function() {
    it('should attach descriptors to a constructor', function() {
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
      expect(needSlots(structure.instance.members)).to.be.true;
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
      expect(needSlots(structure.instance.members)).to.be.true;
    });
  })
  describe('getSelf', function() {
    it('should return this', function() {
      const object = {};
      const result = getSelf.call(object);
      expect(result).to.equal(object);
    })
  })
  describe('ObjectCache', function() {
    describe('save/find', function() {
      it('should save object to cache', function() {
        const cache = new ObjectCache();
        const dv = new DataView(new ArrayBuffer(4));
        expect(cache.find(dv)).to.be.undefined;
        const object = { [MEMORY]: dv };
        cache.save(dv, object);
        expect(cache.find(dv)).to.equal(object);
        const dv2 = new DataView(new ArrayBuffer(8));
        expect(cache.find(dv2)).to.be.undefined;
      })
    })
  })
})
