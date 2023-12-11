import { expect } from 'chai';

import { MemberType, useAllMemberTypes } from '../src/member.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import { initializeErrorSets } from '../src/error-set.js';
import { Environment } from '../src/environment.js'

describe('Error set functions', function() {
  const env = new Environment();
  describe('defineErrorSet', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
      initializeErrorSets();
    })
    it('should define an error set', function() {
      const structure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'Hello',
      });
      env.attachMember(structure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        slot: 5,
      });
      env.attachMember(structure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        slot: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
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
      const structure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'Hello',
      });
      env.attachMember(structure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Object,
        slot: 5,
      });
      env.attachMember(structure, {
        name: 'UnableToCreateObject',
        type: MemberType.Object,
        slot: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      expect(() => new Hello()).to.throw(TypeError);
    })
    it('should make previously defined error sets its subclasses if it has all its error numbers', function() {
      const catStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'CatError',
      });
      env.attachMember(catStructure, {
        name: 'CucumberEncountered',
        type: MemberType.Object,
        slot: 5,
      });
      env.attachMember(catStructure, {
        name: 'CatnipEncountered',
        type: MemberType.Object,
        slot: 6,
      });
      env.finalizeShape(catStructure);
      env.finalizeStructure(catStructure);
      const { constructor: CatError } = catStructure;
      const dogStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'DogError',
      });
      env.attachMember(dogStructure, {
        name: 'StrangerEncountered',
        type: MemberType.Object,
        slot: 7,
      });
      env.attachMember(dogStructure, {
        name: 'BathRequired',
        type: MemberType.Object,
        slot: 8,
      });
      env.finalizeShape(dogStructure);
      env.finalizeStructure(dogStructure);
      const { constructor: DogError } = dogStructure;
      const petStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'PetError',
      });
      env.attachMember(petStructure, {
        name: 'CucumberEncountered',
        type: MemberType.Object,
        slot: 5,
      });
      env.attachMember(petStructure, {
        name: 'CatnipEncountered',
        type: MemberType.Object,
        slot: 6,
      });
      env.attachMember(petStructure, {
        name: 'StrangerEncountered',
        type: MemberType.Object,
        slot: 7,
      });
      env.attachMember(petStructure, {
        name: 'BathRequired',
        type: MemberType.Object,
        slot: 8,
      });
      env.finalizeShape(petStructure);
      env.finalizeStructure(petStructure);
      const { constructor: PetError } = petStructure;
      expect(PetError.BathRequired).to.equal(DogError.BathRequired);
      expect(DogError.BathRequired).to.be.instanceOf(PetError);
      expect(CatError.CucumberEncountered).to.be.instanceOf(PetError);
    })
    it('should use previously defined error set as parent class if the other has all its error numbers', function() {
      // same test as above, with the error sets processed in different order
      const petStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'PetError',
      });
      env.attachMember(petStructure, {
        name: 'CucumberEncountered',
        type: MemberType.Object,
        slot: 5,
      });
      env.attachMember(petStructure, {
        name: 'CatnipEncountered',
        type: MemberType.Object,
        slot: 6,
      });
      env.attachMember(petStructure, {
        name: 'StrangerEncountered',
        type: MemberType.Object,
        slot: 7,
      });
      env.attachMember(petStructure, {
        name: 'BathRequired',
        type: MemberType.Object,
        slot: 8,
      });
      env.finalizeShape(petStructure);
      env.finalizeStructure(petStructure);
      const { constructor: PetError } = petStructure;
      const catStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'CatError',
      });
      env.attachMember(catStructure, {
        name: 'CucumberEncountered',
        type: MemberType.Object,
        slot: 5,
      });
      env.attachMember(catStructure, {
        name: 'CatnipEncountered',
        type: MemberType.Object,
        slot: 6,
      });
      env.finalizeShape(catStructure);
      env.finalizeStructure(catStructure);
      const { constructor: CatError } = catStructure;
      const dogStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'DogError',
      });
      env.attachMember(dogStructure, {
        name: 'StrangerEncountered',
        type: MemberType.Object,
        slot: 7,
      });
      env.attachMember(dogStructure, {
        name: 'BathRequired',
        type: MemberType.Object,
        slot: 8,
      });
      env.finalizeShape(dogStructure);
      env.finalizeStructure(dogStructure);
      const { constructor: DogError } = dogStructure;
      expect(PetError.BathRequired).to.equal(DogError.BathRequired);
      expect(DogError.BathRequired).to.be.instanceOf(PetError);
      expect(CatError.CucumberEncountered).to.be.instanceOf(PetError);
    })
  })
})