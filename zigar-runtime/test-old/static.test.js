import { expect } from 'chai';

import { NodeEnvironment } from '../src/environment-node.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import { MemberType, StructureType } from '../src/types.js';

describe('Static variable functions', function() {
  const env = new NodeEnvironment();
  beforeEach(function() {
    useAllMemberTypes();
    useAllStructureTypes();
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
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
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
        type: MemberType.Static,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      }, true);
      env.attachMember(structure, {
        name: 'supercat',
        type: MemberType.Comptime,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: intStructure,
      }, true);
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: int1,
          1: int2,
        },
      }, true);
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
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
      const names = [], values = [];
      for (const [ name, value ] of Hello) {
        names.push(name);
        values.push(value);
      }
      expect(names).to.eql([ 'superdog', 'supercat' ]);
      expect(values).to.eql([ 43, 4567 ]);
      expect(Hello.valueOf()).to.eql({ superdog: 43, supercat: 4567 });
      expect(JSON.stringify(Hello)).to.eql('{"superdog":43,"supercat":4567}');
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
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = env.beginStructure({
        type: StructureType.Enum,
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
        type: MemberType.Static,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      }, true);
      env.attachMember(structure, {
        name: 'supercat',
        type: MemberType.Static,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: intStructure,
      }, true);
      const int1 = new Int32(1234);
      const int2 = new Int32(4567);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: int1,
          1: int2,
        },
      }, true);
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
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