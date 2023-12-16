import { expect } from 'chai';

import { MemberType, useAllMemberTypes } from '../src/member.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import { initializeErrorSets } from '../src/error-set.js';
import { Environment } from '../src/environment.js'
import { ENVIRONMENT, SLOTS } from '../src/symbol.js';

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
        byteSize: 2,
      });      
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, errorData(5), { writable: false }),
          1: Hello.call(ENVIRONMENT, errorData(8), { writable: false }),
        }
      }, true);
      env.finalizeStructure(structure);
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
      expect(() => Hello.UnableToCreateObject.$ = Hello.UnableToCreateObject).to.throw(TypeError);
      const e = new Hello(Hello.UnableToCreateObject);
      expect(e.$).to.equal(Hello.UnableToCreateObject);
      e.$ = Hello.UnableToRetrieveMemoryLocation;
      expect(e.$).to.equal(Hello.UnableToRetrieveMemoryLocation);
    })
    it('should make previously defined error sets its subclasses if it has all their errors', function() {
      const catStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'CatError',
        byteSize: 2,
      });
      env.attachMember(catStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(catStructure);
      const { constructor: CatError } = catStructure;
      env.attachMember(catStructure, {
        name: 'CucumberEncountered',
        type: MemberType.Comptime,
        slot: 0,
        structure: catStructure,
      }, true);
      env.attachMember(catStructure, {
        name: 'CatnipEncountered',
        type: MemberType.Comptime,
        slot: 1,
        structure: catStructure,
      }, true);
      env.attachTemplate(catStructure, {
        [SLOTS]: {
          0: CatError.call(ENVIRONMENT, errorData(5), { writable: false }),
          1: CatError.call(ENVIRONMENT, errorData(6), { writable: false }),
        },
      }, true);
      env.finalizeStructure(catStructure);
      const dogStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'DogError',
        byteSize: 2,
      });
      env.attachMember(dogStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(dogStructure);
      const { constructor: DogError } = dogStructure;
      env.attachMember(dogStructure, {
        name: 'StrangerEncountered',
        type: MemberType.Comptime,
        slot: 0,
        structure: dogStructure,
      }, true);
      env.attachMember(dogStructure, {
        name: 'BathRequired',
        type: MemberType.Comptime,
        slot: 1,
        structure: dogStructure,
      }, true);
      env.attachTemplate(dogStructure, {
        [SLOTS]: {
          0: CatError.call(ENVIRONMENT, errorData(7), { writable: false }),
          1: CatError.call(ENVIRONMENT, errorData(8), { writable: false }),
        },
      }, true);
      env.finalizeStructure(dogStructure);
      const petStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'PetError',
        byteSize: 2,
      });
      env.attachMember(petStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(petStructure);
      const { constructor: PetError } = petStructure;
      env.attachMember(petStructure, {
        name: 'CucumberEncountered',
        type: MemberType.Comptime,
        slot: 0,
        structure: petStructure,
      }, true);
      env.attachMember(petStructure, {
        name: 'CatnipEncountered',
        type: MemberType.Comptime,
        slot: 1,
        structure: petStructure,
      }, true);
      env.attachMember(petStructure, {
        name: 'StrangerEncountered',
        type: MemberType.Comptime,
        slot: 2,
        structure: petStructure,
      }, true);
      env.attachMember(petStructure, {
        name: 'BathRequired',
        type: MemberType.Comptime,
        slot: 3,
        structure: petStructure,
      }, true);
      env.attachTemplate(petStructure, {
        [SLOTS]: {
          0: PetError.call(ENVIRONMENT, errorData(5), { writable: false }),
          1: PetError.call(ENVIRONMENT, errorData(6), { writable: false }),
          2: PetError.call(ENVIRONMENT, errorData(7), { writable: false }),
          3: PetError.call(ENVIRONMENT, errorData(8), { writable: false }),
        },
      }, true);
      env.finalizeStructure(petStructure);
      expect(PetError.BathRequired).to.equal(DogError.BathRequired);
      expect(DogError.BathRequired).to.be.instanceOf(PetError);
      expect(CatError.CucumberEncountered).to.be.instanceOf(PetError);
    })
    it('should use previously defined error set as parent class if the other has all its error numbers', function() {
      // same test as above, with the error sets processed in different order
      const petStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'PetError',
        byteSize: 2,
      });
      env.attachMember(petStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(petStructure);
      const { constructor: PetError } = petStructure;
      env.attachMember(petStructure, {
        name: 'CucumberEncountered',
        type: MemberType.Comptime,
        slot: 0,
        structure: petStructure,
      }, true);
      env.attachMember(petStructure, {
        name: 'CatnipEncountered',
        type: MemberType.Comptime,
        slot: 1,
        structure: petStructure,
      }, true);
      env.attachMember(petStructure, {
        name: 'StrangerEncountered',
        type: MemberType.Comptime,
        slot: 2,
        structure: petStructure,
      }, true);
      env.attachMember(petStructure, {
        name: 'BathRequired',
        type: MemberType.Comptime,
        slot: 3,
        structure: petStructure,
      }, true);
      env.attachTemplate(petStructure, {
        [SLOTS]: {
          0: PetError.call(ENVIRONMENT, errorData(5), { writable: false }),
          1: PetError.call(ENVIRONMENT, errorData(6), { writable: false }),
          2: PetError.call(ENVIRONMENT, errorData(7), { writable: false }),
          3: PetError.call(ENVIRONMENT, errorData(8), { writable: false }),
        },
      }, true);
      env.finalizeStructure(petStructure);
      const catStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'CatError',
        byteSize: 2,
      });
      env.attachMember(catStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(catStructure);
      const { constructor: CatError } = catStructure;
      env.attachMember(catStructure, {
        name: 'CucumberEncountered',
        type: MemberType.Comptime,
        slot: 0,
        structure: catStructure,
      }, true);
      env.attachMember(catStructure, {
        name: 'CatnipEncountered',
        type: MemberType.Comptime,
        slot: 1,
        structure: catStructure,
      }, true);
      env.attachTemplate(catStructure, {
        [SLOTS]: {
          0: CatError.call(ENVIRONMENT, errorData(5), { writable: false }),
          1: CatError.call(ENVIRONMENT, errorData(6), { writable: false }),
        },
      }, true);
      env.finalizeStructure(catStructure);
      const dogStructure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'DogError',
        byteSize: 2,
      });
      env.attachMember(dogStructure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(dogStructure);
      const { constructor: DogError } = dogStructure;
      env.attachMember(dogStructure, {
        name: 'StrangerEncountered',
        type: MemberType.Comptime,
        slot: 0,
        structure: dogStructure,
      }, true);
      env.attachMember(dogStructure, {
        name: 'BathRequired',
        type: MemberType.Comptime,
        slot: 1,
        structure: dogStructure,
      }, true);
      env.attachTemplate(dogStructure, {
        [SLOTS]: {
          0: CatError.call(ENVIRONMENT, errorData(7), { writable: false }),
          1: CatError.call(ENVIRONMENT, errorData(8), { writable: false }),
        },
      }, true);
      env.finalizeStructure(dogStructure);
      expect(PetError.BathRequired).to.equal(DogError.BathRequired);
      expect(DogError.BathRequired).to.be.instanceOf(PetError);
      expect(CatError.CucumberEncountered).to.be.instanceOf(PetError);
    })
  })
})

function errorData(index) {
  const ta = new Uint16Array([ index ]);
  return new DataView(ta.buffer, 0, 2);
}