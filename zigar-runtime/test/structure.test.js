import { expect } from 'chai';

import {
  StructureType,
  useOpaque,
  beginStructure,
  finalizeStructure,
  getStructureFeature,
  getShortName,
} from '../src/structure.js';

describe('Structure functions', function() {
  describe('useOpaque', function() {
    it(`should enable the creation of opaque structure`, function() {
      useOpaque();
      const structure = beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        byteSize: 0
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.an('object');
    })
  })
  describe('getStructureFeature', function() {
    it(`should return the name of the function needed by structure`, function() {
      const structure = beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        byteSize: 0
      });
      const name = getStructureFeature(structure);
      expect(name).to.equal('useOpaque');
    })
  })
  describe('getShortName', function() {
    it('should shorten names by removing namespace qualifiers', function() {
      expect(getShortName({ name: 'u8' })).to.equal('u8');
      expect(getShortName({ name: 'zig.Hello' })).to.equal('Hello');
      expect(getShortName({ name: '[]const zig.Hello' })).to.equal('[]const Hello');
      expect(getShortName({ name: '[]const zig.world.joga.Hello' })).to.equal('[]const Hello');
    })
  })
})
