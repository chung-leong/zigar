import { expect } from 'chai';

import { WebAssemblyEnvironment } from '../src/environment-wasm.js';
import { Environment } from '../src/environment.js';
import {
  ObjectCache,
  defineProperties,
  getMemoryRestorer,
  getSelf,
  needSlots,
} from '../src/object.js';
import { FIXED, MEMORY, MEMORY_RESTORER } from '../src/symbol.js';
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
  describe('getMemoryRestorer', function() {
    it('should restore WASM memory buffer that has become detached', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const cache = new ObjectCache();
      const dv = new DataView(memory.buffer, 1000, 8);
      dv[FIXED] = { address: 1000, len: 8 };
      const object = {
        [MEMORY]: dv,
        [MEMORY_RESTORER]: getMemoryRestorer(cache, env),
      };
      memory.grow(1);
      expect(() => dv.getInt8(0)).to.throw(TypeError);
      object[MEMORY_RESTORER]();
      expect(object[MEMORY]).to.not.equal(dv);
      expect(() => object[MEMORY].getInt8(0)).to.not.throw();
      expect(cache.find(object[MEMORY])).to.equal(object);
    })
    it('should add align to new buffer when previous buffer has one attached', function() {
      const env = new WebAssemblyEnvironment();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const cache = new ObjectCache();
      const dv = new DataView(memory.buffer, 1000, 8);
      dv[FIXED] = { address: 1000, len: 8, align: 4 };
      const object = {
        [MEMORY]: dv,
        [MEMORY_RESTORER]: getMemoryRestorer(cache, env),
      };
      memory.grow(1);
      expect(() => dv.getInt8(0)).to.throw(TypeError);
      object[MEMORY_RESTORER]();
      expect(object[MEMORY]).to.not.equal(dv);
      expect(() => object[MEMORY].getInt8(0)).to.not.throw();
      expect(object[MEMORY][FIXED].align).to.equal(4);
    })
  })
})
