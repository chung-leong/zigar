import { expect } from 'chai';

import { MemberType, StructureType } from '../src/types.js';
import { defineStructure } from '../src/define.js';

describe('Structure definition', function() { 
  describe('Primitive', function() {
    it('should define a structure for holding a primitive', function() {
      const def = {
        type: StructureType.Primitive,
        size: 8,
        members: [
          {
            type: MemberType.Int,
            bits: 64,
            bitOffset: 0,
            align: 8,
            signed: false,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setBigUint64(0, 0x7FFFFFFFFFFFFFFFn, true);
          return dv;
        })(),
      };
      const Hello = defineStructure(def);
      expect(Hello).to.be.a('function');
      const object = new Hello();
      expect(object.get()).to.equal(0x7FFFFFFFFFFFFFFFn);
      expect(BigInt(object)).to.equal(0x7FFFFFFFFFFFFFFFn);
    })
  })
  describe('Basic Array', function() {
    it('should define structure for holding an int array', function() {
      const def = {
        type: StructureType.Array,
        size: 4 * 8,
        members: [
          {
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
            signed: false,
          }
        ],
        exposeDataView: true,
      };
      const Hello = defineStructure(def);
      expect(Hello).to.be.a('function');
      const object = new Hello();
      object.set(0, 321);
      expect(object.get(0)).to.equal(321);
      expect(object.typedArray).to.be.instanceOf(Uint32Array);
      expect(object.length).to.equal(8);
    })
    it('should define array that is iterable', function() {
      const def = {
        type: StructureType.Array,
        size: 4 * 8,
        members: [
          {
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
            signed: false,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 8));
          dv.setUint32(0, 1234, true);
          dv.setUint32(16, 4567, true);
          return dv;
        })(),
      };
      const Hello = defineStructure(def);
      const object = new Hello();
      const list = [];
      for (const value of object) {
        list.push(value);
      }
      expect(list).to.eql([ 1234, 0, 0, 0, 4567, 0, 0, 0 ]);
    })
  })
  describe('Simple Struct', function() {
    it('should define a simple struct', function() {
      const def = {
        type: StructureType.Struct,
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
            signed: true,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 32,
            align: 4,
            signed: true,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
      };
      const Hello = defineStructure(def);
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
        type: StructureType.Struct,
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
            signed: true,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 32,
            align: 4,
            signed: true,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, false);
          dv.setInt32(4, 4567, false);
          return dv;
        })(),
      };
      const Hello = defineStructure(def, { littleEndian: false });
      const object = new Hello();
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
    })
    it('should create functional setters', function() {
      const def = {
        type: StructureType.Struct,
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
            signed: true,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 32,
            align: 4,
            signed: true,
          }
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setInt32(0, 1234, true);
          dv.setInt32(4, 4567, true);
          return dv;
        })(),
      };
      const Hello = defineStructure(def);
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
        type: StructureType.Struct,
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
            signed: true,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 32,
            align: 4,
            signed: true,
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
      const Hello = defineStructure(def);
      const object = new Hello();
      expect(object.dataView).to.be.instanceOf(DataView);
    })
    it('should have typedArray property when exposeDataView is true and all struct members are of the same supported type', function() {
      const def = {
        type: StructureType.Struct,
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
            signed: true,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 32,
            align: 4,
            signed: true,
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
      const Hello = defineStructure(def);
      const object = new Hello();
      expect(object.typedArray).to.be.instanceOf(Int32Array);
      object.cat = 777;
      expect(object.typedArray[1]).to.equal(777);
    })
    it('should not have typedArray property when struct members are different', function() {
      const def = {
        type: StructureType.Struct,
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
            signed: true,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 32,
            align: 4,
            signed: false,
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
      const Hello = defineStructure(def);
      const object = new Hello();
      expect(object.typedArray).to.be.undefined;
    })
    it('should throw when a value exceed the maximum capability of the type', function () {
      const def = {
        type: StructureType.Struct,
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
            signed: true,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 32,
            align: 4,
            signed: false,
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
      const Hello = defineStructure(def);
      const object = new Hello();
      expect(() => object.dog = 0x1FFFFFFFF).to.throw();
    })
    it('should permit overflow when runtime safety is off', function () {
      const def = {
        type: StructureType.Struct,
        size: 4 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
            signed: true,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 32,
            align: 4,
            signed: false,
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
      const Hello = defineStructure(def, { runtimeSafety: false });
      const object = new Hello();
      expect(() => object.dog = 0x1FFFFFFFF).to.not.throw();
    })
  
    it('should be able to handle bitfields', function() {
      const def = {
        type: StructureType.Struct,
        size: 1,
        members: [
          {
            name: 'dog',
            type: MemberType.Bool,
            bits: 1,
            bitOffset: 0,
            align: 0,
          },
          {
            name: 'cat',
            type: MemberType.Bool,
            bits: 1,
            bitOffset: 1,
            align: 0,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(1));
          dv.setInt8(0, 2, true);
          return dv;
        })(),
        exposeDataView: true,
      };
      const Hello = defineStructure(def);
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
        type: StructureType.Struct,
        size: 1,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            bits: 2,
            bitOffset: 0,
            align: 0,
            signed: false,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            bits: 3,
            bitOffset: 2,
            align: 0,
            signed: true,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(1));
          dv.setInt8(0, 7, true);
          return dv;
        })(),
        exposeDataView: true,
      };
      const Hello = defineStructure(def);
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
        type: StructureType.Struct,
        size: 5,
        members: [
          {
            name: 'dog',
            type: MemberType.Int,
            bits: 2,
            bitOffset: 0,
            align: 0,
            signed: false,
          },
          {
            name: 'cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 2,
            align: 0,
            signed: false,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(5));
          dv.setUint32(0, 8, true);
          return dv;
        })(),
        exposeDataView: true,
      };
      const Hello = defineStructure(def);
      const object = new Hello();
      expect(object.dog).to.equal(0);
      expect(object.cat).to.equal(2);
      // TODO
    }) 
  })
  describe('Complex Struct', function() {
    it('should define a struct that contains pointers', function() {
      const Int32 = defineStructure({
        type: StructureType.Primitive,
        size: 4,
        members: [
          {
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
            signed: false,
          }
        ],
      });
      const number1 = new Int32();
      const number2 = new Int32();
      number1.set(1234);
      number2.set(4567);
      const def = {
        type: StructureType.Struct,
        size: 8 * 2,
        members: [
          {
            name: 'dog',
            type: MemberType.Pointer,
            bits: 64,
            bitOffset: 0,
            align: 8,
            slot: 0,
            struct: Int32,
          },
          {
            name: 'cat',
            type: MemberType.Pointer,
            bits: 64,
            bitOffset: 8,
            align: 8,
            slot: 1,
            struct: Int32,
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
      const Hello = defineStructure(def);
      const object = new Hello();
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(4567);
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
            bits: 32,
            bitOffset: 0,
            align: 4,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const Hello = defineStructure(def);
      expect(Hello.Dog.value).to.equal(0);
      expect(Hello.Cat.value).to.equal(1);
      expect(Hello.Dog.name).to.equal('Dog');
      expect(Hello.Cat.name).to.equal('Cat');
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
            bits: 32,
            bitOffset: 0,
            signed: false,
            align: 4,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            signed: false,
            align: 4,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const Hello = defineStructure(def);
      expect(Hello(0)).to.equal(Hello.Dog);
      expect(Hello(1)).to.equal(Hello.Cat);
    })
    it('should look up the correct enum object when values are not sequential', function() {
      const def = {
        type: StructureType.Enumeration,
        members: [
          {
            name: 'Dog',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            signed: false,
            align: 4,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            signed: false,
            align: 4,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 123, true);
          dv.setUint32(4, 456, true);
          return dv;
        })(),
      };
      const Hello = defineStructure(def);
      expect(Hello(123)).to.equal(Hello.Dog);
      expect(Hello(456)).to.equal(Hello.Cat);
      expect(Hello(123).value).to.equal(123);
      expect(Hello(456).value).to.equal(456);
      expect(Hello(456).name).to.equal('Cat');
    })
    it('should look up the correct enum object when they represent bigInts', function() {
      const def = {
        type: StructureType.Enumeration,
        members: [
          {
            name: 'Dog',
            type: MemberType.Int,
            bits: 64,
            bitOffset: 0,
            signed: false,
            align: 8,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            bits: 64,
            bitOffset: 0,
            signed: false,
            align: 8,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(8 * 2));
          dv.setBigUint64(0, 1234n, true);
          dv.setBigUint64(8, 4567n, true);
          return dv;
        })(),
      };
      const Hello = defineStructure(def);
      expect(Hello(1234n)).to.equal(Hello.Dog);
      // BigInt suffix missing on purpose
      expect(Hello(4567)).to.equal(Hello.Cat);
    })
    it('should produce the expect output when JSON.stringify() is used', function() {
      const def = {
        type: StructureType.Enumeration,
        members: [
          {
            name: 'Dog',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
          },
          {
            name: 'Cat',
            type: MemberType.Int,
            bits: 32,
            bitOffset: 0,
            align: 4,
          },
        ],
        defaultData: (() => {
          const dv = new DataView(new ArrayBuffer(4 * 2));
          dv.setUint32(0, 0, true);
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const Hello = defineStructure(def);
      expect(JSON.stringify(Hello.Dog)).to.equal('0');
      expect(JSON.stringify(Hello.Cat)).to.equal('1');
    })
  }) 
  it('should throw when the new operator is used on the constructor', function() {
    const def = {
      type: StructureType.Enumeration,
      members: [
        {
          name: 'Dog',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 0,
          align: 4,
        },
        {
          name: 'Cat',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 0,
          align: 4,
        },
      ],
      defaultData: (() => {
        const dv = new DataView(new ArrayBuffer(4 * 2));
        dv.setUint32(0, 0, true);
        dv.setUint32(4, 1, true);
        return dv;
      })(),
    };
    const Hello = defineStructure(def);
    expect(() => new Hello(5)).to.throw();
  })
  it('should return undefined when look-up of enum item fails', function() {
    const def = {
      type: StructureType.Enumeration,
      members: [
        {
          name: 'Dog',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 0,
          align: 4,
        },
        {
          name: 'Cat',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 0,
          align: 4,
        },
      ],
      defaultData: (() => {
        const dv = new DataView(new ArrayBuffer(4 * 2));
        dv.setUint32(0, 0, true);
        dv.setUint32(4, 1, true);
        return dv;
      })(),
    };
    const Hello = defineStructure(def);
    expect(Hello(1)).to.be.an('object');
    expect(Hello(5)).to.be.undefined;
  })
})