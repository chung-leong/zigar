import { expect } from 'chai';

import {
  MemberType,
  useBoolEx,
  useIntEx,
  useObject,
} from '../src/member.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import {
  StructureType,
  usePrimitive,
  useStruct,
  useEnumeration,
  usePointer,
  beginStructure,
  attachMember,
  attachTemplate,
  finalizeStructure,
} from '../src/structure.js';

describe('Static variable functions', function() {
  beforeEach(function() {
    useStruct();
    usePointer();
    usePrimitive();
    useEnumeration();
    useBoolEx();
    useIntEx();
    useObject();
  })
  describe('Static variables', function() {
    it('should attach variables to a struct', function() {
      // define structure for integer variables
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const intPtrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(intPtrStructure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const PInt32 = finalizeStructure(intPtrStructure);
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 8 * 2,
      });
      attachMember(structure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'superdog',
        type: MemberType.Object,
        isStatic: true,
        isConst: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intPtrStructure,
      });
      attachMember(structure, {
        name: 'supercat',
        type: MemberType.Object,
        isStatic: true,
        isConst: true,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: intPtrStructure,
      });
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      attachTemplate(structure, {
        isStatic: true,
        template: {
          [SLOTS]: {
           0: new PInt32(int1),
           1: new PInt32(int2),
          },
        }
      });
      const Hello = finalizeStructure(structure);
      expect(Hello.superdog).to.equal(1234);
      Hello.superdog = 43;
      expect(Hello.superdog).to.equal(43);
      expect(Hello.supercat).to.equal(4567);
      expect(() => Hello.supercat = 777).to.throw();
      expect(Hello.supercat).to.equal(4567);
      const object = new Hello();
      expect(object.dog).to.equal(0);
      object.dog = 123;
      expect(object.dog).to.equal(123);
      expect(Hello.superdog).to.equal(43);
    })
    it('should attach variables to an enumeration', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const intPtrStructure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(intPtrStructure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const PInt32 = finalizeStructure(intPtrStructure);
      const structure = beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello'
      });
      attachMember(structure, {
        name: 'Dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachMember(structure, {
        name: 'Cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      attachTemplate(structure, {
        isStatic: false,
        template: {
          [MEMORY]: (() => {
            const dv = new DataView(new ArrayBuffer(4 * 2));
            dv.setUint32(0, 0, true);
            dv.setUint32(4, 1, true);
            return dv;
          })(),
          [SLOTS]: {},
        },
      });
      attachMember(structure, {
        name: 'superdog',
        type: MemberType.Object,
        isStatic: true,
        isConst: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intPtrStructure,
      });
      attachMember(structure, {
        name: 'supercat',
        type: MemberType.Object,
        isStatic: true,
        isConst: true,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: intPtrStructure,
      });
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      attachTemplate(structure, {
        isStatic: true,
        template: {
          [SLOTS]: {
            0: new PInt32(int1),
            1: new PInt32(int2),
          },
        },
      });
      const Hello = finalizeStructure(structure);
      expect(Hello.superdog).to.equal(1234);
      Hello.superdog = 43;
      expect(Hello.superdog).to.equal(43);
      expect(Hello.supercat).to.equal(4567);
      // make sure the variables aren't overwriting the enum slots
      expect(Hello(0)).to.equal(Hello.Dog);
      expect(Hello(1)).to.equal(Hello.Cat);
    })
  })
})