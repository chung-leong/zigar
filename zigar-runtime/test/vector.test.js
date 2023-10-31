import { expect } from 'chai';

import {
  MemberType,
  useFloatEx,
  useIntEx,
  useUintEx,
} from '../src/member.js';
import {
  StructureType,
  useVector,
  useArray,
} from '../src/structure.js';
import { BaseEnvironment } from '../src/environment.js'

describe('Vector functions', function() {
  const env = new BaseEnvironment();
  describe('finalizeVector', function() {
    beforeEach(function() {
      useVector();
      useArray();
      useIntEx();
      useUintEx();
      useFloatEx();
    })
    it('should define structure for holding an int vector', function() {
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 4,
        byteSize: 4 * 4,
      });
      const constructor = function() {};
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array },
      });
      const Hello = env.finalizeStructure(structure);
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
    it('should throw when no initializer is provided', function() {
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 4,
        byteSize: 4 * 4,
      });
      const constructor = function() {};
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array },
      });
      const Hello = env.finalizeStructure(structure);
      expect(() => new Hello).to.throw(TypeError);
    })
    it('should define vector that is iterable', function() {
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array },
      });
      const Hello = env.finalizeStructure(structure);
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
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array },
      });
      const Hello = env.finalizeStructure(structure);
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
    it('should correctly cast a data view with byteOffset', function() {
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 4,
        byteSize: 4 * 4,
      });
      const constructor = function() {};
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array },
      });
      const Hello = env.finalizeStructure(structure);
      const buffer = new ArrayBuffer(32);
      const dv = new DataView(buffer, 16, 16);
      dv.setUint32(0, 1234, true);
      dv.setUint32(8, 5678, true);
      const vector = Hello(dv);
      expect([ ...vector ]).to.eql([ 1234, 0, 5678, 0 ]);
    })
    it('should define structure for holding an float vector', function() {
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Float,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Float32Array },
      });
      const Hello = env.finalizeStructure(structure);
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
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 3,
        byteSize: 8 * 3,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitSize: 64,
        byteSize: 8,
        structure: { constructor, typedArray: BigInt64Array },
      });
      const Hello = env.finalizeStructure(structure);
      const object = new Hello([ 12345n, 12345n, 12345n ]);
      expect(object.dataView).to.be.an.instanceOf(DataView);
      expect(object.typedArray).to.be.an.instanceOf(BigInt64Array);
    })
    it('should not have typedArray prop when it is a 128-bit vector', function() {
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 3,
        byteSize: 16 * 3,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitSize: 128,
        byteSize: 16,
        structure: { constructor, typedArray: null },
      });
      const Hello = env.finalizeStructure(structure);
      const object = new Hello([ 12345n, 12345n, 12345n ]);
      expect(object.dataView).to.be.an.instanceOf(DataView);
      expect(object.typedArray).to.be.undefined;
    })
    it('should allow casting to an int vector', function() {
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array },
      });
      const Hello = env.finalizeStructure(structure);
      expect(Hello).to.be.a('function');
      const ta = new Uint32Array([ 1, 2, 3, 4 ]);
      const object = Hello(ta);
      expect(object[0]).to.equal(1);
      object[3] *= 4;
      expect(object[3]).to.equal(16);
      expect(ta[3]).to.equal(16);
    })
    it('should initialize vector with vector of the same type', function() {
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array },
      });
      const Hello = env.finalizeStructure(structure);
      const object = new Hello([ 1, 2, 3, 4 ]);
      const object2 = new Hello(object);
      expect([ ...object2 ]).to.eql([ 1, 2, 3, 4 ]);
    })
    it('should initialize vector with generator', function() {
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor, typedArray: Uint32Array },
      });
      const Hello = env.finalizeStructure(structure);
      const generate = function*() {
        for (let i = 0; i < 4; i++) {
          yield i + 1;
        }
      };
      const object = new Hello(generate());
      expect([ ...object ]).to.eql([ 1, 2, 3, 4 ]);
    })

    it('should allow casting from an array', function() {
      const Uint32 = function() {};
      const vectorStructure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(vectorStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: Uint32, typedArray: Uint32Array },
      });
      const Vector = env.finalizeStructure(vectorStructure);
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        name: 'Array',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: { constructor: Uint32 },
      });
      const Array = env.finalizeStructure(arrayStructure);
      const array = new Array([ 1, 2, 3, 4 ]);
      const vector = Vector(array);
      expect([ ...vector ]).to.eql([ 1, 2, 3, 4 ]);
    })
    it('should throw when there is not enough initializers', function() {
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: {
          constructor: function() {},
        },
      });
      const Hello = env.finalizeStructure(structure);
      expect(() => new Hello([ 1, 2, 3 ])).to.throw(TypeError)
        .with.property('message').that.contains('4 elements')
        .and.that.contains('3 initializers');
    })
    it('should throw when initializer is of the wrong type', function() {
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Hello',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: {
          constructor: function() {},
          typedArray: Uint32Array,
        },
      });
      const Hello = env.finalizeStructure(structure);
      expect(() => new Hello(1)).to.throw(TypeError)
        .with.property('message').that.contains('an array')
        .and.that.contains('Uint32Array');
    })
  })
})
