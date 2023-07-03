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

describe('Error set functions', function() {
  describe('finalizeErrorSet', function() {
    beforeEach(function() {
      useIntEx();
      useErrorSet();
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
      expect(Number(Hello.UnableToRetrieveMemoryLocation)).to.equal(5);
      expect(Number(Hello.UnableToCreateObject)).to.equal(8);
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
  })
})