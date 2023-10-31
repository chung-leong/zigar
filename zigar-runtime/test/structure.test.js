import { expect } from 'chai';

import {
  StructureType,
  useOpaque,
  getStructureFeature,
  getStructureName,
} from '../src/structure.js';
import { BaseEnvironment } from '../src/environment.js'

describe('Structure functions', function() {
  const env = new BaseEnvironment();
  describe('useOpaque', function() {
    it(`should enable the creation of opaque structure`, function() {
      useOpaque();
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        byteSize: 0
      });
      const Hello = env.finalizeStructure(structure);
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
    })
  })
})
