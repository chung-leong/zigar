import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
} from '../src/member.js';
import {
  StructureType,
  useErrorSet,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';
import { initializeErrorSets } from '../src/error-set.js';

describe('Error set functions', function() {
  describe('finalizeErrorSet', function() {
    beforeEach(function() {
      useIntEx();
      useErrorSet();
      initializeErrorSets();
    })
    it('should define an error set', function() {
      const structure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'Hello',
      });
      attachMember(structure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        slot: 5,
      });
      attachMember(structure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        slot: 8,
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      expect(Hello.UnableToRetrieveMemoryLocation).to.be.an.instanceOf(Error);
      expect(Hello.UnableToRetrieveMemoryLocation).to.be.an('error');
      expect(Hello.UnableToRetrieveMemoryLocation.message).to.equal('Unable to retrieve memory location');
      expect(Hello.UnableToCreateObject.message).to.equal('Unable to create object');
      expect(`${Hello.UnableToCreateObject}`).to.equal(`Error: Unable to create object`);
      expect(Hello.UnableToRetrieveMemoryLocation.valueOf()).to.equal(Hello.UnableToRetrieveMemoryLocation);
      expect(Hello.UnableToRetrieveMemoryLocation.index).to.equal(5);
      expect(Hello.UnableToCreateObject.index).to.equal(8);
      expect(Hello(5)).to.equal(Hello.UnableToRetrieveMemoryLocation);
      expect(Hello(8)).to.equal(Hello.UnableToCreateObject);
      try {
        throw Hello.UnableToCreateObject;
      } catch (err) {
        expect(err).to.equal(Hello.UnableToCreateObject);
      }
    })
    it('should not allow the creation of new error objects', function() {
      const structure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'Hello',
      });
      attachMember(structure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        slot: 5,
      });
      attachMember(structure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        slot: 8,
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello()).to.throw(TypeError);
    })
    it('should make previously defined error sets its subclasses if it has all its error numbers', function() {
      const catStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'CatError',
      });
      attachMember(catStructure, {
        name: 'CucumberEncountered',
        type: MemberType.Object,
        slot: 5,
      });
      attachMember(catStructure, {
        name: 'CatnipEncountered',
        type: MemberType.Object,
        slot: 6,
      });
      const CatError = finalizeStructure(catStructure);
      const dogStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'DogError',
      });
      attachMember(dogStructure, {
        name: 'StrangerEncountered',
        type: MemberType.Object,
        slot: 7,
      });
      attachMember(dogStructure, {
        name: 'BathRequired',
        type: MemberType.Object,
        slot: 8,
      });
      const DogError = finalizeStructure(dogStructure);
      const petStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'PetError',
      });
      attachMember(petStructure, {
        name: 'CucumberEncountered',
        type: MemberType.Object,
        slot: 5,
      });
      attachMember(petStructure, {
        name: 'CatnipEncountered',
        type: MemberType.Object,
        slot: 6,
      });
      attachMember(petStructure, {
        name: 'StrangerEncountered',
        type: MemberType.Object,
        slot: 7,
      });
      attachMember(petStructure, {
        name: 'BathRequired',
        type: MemberType.Object,
        slot: 8,
      });
      const PetError = finalizeStructure(petStructure);
      expect(PetError.BathRequired).to.equal(DogError.BathRequired);
      expect(DogError.BathRequired).to.be.instanceOf(PetError);
      expect(CatError.CucumberEncountered).to.be.instanceOf(PetError);
    })
    it('should use previously defined error set as parent class if the other has all its error numbers', function() {
      // same test as above, with the error sets processed in different order
      const petStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'PetError',
      });
      attachMember(petStructure, {
        name: 'CucumberEncountered',
        type: MemberType.Object,
        slot: 5,
      });
      attachMember(petStructure, {
        name: 'CatnipEncountered',
        type: MemberType.Object,
        slot: 6,
      });
      attachMember(petStructure, {
        name: 'StrangerEncountered',
        type: MemberType.Object,
        slot: 7,
      });
      attachMember(petStructure, {
        name: 'BathRequired',
        type: MemberType.Object,
        slot: 8,
      });
      const PetError = finalizeStructure(petStructure);
      const catStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'CatError',
      });
      attachMember(catStructure, {
        name: 'CucumberEncountered',
        type: MemberType.Object,
        slot: 5,
      });
      attachMember(catStructure, {
        name: 'CatnipEncountered',
        type: MemberType.Object,
        slot: 6,
      });
      const CatError = finalizeStructure(catStructure);
      const dogStructure = beginStructure({
        type: StructureType.ErrorSet,
        name: 'DogError',
      });
      attachMember(dogStructure, {
        name: 'StrangerEncountered',
        type: MemberType.Object,
        slot: 7,
      });
      attachMember(dogStructure, {
        name: 'BathRequired',
        type: MemberType.Object,
        slot: 8,
      });
      const DogError = finalizeStructure(dogStructure);
      expect(PetError.BathRequired).to.equal(DogError.BathRequired);
      expect(DogError.BathRequired).to.be.instanceOf(PetError);
      expect(CatError.CucumberEncountered).to.be.instanceOf(PetError);
    })
  })
})