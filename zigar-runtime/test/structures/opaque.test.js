import { expect } from 'chai';
import {
  MemberFlag, MemberType,
  OptionalFlag, PointerFlag, StructureFlag, StructurePurpose, StructureType
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ENVIRONMENT, INITIALIZE, MEMORY, SLOTS, ZIG } from '../../src/symbols.js';
import { usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Structure: opaque', function () {
  describe('defineOpaque', function () {
    it('should return a function', function () {
      const structure = {
        type: StructureType.Opaque,
        signature: 0n,
        instance: {
          members: [
          ],
        },
        static: {},
      };
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineOpaque(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function () {
      const structure = {
        type: StructureType.Opaque,
        signature: 0n,
        instance: {
          members: [
          ],
        },
        static: {},
      };
      const env = new Env();
      const descriptors = {};
      env.defineOpaque(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
    })
  })
  describe('defineStructure', function () {
    it('should define an opaque structure', function () {
      const env = new Env();
      const structure = {
        type: StructureType.Opaque,
        byteSize: 0,
        name: 'Hello',
        signature: 0n,
        instance: {
          members: [
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      const Hello = structure.constructor;
      env.finishStructure(structure);
      expect(Hello).to.be.a('function');
      const dv = new DataView(new ArrayBuffer(0));
      const object = Hello.call(ENVIRONMENT, dv);
      expect(String(object)).to.equal('[opaque Hello]');
      expect(Number(object)).to.be.NaN;
      expect(object.valueOf()).to.eql({});
      expect(JSON.stringify(object)).to.equal('{}');
      expect(() => object.$).to.throw(TypeError);
      expect(() => new Hello(undefined)).to.throw(TypeError);
    })
    it('should not allow the creation of opaque instances', function () {
      const env = new Env();
      const structure = {
        type: StructureType.Opaque,
        name: 'Hello',
        signature: 0n,
        instance: {
          members: [
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      const Hello = structure.constructor;
      env.finishStructure(structure);
      expect(() => new Hello()).to.throw(TypeError);
    })
    it('should define an iterator opaque', function () {
      const env = new Env();
      const structure = {
        type: StructureType.Opaque,
        purpose: StructurePurpose.Iterator,
        flags: 0,
        byteSize: 4,
        signature: 0n,
        instance: {
          members: [
          ],
        },
        static: {},
      };
      env.beginStructure(structure);
      const Hello = structure.constructor;
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*Hello',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: 0,
              byteSize: 8,
              structure,
              slot: 0,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const optStructure = {
        type: StructureType.Optional,
        flags: StructureFlag.HasValue | OptionalFlag.HasSelector,
        name: '?i32',
        byteSize: 5,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: {},
            },
            {
              type: MemberType.Bool,
              bitSize: 1,
              bitOffset: 32,
              byteSize: 1,
              structure: {},
            },
          ],
        },
        static: {},
      };
      env.beginStructure(optStructure);
      env.finishStructure(optStructure);
      const argStructure = {
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Argument',
        byteSize: 13,
        length: 1,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'retval',
              type: MemberType.Object,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 5,
              structure: optStructure,
            },
            {
              name: '0',
              type: MemberType.Object,
              bitSize: 64,
              bitOffset: optStructure.byteSize * 8,
              byteSize: 8,
              structure: ptrStructure,
              slot: 0,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(argStructure);
      env.finishStructure(argStructure);
      const fnStructure = {
        type: StructureType.Function,
        name: 'fn (*Hello) ?i32',
        byteSize: 0,
        signature: 0n,
        instance: {
          members: [
            {
              byteSize: argStructure.byteSize,
              bitSize: argStructure.byteSize * 8,
              bitOffset: 0,
              structure: argStructure,
            },
          ],
          template: {
            [MEMORY]: (() => {
              const dv = new DataView(new ArrayBuffer(0));
              dv[ZIG] = { address: usize(0x8888) };
              return dv;
            })(),
          },
        },
      };
      env.beginStructure(fnStructure);
      const Next = fnStructure.constructor;
      const fnDV = new DataView(new ArrayBuffer(0));
      fnDV[ZIG] = { address: usize(0x1_8888) };
      const next = Next.call(ENVIRONMENT, fnDV);
      structure.static = {
        members: [
          {
            name: 'next',
            type: MemberType.Object,
            flags: MemberFlag.IsReadOnly | MemberFlag.IsMethod,
            slot: 0,
            structure: fnStructure,
          },
        ],
        template: {
          [SLOTS]: {
            0: next,
          }
        },
      };
      env.finishStructure(fnStructure);
      env.finishStructure(structure);
      let i = 0, thunkAddress, fnAddress, argBuffer;
      env.runThunk = function (...args) {
        thunkAddress = args[0];
        fnAddress = args[1];
        let argDV;
        if (process.env.TARGET === 'wasm') {
          argDV = new DataView(env.memory.buffer, args[2], 13);
        } else {
          argDV = new DataView(argBuffer, 0, 13);
        }
        if (i++ < 5) {
          argDV.setInt32(0, i, true);
          argDV.setInt8(4, 1);
        } else {
          argDV.setInt32(0, 0, true);
          argDV.setInt8(4, 0);
        }
        return true;
      };
      if (process.env.TARGET === 'wasm') {
        env.allocateScratchMemory = function (len, align) {
          return 0x1000;
        };
        env.freeScratchMemory = function (address) {
        };
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else if (process.env.TARGET === 'node') {
        env.getBufferAddress = function (buffer) {
          argBuffer = buffer;
          return 0x1000n;
        }
      }
      const dv = new DataView(new ArrayBuffer(4));
      const object = Hello(dv);
      const results = [];
      for (const value of object) {
        results.push(value);
      }
      expect(results).to.eql([1, 2, 3, 4, 5]);
      expect(thunkAddress).to.equal(usize(0x8888));
      expect(fnAddress).to.equal(usize(0x1_8888));
    })
  })
})