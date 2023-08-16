import { expect } from 'chai';

import {
  MemberType,
  useFloatEx,
  useIntEx,
} from '../src/member.js';
import {
  StructureType,
  useVector,
  beginStructure,
  attachMember,
  finalizeStructure,
} from '../src/structure.js';

describe('Vector functions', function() {
  describe('finalizeVector', function() {
    beforeEach(function() {
      useVector();
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
        isStatic: false,
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
    it('should define structure for holding an float vector', function() {
      const structure = beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        size: 4 * 4,
      });
      attachMember(structure, {
        type: MemberType.Float,
        isStatic: false,
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
    it('should allow casting to an int vector', function() {
      const structure = beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        size: 4 * 4,
      });
      attachMember(structure, {
        type: MemberType.Int,
        isStatic: false,
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
        isStatic: false,
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
        isStatic: false,
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
        isStatic: false,
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
        isStatic: false,
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
        isStatic: false,
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
