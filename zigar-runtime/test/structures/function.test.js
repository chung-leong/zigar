import { expect } from 'chai';
import { MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';

import AccessorAll from '../../src/accessors/all.js';
import Baseline from '../../src/features/baseline.js';
import CallMarshalingOutbound from '../../src/features/call-marshaling-outbound.js';
import DataCopying from '../../src/features/data-copying.js';
import IntConversion from '../../src/features/int-conversion.js';
import MemoryMapping from '../../src/features/memory-mapping.js';
import StructureAcquisition from '../../src/features/structure-acquisition.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll from '../../src/members/all.js';
import MemberInt from '../../src/members/int.js';
import MemberPrimitive from '../../src/members/primitive.js';
import MemberTypeMixin from '../../src/members/type.js';
import MemberUint from '../../src/members/uint.js';
import All from '../../src/structures/all.js';
import StructureArgStruct from '../../src/structures/arg-struct.js';
import Function, {
  isNeededByStructure,
} from '../../src/structures/function.js';
import Primitive from '../../src/structures/primitive.js';
import { FIXED, MEMORY, SIZE } from '../../src/symbols.js';
import { usize } from '../test-utils.js';

const Env = defineClass('PrimitiveTest', [
  AccessorAll, MemberInt, MemberPrimitive, MemberAll, All, Primitive, DataCopying,
  StructureAcquisition, ViewManagement, MemberTypeMixin, IntConversion, MemberUint, Baseline,
  Function, StructureArgStruct, CallMarshalingOutbound, MemoryMapping,
]);

describe('Structure: function', function() {
  describe('isNeededByStructure', function() {
    it('should return true when structure is a function', function() {
      const structure = {
        type: StructureType.Function,
        instance: {}
      };
      expect(isNeededByStructure(structure)).to.be.true;
    })
    it('should return true when structure is not a function', function() {
      const structure = {
        type: StructureType.SinglePointer,
        instance: {
          members: [
            {
              type: MemberType.Object,
              structure: {
                type: StructureType.Function,
              }
            }
          ]
        }
      };
      expect(isNeededByStructure(structure)).to.be.false;
    })
  })
  describe('defineFunction', function() {
  })
  describe('defineStructure', function() {
    it('should return a function', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
        flags: StructureFlag.HasValue,
      });
      env.attachMember(intStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.defineStructure(intStructure);
      env.endStructure(intStructure);
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 4 * 3,
      });
      env.attachMember(argStructure, {
        name: 'retval',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '0',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.attachMember(argStructure, {
        name: '1',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 64,
        byteSize: 4,
        structure: intStructure,
      });
      const ArgStruct = env.defineStructure(argStructure);
      env.endStructure(argStructure);
      const structure = {
        type: StructureType.Function,
        name: 'fn(i32, i32) i32',
        byteSize: 8,
        instance: {},
        static: { members: [] },
      };
      structure.instance.members = [
        {
          type: MemberType.Object,
          structure: argStructure,
        }
      ];
      const thunk = {
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      };
      thunk[MEMORY][FIXED] = { address: usize(0x1004) };
      env.attachTemplate(structure, thunk, false);
      const descriptors = {};
      const constructor = env.defineFunction(structure, descriptors);
      expect(constructor).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(0));
      dv[FIXED] = { address: usize(0x2008) };
      const f = constructor(dv);
      expect(f).to.be.a('function');
      let thunkAddress, fnAddress, argStruct;
      env.runThunk = (...args) => {
        thunkAddress = args[0];
        fnAddress = args[1];
        argStruct = args[2];
        return true;
      };
      env.allocateExternMemory = function(address, len) {
        return usize(0x4000);
      };
      env.freeExternMemory = function() {
      }
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 128 });
      }
      expect(() => f(1, 2)).to.not.throw();
      expect(thunkAddress).to.equal(usize(0x1004));
      expect(fnAddress).to.equal(usize(0x2008));
      if (process.env.TARGET === 'wasm') {
        expect(argStruct).to.equal(usize(0x4000));
        argStruct = ArgStruct(new DataView(env.memory.buffer, 0x4000, ArgStruct[SIZE]));
      } else if (process.env.TARGET === 'node') {
        expect(argStruct).to.be.instanceOf(DataView);
        argStruct = ArgStruct(argStruct);
      }
      expect(argStruct[0]).to.equal(1);
      expect(argStruct[1]).to.equal(2);
    })
  })
})