import { expect } from 'chai';
import 'mocha-skip-if';
import {
    MemberType, PointerFlag,
    StructureFlag, StructurePurpose, StructureType
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { MEMORY } from '../../src/symbols.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: abort-signal', function() {
  describe('createSignal', function() {
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
        purpose: StructurePurpose.AbortSignal,
        name: 'AbortSignal',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject,
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
      const { ptr: int32 } = env.createSignal(signalStructure, null);
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
        purpose: StructurePurpose.AbortSignal,
        name: 'AbortSignal',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject,
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
      const controller = new AbortController();
      const { signal } = controller;
      const { ptr: int32 } = env.createSignal(signalStructure, signal);
      expect(int32.$).to.equal(0);
      const context = env.startContext();
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
        env.allocateScratchMemory = function(len, align) {
          return 0x1000;
        };
      } else {
        env.getBufferAddress = function() {
          return usize(0x1000);
        };
      }
      env.getTargetAddress(context, int32, null, true);
      controller.abort();
      if (process.env.TARGET === 'wasm') {
        const shadowDV = env.findShadowView(int32[MEMORY]);
        expect(shadowDV.getInt32(0, true)).to.equal(1);
        env.updateShadowTargets(context);
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
        purpose: StructurePurpose.AbortSignal,
        name: 'AbortSignal',
        byteSize: 8,
        flags: StructureFlag.HasPointer | StructureFlag.HasSlot | StructureFlag.HasObject,
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
      const controller = new AbortController();
      const { signal } = controller;
      controller.abort();
      const { ptr: int32 } = env.createSignal(signalStructure, signal);
      expect(int32.$).to.equal(1);
    })
  })
})
