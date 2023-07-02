import { expect } from 'chai';

import { StructureType } from '../src/structure.js';
import { MEMORY, SLOTS } from '../src/symbol.js';
import {
  MemberType,
  getAccessors,
  useVoid,
  useBool,
  useInt,
  useFloat,
  useEnumerationItem,
  useObject,
} from '../src/member.js';

describe('Member functions', function() {
  describe('getAccessors', function() {
    it('should return void accessors', function() {
      useVoid();
      const member = {
        type: MemberType.Void,
        bitSize: 0,
        byteSize: 0,
      };
      const dv = new DataView(new ArrayBuffer(12));
      const object = { [MEMORY]: dv };
      const { get, set } = getAccessors(member, { runtimeSafety: true });
      expect(get.call(object)).to.be.null;
      expect(() => set.call(object, null)).to.not.throw();
      expect(() => set.call(object, 0)).to.throw();
    })
    it('should return bool accessors', function() {
      useBool();
      const object = {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Bool,
        signed: false,
        bitSize: 1,
        bitOffset: 32,
        byteSize: 1,
      };
      const { get, set } = getAccessors(member, {});
      expect(get.call(object)).to.equal(true);
      set.call(object, false);
      expect(get.call(object)).to.equal(false);
    })
    it('should return int accessors', function() {
      useInt();
      const object = {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setUint32(4, 1234, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Int,
        signed: false,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      };
      const { get, set } = getAccessors(member, {});
      expect(get.call(object)).to.equal(1234);
      set.call(object, 3456);
      expect(get.call(object)).to.equal(3456);
    })
    it('should return float accessors', function() {
      useFloat();
      const object = {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setFloat64(0, 3.14, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Float,
        signed: false,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
      };
      const { get, set } = getAccessors(member, {});
      expect(get.call(object)).to.equal(3.14);
      set.call(object, 1234.5678);
      expect(get.call(object)).to.equal(1234.5678);
    })
    it('should return enum item accessor', function() {
      useEnumerationItem();
      const DummyValue1 = {
        valueOf() { return 1 }
      };
      const DummyValue2 = {
        valueOf() { return 2 }
      };
      const DummyEnum = function(v) {
        if (v === 1) {
          return DummyValue1;
        } else if (v === 2) {
          return DummyValue2;
        }
      };
      Object.setPrototypeOf(DummyValue1, DummyEnum.prototype);
      Object.setPrototypeOf(DummyValue2, DummyEnum.prototype);
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(4, 1, true);
      const object = { [MEMORY]: dv };
      const member = {
        type: MemberType.EnumerationItem,
        signed: false,
        bitSize: 8,
        bitOffset: 32,
        byteSize: 0,
        structure: { type: StructureType.Enumeration, constructor: DummyEnum },
      };
      const { get, set } = getAccessors(member, {});
      expect(get.call(object)).to.equal(DummyValue1);
      set.call(object, DummyEnum(2));
      expect(dv.getUint32(4, true)).to.equal(2);
      expect(get.call(object)).to.equal(DummyValue2);
    })
    it('should return object accessors (Struct)', function() {
      useObject();
      const DummyClass = function(arg) {
        this.value = arg
      } ;
      const dummyObject = new DummyClass(123);
      const member = {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 32,
        byteSize: 64,
        slot: 4,
        structure: {
          type: StructureType.Struct,
          constructor: DummyClass,
          copier: (dest, src) => {
            dest.value = src.value
          },
        },
      };
      const slots = { 4: dummyObject };
      const object = {
        [SLOTS]: slots
      };
      const { get, set } = getAccessors(member, {});
      expect(get.call(object)).to.equal(dummyObject);
      set.call(object, 456);
      expect(get.call(object)).to.equal(dummyObject);
      expect(dummyObject.value).to.equal(456);
    })
    it('should return object accessors (Optional)', function() {
      const DummyClass = function(arg) {
        this.value = arg;
        this.get = function() { return this.value };
        this.set = function(value) { this.value = value };
      } ;
      const dummyObject = new DummyClass(123);
      const member = {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 32,
        byteSize: 64,
        slot: 4,
        structure: {
          type: StructureType.Optional,
          constructor: DummyClass,
        },
      };
      const slots = { 4: dummyObject };
      const object = {
        [SLOTS]: slots
      };
      const { get, set } = getAccessors(member, {});
      expect(get.call(object)).to.equal(123);
      set.call(object, 456);
      expect(get.call(object)).to.equal(456);
    })
    it('should return object accessors (ErrorUnion)', function() {
      const DummyClass = function(arg) {
        this.value = arg;
        this.get = function() {
          if (this.value instanceof Error) {
            throw this.value;
          } else {
            return this.value;
          }
        };
        this.set = function(value) { this.value = value };
      } ;
      const dummyObject = new DummyClass(123);
      const member = {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 32,
        byteSize: 64,
        slot: 4,
        structure: {
          type: StructureType.Optional,
          constructor: DummyClass,
        },
      };
      const slots = { 4: dummyObject };
      const object = {
        [SLOTS]: slots
      };
      const { get, set } = getAccessors(member, {});
      expect(get.call(object)).to.equal(123);
      set.call(object, new Error('Pants on fire'));
      expect(() => get.call(object)).to.throw();
    })
    it('should return object accessors (Pointer, auto-deref to primitive)', function() {
      const DummyClass = function(value) {
        this.value = value;
        this.get = function() { return this.value };
        this.set = function(value) { this.value = value };
      };
      const dummyObject = new DummyClass(123);
      const object = {
        [SLOTS]: {
          1: { '*': dummyObject },
        },
      };
      const member = {
        type: MemberType.Object,
        signed: false,
        bitSize: 8,
        bitOffset: 0,
        byteSize: 8,
        slot: 1,
        mutable: true,
        structure: {
          type: StructureType.Pointer,
          instance: {
            members: [
              {
                structure: {
                  type: StructureType.Primitive,
                  constructor: DummyClass
                },
              }
            ]
          }
        }
      };
      const { get, set } = getAccessors(member, { autoDeref: true });
      expect(get.call(object)).to.equal(123);
      set.call(object, 456);
      expect(get.call(object)).to.equal(456);
    })
    it('should return array accessors', function() {
      useInt();
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = { [MEMORY]: dv };
      const { get, set } = getAccessors(member);
      const res1 = get.call(object, 0);
      const res2 = get.call(object, 1);
      const res3 = get.call(object, 2);
      expect(res1).to.equal(1234);
      expect(res2).to.equal(-2);
      expect(res3).to.equal(-1);
      set.call(object, 0, 5);
      set.call(object, 1, 5);
      set.call(object, 2, 5);
      expect(dv.getInt32(0, true)).to.equal(5);
      expect(dv.getInt32(4, true)).to.equal(5);
      expect(dv.getInt32(8, true)).to.equal(5);
    })
    it('should return big int array accessors', function() {
      useInt();
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 64,
        byteSize: 8,
      };
      const dv = new DataView(new ArrayBuffer(24));
      dv.setBigInt64(0, 1234n, true);
      dv.setBigInt64(8, -2n, true);
      dv.setBigInt64(16, -1n, true);
      const object = { [MEMORY]: dv };
      const { set, get } = getAccessors(member);
      const res1 = get.call(object, 0);
      const res2 = get.call(object, 1);
      const res3 = get.call(object, 2);
      expect(res1).to.equal(1234n);
      expect(res2).to.equal(-2n);
      expect(res3).to.equal(-1n);
      set.call(object, 0, 5n);
      set.call(object, 1, 5n);
      set.call(object, 2, 5n);
      expect(dv.getBigInt64(0, true)).to.equal(5n);
      expect(dv.getBigInt64(8, true)).to.equal(5n);
      expect(dv.getBigInt64(16, true)).to.equal(5n);
    })
    it('should throw when index is out-of-bound', function() {
      useInt();
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = { [MEMORY]: dv };
      const { get, set } = getAccessors(member);
      expect(() => get.call(object, -1)).to.throw();
      expect(() => get.call(object, 4)).to.throw();
      expect(() => set.call(object, -1, 0)).to.throw();
      expect(() => set.call(object, 4, 0)).to.throw();
    })
    it('should return functions employing the correct endianness', function() {
      useInt();
      const member = {
        type: MemberType.Int,
        isSigned: true,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, false);
      dv.setInt32(4, -2, false);
      dv.setInt32(8, -1, false);
      const object = { [MEMORY]: dv };
      const { get, set } = getAccessors(member, { littleEndian: false });
      expect(get.call(object, 0)).to.equal(1234);
      expect(get.call(object, 1)).to.equal(-2);
      expect(get.call(object, 2)).to.equal(-1);
      set.call(object, 0, 1235);
      set.call(object, 1, -3);
      set.call(object, 2, -2);
      expect(get.call(object, 0, false)).to.equal(1235);
      expect(get.call(object, 1, false)).to.equal(-3);
      expect(get.call(object, 2, false)).to.equal(-2);
    })
  })
})