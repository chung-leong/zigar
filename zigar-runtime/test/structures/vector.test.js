import { expect } from 'chai';
import { MemberType, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { INITIALIZE, SLOTS } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Structure: vector', function() {
  describe('defineVector', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Vector,
        name: 'Vector',
        byteSize: 2,
        instance: {},
        static: {
          members: [],
          template: {
            [SLOTS]: {},
          }
        },
      };
      structure.instance.members = [
        {
          type: MemberType.Uint,
          bitSize: 16,
          byteSize: 1,
          structure,
        },
      ];
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineVector(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Vector,
        name: 'Vector',
        byteSize: 2,
        instance: {},
        static: {
          members: [],
          template: {
            [SLOTS]: {},
          }
        },
      };
      structure.instance.members = [
        {
          type: MemberType.Uint,
          bitSize: 16,
          byteSize: 2,
          structure,
        },
      ];
      const env = new Env();
      const descriptors = {};
      env.defineVector(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
    })
  })
  describe('finalizeVector', function() {
    it('should add static descriptors to the given object', function() {
      const structure = {
        type: StructureType.Vector,
        name: 'Vector',
        byteSize: 2,
        instance: {},
        static: {
          members: [],
          template: {
            [SLOTS]: {},
          }
        },
      };
      structure.instance.members = [
        {
          type: MemberType.Uint,
          bitSize: 16,
          byteSize: 2,
          structure,
        },
      ];
      const env = new Env();
      const descriptors = {};
      env.finalizeVector(structure, descriptors);
      expect(descriptors.child?.value).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define structure for holding an int vector', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Uint32 = env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      expect(Vector).to.be.a('function');
      expect(Vector.child).to.equal(Uint32);
      const object = new Vector(new Uint32Array([ 1, 2, 3, 4 ]));
      expect(object[0]).to.equal(1);
      object[3] *= 4;
      expect(object[3]).to.equal(16);
      expect(object.$).to.equal(object);
      expect([ ...object ]).to.eql([ 1, 2, 3, 16 ]);
      expect(object.valueOf()).to.eql([ 1, 2, 3, 16 ]);
      expect(JSON.stringify(object)).to.equal('[1,2,3,16]');
      expect(object.length).to.equal(4);
      expect(object.typedArray).to.be.instanceOf(Uint32Array);
    })
    it('should cast the same buffer to the same object', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      const buffer = new ArrayBuffer(4 * 4);
      const object1 = Vector(buffer);
      const object2 = Vector(buffer);
      expect(object2).to.equal(object1);
      const object3 = new Vector([ 1, 2, 3, 4 ]);
      const object4 = Vector(object3.dataView);
      expect(object4).to.equal(object3);
    })
    it('should throw when no initializer is provided', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Vector).to.throw(TypeError);
    })
    it('should define vector that is iterable', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      const dv = new DataView(new ArrayBuffer(4 * 8));
      dv.setUint32(0, 1234, true);
      dv.setUint32(16, 4567, true);
      const object = Vector(dv);
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 1234, 0, 0, 0, 4567, 0, 0, 0 ]);
    })
    it('should permit retrieval of indices during iteration', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 8,
        byteSize: 4 * 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      const dv = new DataView(new ArrayBuffer(4 * 8));
      dv.setUint32(0, 1234, true);
      dv.setUint32(16, 4567, true);
      const object = Vector(dv);
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
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      })
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      const buffer = new ArrayBuffer(32);
      const dv = new DataView(buffer, 16, 16);
      dv.setUint32(0, 1234, true);
      dv.setUint32(8, 5678, true);
      const vector = Vector(dv);
      expect([ ...vector ]).to.eql([ 1234, 0, 5678, 0 ]);
    })
    it('should define structure for holding an float vector', function() {
      const env = new Env();
      const floatStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'f32',
        byteSize: 4,
      })
      env.attachMember(floatStructure, {
        type: MemberType.Float,
        bitSize: 32,
        byteSize: 4,
        structure: floatStructure,
      });
      env.defineStructure(floatStructure);
      env.endStructure(floatStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: '@Vector(4, f32)',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Float,
        bitSize: 32,
        byteSize: 4,
        structure: floatStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      expect(Vector).to.be.a('function');
      const object = new Vector(new Float32Array([ 0.25, 1.5, 2.5, 3.5 ]));
      expect(object[0]).to.equal(0.25);
      object[3] *= 4;
      expect(object[3]).to.equal(14);
      expect(object.$).to.equal(object);
      expect([ ...object ]).to.eql([ 0.25, 1.5, 2.5, 14 ]);
      expect(object.length).to.equal(4);
      expect(object.typedArray).to.be.instanceOf(Float32Array);
    })
    it('should have special properties', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i64',
        byteSize: 4,
      })
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 64,
        byteSize: 8,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 3,
        byteSize: 8 * 3,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitSize: 64,
        byteSize: 8,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Vector([ 12345n, 12345n, 12345n ]);
      expect(object.dataView).to.be.an.instanceOf(DataView);
      expect(object.typedArray).to.be.an.instanceOf(BigInt64Array);
    })
    it('should not have typedArray prop when it is a 128-bit vector', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i128',
        byteSize: 16,
      })
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 128,
        byteSize: 16,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 3,
        byteSize: 16 * 3,
      });
      env.attachMember(structure, {
        type: MemberType.Int,
        bitSize: 128,
        byteSize: 16,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Vector([ 12345n, 12345n, 12345n ]);
      expect(object.dataView).to.be.an.instanceOf(DataView);
      expect(object.typedArray).to.be.undefined;
    })
    it('should allow casting to an int vector', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      })
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      expect(Vector).to.be.a('function');
      const ta = new Uint32Array([ 1, 2, 3, 4 ]);
      const object = Vector(ta);
      expect(object[0]).to.equal(1);
      object[3] *= 4;
      expect(object[3]).to.equal(16);
      expect(ta[3]).to.equal(16);
    })
    it('should initialize vector with vector of the same type', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      })
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      const object = new Vector([ 1, 2, 3, 4 ]);
      const object2 = new Vector(object);
      expect([ ...object2 ]).to.eql([ 1, 2, 3, 4 ]);
    })
    it('should initialize vector with generator', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      })
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      const generate = function*() {
        for (let i = 0; i < 4; i++) {
          yield i + 1;
        }
      };
      const object = new Vector(generate());
      expect([ ...object ]).to.eql([ 1, 2, 3, 4 ]);
    })
    it('should allow casting from an array', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
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
        structure: intStructure,
      });
      const Vector = env.defineStructure(vectorStructure)
      env.endStructure(vectorStructure)
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
        structure: intStructure,
      });
      const Array = env.defineStructure(arrayStructure);
      env.endStructure(arrayStructure);
      const array = new Array([ 1, 2, 3, 4 ]);
      const vector = Vector(array);
      expect([ ...vector ]).to.eql([ 1, 2, 3, 4 ]);
    })
    it('should throw when there is not enough initializers', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: {
          constructor: intStructure,
        },
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Vector([ 1, 2, 3 ])).to.throw(TypeError)
        .with.property('message').that.contains('4 elements')
        .and.that.contains('3 initializers');
    })
    it('should throw when initializer is of the wrong type', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Vector(1)).to.throw(TypeError)
        .with.property('message').that.contains('an array')
        .and.that.contains('Uint32Array');
    })
    it('should throw when initializer is en empty object', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Vector({})).to.throw(TypeError)
        .with.property('message').that.contains('an array')
        .and.that.contains('Uint32Array');
    })
    it('should accept special initializers', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'u32',
        byteSize: 4,
      })
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const structure = env.beginStructure({
        type: StructureType.Vector,
        name: 'Vector',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      const Vector = env.defineStructure(structure);
      env.endStructure(structure);
      const dv = new DataView(new ArrayBuffer(4 * 4));
      dv.setUint32(0, 123, true);
      dv.setUint32(4, 234, true);
      dv.setUint32(8, 345, true);
      dv.setUint32(12, 456, true);
      const object = new Vector({ dataView: dv });
      expect([ ...object ]).to.eql([ 123, 234, 345, 456 ]);
      object[2] = 777;
      // make sure a copy was made
      expect(dv.getUint32(8, true)).to.equal(345);
    })
  })
})