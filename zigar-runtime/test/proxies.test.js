import { expect } from 'chai';
import {
  MemberType, PointerFlag, ProxyType, StructureFlag, StructureType,
} from '../src/constants.js';
import { defineEnvironment } from '../src/environment.js';
import '../src/mixins.js';
import { addressByteSize, addressSize } from './test-utils.js';

import {
  getProxy,
  getProxyTarget,
  getProxyType,
  getReadOnlyProxy,
} from '../src/proxies.js';
import { TARGET } from '../src/symbols.js';

const Env = defineEnvironment();

describe('Proxies', function() {
  describe('getProxy', function() {
    it('should create proxy for slice', function() {
      const array = { 
        get(index) {
          return index;
        },
      };
      const proxy = getProxy(array, ProxyType.Slice);
      expect(proxy[1]).to.equal(1);
      expect(proxy[2]).to.equal(2);
    })
    it('should create read-only proxy for slice', function() {
      const array = { 
        get(index) {
          return index;
        },
        set(index) {}
      };
      const proxy = getProxy(array, ProxyType.Slice | ProxyType.ReadOnly);
      expect(proxy[1]).to.equal(1);
      expect(() => proxy[2] = 123).to.throw();
      expect(() => proxy.set(2, 123)).to.throw();
    })
    it('should create proxy for pointer', function() {
      const target = { dog: 123 };
      const pointer = { 
        get ['*']() {
          return this[TARGET];
        },
        [TARGET]: target 
      };
      const proxy = getProxy(pointer, ProxyType.Pointer);
      expect(proxy['*']).to.equal(target);
      expect(proxy.dog).to.equal(123);
      proxy.dog = 456;
      expect(target.dog).to.equal(456);
    })
    it('should create proxy for const pointer', function() {
      const target = { dog: 123 };
      const pointer = { 
        get ['*']() {
          return this[TARGET];
        },
        [TARGET]: target 
      };
      const proxy = getProxy(pointer, ProxyType.Pointer | ProxyType.Const);
      expect(proxy['*']).to.not.equal(target);
      expect(proxy.dog).to.equal(123);
      expect(() => proxy.dog = 456).to.throw();
    })
    it('should create proxy for function pointer', function() {
      const target = () => 1234;
      const pointer = () => {};
      pointer['*'] = target;
      pointer[TARGET] = target;
      const proxy = getProxy(pointer, ProxyType.Pointer | ProxyType.Const);
      expect(proxy['*']).to.equal(target);
      expect(proxy()).to.equal(1234);
    })
  })
  describe('getProxyType', function() {
    it('should set slice flag for array', function() {
      const structure = {
        type: StructureType.Array,
        flags: StructureFlag.HasProxy,
      };
      const result = getProxyType(structure, false);
      expect(result).to.equal(ProxyType.Slice);
    })
    it('should set slice flag for slice', function() {
      const structure = {
        type: StructureType.Slice,
        flags: StructureFlag.HasProxy,
      };
      const result = getProxyType(structure, false);
      expect(result).to.equal(ProxyType.Slice);
    })
    it('should set pointer flag for pointer', function() {
      const structure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasProxy,
      };
      const result = getProxyType(structure, false);
      expect(result).to.equal(ProxyType.Pointer);
    })
    it('should set const flag when pointer is const', function() {
      const structure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasProxy | PointerFlag.IsConst,
      };
      const result = getProxyType(structure, false);
      expect(result).to.equal(ProxyType.Pointer | ProxyType.Const);
    })
    it('should set read-only flag when readOnly is true', function() {
      const structure = {
        type: StructureType.Struct,
        flags: 0,
      };
      const result = getProxyType(structure, true);
      expect(result).to.equal(ProxyType.ReadOnly);
    })
    it('should return 0 for function even when readOnly is true', function() {
      const structure = {
        type: StructureType.Function,
        flags: 0,
      };
      const result = getProxyType(structure, true);
      expect(result).to.equal(0);
    });
  })
  describe('getProxyTarget', function() {
    it('should return underlying pointer object', function() {
      const env = new Env();
      const intStructure = {
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const structure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasProxy | StructureFlag.HasSlot | PointerFlag.IsSingle,
        byteSize: addressByteSize,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: addressSize,
              bitOffset: 0,
              byteSize: addressByteSize,
              slot: 0,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
      const Int32Ptr = structure.constructor;
      expect(Int32Ptr.child).to.equal(Int32);
      const int32 = new Int32(1234);
      const intPointer = new Int32Ptr(int32);
      const proxy = getProxyTarget(intPointer)
      expect(proxy.target).to.be.instanceOf(Int32Ptr);
    })
  })
  describe('getReadOnlyProxy', function() {
    it('should read a proxy protecting an object from changes', function() {
      const target = { dog: 123 };
      const proxy = getReadOnlyProxy(target);
      expect(proxy).to.not.equal(target);
      expect(proxy.dog).to.equal(123);
      expect(() => proxy.dog = 456).to.throw();
      const proxyAgain = getReadOnlyProxy(target);
      expect(proxyAgain).to.equal(proxy);
    })
    it('should make a pointer target read-only', function() {
      const target = { dog: 123 };
      const pointer = { '*': target };
      const pointerProxy = getProxy(pointer, ProxyType.Pointer);
      const readOnlyProxy  = getReadOnlyProxy(pointerProxy);
      expect(readOnlyProxy['*']).to.equal(target);
      expect(() => readOnlyProxy['*'] = {}).to.throw();
    })
  })
})
