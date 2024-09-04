import { expect } from 'chai';

import { useAllExtendedTypes } from '../src/data-view.js';
import { NodeEnvironment } from '../src/environment-node.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import { encodeBase64 } from '../src/text.js';
import { MemberType, StructureType } from '../src/types.js';

describe('Primitive functions', function() {
  const env = new NodeEnvironment();
  describe('definePrimitive', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
      useAllExtendedTypes();
    })
    it('should allow assignment of base64 data', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      const str = '\u0001\u0000\u0000\u0000\u0000\u0000\u0000\u0000';
      const int = new I64(0n);
      int.base64 = encodeBase64(Buffer.from(str));
      expect(int.$).to.equal(1n);
    })
    it('should accept typed array as initializer', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      const typedArray = new BigInt64Array([ 1234n ]);
      const int = new I64({ typedArray });
      expect(int.$).to.equal(typedArray[0]);
      int.$ = 123n;
      expect(int.$).to.not.equal(typedArray[0]);
    })
    it('should allow assignment of typed array', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      const int = new I64(77n);
      const typedArray = new BigInt64Array([ 1234n ]);
      int.typedArray = typedArray;
      expect(int.$).to.equal(typedArray[0]);
    })
    it('should allow casting of typed array into primitive', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      const typedArray = new BigInt64Array([ 1234n ]);
      const int = I64(typedArray);
      expect(int.$).to.equal(typedArray[0]);
      int.$ = 123n;
      expect(int.$).to.equal(typedArray[0]);
    })
    it('should throw when given an object with unrecognized properties', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      expect(() => new I64({ dogmeat: 5 })).to.throw(TypeError);
    })
    it('should throw when given an empty object', function() {
      const structure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: I64 } = structure;
      expect(() => new I64({})).to.throw(TypeError);
    })
  })
})
