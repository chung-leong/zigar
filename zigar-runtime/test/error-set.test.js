import { expect } from 'chai';

import { Environment } from '../src/environment.js';
import { resetGlobalErrorSet } from '../src/error-set.js';
import { MemberType, useAllMemberTypes } from '../src/member.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import { ENVIRONMENT, SLOTS } from '../src/symbol.js';

describe('Error set functions', function() {
  const env = new Environment();
  describe('defineErrorSet', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
      resetGlobalErrorSet();
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
        structure,
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
      const object = new Hello(Hello.UnableToCreateObject);
      expect(object.$).to.equal(Hello.UnableToCreateObject);
      object.$ = Hello.UnableToRetrieveMemoryLocation;
      expect(object.$).to.equal(Hello.UnableToRetrieveMemoryLocation);
      expect(object.valueOf()).to.equal(Hello.UnableToRetrieveMemoryLocation);
      expect(JSON.stringify(Hello.UnableToRetrieveMemoryLocation)).to.equal('{"error":"Unable to retrieve memory location"}');
      expect(JSON.stringify(object)).to.equal('{"error":"Unable to retrieve memory location"}');
      object.dataView.setInt16(0, -1);
      expect(() => JSON.stringify(object)).to.throw(TypeError);
    })
    it('should define anyerror', function() {
      // define error first
      const errorStructure1 = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'ErrorSet1',
        byteSize: 2,
      });      
      env.attachMember(errorStructure1, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: errorStructure1
      });
      env.attachMember(errorStructure1, {
        name: 'UnableToRetrieveMemoryLocation',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure1,
      }, true);
      env.attachMember(errorStructure1, {
        name: 'UnableToCreateObject',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure1,
      }, true);
      env.finalizeShape(errorStructure1);
      const { constructor: ErrorSet1 } = errorStructure1;
      env.attachTemplate(errorStructure1, {
        [SLOTS]: {
          0: ErrorSet1.call(ENVIRONMENT, errorData(5), { writable: false }),
          1: ErrorSet1.call(ENVIRONMENT, errorData(8), { writable: false }),
        }
      }, true);
      env.finalizeStructure(errorStructure1);
      // define anyerror
      const structure = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'anyerror',
        byteSize: 2,
      });      
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
      });
      env.finalizeShape(structure);
      const { constructor: AnyError } = structure;
      env.finalizeStructure(structure);
      // define another error afterward
      const errorStructure2 = env.beginStructure({
        type: StructureType.ErrorSet,
        name: 'ErrorSet1',
        byteSize: 2,
      });      
      env.attachMember(errorStructure2, {
        type: MemberType.Uint,
        bitSize: 16,
        bitOffset: 0,
        byteSize: 2,
        structure: errorStructure2
      });
      env.attachMember(errorStructure2, {
        name: 'pants_on_fire',
        type: MemberType.Comptime,
        slot: 0,
        structure: errorStructure2,
      }, true);
      env.attachMember(errorStructure2, {
        name: 'jesus_showed_up',
        type: MemberType.Comptime,
        slot: 1,
        structure: errorStructure2,
      }, true);
      env.finalizeShape(errorStructure2);
      const { constructor: ErrorSet2 } = errorStructure2;
      env.attachTemplate(errorStructure2, {
        [SLOTS]: {
          0: ErrorSet2.call(ENVIRONMENT, errorData(6), { writable: false }),
          1: ErrorSet2.call(ENVIRONMENT, errorData(7), { writable: false }),
        }
      }, true);
      env.finalizeStructure(errorStructure2);
      expect(AnyError).to.be.a('function');
      expect(AnyError.UnableToRetrieveMemoryLocation).to.be.an.instanceOf(Error);
      expect(AnyError.UnableToRetrieveMemoryLocation.message).to.equal('Unable to retrieve memory location');
      expect(Number(AnyError.UnableToRetrieveMemoryLocation)).to.equal(Number(ErrorSet1.UnableToRetrieveMemoryLocation));
      expect(ErrorSet1.UnableToRetrieveMemoryLocation in AnyError).to.be.true;
      expect(Number(AnyError.pants_on_fire)).to.equal(Number(ErrorSet2.pants_on_fire));
      expect(AnyError.pants_on_fire).to.be.instanceOf(Error);
      expect(AnyError.pants_on_fire.message).to.equal('Pants on fire');
      expect(ErrorSet2.pants_on_fire in AnyError).to.be.true;
      expect(AnyError.valueOf()).to.eql({
        UnableToRetrieveMemoryLocation: AnyError.UnableToRetrieveMemoryLocation,
        UnableToCreateObject: AnyError.UnableToCreateObject,
        pants_on_fire: AnyError.pants_on_fire,
        jesus_showed_up: AnyError.jesus_showed_up,
      });
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
        structure,
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
      expect(error.$.message).to.equal(Hello.UnableToRetrieveMemoryLocation.message);
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
        structure,
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
      expect(error.$.message).to.equal(Hello.UnableToRetrieveMemoryLocation.message);
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
        structure,
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
        structure,
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
        structure,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'unable_to_retrieve_memory_location',
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
      expect(Hello('UnableToCreateObject')).to.equal(Hello.UnableToCreateObject);
      expect(Hello('unable_to_retrieve_memory_location')).to.equal(Hello.unable_to_retrieve_memory_location);
      expect(Hello('Error: Unable to retrieve memory location')).to.equal(Hello.unable_to_retrieve_memory_location);
      expect(Hello('Unable to retrieve memory location')).to.be.undefined;
      expect(Hello('Dunno')).to.be.undefined;
    })
    it('should cast object to an error', function() {
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
        structure,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'unable_to_retrieve_memory_location',
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
      expect(Hello({ error: 'Unable to create object' })).to.equal(Hello.UnableToCreateObject);
      expect(Hello(JSON.parse(JSON.stringify(Hello.UnableToCreateObject)))).to.equal(Hello.UnableToCreateObject);
      expect(Hello({ error: 'Unable to retrieve memory location' })).to.equal(Hello.unable_to_retrieve_memory_location);
      expect(Hello({ error: 'UnableToCreateObject' })).to.be.undefined;
    })
    it('should detect that set contains errors from a different set', function() {
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
        structure: catStructure
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
        structure: dogStructure,
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
        structure: petStructure,
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
      expect(DogError.BathRequired in PetError).to.be.true;
      expect(DogError.BathRequired in DogError).to.be.true;
      expect(CatError.CucumberEncountered in PetError).to.be.true;
      expect(DogError.BathRequired).to.equal(PetError.BathRequired);
      expect(CatError.CucumberEncountered).to.equal(PetError.CucumberEncountered);
      expect(new Error('Doh') in PetError).to.be.false;
      expect(null in PetError).to.be.false;
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
        structure,
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
        structure,
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
        structure,
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
      debugger;
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
        structure,
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
        structure,
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