import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
  useFloatEx,
  useObject,
} from '../src/member.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import {
  StructureType,
  usePrimitive,
  useArray,
  useStruct,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';
import {
  getValueOf,
} from '../src/json.js';

describe('JSON functions', function() {
  describe('getValueOf', function() {
    it('should return a plain object', function() {
      const object = Object.defineProperties({}, {
        dog: { get() { return 1234; }, enumerable: true },
        cat: { get() { return 4567; }, enumerable: true },
        food: { get() { return [ 1, 2, 3, 4 ] }, enumerable: true },
        self: { get() { return this }, enumerable: true },
        $: { get() { return this } }
      });
      const result = getValueOf.call(object);
      expect(result.dog).to.equal(1234);
      expect(result.cat).to.equal(4567);
      expect(result.food).to.eql([ 1, 2, 3, 4 ]);
      expect(result.self).to.equal(result);
    })
    it('should return a number', function() {
      const object = Object.defineProperties({}, {
        $: { get() { return 1234 } }
      });
      const result = getValueOf.call(object);
      expect(result).to.equal(1234);
    })
    it('should enable correct output from JSON.stringify()', function() {
      usePrimitive();
      useStruct();
      useArray();
      useIntEx();
      useFloatEx();
      useObject();
      const structStructure = beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        size: 4 * 2,
      });
      attachMember(structStructure, {
        name: 'dog',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        byteSize: 4,
        bitOffset: 0,
        bitSize: 32,
      });
      attachMember(structStructure, {
        name: 'cat',
        type: MemberType.Int,
        isStatic: false,
        isSigned: true,
        isRequired: true,
        byteSize: 4,
        bitOffset: 32,
        bitSize: 32,
      });
      const Hello = finalizeStructure(structStructure);
      const arrayStructure = beginStructure({
        type: StructureType.Array,
        name: 'HelloArray',
        size: structStructure.size * 4,
      });
      attachMember(arrayStructure, {
        type: MemberType.Object,
        isStatic: false,
        bitSize: 64,
        byteSize: 8,
        structure: structStructure,
      });
      const HelloArray = finalizeStructure(arrayStructure);
      const structure = beginStructure({
        type: StructureType.Struct,
        name: 'Complex',
        size: arrayStructure.size + 8 * 2,
      });
      attachMember(structure, {
        name: 'animals',
        type: MemberType.Object,
        bitSize: arrayStructure.size * 8,
        bitOffset: 0,
        byteSize: arrayStructure.size,
        structure: arrayStructure,
        slot: 0,
        isRequired: true,
      });
      attachMember(structure, {
        name: 'donut',
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: arrayStructure.size * 8,
        byteSize: 8,
        isRequired: true,
      })
      attachMember(structure, {
        name: 'turkey',
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: (arrayStructure.size + 8) * 8,
        byteSize: 8,
        isRequired: true,
      });
      const Complex = finalizeStructure(structure);
      const data = {
        animals: [
          { dog: 1, cat: 2 },
          { dog: 3, cat: 4 },
          { dog: 5, cat: 6 },
          { dog: 7, cat: 8 },
        ],
        donut: 3.5,
        turkey: 1e7,
      };
      const object = new Complex(data);
      expect(JSON.stringify(object)).to.equal(JSON.stringify(data));
    })
  })
})