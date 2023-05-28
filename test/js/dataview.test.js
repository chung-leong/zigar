import { expect } from 'chai';

import { defineStruct } from '../../src/js/dataview.js';

const Pointer = 0;
const Bool = 1;
const Int = 2;
const Float = 3;

describe("JavaScript Struct DataView creation", function() { 
  it('should create a class()', function() {
    const fields = {
        dog: { type: Int, bits: 32, offset: 0, signed: true, bitOffset: 0, defaultValue: 43, writable: true },
        cat: { type: Int, bits: 32, offset: 4, signed: true, bitOffset: 0, defaultValue: 3332 },
    };
    const Hello = defineStruct('Hello', 8, fields);
    expect(Hello).to.be.a('function');
  })
  it('should return default values', function() {
    const fields = {
      dog: { type: Int, bits: 32, offset: 0, signed: true, bitOffset: 0, defaultValue: 43, writable: true },
      cat: { type: Int, bits: 32, offset: 4, signed: true, bitOffset: 0, defaultValue: 3332 },
    };
    const Hello = defineStruct('Hello', 8, fields);
    const obj = new Hello();
    expect(obj.dog).to.be.equal(43);
    expect(obj.cat).to.be.equal(3332);
  })
  it('should have dataView property when exposeDataView is true', function() {
    const fields = {
      dog: { type: Int, bits: 32, offset: 0, signed: true, bitOffset: 0, defaultValue: 43, writable: true },
      cat: { type: Int, bits: 32, offset: 4, signed: true, bitOffset: 0, defaultValue: 3332 },
    };
    const Hello = defineStruct('Hello', 8, fields, { exposeDataView: true });
    const obj = new Hello();
    expect(obj.dataView).to.be.instanceOf(DataView);
  })
  it('should have dataView property when exposeDataView is false', function() {
    const fields = {
      dog: { type: Int, bits: 32, offset: 0, signed: true, bitOffset: 0, defaultValue: 43, writable: true },
      cat: { type: Int, bits: 32, offset: 4, signed: true, bitOffset: 0, defaultValue: 3332 },
    };
    const Hello = defineStruct('Hello', 8, fields, { exposeDataView: false });
    const obj = new Hello();
    expect(obj.dataView).to.be.undefined;
  })
  it('should change underlying ArrayBuffer property is set', function() {
    const fields = {
      dog: { type: Int, bits: 32, offset: 0, signed: true, bitOffset: 0, defaultValue: 43, writable: true },
      cat: { type: Int, bits: 32, offset: 4, signed: true, bitOffset: 0, defaultValue: 3332 },
    };
    const Hello = defineStruct('Hello', 8, fields, { exposeDataView: true });
    const obj = new Hello();
    obj.dog = 4567;
    expect(obj.dataView.getInt32(0, true)).to.equal(4567);
  })
  it('should accept an ArrayBuffer as constructor argument', function() {
    const fields = {
      dog: { type: Int, bits: 32, offset: 0, signed: true, bitOffset: 0, defaultValue: 43, writable: true },
      cat: { type: Int, bits: 32, offset: 4, signed: true, bitOffset: 0, defaultValue: 3332 },
    };
    const buffer = new ArrayBuffer(8);
    const Hello = defineStruct('Hello', 8, fields, { exposeDataView: true });
    const obj = new Hello(buffer);
    obj.dog = 14567;
    const dataView = new DataView(buffer);
    expect(dataView.getInt32(0, true)).to.equal(14567);
  })
  it('should accept a DataView as constructor argument', function() {
    const fields = {
      dog: { type: Int, bits: 32, offset: 0, signed: true, bitOffset: 0, defaultValue: 43, writable: true },
      cat: { type: Int, bits: 32, offset: 4, signed: true, bitOffset: 0, defaultValue: 3332 },
    };
    const buffer = new ArrayBuffer(8);
    const dataView = new DataView(buffer);
    const Hello = defineStruct('Hello', 8, fields, { exposeDataView: true });
    const obj = new Hello(dataView);
    obj.dog = 14567;
    expect(dataView.getInt32(0, true)).to.equal(14567);
  })
  it('should throw when array buffer is not the correct size', function() {
    const fields = {
      dog: { type: Int, bits: 32, offset: 0, signed: true, bitOffset: 0, defaultValue: 43, writable: true },
      cat: { type: Int, bits: 32, offset: 4, signed: true, bitOffset: 0, defaultValue: 3332 },
    };
    const buffer = new ArrayBuffer(9);
    const Hello = defineStruct('Hello', 8, fields, { exposeDataView: true });
    expect(() => new Hello(buffer)).to.throw();
  })
  it('should throw when a value exceed the maximum capability of the type', function () {
    const fields = {
      dog: { type: Int, bits: 32, offset: 0, signed: true, bitOffset: 0, defaultValue: 43, writable: true },
      cat: { type: Int, bits: 32, offset: 4, signed: true, bitOffset: 0, defaultValue: 3332 },
    };
    const Hello = defineStruct('Hello', 8, fields);
    const obj = new Hello();
    expect(() => obj.dog = 0x1FFFFFFFF).to.throw();
  })
  it('should be able to handle bitfields', function() {
    const fields = {
      dog: { type: Bool, bits: 1, offset: 0, bitOffset: 0, defaultValue: false, writable: true },
      cat: { type: Bool, bits: 1, offset: 0, bitOffset: 1, defaultValue: true, writable: true },
    };
    const Hello = defineStruct('Hello', 8, fields, { exposeDataView: true });
    const obj = new Hello();
    expect(obj.dog).to.be.false;
    expect(obj.cat).to.be.true;
  })
  it('should be able to small int type', function() {
    const fields = {
      dog: { type: Int, bits: 2, offset: 0, signed: false, bitOffset: 0, writable: true },
      cat: { type: Int, bits: 2, offset: 0, signed: false, bitOffset: 2, writable: true },
    };
    const Hello = defineStruct('Hello', 8, fields, { exposeDataView: true, runtimeSafty: true });
    const obj = new Hello();
    obj.dataView.setUint8(0, 7);
    expect(obj.dog).to.equal(3);
    expect(obj.cat).to.equal(1);
    expect(() => obj.dog = 4).to.throw();
  })

})