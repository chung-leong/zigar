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
})