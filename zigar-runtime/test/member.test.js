import { expect } from 'chai';

import { CHILD_VIVIFICATOR, MEMORY, SLOTS } from '../src/symbol.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import { clearMethodCache } from '../src/data-view.js';
import { getCurrentErrorSets, initializeErrorSets } from '../src/error-set.js';
import {
  MemberType,
  useAllMemberTypes,
  useBool,
  useInt,
  useFloat,
  useUint,
  useEnumerationItem,
  isReadOnly,
  isByteAligned,
  getDescriptor,
} from '../src/member.js';

describe('Member functions', function() {
  beforeEach(function() {
    useAllMemberTypes();
    useAllStructureTypes()
  })
  describe('isReadOnly', function() {
    it('should return true for certain types', function() {
      expect(isReadOnly(MemberType.Comptime)).to.be.true;
      expect(isReadOnly(MemberType.Type)).to.be.true;
      expect(isReadOnly(MemberType.Literal)).to.be.true;
      expect(isReadOnly(MemberType.Int)).to.be.false;
    })
  })
  describe('isByteAligned', function() {
    it('should return true when member is byte-aligned', function() {
      const members = [
        { type: MemberType.Void, bitSize: 0, byteSize: 0, bitOffset: 0 },
        { type: MemberType.Bool, bitSize: 1, bitOffset: 32, byteSize: 1 },
        { type: MemberType.Int, bitSize: 8, bitOffset: 8 },
      ];
      for (const member of members) {
        expect(isByteAligned(member)).to.be.true;
      }
    })
    it('should return false when member is not byte-aligned', function() {
      const members = [
        { type: MemberType.Bool, bitSize: 1, bitOffset: 32 },
        { type: MemberType.Int, bitSize: 8, bitOffset: 9 },
      ];
      for (const member of members) {
        expect(isByteAligned(member)).to.be.false;
      }
    })
  })
  describe('getDescriptor', function() {
    const env = {
      littleEndian: true,
      runtimeSafety: true,
    };
    it('should return void accessors', function() {
      const member = {
        type: MemberType.Void,
        bitSize: 0,
        byteSize: 0,
      };
      const dv = new DataView(new ArrayBuffer(12));
      const object = { [MEMORY]: dv };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.be.undefined;
      expect(() => set.call(object, undefined)).to.not.throw();
      expect(() => set.call(object, null)).to.throw();
      expect(() => set.call(object, 0)).to.throw();
      const { set: setNoCheck } = getDescriptor(member, { ...env, runtimeSafety: false });
      expect(() => setNoCheck.call(object, undefined)).to.not.throw();
    })
    it('should return null accessors', function() {
      const member = {
        type: MemberType.Null,
        bitSize: 0,
        byteSize: 0,
      };
      const dv = new DataView(new ArrayBuffer(12));
      const object = { [MEMORY]: dv };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.be.null;
      expect(() => set.call(object, null)).to.not.throw();
      expect(() => set.call(object, undefined)).to.throw();
      expect(() => set.call(object, 0)).to.throw();
      const { set: setNoCheck } = getDescriptor(member, { ...env, runtimeSafety: false });
      expect(() => setNoCheck.call(object, null)).to.not.throw();
    })
    it('should return error accessors', function() {
      const MyError = function(index) {
        if (this) {
          this.index = index;
        } else {
          switch (index) {
            case 1: return error1;
            case 2: return error2;
          }
        }
      };
      Object.setPrototypeOf(MyError.prototype, Error.prototype);
      const error1 = new MyError(1), error2 = new MyError(2);
      const member = {
        type: MemberType.Error,
        bitSize: 16,
        byteSize: 2,
        bitOffset: 0,
        structure: {
          name: 'MyError',
          constructor: MyError,
          instance: {
            members: [
              {
                type: MemberType.Uint,
                bitSize: 16,
                byteSize: 2,
                bitOffset: 0
              }
            ]
          }
        }
      };
      const dv = new DataView(new ArrayBuffer(12));
      const object = { [MEMORY]: dv };
      const { get, set } = getDescriptor(member, env);
      dv.setUint16(0, 1, true);
      expect(get.call(object)).to.equal(error1);
      set.call(object, error2);
      expect(dv.getUint16(0, true)).to.equal(2);
      expect(get.call(object)).to.equal(error2);
      set.call(object, 1);
      expect(get.call(object)).to.equal(error1);
      expect(() => set.call(object, new Error)).to.throw(TypeError);
      expect(() => set.call(object, 3)).to.throw(TypeError);
    })
    it('should return accessors for anyerror', function() {
      const MyError = function(index) {
        if (this) {
          this.index = index;
        } else {
          switch (index) {
            case 1: return error1;
            case 2: return error2;
          }
        }
      };
      Object.setPrototypeOf(MyError.prototype, Error.prototype);
      const error1 = new MyError(1), error2 = new MyError(2);
      initializeErrorSets();
      const allErrors = getCurrentErrorSets();
      allErrors[1] = error1;
      allErrors[2] = error2;
      const member = {
        type: MemberType.Error,
        bitSize: 16,
        byteSize: 2,
        bitOffset: 0,
        structure: {
          name: 'anyerror',
          constructor: Error,
          instance: {
            members: [
              {
                type: MemberType.Uint,
                bitSize: 16,
                byteSize: 2,
                bitOffset: 0
              }
            ]
          }
        }
      };
      const dv = new DataView(new ArrayBuffer(12));
      const object = { [MEMORY]: dv };
      const { get, set } = getDescriptor(member, env);
      dv.setUint16(0, 1, true);
      expect(get.call(object)).to.equal(error1);
      set.call(object, error2);
      expect(dv.getUint16(0, true)).to.equal(2);
      expect(get.call(object)).to.equal(error2);
      set.call(object, 1);
      expect(get.call(object)).to.equal(error1);
      expect(() => set.call(object, new Error)).to.throw(TypeError);
      expect(() => set.call(object, 3)).to.throw(TypeError);
    })
    it('should return bool accessors', function() {
      const object = {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setUint32(4, 1, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 32,
        byteSize: 1,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(true);
      set.call(object, false);
      expect(get.call(object)).to.equal(false);
    })
    it('should return bitfield accessors', function() {
      const dv = new DataView(new ArrayBuffer(8));
      dv.setUint32(4, 3, true);
      const object = { [MEMORY]: dv };
      const member = {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 33,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(true);
      set.call(object, false);
      expect(get.call(object)).to.equal(false);
      expect(dv.getUint32(4, true)).to.equal(1);
    })
    it('should not return bitfield accessors when useBoolEx is not active', function() {
      clearMethodCache();
      useBool();
      const member = {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 33,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get).to.be.undefined;
      expect(set).to.be.undefined;
    })
    it('should return int accessors', function() {
      const object = {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setUint32(4, 1234, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(1234);
      set.call(object, 3456);
      expect(get.call(object)).to.equal(3456);
    })
    it('should return uint accessors', function() {
      const object = {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setUint32(4, 1234, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(1234);
      set.call(object, 3456);
      expect(get.call(object)).to.equal(3456);
    })
    it('should return standard int accessors when only useIntEx is not set', function() {
      clearMethodCache();
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
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(1234);
      set.call(object, 3456);
      expect(get.call(object)).to.equal(3456);
    })
    it('should return standard int accessors when only useUintEx is not active', function() {
      clearMethodCache();
      useUint();
      const object = {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setUint32(4, 1234, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(1234);
      set.call(object, 3456);
      expect(get.call(object)).to.equal(3456);
    })
    it('should return small int accessors', function() {
      const dv = new DataView(new ArrayBuffer(8));
      dv.setInt32(4, 0x07, true);
      const object = { [MEMORY]: dv };
      const member = {
        type: MemberType.Int,
        bitSize: 4,
        bitOffset: 33,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(3);
      set.call(object, -6);
      expect(get.call(object)).to.equal(-6);
      expect(() => set.call(object, 15)).to.throw();
      const { set: setNoCheck } = getDescriptor(member, { ...env, runtimeSafety: false });
      expect(() => setNoCheck.call(object, 15)).to.not.throw();
    })
    it('should return small uint accessors', function() {
      const dv = new DataView(new ArrayBuffer(8));
      dv.setInt32(4, 0x07, true);
      const object = { [MEMORY]: dv };
      const member = {
        type: MemberType.Uint,
        bitSize: 4,
        bitOffset: 33,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(3);
      set.call(object, 15);
      expect(get.call(object)).to.equal(15);
      expect(() => set.call(object, 32)).to.throw();
      const { set: setNoCheck } = getDescriptor(member, { env, runtimeSafety: false });
      expect(() => setNoCheck.call(object, 32)).to.not.throw();
    })
    it('should not return small int accessors when useIntEx is not active', function() {
      clearMethodCache();
      useInt();
      const member = {
        type: MemberType.Int,
        bitSize: 4,
        bitOffset: 33,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get).to.be.undefined;
      expect(set).to.be.undefined;
    })
    it('should not return small uint accessors when useUintEx is not active', function() {
      clearMethodCache();
      useUint();
      const member = {
        type: MemberType.Uint,
        bitSize: 4,
        bitOffset: 33,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get).to.be.undefined;
      expect(set).to.be.undefined;
    })
    it('should return float accessors', function() {
      const object = {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          dv.setFloat64(0, 3.14, true);
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Float,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(3.14);
      set.call(object, 1234.5678);
      expect(get.call(object)).to.equal(1234.5678);
    })
    it('should return small float accessors', function() {
      const object = {
        [MEMORY]: (() => {
          const dv = new DataView(new ArrayBuffer(8));
          return dv;
        })(),
      };
      const member = {
        type: MemberType.Float,
        bitSize: 16,
        bitOffset: 4,
        byteSize: 8,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(0);
      set.call(object, 3.5);
      expect(get.call(object)).to.equal(3.5);
    })
    it('should not return small float accessors when useFloatEx is not active', function() {
      clearMethodCache();
      useFloat();
      const member = {
        type: MemberType.Float,
        bitSize: 16,
        bitOffset: 4,
        byteSize: 8,
      };
      const { get, set } = getDescriptor(member, env);
      expect(get).to.be.undefined;
      expect(set).to.be.undefined;
    })
    it('should return enum item accessors', function() {
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
        bitSize: 8,
        bitOffset: 32,
        byteSize: 1,
        structure: {
          name: 'DummEnum',
          type: StructureType.Enumeration,
          constructor: DummyEnum,
          instance: {
            members: [ 
              {
                type: MemberType.Uint,
                bitSize: 4,
                bitOffset: 0,
              } 
            ]
          }
        },
      };
      const { get, set } = getDescriptor(member, { ...env, runtimeSafety: false });
      expect(get.call(object)).to.equal(DummyValue1);
      set.call(object, DummyEnum(2));
      expect(dv.getUint32(4, true)).to.equal(2);
      expect(get.call(object)).to.equal(DummyValue2);
      expect(() => set.call(object, 1)).to.not.throw();
      expect(() => set.call(object, 5)).to.throw();
      dv.setUint32(4, 3, true);
      expect(() => get.call(object)).to.throw();
    })
    it('should return small enum item accessors', function() {
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
        bitSize: 4,
        bitOffset: 32,
        structure: { 
          type: StructureType.Enumeration, 
          constructor: DummyEnum,
          instance: {
            members: [ 
              {
                type: MemberType.Uint,
                bitSize: 4,
                bitOffset: 0,
              } 
            ]
          }
        },
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(DummyValue1);
      set.call(object, DummyEnum(2));
      expect(dv.getUint32(4, true)).to.equal(2);
      expect(get.call(object)).to.equal(DummyValue2);
    })
    it('should not return small enum item accessors when useEnumerationItemEx is not active', function() {
      clearMethodCache();
      useEnumerationItem();
      const member = {
        type: MemberType.EnumerationItem,
        bitSize: 4,
        bitOffset: 32,
        structure: {
          instance: {
            members: [ 
              {
                type: MemberType.Uint,
                bitSize: 4,
                bitOffset: 0,
              } 
            ]
          }
        },
      };
      const descriptor = getDescriptor(member, env);
      expect(descriptor).to.be.undefined;
    })
    it('should return object accessors (Struct)', function() {
      const DummyClass = function(arg) {
        this.value = arg
      };
      const initializer = function(arg) {
        if (arg instanceof DummyClass) {
          this.value = arg.value
        } else {
          this.value = arg;
        }
      };
      Object.defineProperties(DummyClass.prototype, {
        $: { set: initializer },
      });
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
          initializer,
        },
      };
      const object = {
        [CHILD_VIVIFICATOR]: () => dummyObject,
        [SLOTS]: {},
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(dummyObject);
      set.call(object, 456);
      expect(get.call(object)).to.equal(dummyObject);
      expect(dummyObject.value).to.equal(456);
    })
    it('should return object accessors (Optional)', function() {
      const DummyClass = function(arg) {
        this.value = arg;
      } ;
      Object.defineProperties(DummyClass.prototype, {
        $: {
          get() { return this.value },
          set(value) { this.value = value },
        }
      });
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
      const object = {
        [CHILD_VIVIFICATOR]: () => dummyObject,
        [SLOTS]: {},
      };
      const { get, set } = getDescriptor(member, env);
      debugger;
      get.call(object);
      expect(get.call(object)).to.equal(123);
      set.call(object, 456);
      expect(get.call(object)).to.equal(456);
    })
    it('should return object accessors (ErrorUnion)', function() {
      const DummyClass = function(arg) {
        this.value = arg;
      } ;
      Object.defineProperties(DummyClass.prototype, {
        $: {
          get() {
            if (this.value instanceof Error) {
              throw this.value;
            } else {
              return this.value;
            }
          },
          set(value) { this.value = value },
        }
      });
      const dummyObject = new DummyClass(123);
      const member = {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 32,
        byteSize: 64,
        slot: 4,
        structure: {
          type: StructureType.ErrorUnion,
          constructor: DummyClass,
        },
      };
      const object = {
        [CHILD_VIVIFICATOR]: () => dummyObject,
        [SLOTS]: {
          // pre-fill the slot here
          4: dummyObject,
        },
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(123);
      set.call(object, new Error('Pants on fire'));
      expect(() => get.call(object)).to.throw();
    })
    it('should return int array accessors', function() {
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = { [MEMORY]: dv };
      const { get, set } = getDescriptor(member, env);
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
      const member = {
        type: MemberType.Int,
        bitSize: 64,
        byteSize: 8,
      };
      const dv = new DataView(new ArrayBuffer(24));
      dv.setBigInt64(0, 1234n, true);
      dv.setBigInt64(8, -2n, true);
      dv.setBigInt64(16, -1n, true);
      const object = { [MEMORY]: dv };
      const { set, get } = getDescriptor(member, env);
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
    it('should return object array accessors (Struct)', function() {
      const DummyClass = function(arg) {
        this.value = arg
      } ;
      const initializer = function(arg) {
        if (arg instanceof DummyClass) {
          this.value = arg.value
        } else {
          this.value = arg;
        }
      };
      Object.defineProperties(DummyClass.prototype, {
        $: { set: initializer },
      });
      const dummyObject1 = new DummyClass(123);
      const dummyObject2 = new DummyClass(456);
      const dummyObject3 = new DummyClass(789);
      const member = {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 64,
        structure: {
          type: StructureType.Struct,
          constructor: DummyClass,
          initializer,
        },
      };
      const slots = {
        0: dummyObject1,
        1: dummyObject2,
        2: dummyObject3,
      };
      const object = {
        [CHILD_VIVIFICATOR]: index => slots[index],
        [SLOTS]: {},
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object, 0)).to.equal(dummyObject1);
      expect(get.call(object, 1)).to.equal(dummyObject2);
      expect(get.call(object, 2)).to.equal(dummyObject3);
      set.call(object, 0, 1234);
      set.call(object, 1, 4567);
      set.call(object, 2, 7890);
      expect(get.call(object, 0)).to.equal(dummyObject1);
      expect(get.call(object, 1)).to.equal(dummyObject2);
      expect(get.call(object, 2)).to.equal(dummyObject3);
      expect(dummyObject1.value).to.equal(1234);
      expect(dummyObject2.value).to.equal(4567);
      expect(dummyObject3.value).to.equal(7890);
    })
    it('should return object array accessors (Optional)', function() {
      const DummyClass = function(arg) {
        this.value = arg;
      } ;
      Object.defineProperties(DummyClass.prototype, {
        $: {
          get() { return this.value },
          set(value) { this.value = value },
        },
      });
      const dummyObject1 = new DummyClass(123);
      const dummyObject2 = new DummyClass(456);
      const dummyObject3 = new DummyClass(789);
      const member = {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 64,
        structure: {
          type: StructureType.Optional,
          constructor: DummyClass,
        },
      };
      const slots = {
        0: dummyObject1,
        1: dummyObject2,
        2: dummyObject3,
      };
      const object = {
        [CHILD_VIVIFICATOR]: index => slots[index],
        [SLOTS]: {},
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object, 0)).to.equal(123);
      expect(get.call(object, 1)).to.equal(456);
      expect(get.call(object, 2)).to.equal(789);
      set.call(object, 0, 1234);
      set.call(object, 1, 4567);
      set.call(object, 2, 7890);
      expect(get.call(object, 0)).to.equal(1234);
      expect(get.call(object, 1)).to.equal(4567);
      expect(get.call(object, 2)).to.equal(7890);
    })
    it('should throw when index is out-of-bound', function() {
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, true);
      dv.setInt32(4, -2, true);
      dv.setInt32(8, -1, true);
      const object = { [MEMORY]: dv };
      const { get, set } = getDescriptor(member, env);
      expect(() => get.call(object, -1)).to.throw();
      expect(() => get.call(object, 4)).to.throw();
      expect(() => set.call(object, -1, 0)).to.throw();
      expect(() => set.call(object, 4, 0)).to.throw();
    })
    it('should return functions employing the correct endianness', function() {
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
      };
      const dv = new DataView(new ArrayBuffer(12));
      dv.setInt32(0, 1234, false);
      dv.setInt32(4, -2, false);
      dv.setInt32(8, -1, false);
      const object = { [MEMORY]: dv };
      const { get, set } = getDescriptor(member, { ...env, littleEndian: false });
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
    it('should return accessors for accessing WASM memory', function() {
      const memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      const dv = new DataView(memory.buffer, 0, 8);
      dv[MEMORY] = { memory, address: 0, len: 8 };
      const object = {
        [MEMORY]: dv,
      };
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      };
      const { get, set } = getDescriptor(member, env);
      set.call(object, 123);
      memory.grow(1);
      expect(get.call(object)).to.equal(123);
      const dv2 = object[MEMORY];
      expect(dv2).to.not.equal(dv);
      memory.grow(1);
      expect(() => set.call(object, 456)).to.not.throw();
      const dv3 = object[MEMORY];
      expect(dv3).to.not.equal(dv2);
    })
    it('should return array accessors for accessing WASM memory', function() {
      const memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      const dv = new DataView(memory.buffer, 0, 8);
      dv[MEMORY] = { memory, address: 0, len: 8 };
      const object = {
        [MEMORY]: dv,
      };
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
      };
      const { get, set } = getDescriptor(member, env);
      set.call(object, 0, 123);
      memory.grow(1);
      expect(get.call(object, 0)).to.equal(123);
      const dv2 = object[MEMORY];
      expect(dv2).to.not.equal(dv);
      memory.grow(1);
      set.call(object, 0, 456);
      expect(() => set.call(object, 0, 456)).to.not.throw();
      const dv3 = object[MEMORY];
      expect(dv3).to.not.equal(dv2);
    })
    it('should not trap errors unrelated to WASM buffer detachment', function() {
      const memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      const dv = new DataView(memory.buffer, 0, 8);
      dv[MEMORY] = { memory, address: 0, len: 8 };
      const object = {
        [MEMORY]: dv,
      };
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
      };
      const { get, set } = getDescriptor(member, env);
      expect(() => set.call(object, 123n)).to.throw(TypeError);
      // force a specific error
      Object.defineProperty(object, MEMORY, {
        get() {
          throw new Error('Bogus man!');
        }
      });
      expect(() => get.call(object)).to.throw();
      expect(() => set.call(object, 123)).to.throw();
    })
    it('should throw range error when indexing beyond an array after WASM memory detachment', function() {
      const memory = new WebAssembly.Memory({
        initial: 128,
        maximum: 1024,
      });
      const dv = new DataView(memory.buffer, 0, 8);
      dv[MEMORY] = { memory, address: 0, len: 8 };
      const object = {
        [MEMORY]: dv,
      };
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        byteSize: 4,
      };
      const { get, set } = getDescriptor(member, env);
      memory.grow(1);
      expect(() => set.call(object, 4, 123)).to.throw(RangeError);
      // do it a second time to hit different branch
      expect(() => set.call(object, 4, 123)).to.throw(RangeError);
      memory.grow(1);
      expect(() => get.call(object, 4)).to.throw(RangeError);
      expect(() => get.call(object, 4)).to.throw(RangeError);
    })
    it('should return accessors that work correctly with regular ArrayBuffer', function() {
      const dv = new DataView(new ArrayBuffer(4));
      const object = {
        [MEMORY]: dv,
      };
      const member = {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      };
      const { get, set } = getDescriptor(member, env);
      set.call(object, 123);
      expect(get.call(object)).to.equal(123);
      expect(() => set.call(object, 123n)).to.throw(TypeError);
    })
    it('should return type accessors', function() {
      const DummyClass = function(value) {};
      const member = {
        type: MemberType.Type,
        slot: 5,
      };
      const object = {
        [SLOTS]: {
          5: { constructor: DummyClass },
        }
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(DummyClass);
      expect(set).to.be.undefined;
    })
    it('should return literal accessors', function() {
      const literal = { string: 'Hello' };
      const member = {
        type: MemberType.Literal,
        slot: 5,
      };
      const object = {
        [SLOTS]: {
          5: literal,
        }
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal('Hello');
      expect(set).to.be.undefined;
    })
    it('should return comptime value accessors', function() {
      const comptime = { $: 1234 };
      const member = {
        type: MemberType.Comptime,
        slot: 5,
        structure: { type: StructureType.Primitive },
      };
      const object = {
        [SLOTS]: {
          5: comptime,
        }
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(1234);
      expect(set).to.be.undefined;
    })
    it('should return comptime object accessors', function() {
      const comptime = { hello: 1234 };
      const member = {
        type: MemberType.Comptime,
        slot: 5,
        structure: { type: StructureType.Struct },
      };
      const object = {
        [SLOTS]: {
          5: comptime,
        }
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(comptime);
      expect(set).to.be.undefined;
    })
    it('should return static value accessors', function() {
      const staticObj = { $: 1234 };
      const member = {
        type: MemberType.Static,
        slot: 5,
        structure: { type: StructureType.Primitive },
      };
      const object = {
        [SLOTS]: {
          5: staticObj,
        }
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(1234);
      set.call(object, 4567);
      expect(staticObj.$).to.equal(4567);
    })
    it('should return static object accessors', function() {
      const staticObj = { $: 1234 };
      const member = {
        type: MemberType.Static,
        slot: 5,
        structure: { type: StructureType.Struct },
      };
      const object = {
        [SLOTS]: {
          5: staticObj,
        }
      };
      const { get, set } = getDescriptor(member, env);
      expect(get.call(object)).to.equal(staticObj);
      set.call(object, 4567);
      expect(staticObj.$).to.equal(4567);
    })
  })
})