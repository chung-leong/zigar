import { expect } from 'chai';

import { Environment } from '../src/environment.js';
import { createGlobalErrorSet } from '../src/error-set.js';
import { MemberType, useAllMemberTypes } from '../src/member.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import { ENVIRONMENT, SLOTS } from '../src/symbol.js';

describe('Error set functions', function() {
  const env = new Environment();
  describe('defineErrorSet', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
      createGlobalErrorSet();
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
      expect(Number(Hello.UnableToRetrieveMemoryLocation)).to.equal(5);
      expect(Number(Hello.UnableToCreateObject)).to.equal(8);
      expect(Hello(5)).to.equal(Hello.UnableToRetrieveMemoryLocation);
      expect(Hello(8)).to.equal(Hello.UnableToCreateObject);
      try {
        throw Hello.UnableToCreateObject;
      } catch (err) {
        expect(err).to.equal(Hello.UnableToCreateObject);
      }
      expect(() => Hello.UnableToCreateObject.$ = Hello.UnableToCreateObject).to.throw(TypeError);
      const object = new Hello(Hello.UnableToCreateObject);
      expect(object.$).to.equal(Hello.UnableToCreateObject);
      object.$ = Hello.UnableToRetrieveMemoryLocation;
      expect(object.$).to.equal(Hello.UnableToRetrieveMemoryLocation);
      expect(object.valueOf()).to.equal(Hello.UnableToRetrieveMemoryLocation);
      expect(JSON.stringify(object)).to.equal('{"error":"Unable to retrieve memory location"}');
      object.dataView.setInt16(0, -1);
      expect(() => JSON.stringify(object)).to.throw(TypeError);
    })
    it('should create an object for storing an error', function() {
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
      const error = new Hello(5);
      expect(error.message).to.equal(Hello.UnableToRetrieveMemoryLocation.message);
    })
    it('should cast view used for storing an error', function() {
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
      const dv = new DataView(new ArrayBuffer(structure.byteSize));
      dv.setUint16(0, 5, true);
      const error = Hello(dv);
      expect(error.message).to.equal(Hello.UnableToRetrieveMemoryLocation.message);
    })
    it('should cast the same buffer to the same object', function() {
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
      const buffer = new ArrayBuffer(2);
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
    })
    it('should cast number to an error', function() {
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
      expect(Hello(5)).to.equal(Hello.UnableToRetrieveMemoryLocation);
      expect(Hello(8)).to.equal(Hello.UnableToCreateObject);
      expect(Hello(9)).to.be.undefined;
    })
    it('should cast string to an error', function() {
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
      const text = Hello.UnableToCreateObject.toString();
      expect(text).to.equal('Error: Unable to create object');
      expect(Hello(text)).to.equal(Hello.UnableToCreateObject);
      expect(Hello('Dunno')).to.be.undefined;
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
          0: DogError.call(ENVIRONMENT, errorData(7), { writable: false }),
          1: DogError.call(ENVIRONMENT, errorData(8), { writable: false }),
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
      PetError.BathRequired;
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
          0: DogError.call(ENVIRONMENT, errorData(7), { writable: false }),
          1: DogError.call(ENVIRONMENT, errorData(8), { writable: false }),
        },
      }, true);
      env.finalizeStructure(dogStructure);
      expect(PetError.BathRequired).to.equal(DogError.BathRequired);
      expect(DogError.BathRequired).to.be.instanceOf(PetError);
      expect(CatError.CucumberEncountered).to.be.instanceOf(PetError);
    })
    it('should throw when no initializer is provided', function() {
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
      expect(() => new Hello()).to.throw(TypeError);
    }) 
    it('should throw when initializer is not one of the expected types', function() {
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
      expect(() => Hello(false)).to.throw(TypeError);
    }) 
    it('should accept special properties', function() {
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
      const object = new Hello({ typedArray: new Uint16Array([ 8 ])});
      expect(object.$).to.equal(Hello.UnableToCreateObject);
    }) 
    it('should throw when no special properties are found', function() {
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
      expect(() => new Hello({})).to.throw(TypeError);
    })
    it('should initialize error object from toJSON output', function() {
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
      const object1 = new Hello(Hello.UnableToCreateObject);
      const json = object1.toJSON();
      const object2 = new Hello(json);
      expect(object2.$).to.equal(Hello.UnableToCreateObject);
      expect(() => new Hello({ error: 'Something' })).to.throw(TypeError)
        .with.property('message').to.contain('Something');
    })
  })
})

function errorData(index) {
  const ta = new Uint16Array([ index ]);
  return new DataView(ta.buffer, 0, 2);
}