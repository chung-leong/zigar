import { expect } from 'chai';
import {
  MemberFlag, MemberType, OpaqueFlag, OptionalFlag, PointerFlag, StructureFlag, StructureType,
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ENVIRONMENT, INITIALIZE, MEMORY, SLOTS, ZIG } from '../../src/symbols.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Structure: opaque', function() {
  describe('defineOpaque', function() {
    it('should return a function', function() {
      const structure = {
        type: StructureType.Opaque,
        instance: { members: [] },
        static: { members: [] },
      };
      const env = new Env();
      const descriptors = {};
      const constructor = env.defineOpaque(structure, descriptors);
      expect(constructor).to.be.a('function');
    })
    it('should add descriptors to the given object', function() {
      const structure = {
        type: StructureType.Opaque,
        instance: { members: [] },
        static: { members: [] },
      };
      const env = new Env();
      const descriptors = {};
      env.defineOpaque(structure, descriptors);
      expect(descriptors.$?.get).to.be.a('function');
      expect(descriptors.$?.set).to.be.a('function');
      expect(descriptors[INITIALIZE]?.value).to.be.a('function');
    })
  })
  describe('defineStructure', function() {
    it('should define an opaque structure', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        byteSize: 0,
        name: 'Hello',
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
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
    it('should not allow the creation of opaque instances', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
      });
      const Hello = env.defineStructure(structure);
      env.endStructure(structure);
      expect(() => new Hello()).to.throw(TypeError);
    })
    it('should define an iterator opaque', function() {
      const env = new Env();
      const structure = env.beginStructure({
        type: StructureType.Opaque,
        flags: OpaqueFlag.IsIterator,
        byteSize: 4,
      });
      const Hello = env.defineStructure(structure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*Hello',
        byteSize: 8,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure,
        slot: 0,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const optStructure = env.beginStructure({
        type: StructureType.Optional,
        flags: StructureFlag.HasValue | OptionalFlag.HasSelector,
        name: '?i32',
        byteSize: 5,
      });
      env.attachMember(optStructure, {
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.attachMember(optStructure, {
        type: MemberType.Bool,
        bitSize: 1,
        bitOffset: 32,
        byteSize: 1,
        structure: {},
      });
      env.defineStructure(optStructure);
      env.endStructure(optStructure);
      const argStructure = env.beginStructure({
        type: StructureType.ArgStruct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Argument',
        byteSize: 13,
        length: 1,
      });
      env.attachMember(argStructure, {
        name: 'retval',
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 5,
        structure: optStructure,
      });
      env.attachMember(argStructure, {
        name: '0',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: optStructure.byteSize * 8,
        byteSize: 8,
        structure: ptrStructure,
        slot: 0,
      });
      env.defineStructure(argStructure);
      env.endStructure(argStructure);
      const fnStructure = env.beginStructure({
        type: StructureType.Function,
        name: 'fn (*Hello) ?i32',
        byteSize: 0,
      });
      env.attachMember(fnStructure, {
        byteSize: argStructure.byteSize,
        bitSize: argStructure.byteSize * 8,
        bitOffset: 0,
        structure: argStructure,
      });
      const thunk = {
        [MEMORY]: new DataView(new ArrayBuffer(0)),
      };
      thunk[MEMORY][ZIG] = { address: usize(0x8888) };
      env.attachTemplate(fnStructure, thunk, false);
      const Next = env.defineStructure(fnStructure);
      env.endStructure(fnStructure);
      env.attachMember(structure, {
        name: 'next',
        type: MemberType.Object,
        flags: MemberFlag.IsReadOnly | MemberFlag.IsMethod,
        slot: 0,
        structure: fnStructure,
      }, true);
      const fnDV = new DataView(new ArrayBuffer(0));
      fnDV[ZIG] = { address: usize(0x1_8888) };
      const next = Next.call(ENVIRONMENT, fnDV);
      env.attachTemplate(structure, {
        [SLOTS]: {
          0: next,
        }
      }, true);
      env.endStructure(structure);
      let i = 0, thunkAddress, fnAddress, argBuffer;
      env.runThunk = function(...args) {
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
        env.allocateScratchMemory = function(len, align) {
          return 0x1000;
        };
        env.freeScratchMemory = function(address) {
        };
        env.memory = new WebAssembly.Memory({ initial: 128 });
      } else if (process.env.TARGET === 'node') {
        env.getBufferAddress = function(buffer) {
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
      expect(results).to.eql([ 1, 2, 3, 4, 5 ]);
      expect(thunkAddress).to.equal(usize(0x8888));
      expect(fnAddress).to.equal(usize(0x1_8888));
    })
  })
})