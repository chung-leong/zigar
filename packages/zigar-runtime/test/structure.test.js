import { expect } from 'chai';

import {
  StructureType,
  useOpaque,
  beginStructure,
  finalizeStructure,
  getStructureFeature,
} from '../src/structure.js';

describe('Structure functions', function() {
  describe('useOpaque', function() {
    it(`should enable the creation of opaque structure`, function() {
      useOpaque();
      const structure = beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        size: 0
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const object = new Hello();
      expect(object).to.be.a('object');
    })
  })
  describe('getStructureFeature', function() {
    it(`should return the name of the function needed by structure`, function() {
      const structure = beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        size: 0
      });
      const name = getStructureFeature(structure);
      expect(name).to.equal('useOpaque');
    })
  })
})
