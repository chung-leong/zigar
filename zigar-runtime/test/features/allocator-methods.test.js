import { expect } from 'chai';
import 'mocha-skip-if';
import { MemberType, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { MEMORY, TYPE, ZIG } from '../../src/symbols.js';
import { defineProperties, usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Feature: allocator-methods', function() {
  describe('defineAlloc', function() {
    it('should return descriptor for the alloc method', function() {
      const env = new Env();
      const struct = {
        ptr: {},
        vtable: {
          alloc(ptr, len, ptrAlign) {
            const dv = new DataView(new ArrayBuffer(len));
            dv[ZIG] = { address: 0x1000, len };
            return {
              ['*']: {
                [MEMORY]: dv,
              }
            };
          },
          free() {},
        }
      };
      defineProperties(struct, {
        alloc: env.defineAlloc(),
      });
      const dv = struct.alloc(16, 4);
      expect(dv.byteLength).to.equal(16);
      expect(dv[ZIG].align).to.equal(4);
    })
    it('should throw an error when function in vtable returns null', function() {
      const env = new Env();
      const struct = {
        ptr: {},
        vtable: {
          alloc(ptr, len, ptrAlign) {
            return null;
          },
          free() {},
        }
      };
      defineProperties(struct, {
        alloc: env.defineAlloc(),
      });
      expect(() => struct.alloc(16, 4)).to.throw(Error);
    })
    it('should throw an error when alignment is impossible', function() {
      const env = new Env();
      const struct = {
        ptr: {},
        vtable: {
          alloc(ptr, len, ptrAlign) {
            return null;
          },
          free() {},
        }
      };
      defineProperties(struct, {
        alloc: env.defineAlloc(),
      });
      expect(() => struct.alloc(16, 5)).to.throw(Error).with.property('message').to.contain('5');
    })

  })
  describe('defineFree', function() {
    it('should return descriptor for the free method', function() {
      const env = new Env();
      let freeArgs = null;
      const struct = {
        ptr: {},
        vtable: {
          alloc(ptr, len, ptrAlign) {
            const dv = new DataView(new ArrayBuffer(len));
            dv[ZIG] = { address: usize(0x1000), len, align: 1 << ptrAlign };
            return {
              ['*']: {
                [MEMORY]: dv,
              }
            };
          },
          free(ptr, slicePtr, ptrAlign) {
            freeArgs = { ptr, slicePtr, ptrAlign };
          },
        }
      };
      defineProperties(struct, {
        alloc: env.defineAlloc(),
        free: env.defineFree(),
      });
      const dv = struct.alloc(16, 4);
      expect(() => struct.free(dv)).to.not.throw();
      expect(() => struct.free(dv)).to.throw(TypeError);
      expect(() => struct.free('asd')).to.throw(TypeError);
      expect(() => struct.free({})).to.throw(TypeError);
      expect(() => struct.free(new DataView)).to.throw(TypeError);
    })
  })
  describe('defineDupe', function() {
    it('should return descriptor for the dupe method', function() {
      const env = new Env();
      const struct = {
        ptr: {},
        vtable: {
          alloc(ptr, len, ptrAlign) {
            const dv = new DataView(new ArrayBuffer(len));
            dv[ZIG] = { address: usize(0x1000), len, align: 1 << ptrAlign };
            return {
              ['*']: {
                [MEMORY]: dv,
              }
            };
          },
          free() {},
        }
      };
      defineProperties(struct, {
        alloc: env.defineAlloc(),
        free: env.defineFree(),
        dupe: env.defineDupe(),
      });
      const dv1 = struct.dupe('Hello world!');
      expect(dv1.byteLength).to.equal(12);
      const dv2 = struct.dupe(new DataView(new ArrayBuffer(4)));
      expect(dv2.byteLength).to.equal(4);
      const dv3 = struct.dupe(new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]));
      expect(dv3.byteLength).to.equal(8 * 8);
      expect(dv3.getFloat64(0, true)).to.equal(1);
      expect(dv3.getFloat64(8 * 7, true)).to.equal(8);
      const dv4 = struct.dupe(new ArrayBuffer(17));
      expect(dv4.byteLength).to.equal(17);
      const Pointer = function() {
        this['*'] = {
          [MEMORY]: new DataView(new ArrayBuffer(20), 2),
        };
        this[MEMORY] = new DataView(new ArrayBuffer(8));
      };
      Pointer[TYPE] = StructureType.Pointer;
      const ptr = new Pointer();
      const dv5 = struct.dupe(ptr);
      expect(dv5.byteLength).to.equal(18);
      expect(() => struct.dupe(1)).to.throw(TypeError);
      expect(() => struct.dupe({})).to.throw(TypeError);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        byteSize: 4 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: {},
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Hello({ dog: 123, cat: 456 });
      const copy = struct.dupe(object);
      expect(copy.valueOf()).to.eql({ dog: 123, cat: 456 });
      struct.free(copy);
    })
  })
})
