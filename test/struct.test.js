import { expect } from 'chai';

import { MemberType } from '../src/types.js';
import { DATA, RELOCATABLE } from '../src/symbols.js';
import { obtainGetter, obtainSetter } from '../src/struct.js';

describe('Struct functions', function() {
  describe('obtainGetter', function() {
    it('should return a function for getting int', function() {
      const object = {
        [DATA]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setUint32(4, 1234, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Int,
        bits: 32,
        bitOffset: 32,
        align: 4,
        signed: false,
      };
      const f = obtainGetter(member, {});
      const res = f.call(object);
      expect(res).to.equal(1234);
    })
    it('should return a function for getting float', function() {
      const object = {
        [DATA]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setFloat64(0, 3.14, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Float,
        bits: 64,
        bitOffset: 0,
        align: 8,
        signed: false,
      };
      const f = obtainGetter(member, {});
      const res = f.call(object);
      expect(res).to.equal(3.14);
    })
    it('should return a function for getting bool', function() {
      const object = {
        [DATA]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Bool,
        bits: 1,
        bitOffset: 32,
        align: 1,
        signed: false,
      };
      const f = obtainGetter(member, {});
      const res = f.call(object);
      expect(res).to.equal(true);
    })
    it('should return a function for getting void', function() {
      const object = {
        [DATA]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Void,
        bits: 0,
        bitOffset: 32,
        align: 0,
        signed: false,
      };
      const f = obtainGetter(member, {});
      const res = f.call(object);
      expect(res).to.equal(null);
    })
    it('should return a function for getting enum', function() {
      const DummyValue = { value: 1 };
      const DummyEnum = function(v) {
        if (v === 1) {
          return DummyValue;
        }
      };
      const object = {
        [DATA]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Enum,
        bits: 4,
        bitOffset: 32,
        align: 0,
        signed: false,
        struct: DummyEnum,
      };
      const f = obtainGetter(member, {});
      const res = f.call(object);
      expect(res).to.equal(DummyValue);
    })
    it('should return a function for getting a pointer', function() {
      const DummyStruct = class {};
      const DummyValue = new DummyStruct;
      const dv = new DataView(new ArrayBuffer(8));
      const object = {
        [DATA]: dv,
        [RELOCATABLE]: {
          1: DummyValue,
        },
      };
      const member = {
        type: MemberType.Pointer,
        bits: 8,
        bitOffset: 0,
        align: 8,
        slot: 1,
        signed: false,
        mutable: true,
        struct: DummyStruct,
      };
      const f = obtainGetter(member, {});
      const res = f.call(object);
      expect(res).to.equal(DummyValue);
    })
    it('should return a function that dereferences a pointer to a primitive', function() {
      var value = 1234;
      const DummyStruct = class {
        get() { return value }
        set(v) { value = v }
        [Symbol.toPrimitive]() { return value }
      };
      const DummyValue = new DummyStruct;
      const dv = new DataView(new ArrayBuffer(8));
      const object = {
        [DATA]: dv,
        [RELOCATABLE]: {
          1: DummyValue,
        },
      };
      const member = {
        type: MemberType.Pointer,
        bits: 8,
        bitOffset: 0,
        align: 8,
        slot: 1,
        signed: false,
        mutable: true,
        struct: DummyStruct,
      };
      const f = obtainGetter(member, {});
      const res = f.call(object);
      expect(res).to.equal(1234);
    })
  })
  describe('obtainSetter', function() {
    it('should return a function for setting int', function() {
      const dv = new DataView(new ArrayBuffer(8));
      const object = {
        [DATA]: dv,
      };
      const member = {
        type: MemberType.Int,
        bits: 32,
        bitOffset: 32,
        align: 4,
        signed: false,
      };
      const f = obtainSetter(member, {});
      f.call(object, 123);
      expect(dv.getUint32(4, true)).to.equal(123);
    })
    it('should return a function for setting float', function() {
      const dv = new DataView(new ArrayBuffer(8));
      const object = {
        [DATA]: dv,
      };
      const member = {
        type: MemberType.Float,
        bits: 64,
        bitOffset: 0,
        align: 8,
        signed: false,
      };
      const f = obtainSetter(member, {});
      f.call(object, 3.14);
      expect(dv.getFloat64(0, true)).to.equal(3.14);
    })
    it('should return a function for setting bool', function() {
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(4, 2, true);
      const object = {
        [DATA]: dv,
      };
      const member = {
        type: MemberType.Bool,
        bits: 1,
        bitOffset: 32,
        align: 1,
        signed: false,
      };
      const f = obtainSetter(member, {});
      f.call(object, true);
      expect(dv.getUint32(4, true)).to.equal(3);
    })
    it('should return a function for setting void', function() {
      const dv = new DataView(new ArrayBuffer(8));
      const object = {
        [DATA]: dv,
      };
      const member = {
        type: MemberType.Void,
        bits: 0,
        bitOffset: 32,
        align: 0,
        signed: false,
      };
      const f = obtainSetter(member, {});
      f.call(object, null);
      expect(dv.getUint32(4, true)).to.equal(0);
      expect(() => f.call(object, 44)).to.throw();
    })   
    it('should return a function for setting enum', function() {
      const DummyValue = { value: 1 };
      const DummyEnum = function(v) {
        if (v === 1) {
          return DummyValue;
        }
      };
      Object.setPrototypeOf(DummyValue, DummyEnum.prototype);
      const dv = new DataView(new ArrayBuffer(8));
      const object = {
        [DATA]: dv,
      };
      const member = {
        type: MemberType.Enum,
        bits: 4,
        bitOffset: 32,
        align: 0,
        signed: false,
        struct: DummyEnum,
      };
      const f = obtainSetter(member, {});
      f.call(object, DummyEnum(1));
      expect(dv.getUint32(4, true)).to.equal(1);
    })
    it('should return a function for setting a pointer', function() {
      const DummyStruct = class {};
      const DummyValue = new DummyStruct;
      const dv = new DataView(new ArrayBuffer(8));
      const object = {
        [DATA]: dv,
        [RELOCATABLE]: {
        },
      };
      const member = {
        type: MemberType.Pointer,
        bits: 8,
        bitOffset: 0,
        align: 8,
        slot: 1,
        signed: false,
        mutable: true,
        struct: DummyStruct,
      };
      const f = obtainSetter(member, {});
      f.call(object, DummyValue);
      expect(object[RELOCATABLE][1]).to.equal(DummyValue);
    })
    it('should return a function that set a primitive referenced by a pointer', function() {
      var value = 1234;
      const DummyStruct = class {
        get() { return value }
        set(v) { value = v }
        [Symbol.toPrimitive]() { return value }
      };
      const DummyValue = new DummyStruct;
      const dv = new DataView(new ArrayBuffer(8));
      const object = {
        [DATA]: dv,
        [RELOCATABLE]: {
          1: DummyValue,
        },
      };
      const member = {
        type: MemberType.Pointer,
        bits: 8,
        bitOffset: 0,
        align: 8,
        slot: 1,
        signed: false,
        mutable: true,
        struct: DummyStruct,        
      };
      const f = obtainSetter(member, {});
      const res = f.call(object, 4567);
      expect(value).to.equal(4567);
    })
  })
})
