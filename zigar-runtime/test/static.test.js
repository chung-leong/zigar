import { expect } from 'chai';

import {
  MemberType,
  useBoolEx,
  useIntEx,
  useUintEx,
  useObject,
} from '../src/member.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import {
  StructureType,
  usePrimitive,
  useStruct,
  useEnumeration,
  usePointer,
} from '../src/structure.js';
import { NodeEnvironment } from '../src/environment.js'

describe('Static variable functions', function() {
  const env = new NodeEnvironment();
  beforeEach(function() {
    useStruct();
    usePointer();
    usePrimitive();
    useEnumeration();
    useBoolEx();
    useIntEx();
    useUintEx();
    useObject();
  })
  describe('Static variables', function() {
    it('should attach variables to a struct', function() {
      // define structure for integer variables
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = env.finalizeStructure(intStructure);
      const intPtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        isConst: false,
        hasPointer: true,
      });
      env.attachMember(intPtrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.finalizeStructure(intPtrStructure);
      const constIntPtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        isConst: true,
        hasPointer: true,
      });
      env.attachMember(constIntPtrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const ConstInt32Ptr = env.finalizeStructure(constIntPtrStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'superdog',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intPtrStructure,
      }, true);
      env.attachMember(structure, {
        name: 'supercat',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: constIntPtrStructure,
      }, true);
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: new Int32Ptr(int1),
          1: new ConstInt32Ptr(int2),
        },
      }, true);
      const Hello = env.finalizeStructure(structure);
      expect(Hello.superdog).to.equal(1234);
      Hello.superdog = 43;
      expect(Hello.superdog).to.equal(43);
      expect(Hello.supercat).to.equal(4567);
      expect(() => Hello.supercat = 777).to.throw();
      expect(Hello.supercat).to.equal(4567);
      const object = new Hello(undefined);
      expect(object.dog).to.equal(0);
      object.dog = 123;
      expect(object.dog).to.equal(123);
      expect(Hello.superdog).to.equal(43);
      const descriptors = Object.getOwnPropertyDescriptors(Hello);
      expect(descriptors.superdog.set).to.be.a('function');
      expect(descriptors.supercat.set).to.be.undefined;
    })
    it('should attach variables to an enumeration', function() {
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = env.finalizeStructure(intStructure);
      const intPtrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(intPtrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.finalizeStructure(intPtrStructure);
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello'
      });
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
      });
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
      });
      env.attachTemplate(structure, {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
        [SLOTS]: {},
      });
      env.attachMember(structure, {
        name: 'superdog',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intPtrStructure,
      }, true);
      env.attachMember(structure, {
        name: 'supercat',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: intPtrStructure,
      }, true);
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: new Int32Ptr(int1),
          1: new Int32Ptr(int2),
        },
      }, true);
      const Hello = env.finalizeStructure(structure);
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