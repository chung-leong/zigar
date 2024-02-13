import { expect } from 'chai';

import { NodeEnvironment } from '../src/environment-node.js';
import { MemberType, useAllMemberTypes } from '../src/member.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import { ENVIRONMENT, SLOTS } from '../src/symbol.js';

describe('Enumeration functions', function() {
  const env = new NodeEnvironment();
  describe('defineEnumerationShape', function() {
    beforeEach(function() {
      useAllMemberTypes();
      useAllStructureTypes();
    })
    it('should define an enum class', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 0 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 1 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      expect(Number(Hello.Dog)).to.equal(0);
      expect(Number(Hello.Cat)).to.equal(1);
      expect(`${Hello.Dog}`).to.equal('Dog');
      expect(Hello.Dog.valueOf()).to.equal('Dog');
      expect(Hello.Dog === Hello.Dog).to.be.true;
      expect(Hello.Dog === Hello.Cat).to.be.false;
      expect(() => Hello.Dog.$ = Hello.Dog).to.throw(TypeError);
      const e = new Hello(Hello.Cat);
      expect(e.$).to.equal(Hello.Cat);
      e.$ = Hello.Dog;
      expect(e.$).to.equal(Hello.Dog);
    })
    it('should define a non-exhaustive enum class', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachMember(structure, {
        type: MemberType.Comptime,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 0 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 1 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
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
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 0 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 1 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      const buffer = new ArrayBuffer(4);
      const object1 = Hello(buffer);
      const object2 = Hello(buffer);
      expect(object2).to.equal(object1);
    })
    it('should look up the correct enum object', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 0 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 1 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      expect(Hello(0)).to.equal(Hello.Dog);
      expect(Hello(1)).to.equal(Hello.Cat);
    })
    it('should look up the correct enum object by name', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 0 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 1 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      expect(Hello('Dog')).to.equal(Hello.Dog);
      expect(Hello('Cat')).to.equal(Hello.Cat);
    })
    it('should throw when given incompatible input', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 0 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 1 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      expect(() => Hello({})).to.throw(TypeError);
      expect(() => Hello(undefined)).to.throw(TypeError);
      expect(() => Hello(Symbol.asyncIterator)).to.throw(TypeError);
    })
    it('should look up the correct enum object when values are not sequential', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 123 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 456 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      expect(Hello(123)).to.equal(Hello.Dog);
      expect(Hello(456)).to.equal(Hello.Cat);
      expect(Number(Hello(123))).to.equal(123);
      expect(Number(Hello(456))).to.equal(456);
    })
    it('should look up the correct enum object when they represent bigInts', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new BigUint64Array([ 1234n ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new BigUint64Array([ 4567n ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      expect(Hello(1234n)).to.equal(Hello.Dog);
      // BigInt suffix missing on purpose
      expect(Hello(4567)).to.equal(Hello.Cat);
    })
    it('should produce the expected output when JSON.stringify() is used', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 0 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 1 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      expect(JSON.stringify(Hello.Dog)).to.equal('"Dog"');
      expect(JSON.stringify(Hello.Cat)).to.equal('"Cat"');
      const object = new Hello(undefined);
      object.dataView.setInt32(0, -1, true);
      expect(() => JSON.stringify(object)).to.throw(TypeError);
    })
    it('should return undefined when look-up of enum item fails', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 0 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 1 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      expect(Hello(1)).to.be.instanceOf(Hello);
      expect(Hello(5)).to.be.undefined;
    })
    it('should return undefined when look-up of enum item fails', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 0 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 1 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      expect(Hello(1)).to.be.instanceOf(Hello);
      expect(Hello(5)).to.be.undefined;
    })
    it('should have correct string tag', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'zig.Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 0 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 1 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      expect(Hello.name).to.equal('zig.Hello');
      const desc = Object.prototype.toString.call(Hello.Dog);
      expect(desc).to.equal('[object zig.Hello]');
    })
    it('should throw when no initializer is provided', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.finalizeStructure(structure);
      expect(() => new Hello()).to.throw(TypeError);
    })
    it('should throw when initializer is not one of the expected types', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.finalizeStructure(structure);
      expect(() => new Hello(false)).to.throw(TypeError);
    })
    it('should accept special initializers', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 456 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 123 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      const object = new Hello({ typedArray: new Uint32Array([ 123 ])});
      expect(object.$).to.equal(Hello.Cat);
    })
    it('should throw when initializer is empty', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 456 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 123 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
      expect(() => new Hello({})).to.throw(TypeError);
    })
    it('should throw when invalid indices are encountered', function() {
      const structure = env.beginStructure({
        type: StructureType.Enumeration,
        name: 'Hello',
        byteSize: 4,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      const { constructor: Hello } = structure;
      env.attachMember(structure, {
        name: 'Dog',
        type: MemberType.Comptime,
        slot: 0,
        structure,
      }, true);
      env.attachMember(structure, {
        name: 'Cat',
        type: MemberType.Comptime,
        slot: 1,
        structure,
      }, true);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 456 ])), { writable: false }),
          1: Hello.call(ENVIRONMENT, viewOf(new Uint32Array([ 123 ])), { writable: false }),
        },
      }, true);
      env.finalizeStructure(structure);
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

function viewOf(ta) {
  return new DataView(ta.buffer);
}