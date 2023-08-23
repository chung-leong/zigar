import { expect } from 'chai';

import {
  MemberType,
  useFloatEx,
  useIntEx,
} from '../src/member.js';
import {
  StructureType,
  useVector,
  useArray,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';

describe('Vector functions', function() {
  describe('finalizeVector', function() {
    beforeEach(function() {
      useVector();
      useArray();
      useIntEx();
      useFloatEx();
    })
    it('should define structure for holding an int vector', function() {
      const structure = beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        size: 4 * 4,
      });
      const constructor = function() {};
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor },
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      expect(Hello.child).to.equal(constructor);
      const object = new Hello(new Uint32Array([ 1, 2, 3, 4 ]));
      expect(object[0]).to.equal(1);
      object[3] *= 4;
      expect(object[3]).to.equal(16);
      expect(object.$).to.equal(object);
      expect([ ...object ]).to.eql([ 1, 2, 3, 16 ]);
      expect(object.length).to.equal(4);
      expect(object.typedArray).to.be.instanceOf(Uint32Array);
    })
    it('should define vector that is iterable', function() {
      const structure = beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        size: 4 * 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      const dv = new DataView(new ArrayBuffer(4 * 8));
      dv.setUint32(0, 1234, true);
      dv.setUint32(16, 4567, true);
      const object = Hello(dv);
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 1234, 0, 0, 0, 4567, 0, 0, 0 ]);
    })
    it('should permit retrieval of indices during iteration', function() {
      const structure = beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        size: 4 * 8,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      const dv = new DataView(new ArrayBuffer(4 * 8));
      dv.setUint32(0, 1234, true);
      dv.setUint32(16, 4567, true);
      const object = Hello(dv);
      const indexList = [];
      const valueList = [];
      for (const [ index, value ] of object.entries()) {
        indexList.push(index);
        valueList.push(value);
      }
      expect(indexList).to.eql([ 0, 1, 2, 3, 4, 5, 6, 7 ]);
      expect(valueList).to.eql([ 1234, 0, 0, 0, 4567, 0, 0, 0 ]);
    })
    it('should define structure for holding an float vector', function() {
      const structure = beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        size: 4 * 4,
      });
      attachMember(structure, {
        type: MemberType.Float,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const object = new Hello(new Float32Array([ 0.25, 1.5, 2.5, 3.5 ]));
      expect(object[0]).to.equal(0.25);
      object[3] *= 4;
      expect(object[3]).to.equal(14);
      expect(object.$).to.equal(object);
      expect([ ...object ]).to.eql([ 0.25, 1.5, 2.5, 14 ]);
      expect(object.length).to.equal(4);
      expect(object.typedArray).to.be.instanceOf(Float32Array);
    })
    it('should have special properties', function() {
      const structure = beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        size: 8 * 3,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 64,
        byteSize: 8,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello([ 12345n, 12345n, 12345n ]);
      expect(object.dataView).to.be.an.instanceOf(DataView);
      expect(object.typedArray).to.be.an.instanceOf(BigInt64Array);
    })
    it('should not have typedArray prop when it is a 128-bit vector', function() {
      const structure = beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        size: 16 * 3,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 128,
        byteSize: 16,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello([ 12345n, 12345n, 12345n ]);
      expect(object.dataView).to.be.an.instanceOf(DataView);
      expect(object.typedArray).to.be.undefined;
    })
    it('should allow casting to an int vector', function() {
      const structure = beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        size: 4 * 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const ta = new Uint32Array([ 1, 2, 3, 4 ]);
      const object = Hello(ta);
      expect(object[0]).to.equal(1);
      object[3] *= 4;
      expect(object[3]).to.equal(16);
      expect(ta[3]).to.equal(16);
    })
    it('should initialize vector with vector of the same type', function() {
      const structure = beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        size: 4 * 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
      });
      const Hello = finalizeStructure(structure);
      const object = new Hello([ 1, 2, 3, 4 ]);
      const object2 = new Hello(object);
      expect([ ...object2 ]).to.eql([ 1, 2, 3, 4 ]);
    })
    it('should allow casting from an array', function() {
      const Uint32 = function() {};
      const vectorStructure = beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        size: 4 * 4,
      });
      attachMember(vectorStructure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: Uint32 },
      });
      const Vector = finalizeStructure(vectorStructure);
      const arrayStructure = beginStructure({
        type: StructureType.Array,
        name: 'Array',
        size: 4 * 4,
      });
      attachMember(arrayStructure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: Uint32 },
      });
      const Array = finalizeStructure(arrayStructure);
      const array = new Array([ 1, 2, 3, 4 ]);
      const vector = Vector(array);
      expect([ ...vector ]).to.eql([ 1, 2, 3, 4 ]);
    })
    it('should throw when there is not enough initializers', function() {
      const structure = beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        size: 4 * 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
        structure: {
          constructor: function() {},
        },
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello([ 1, 2, 3 ])).to.throw(TypeError)
        .with.property('message').that.contains('4 elements')
        .and.that.contains('3 initializers');
    })
    it('should throw when initializer is of the wrong type', function() {
      const structure = beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        size: 4 * 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isSigned: false,
        bitSize: 32,
        byteSize: 4,
        structure: {
          constructor: function() {},
        },
      });
      const Hello = finalizeStructure(structure);
      expect(() => new Hello(1)).to.throw(TypeError)
        .with.property('message').that.contains('an array')
        .and.that.contains('Uint32Array');
    })
  })
})
