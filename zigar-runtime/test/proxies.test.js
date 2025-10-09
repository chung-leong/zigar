import { expect } from 'chai';
import {
  MemberType, PointerFlag,
  StructureFlag, StructureType
} from '../src/constants.js';
import { defineEnvironment } from '../src/environment.js';
import '../src/mixins.js';
import { getProxyTarget } from '../src/proxies.js';
import { addressByteSize, addressSize } from './test-utils.js';

const Env = defineEnvironment();

describe('Proxies', function() {
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
})
