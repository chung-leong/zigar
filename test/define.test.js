import { expect } from 'chai';

import { MemberType, StructureType } from '../src/type.js';
import { 
  createStructure, 
  shapeStructure,
  attachVariables, 
  attachMethods,
} from '../src/define.js';

describe('Structure definition', function() { 
  describe('Primitive', function() {
    it('should define a structure for holding a primitive', function() {
      const def = {
        size: 8,
        members: [
          {
            type: MemberType.Int,
            signed: false,
            bitSize: 64,
            bitOffset: 0,
            byteSize: 8,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setBigUint64(0, 0x7FFFFFFFFFFFFFFFn, true);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Primitive, 'Hello');
      const Hello = shapeStructure(structure, def);
      expect(Hello).to.be.a('function');
      const object = new Hello();
      expect(object.get()).to.equal(0x7FFFFFFFFFFFFFFFn);
      expect(BigInt(object)).to.equal(0x7FFFFFFFFFFFFFFFn);
    })
  })
  describe('Basic array', function() {
    it('should define structure for holding an int array', function() {
      const def = {
        size: 4 * 8,
        members: [
          {
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          }
        ],
        exposeDataView: true,
      };
      const structure = createStructure(StructureType.Array, 'Hello');
      const Hello = shapeStructure(structure, def);
      expect(Hello).to.be.a('function');
      const object = new Hello();
      object.set(0, 321);
      expect(object.get(0)).to.equal(321);
      expect(object.typedArray).to.be.instanceOf(Uint32Array);
      expect(object.length).to.equal(8);
    })
    it('should define array that is iterable', function() {
      const def = {
        size: 4 * 8,
        members: [
          {
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 8));
          dv.setUint32(0, 1234, true);
          dv.setUint32(16, 4567, true);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Array, 'Hello');
      const Hello = shapeStructure(structure, def);
      const object = new Hello();
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 1234, 0, 0, 0, 4567, 0, 0, 0 ]);
    })
  })
  describe('Simple struct', function() {
    it('should define a simple struct', function() {
      const def = {
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 32,
            byteSize: 4,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
      };      
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def);
      expect(Hello).to.be.a('function');
      const object = new Hello();
      expect(object).to.be.an.instanceOf(Object);
      expect(object).to.be.an.instanceOf(Hello);
      expect(Object.keys(object)).to.have.lengthOf(2);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
    it('should work correctly with big-endian data', function() {
      const def = {
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 32,
            byteSize: 4,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, false);
          dv.setInt32(4, 4567, false);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def, { littleEndian: false });
      const object = new Hello();
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
    it('should create functional setters', function() {
      const def = {
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 32,
            byteSize: 4,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def);
      const object = new Hello();
      object.dog = 72;
      expect(object.dog).to.equal(72);
      expect(object.cat).to.equal(4567);
      object.cat = 882;
      expect(object.cat).to.equal(882);
      expect(object.dog).to.equal(72);
    })
    it('should have dataView property when exposeDataView is true', function() {
      const def = {
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 32,
            byteSize: 4,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
        exposeDataView: true,
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def);
      const object = new Hello();
      expect(object.dataView).to.be.instanceOf(DataView);
    })
    it('should have typedArray property when exposeDataView is true and all struct members are of the same supported type', function() {
      const def = {
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 32,
            byteSize: 4,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
        exposeDataView: true,
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def);
      const object = new Hello();
      expect(object.typedArray).to.be.instanceOf(Int32Array);
      object.cat = 777;
      expect(object.typedArray[1]).to.equal(777);
    })
    it('should not have typedArray property when struct members are different', function() {
      const def = {
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 32,
            byteSize: 4,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
        exposeDataView: true,
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def);
      const object = new Hello();
      expect(object.typedArray).to.be.undefined;
    })
    it('should throw when a value exceed the maximum capability of the type', function () {
      const def = {
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 32,
            byteSize: 4,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
        exposeDataView: true,
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def);
      const object = new Hello();
      expect(() => object.dog = 0x1FFFFFFFF).to.throw();
    })
    it('should permit overflow when runtime safety is off', function () {
      const def = {
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 32,
            byteSize: 4,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
        exposeDataView: true,
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def, { runtimeSafety: false });
      const object = new Hello();
      expect(() => object.dog = 0x1FFFFFFFF).to.not.throw();
    })
  
    it('should be able to handle bitfields', function() {
      const def = {
        size: 1,
        members: [
          {
            name: 'dog',
            type: MemberType.Bool,
            bitSize: 1,
            bitOffset: 0,
            byteSize: 0,
          },
          {
            name: 'cat',
            type: MemberType.Bool,
            bitSize: 1,
            bitOffset: 1,
            byteSize: 0,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(1));
          dv.setInt8(0, 2, true);
          return dv;
        })(),
        exposeDataView: true,
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def);
      const object = new Hello();
      expect(object.dog).to.be.false;
      expect(object.cat).to.be.true;
      expect(object.typedArray).to.be.undefined;
      object.dog = true;
      object.cat = false;
      expect(object.dog).to.be.true;
      expect(object.cat).to.be.false;
    })
    it('should be able to handle small int type', function() {
      const def = {
        size: 1,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            signed: false,
            bitSize: 2,
            bitOffset: 0,
            byteSize: 0,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            signed: true,
            bitSize: 3,
            bitOffset: 2,
            byteSize: 0,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(1));
          dv.setInt8(0, 7, true);
          return dv;
        })(),
        exposeDataView: true,
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def);
      const object = new Hello();
      expect(object.dog).to.equal(3);
      expect(object.cat).to.equal(1);
      expect(() => object.dog = 4).to.throw();
      expect(() => object.cat = 4).to.throw();
      expect(() => object.cat = -3).to.not.throw();
      expect(object.cat).to.equal(-3);
      object.cat = 1;
      expect(object.cat).to.equal(1);
      expect(object.dog).to.equal(3);
    }) 
    it('should be able to handle bit-misalignment', function() {
      const def = {
        size: 5,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            signed: false,
            bitSize: 2,
            bitOffset: 0,
            byteSize: 0,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 2,
            byteSize: 0,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(5));
          dv.setUint32(0, 8, true);
          return dv;
        })(),
        exposeDataView: true,
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def);
      const object = new Hello();
      expect(object.dog).to.equal(0);
      debugger;
      expect(object.cat).to.equal(2);
      // TODO
    }) 
  })
  describe('Complex Struct', function() {
    it('should define a struct that contains pointers', function() {
      const intStructure = createStructure(StructureType.Primitive, 'Int32');
      const Int32 = shapeStructure(intStructure, {
        size: 4,
        members: [
          {
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          }
        ],
      });
      const number1 = new Int32();
      const number2 = new Int32();
      number1.set(1234);
      number2.set(4567);
      const def = {
        size: 8 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Pointer,
            bitSize: 64,
            bitOffset: 0,
            byteSize: 8,
            slot: 0,
            structure: intStructure,
          },
          {
            name: 'cat',
            type: MemberType.Pointer,
            bitSize: 64,
            bitOffset: 64,
            byteSize: 8,
            slot: 1,
            structure: intStructure,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(8 * 2));
          dv.setBigUint64(0, 0xaaaaaaaaaaaaaaaan, true);
          dv.setBigUint64(8, 0xaaaaaaaaaaaaaaaan, true);
          return dv;
        })(),
        defaultPointers: { 
          0: number1, 
          1: number2 
        },
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def);
      const object = new Hello();
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
  })
  describe('Simple extern union', function() {
    it('should define a simple extern union', function() {
      const def = {
        size: 4,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4));
          dv.setInt32(0, 1234, true);
          return dv;
        })(),
      };      
      const structure = createStructure(StructureType.ExternUnion, 'Hello');
      const Hello = shapeStructure(structure, def);
      expect(Hello).to.be.a('function');
      const object = new Hello();
      expect(object).to.be.an.instanceOf(Object);
      expect(object).to.be.an.instanceOf(Hello);
      expect(Object.keys(object)).to.have.lengthOf(2);
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(1234);
      object.dog = 777;
      expect(object.dog).to.equal(777);
      expect(object.cat).to.equal(777);
    })
  })
  describe('Enumeration', function() {
    it('should define an enum class', function() {
      const def = {
        type: StructureType.Enumeration,
        members: [
          {
            name: 'Dog',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Enumeration, 'Hello');
      const Hello = shapeStructure(structure, def);
      expect(Number(Hello.Dog)).to.equal(0);
      expect(Number(Hello.Cat)).to.equal(1);
      expect(Hello.Dog === Hello.Dog).to.be.true;
      expect(Hello.Dog === Hello.Cat).to.be.false;
    })
    it('should look up the correct enum object', function() {
      const def = {
        type: StructureType.Enumeration,
        members: [
          {
            name: 'Dog',
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Enumeration, 'Hello');
      const Hello = shapeStructure(structure, def);
      expect(Hello(0)).to.equal(Hello.Dog);
      expect(Hello(1)).to.equal(Hello.Cat);
    })
    it('should look up the correct enum object when values are not sequential', function() {
      const def = {
        members: [
          {
            name: 'Dog',
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 123, true);
          dv.setUint32(4, 456, true);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Enumeration, 'Hello');
      const Hello = shapeStructure(structure, def);
      expect(Hello(123)).to.equal(Hello.Dog);
      expect(Hello(456)).to.equal(Hello.Cat);
      expect(Number(Hello(123))).to.equal(123);
      expect(Number(Hello(456))).to.equal(456);
    })
    it('should look up the correct enum object when they represent bigInts', function() {
      const def = {
        members: [
          {
            name: 'Dog',
            type: MemberType.Int,
            signed: false,
            bitSize: 64,
            bitOffset: 0,
            byteSize: 8,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            signed: false,
            bitSize: 64,
            bitOffset: 0,
            byteSize: 8,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(8 * 2));
          dv.setBigUint64(0, 1234n, true);
          dv.setBigUint64(8, 4567n, true);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Enumeration, 'Hello');
      const Hello = shapeStructure(structure, def);
      expect(Hello(1234n)).to.equal(Hello.Dog);
      // BigInt suffix missing on purpose
      expect(Hello(4567)).to.equal(Hello.Cat);
    })
    it('should produce the expect output when JSON.stringify() is used', function() {
      const def = {
        members: [
          {
            name: 'Dog',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Enumeration, 'Hello');
      const Hello = shapeStructure(structure, def);
      expect(JSON.stringify(Hello.Dog)).to.equal('0');
      expect(JSON.stringify(Hello.Cat)).to.equal('1');
    })
    it('should throw when the new operator is used on the constructor', function() {
      const def = {
        members: [
          {
            name: 'Dog',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Enumeration, 'Hello');
      const Hello = shapeStructure(structure, def);
      expect(() => new Hello(5)).to.throw();
    })
    it('should return undefined when look-up of enum item fails', function() {
      const def = {
        members: [
          {
            name: 'Dog',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Enumeration, 'Hello');
      const Hello = shapeStructure(structure, def);
      expect(Hello(1)).to.be.an('object');
      expect(Hello(5)).to.be.undefined;
    })
  }) 
  describe('Static variables', function() {
    it('should attach variables to a struct', function() {
      const def = {
        size: 8 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 32,
            byteSize: 4,
          },
        ],
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def);
      // define structure for integer variables
      // in practice this structure will have a SharedArrayBuffer that points to 
      // memory in the Zig code's data segment; we'll test with a regular 
      // ArrayBuffer here
      const intStructure = createStructure(StructureType.Primitive, 'Int32');
      const Int32 = shapeStructure(intStructure, {
        size: 4,
        members: [
          {
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          }
        ],
      });
      const number1 = new Int32();
      const number2 = new Int32();
      number1.set(1234);
      number2.set(4567);
      // the "static structure" doesn't have binary data attach to it, 
      // since it does not appear on the Zig side; hence no need to 
      // provide a size (or defaultData); we only need the slot numbers
      const staticDef = {
        members: [
          {
            name: 'superdog',
            type: MemberType.Pointer,
            bitSize: 64,
            bitOffset: 0,
            byteSize: 8,
            slot: 0,
            structure: intStructure,
            mutable: true,
          },
          {
            name: 'supercat',
            type: MemberType.Pointer,
            bitSize: 64,
            bitOffset: 64,
            byteSize: 8,
            slot: 1,
            structure: intStructure,
            mutable: false,
          },
        ],
        defaultPointers: { 
          0: number1, 
          1: number2 
        },
      };
      attachVariables(structure, staticDef);
      expect(Hello.superdog).to.equal(1234);
      Hello.superdog = 43;
      expect(Hello.superdog).to.equal(43);
      expect(Hello.supercat).to.equal(4567);
      expect(() => Hello.supercat = 777).to.throw();
      expect(Hello.supercat).to.equal(4567);
      const object = new Hello();
      expect(object.dog).to.equal(0);
      object.dog = 123;
      expect(object.dog).to.equal(123);
      expect(Hello.superdog).to.equal(43);
    })
    it('should attach variables to an enumeration', function() {
      const def = {
        members: [
          {
            name: 'Dog',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Enumeration, 'Hello');
      const Hello = shapeStructure(structure, def);
      const intStructure = createStructure(StructureType.Primitive, 'Int32');
      const Int32 = shapeStructure(intStructure, {
        size: 4,
        members: [
          {
            type: MemberType.Int,
            signed: false,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          }
        ],
      });
      const number1 = new Int32();
      const number2 = new Int32();
      number1.set(1234);
      number2.set(4567);
      const staticDef = {
        members: [
          {
            name: 'superdog',
            type: MemberType.Pointer,
            bitSize: 64,
            bitOffset: 0,
            byteSize: 8,
            slot: 0,
            structure: intStructure,
            mutable: true,
          },
          {
            name: 'supercat',
            type: MemberType.Pointer,
            bitSize: 64,
            bitOffset: 64,
            byteSize: 8,
            slot: 1,
            structure: intStructure,
            mutable: false,
          },
        ],
        defaultPointers: { 
          0: number1, 
          1: number2 
        },
      };
      attachVariables(structure, staticDef);
      expect(Hello.superdog).to.equal(1234);
      Hello.superdog = 43;
      expect(Hello.superdog).to.equal(43);
      expect(Hello.supercat).to.equal(4567);
      // make sure the variables aren't overwriting the enum slots
      expect(Hello(0)).to.equal(Hello.Dog);
      expect(Hello(1)).to.equal(Hello.Cat);
    })
  })
  describe('Methods', function() {
    it('should attach methods to a struct', function() {
      const def = {
        size: 8,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 32,
            byteSize: 4,
          },
        ]
      };
      const structure = createStructure(StructureType.Struct, 'Hello');
      const Hello = shapeStructure(structure, def);
      const object = new Hello();
      // argument struct
      const argDef = {
        type: StructureType.Struct,
        size: 12,
        members: [
          {
            name: '0',
            type: MemberType.Compound,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 8,
            structure,
          },
          {
            name: 'return_value',
            type: MemberType.Int,
            signed: true,
            bitSize: 32,
            bitOffset: 64,
            byteSize: 4,
          },
        ],
      };
      const thunk = (args) => {
        args.return_value = args[0].dog + args[0].cat;
      };
      const argStructure = createStructure(StructureType.Struct, undefined);
      const argStruct = shapeStructure(argStructure, argDef);
      const methods = [
        {
          name: 'merge',
          argStruct,
          staticOnly: false,
          thunk, 
        },
      ];
      attachMethods(structure, { methods });
      expect(Hello.merge).to.be.a('function');
      expect(Hello.merge).to.have.property('name', 'merge');
      expect(Hello.prototype.merge).to.be.a('function');
      expect(Hello.prototype.merge).to.have.property('name', 'merge');
      object.dog = 10;
      object.cat = 13;
      const res1 = object.merge();
      expect(res1).to.equal(23);
      const res2 = Hello.merge(object);
      expect(res2).to.equal(23);
    })
    it('should attach methods to enum items', function() {
      const def = {
        size: 4,
        members: [
          {
            name: 'Dog',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const structure = createStructure(StructureType.Enumeration, 'Hello');
      const Hello = shapeStructure(structure, def);
      // argument struct
      const argDef = {
        type: StructureType.Struct,
        size: 12,
        members: [
          {
            name: '0',
            type: MemberType.Enum,
            bitSize: 32,
            bitOffset: 0,
            byteSize: 4,
            structure,
          },
          {
            name: '1',
            type: MemberType.Int,
            bitSize: 32,
            bitOffset: 32,
            byteSize: 4,
          },
          {
            name: 'return_value',
            type: MemberType.Bool,
            bitSize: 1,
            bitOffset: 64,
            byteSize: 1,
          },
        ],
      };
      let arg1, arg2;
      const thunk = (args) => {
        arg1 = args[0];
        arg2 = args[1];
        args.return_value = true;
      };
      const argStructure = createStructure(StructureType.Struct, undefined);
      const argStruct = shapeStructure(argStructure, argDef);
      const methods = [
        {
          name: 'foo',
          argStruct,
          staticOnly: false,
          thunk, 
        },
      ];
      attachMethods(structure, { methods });
      expect(Hello.foo).to.be.a('function');
      expect(Hello.foo).to.have.property('name', 'foo');
      expect(Hello.prototype.foo).to.be.a('function');
      expect(Hello.prototype.foo).to.have.property('name', 'foo');
      const res1 = Hello.Cat.foo(1234);
      expect(res1).to.be.true;
      expect(arg1).to.equal(Hello.Cat);
      expect(arg2).to.equal(1234);
      const res2 = Hello.foo(Hello.Dog, 4567);
      expect(res2).to.be.true;
      expect(arg1).to.equal(Hello.Dog);
      expect(arg2).to.equal(4567);
    }) 
  })
})