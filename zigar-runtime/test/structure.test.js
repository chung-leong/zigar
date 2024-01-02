import { expect } from 'chai';

import { MemberType } from '../src/member.js';
import {
  StructureType,
  useOpaque,
  getStructureName,
  getStructureFactory,
  getFeaturesUsed,
  defineProperties,
  attachDescriptors,
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
  describe('getFeaturesUsed', function() {
    it('should report the need for standard int support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Int,
                bitSize: 32,
                byteSize: 4,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useInt');
    })
    it('should report the need for extended int support when unaligned int is used', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Int,
                bitOffset: 2,
                bitSize: 32,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useIntEx');
    })
    it('should report the need for extended int support when non-standard int is used', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Int,
                bitSize: 35,
                byteSize: 8,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useIntEx');
    })
    it('should omit useInt when useIntEx is present', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Int,
                bitSize: 35,
                byteSize: 8,
              },
              {
                type: MemberType.Int,
                bitSize: 32,
                byteSize: 4,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useIntEx');
      expect(features).to.not.contain('useInt');
    })
    it('should report the need for standard uint support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Uint,
                bitSize: 32,
                byteSize: 4,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useUint');
    })
    it('should report the need for extended int support when unaligned uint is used', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Uint,
                bitOffset: 2,
                bitSize: 32,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useUintEx');
    })
    it('should report the need for extended int support when non-standard uint is used', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Uint,
                bitSize: 35,
                byteSize: 8,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useUintEx');
    })
    it('should omit useUint when useUintEx is present', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Uint,
                bitSize: 35,
                byteSize: 8,
              },
              {
                type: MemberType.Uint,
                bitSize: 32,
                byteSize: 4,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useUintEx');
      expect(features).to.not.contain('useUint');
    })
    it('should report the need for standard float support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Float,
                bitSize: 32,
                byteSize: 4,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useFloat');
    })
    it('should report the need for extended float support when unaligned float is used', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Float,
                bitOffset: 2,
                bitSize: 32,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useFloatEx');
    })
    it('should report the need for extended float support when non-standard float is used', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Float,
                bitSize: 80,
                byteSize: 128,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useFloatEx');
    })
    it('should omit useFloat when useFloatEx is present', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Float,
                bitSize: 80,
                byteSize: 8,
              },
              {
                type: MemberType.Float,
                bitSize: 32,
                byteSize: 4,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useFloatEx');
      expect(features).to.not.contain('useFloat');
    })
    it('should report the need for standard bool support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Bool,
                bitSize: 1,
                byteSize: 1,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useBool');
    })
    it('should report the need for extended bool support when bitfield is used', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Bool,
                bitOffset: 1,
                bitSize: 1,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useBoolEx');
    })
    it('should omit useBool when useBoolEx is present', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Bool,
                bitSize: 1,
                byteSize: 1,
              },
              {
                type: MemberType.Bool,
                bitOffset: 1,
                bitSize: 1,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useBoolEx');
      expect(features).to.not.contain('useBool');
    })
    it('should report the need for standard enum support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.EnumerationItem,
                bitSize: 32,
                byteSize: 4,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useEnumerationItem');
    })
    it('should report the need for extended enum support when unaligned enum is used', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.EnumerationItem,
                bitOffset: 2,
                bitSize: 32,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useEnumerationItemEx');
    })
    it('should report the need for extended enum support when non-standard enum is used', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.EnumerationItem,
                bitSize: 35,
                byteSize: 8,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useEnumerationItemEx');
    })
    it('should omit useEnumerationItem when useEnumerationItemEx is present', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.EnumerationItem,
                bitSize: 35,
                byteSize: 8,
              },
              {
                type: MemberType.EnumerationItem,
                bitSize: 32,
                byteSize: 4,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useEnumerationItemEx');
      expect(features).to.not.contain('useEnumerationItem');
    })
    it('should report the need for enum support when enum structure is used', function() {
      const structures = [ 
        {
          type: StructureType.Enumeration,
          instance: { 
            members: [
              {
                type: MemberType.Uint,
                bitSize: 32,
                byteSize: 4,
              },
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useEnumeration');
      expect(features).to.contain('useEnumerationItem');
      expect(features).to.contain('useUintEx');
    })
    it('should report the need for extended enum support when non-standard int is involved', function() {
      const structures = [ 
        {
          type: StructureType.Enumeration,
          instance: { 
            members: [
              {
                type: MemberType.Uint,
                bitSize: 35,
                byteSize: 8,
              },
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useEnumeration');
      expect(features).to.contain('useEnumerationItemEx');
      expect(features).to.contain('useUintEx');
      expect(features).to.not.contain('useEnumerationItem');
    })

    it('should report the need for error support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Error,
                bitSize: 16,
                byteSize: 2,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useError');
    })
    it('should report the need for error support when error set structure is used', function() {
      const structures = [ 
        {
          type: StructureType.ErrorSet,
          instance: { 
            members: [
              {
                type: MemberType.Uint,
                bitSize: 16,
                byteSize: 2,
              },
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useErrorSet');
      expect(features).to.contain('useError');
      expect(features).to.contain('useUint');
    })
    it('should report the need for uint support when pointer structure is used', function() {
      const structures = [ 
        {
          type: StructureType.Pointer,
          instance: { 
            members: [
              {
                type: MemberType.Object,
                slot: 0
              },
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('usePointer');
      expect(features).to.contain('useObject');
      expect(features).to.contain('useUint');
    })
    it('should report the need for object support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Object,
                bitSize: 16,
                byteSize: 2,
                slot: 1,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useObject');
    })
    it('should report the need for type support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Type,
                slot: 1,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useType');
    })
    it('should report the need for void support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Void,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useVoid');
    })
    it('should report the need for comptime support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Comptime,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useComptime');
    })
    it('should report the need for literal support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Literal,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useLiteral');
    })
    it('should report the need for static support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          static: { 
            members: [
              {
                type: MemberType.Static,
              }
            ]
          },
          instance: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useStatic');
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
