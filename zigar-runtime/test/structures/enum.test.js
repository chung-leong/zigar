import { expect } from 'chai';
import { EnumFlag, MemberFlag, MemberType, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { CAST, ENVIRONMENT, INITIALIZE, MEMORY, SLOTS } from '../../src/symbols.js';

const Env = defineEnvironment();

describe('Structure: enum', function() {
  describe('defineEnum', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Enum,
        byteSize: 1,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 8,
          bitOffset: 0,
          byteSize: 1,
          structure,
        },
      ];
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineEnum(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Enum,
        byteSize: 1,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 8,
          bitOffset: 0,
          byteSize: 1,
          structure,
        },
      ];
      const env = new Env();
      const descriptors = {};
      env.defineEnum(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
    })
  })
  describe('finalizeEnum', function() {
    it('should add static descriptors to the given object', function() {
      const structure = {
        type: StructureType.Enum,
        byteSize: 1,
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
          type: MemberType.Int,
          bitSize: 8,
          bitOffset: 0,
          byteSize: 1,
          structure,
        },
      ];
      const env = new Env();
      const descriptors = {};
      env.finalizeEnum(structure, descriptors);
      expect(descriptors[CAST]?.value).to.be.a('function');
    })
    it('should add descriptors for items in enum set', function() {
      const structure = {
        type: StructureType.Enum,
        byteSize: 1,
        instance: {},
        static: {},
      };
      structure.instance.members = [
        {
          type: MemberType.Int,
          bitSize: 8,
          bitOffset: 0,
          byteSize: 1,
          structure,
        },
      ];
      structure.static.members = [
        {
          name: 'dog',
          type: MemberType.Object,
          flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
          slot: 0,
        },
        {
          name: 'cat',
          type: MemberType.Object,
          flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
          slot: 1,
        },
      ];
      const Item = function(number) {
        this[MEMORY] = new DataView(new ArrayBuffer(1));
        this[MEMORY].setInt8(0, number);
      };
      const dog = new Item(77);
      const cat = new Item(88);
      structure.static.template = {
        [SLOTS]: {
          0: dog,
          1: cat
        },
      };
      const env = new Env();
      const descriptors = {};
      env.finalizeEnum(structure, descriptors);
      expect(descriptors.dog?.value).to.be.an('object');
      expect(descriptors.cat?.value).to.be.an('object');
    })
  })
  describe('defineStructure', function() {
    it('should define an enum class', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 0 ])),
          1: createInstance(env, structure, new Uint32Array([ 1 ])),
        },
      }, true);
      env.finishStructure(structure);
      expect(Number(Hello.Dog)).to.equal(0);
      expect(Number(Hello.Cat)).to.equal(1);
      expect(`${Hello.Dog}`).to.equal('Dog');
      expect(Hello.Dog + '').to.equal('Dog');
      expect(Hello.Dog.valueOf()).to.equal('Dog');
      expect(Hello.Dog.toString()).to.equal('Dog');
      expect(Hello.Dog === Hello.Dog).to.be.true;
      expect(Hello.Dog === Hello.Cat).to.be.false;
      expect(() => Hello.Dog.$ = Hello.Dog).to.throw(TypeError);
      const e = new Hello(Hello.Cat);
      expect(e.$).to.equal(Hello.Cat);
      e.$ = Hello.Dog;
      expect(e.$).to.equal(Hello.Dog);
    })
    it('should define a non-exhaustive enum class', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        flags: EnumFlag.IsOpenEnded,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachMember(structure, {
        type: MemberType.Object,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 0 ])),
          1: createInstance(env, structure, new Uint32Array([ 1 ])),
        },
      }, true);
      env.finishStructure(structure);
      expect(Number(Hello.Dog)).to.equal(0);
      expect(Number(Hello.Cat)).to.equal(1);
      const e1 = new Hello(3);
      expect(Number(e1)).to.equal(3);
      e1.$ = 2;
      expect(Number(e1)).to.equal(2);
      const e2 = new Hello(2);
      expect(e1.$).to.equal(e2.$);
      expect(String(e1)).to.equal('2');
    })
    it('should cast the same buffer to the same object', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 0 ])),
          1: createInstance(env, structure, new Uint32Array([ 1 ])),
        },
      }, true);
      env.finishStructure(structure);
      const buffer = new ArrayBuffer(4);
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
    })
    it('should work correctly in an array', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 0 ])),
          1: createInstance(env, structure, new Uint32Array([ 1 ])),
        },
      }, true);
      env.finishStructure(structure);
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        name: '[4]Hello',
        length: 4,
        byteSize: 4 * 4,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        byteSize: 4,
        structure,
      });
      const HelloArray = env.defineStructure(arrayStructure);
      env.finishStructure(arrayStructure);
      const array = new HelloArray([ Hello.Dog, Hello.Cat, Hello.Dog, Hello.Dog ]);
      expect(array.valueOf()).to.eql([ 'Dog', 'Cat', 'Dog', 'Dog' ]);
      expect(array[1]).to.equal(Hello.Cat);
      expect(() => array[1] = 'Dog').to.not.throw();
      expect(array.valueOf()).to.eql([ 'Dog', 'Dog', 'Dog', 'Dog' ]);
    })
    it('should look up the correct enum object', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 0 ])),
          1: createInstance(env, structure, new Uint32Array([ 1 ])),
        },
      }, true);
      env.finishStructure(structure);
      expect(Hello(0)).to.equal(Hello.Dog);
      expect(Hello(1)).to.equal(Hello.Cat);
    })
    it('should look up the correct enum object by name', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 0 ])),
          1: createInstance(env, structure, new Uint32Array([ 1 ])),
        },
      }, true);
      env.finishStructure(structure);
      expect(Hello('Dog')).to.equal(Hello.Dog);
      expect(Hello('Cat')).to.equal(Hello.Cat);
    })
    it('should throw when given incompatible input', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 0 ])),
          1: createInstance(env, structure, new Uint32Array([ 1 ])),
        },
      }, true);
      env.finishStructure(structure);
      expect(() => Hello({})).to.throw(TypeError);
      expect(() => Hello(undefined)).to.throw(TypeError);
      expect(() => Hello(Symbol.asyncIterator)).to.throw(TypeError);
    })
    it('should look up the correct enum object when values are not sequential', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 123 ])),
          1: createInstance(env, structure, new Uint32Array([ 456 ])),
        },
      }, true);
      env.finishStructure(structure);
      expect(Hello(123)).to.equal(Hello.Dog);
      expect(Hello(456)).to.equal(Hello.Cat);
      expect(Number(Hello(123))).to.equal(123);
      expect(Number(Hello(456))).to.equal(456);
    })
    it('should look up the correct enum object when they represent bigInts', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new BigUint64Array([ 1234n ])),
          1: createInstance(env, structure, new BigUint64Array([ 4567n ])),
        },
      }, true);
      env.finishStructure(structure);
      expect(Hello(1234n)).to.equal(Hello.Dog);
      // BigInt suffix missing on purpose
      expect(Hello(4567)).to.equal(Hello.Cat);
    })
    it('should produce the expected output when JSON.stringify() is used', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 0 ])),
          1: createInstance(env, structure, new Uint32Array([ 1 ])),
        },
      }, true);
      env.finishStructure(structure);
      expect(JSON.stringify(Hello.Dog)).to.equal('"Dog"');
      expect(JSON.stringify(Hello.Cat)).to.equal('"Cat"');
      const object = new Hello(undefined);
      object.dataView.setInt32(0, -1, true);
      expect(() => object.valueOf()).to.throw(TypeError);
      expect(() => JSON.stringify(object)).to.not.throw();
      expect(JSON.stringify(object)).to.contain("error");
    })
    it('should return undefined when look-up of enum item fails', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 0 ])),
          1: createInstance(env, structure, new Uint32Array([ 1 ])),
        },
      }, true);
      env.finishStructure(structure);
      expect(Hello(1)).to.be.instanceOf(Hello);
      expect(Hello(5)).to.be.undefined;
    })
    it('should return undefined when look-up of enum item fails', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 0 ])),
          1: createInstance(env, structure, new Uint32Array([ 1 ])),
        },
      }, true);
      env.finishStructure(structure);
      expect(Hello(1)).to.be.instanceOf(Hello);
      expect(Hello(5)).to.be.undefined;
    })
    it('should have correct string tag', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        name: 'zig.Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 0 ])),
          1: createInstance(env, structure, new Uint32Array([ 1 ])),
        },
      }, true);
      env.finishStructure(structure);
      expect(Hello.name).to.equal('zig.Hello');
      const desc = Object.prototype.toString.call(Hello.Dog);
      expect(desc).to.equal('[object zig.Hello]');
    })
    it('should throw when no initializer is provided', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachTemplate(structure, {
        [SLOTS]: {},
      }, true);
      env.finishStructure(structure);
      expect(() => new Hello()).to.throw(TypeError);
    })
    it('should throw when initializer is not one of the expected types', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachTemplate(structure, {
        [SLOTS]: {},
      }, true);
      env.finishStructure(structure);
      expect(() => new Hello(false)).to.throw(TypeError);
    })
    it('should throw when initializer is empty', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 456 ])),
          1: createInstance(env, structure, new Uint32Array([ 123 ])),
        },
      }, true);
      env.finishStructure(structure);
      expect(() => new Hello({})).to.throw(TypeError);
    })
    it('should throw when invalid indices are encountered', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Enum,
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure,
      });
      const Hello = env.defineStructure(structure);
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Object,
        flags: MemberFlag.IsPartOfSet | MemberFlag.IsReadOnly,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: createInstance(env, structure, new Uint32Array([ 456 ])),
          1: createInstance(env, structure, new Uint32Array([ 123 ])),
        },
      }, true);
      env.finishStructure(structure);
      const dv = new DataView(new ArrayBuffer(structure.byteSize));
      dv.setUint32(0, 1234, true);
      const object = Hello(dv);
      expect(() => object.$).to.throw(TypeError)
        .with.property('message').that.contains('1234');
      dv.setUint32(0, 123, true);
      expect(object.$).to.equal(Hello.Cat);
      expect(() => object.$ = 4567).to.throw(TypeError)
        .with.property('message').that.contains('4567');
      object.$ = 456;
      expect(object.$).to.equal(Hello.Dog);
    })
  })
})

function createInstance(env, structure, ta) {
  const { constructor } = structure;
  const dv = new DataView(ta.buffer);
  const object = constructor.call(ENVIRONMENT, dv);
  env.makeReadOnly(object);
  return object;
}