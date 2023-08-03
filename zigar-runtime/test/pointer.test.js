import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
  useObject,
} from '../src/member.js';
import {
  StructureType,
  usePrimitive,
  usePointer,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';
import { getMemoryCopier } from '../src/memory.js';
import { MEMORY, SLOTS, SOURCE } from '../src/symbol.js';

describe('Pointer functions', function() {
  describe('finalizePointer', function() {
    beforeEach(function() {
      useIntEx();
      useObject();
      usePrimitive();
      usePointer();
    })
    it('should define a pointer for pointing to integers', function() {
      const intStructure = beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        size: 4,
      });
      attachMember(intStructure, {
        type: MemberType.Int,
        isStatic: false,
        isSigned: false,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = finalizeStructure(intStructure);
      const structure = beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        size: 8,
        hasPointer: true,
      });
      attachMember(structure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const PInt32 = finalizeStructure(structure);
      const int32 = new Int32(1234);
      const intPointer = new PInt32(int32);
      expect(intPointer['&']).to.equal(int32);
      expect(intPointer['*']).to.equal(1234);
    })
  })
})
