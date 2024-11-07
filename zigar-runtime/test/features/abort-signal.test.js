import { expect } from 'chai';
import 'mocha-skip-if';
import {
  MemberType, PointerFlag, StructFlag, StructureFlag, StructureType
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { CONTEXT } from '../../src/symbols.js';
import { CallContext } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Feature: abort-signal', function() {
  describe('createSignalArray', function() {
    it('should create an Int32 object', async function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
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
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*const i32',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
        slot: 0,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const signalStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'AbortSignal',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | StructFlag.IsAbortSignal,
      });
      env.attachMember(signalStructure, {
        name: 'ptr',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: ptrStructure,
        slot: 0,
      });
      env.defineStructure(signalStructure);
      env.endStructure(signalStructure);
      const args = {
        [CONTEXT]: new CallContext(),
      };
      const int32 = env.createSignalArray(args, signalStructure, null);
      expect(int32.$).to.equal(0);
    })
    it('should create an Int32 object hooked to an abort signal', async function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
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
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*const i32',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
        slot: 0,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const signalStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'AbortSignal',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | StructFlag.IsAbortSignal,
      });
      env.attachMember(signalStructure, {
        name: 'ptr',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: ptrStructure,
        slot: 0,
      });
      env.defineStructure(signalStructure);
      env.endStructure(signalStructure);
      const args = {
        [CONTEXT]: new CallContext(),
      };
      const controller = new AbortController();
      const { signal } = controller;
      const int32 = env.createSignalArray(args, signalStructure, signal);
      expect(int32.$).to.equal(0);
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
        env.allocateExternMemory = function(len, align) {
          return 0x1000;
        };
        env.createShadow(args[CONTEXT], int32);
      }
      controller.abort();
      if (process.env.TARGET === 'wasm') {
        env.updateShadowTargets(args[CONTEXT]);
      }
      expect(int32.$).to.equal(1);
    })
    it('should create an Int32 object with value 1 when abort signal has already fired', async function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
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
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*const i32',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | PointerFlag.IsSingle | PointerFlag.IsConst,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
        slot: 0,
      });
      env.defineStructure(ptrStructure);
      env.endStructure(ptrStructure);
      const signalStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'AbortSignal',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject | StructFlag.IsAbortSignal,
      });
      env.attachMember(signalStructure, {
        name: 'ptr',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        structure: ptrStructure,
        slot: 0,
      });
      env.defineStructure(signalStructure);
      env.endStructure(signalStructure);
      const args = {
        [CONTEXT]: new CallContext(),
      };
      const controller = new AbortController();
      const { signal } = controller;
      controller.abort();
      const int32 = env.createSignalArray(args, signalStructure, signal);
      expect(int32.$).to.equal(1);
    })
  })
})
