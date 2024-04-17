import { expect } from 'chai';

import { Environment } from '../src/environment.js';
import {
  findAllObjects,
  getFeaturesUsed,
  getStructureFactory,
  useOpaque
} from '../src/structure.js';
import { SLOTS } from '../src/symbol.js';
import { MemberType, StructureType } from '../src/types.js';

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
      expect(features).to.contain('useInt');
      expect(features).to.contain('useExtendedInt');
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
      expect(features).to.contain('useInt');
      expect(features).to.contain('useExtendedInt');
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
      expect(features).to.contain('useUint');
      expect(features).to.contain('useExtendedUint');
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
      expect(features).to.contain('useUint');
      expect(features).to.contain('useExtendedUint');
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
      expect(features).to.contain('useFloat');
      expect(features).to.contain('useExtendedFloat');
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
      expect(features).to.contain('useFloat');
      expect(features).to.contain('useExtendedFloat');
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
      expect(features).to.contain('useExtendedBool');
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
                structure: {
                  instance: {
                    members: [ { type: MemberType.Uint } ]
                  }
                }
              },
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useEnumeration');
      expect(features).to.contain('useUint');
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
                structure: {
                  instance: {
                    members: [ { type: MemberType.Uint } ]
                  }
                }
              },
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useEnumeration');
      expect(features).to.contain('useUint');
      expect(features).to.contain('useExtendedUint');
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
    it('should report the need for null support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Null,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useNull');
    })
    it('should report the need for undefined support', function() {
      const structures = [ 
        {
          type: StructureType.Struct,
          instance: { 
            members: [
              {
                type: MemberType.Undefined,
              }
            ]
          },
          static: { members: [] },
        }
      ];
      const features = getFeaturesUsed(structures);
      expect(features).to.contain('useStruct');
      expect(features).to.contain('useUndefined');
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
})
