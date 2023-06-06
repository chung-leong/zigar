import { expect } from 'chai';

import { 
  MemberType,
  StructureType,
  defineStructure,
} from '../src/define.js';

describe("Class definition", function() { 
  it('should define a simple struct()', function() {
    const def = {
      type: StructureType.Struct,
      size: 4 * 2,
      members: [
        {
          name: 'dog',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 0,
          signed: true,
        },
        {
          name: 'cat',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 32,
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
    const proto = Object.getPrototypeOf(object);
    const descrs = Object.getOwnPropertyDescriptors(proto);
    expect(Object.keys(descrs)).to.have.lengthOf(2);
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
          signed: true,
        },
        {
          name: 'cat',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 32,
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
          signed: true,
        },
        {
          name: 'cat',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 32,
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
          signed: true,
        },
        {
          name: 'cat',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 32,
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
          signed: true,
        },
        {
          name: 'cat',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 32,
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
          signed: true,
        },
        {
          name: 'cat',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 32,
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
          signed: true,
        },
        {
          name: 'cat',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 32,
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
          signed: true,
        },
        {
          name: 'cat',
          type: MemberType.Int,
          bits: 32,
          bitOffset: 32,
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
        },
        {
          name: 'cat',
          type: MemberType.Bool,
          bits: 1,
          bitOffset: 1,
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
          signed: false,
        },
        {
          name: 'cat',
          type: MemberType.Int,
          bits: 3,
          bitOffset: 2,
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
  })
})