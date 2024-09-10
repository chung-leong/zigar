import { expect } from 'chai';
import { MemberType, StructureFlag, StructureType } from '../../src/constants.js';
import { defineClass } from '../../src/environment.js';
import { ENVIRONMENT, FIXED, MEMORY, SLOTS, VISIT } from '../../src/symbols.js';

import AccessorAll from '../../src/accessors/all.js';
import AccessorBool from '../../src/accessors/bool.js';
import Baseline from '../../src/features/baseline.js';
import DataCopying from '../../src/features/data-copying.js';
import IntConversion from '../../src/features/int-conversion.js';
import MemoryMapping from '../../src/features/memory-mapping.js';
import ModuleLoading from '../../src/features/module-loading.js';
import PointerSynchronization from '../../src/features/pointer-synchronization.js';
import StructureAcquisition from '../../src/features/structure-acquisition.js';
import ViewManagement from '../../src/features/view-management.js';
import MemberAll from '../../src/members/all.js';
import MemberBool from '../../src/members/bool.js';
import MemberObject from '../../src/members/object.js';
import PointerInStruct from '../../src/members/pointer-in-struct.js';
import MemberPrimitive from '../../src/members/primitive.js';
import MemberUint from '../../src/members/uint.js';
import MemberVoid from '../../src/members/void.js';
import StructureAll from '../../src/structures/all.js';
import ArgStruct from '../../src/structures/arg-struct.js';
import Pointer from '../../src/structures/pointer.js';
import StructurePrimitive from '../../src/structures/primitive.js';
import StructLike from '../../src/structures/struct-like.js';
import Struct from '../../src/structures/struct.js';

const Env = defineClass('FeatureTest', [
  Baseline, StructureAcquisition, StructureAll, ViewManagement, PointerSynchronization, Struct,
  StructLike, DataCopying, MemberAll, MemberBool, MemberPrimitive, StructurePrimitive, MemberUint,
  IntConversion, AccessorAll, AccessorBool, ModuleLoading, Pointer, MemberObject, PointerInStruct,
  ArgStruct, MemberVoid, MemoryMapping,
]);

describe('Feature: structure-acquisition', function() {
  describe('readSlot', function() {
    it('should read from global slots where target is null', function() {
      const env = new Env();
      const object = {}
      env.slots[1] = object;
      const result1 = env.readSlot(null, 1);
      const result2 = env.readSlot(null, 2);
      expect(result1).to.equal(object);
      expect(result2).to.be.undefined;
    })
    it('should read from slots of target object', function() {
      const env = new Env();
      const object = {}
      const target = {
        [SLOTS]: {
          1: object,
        }
      };
      const result1 = env.readSlot(target, 1);
      const result2 = env.readSlot(target, 2);
      expect(result1).to.equal(object);
      expect(result2).to.be.undefined;
    })
    it('should not throw where object does not have slots', function() {
      const env = new Env();
      const target = {};
      expect(() => env.readSlot(target, 1)).to.not.throw();
    })
  });
  describe('writeSlot', function() {
    it('should write into global slots where target is null', function() {
      const env = new Env();
      const object = {}
      env.writeSlot(null, 1, object);
      expect(env.slots[1]).to.equal(object);
    })
    it('should read from slots of target object', function() {
      const env = new Env();
      const object = {}
      const target = {
        [SLOTS]: {}
      };
      env.writeSlot(target, 1, object);
      expect(target[SLOTS][1]).to.equal(object);
    })
    it('should not throw where object does not have slots', function() {
      const env = new Env();
      const object = {}
      const target = {};
      expect(() => env.writeSlot(target, 1, object)).to.not.throw();
    })
  })
  describe('createTemplate', function() {
    it('should return a template object', function() {
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(8));
      const templ = env.createTemplate(dv);
      expect(templ[MEMORY]).to.equal(dv);
      expect(templ[SLOTS]).to.be.an('object');
    })
  })
  describe('beginStructure', function() {
    it('should return a structure object', function() {
      const env = new Env();
      const s = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        length: 1,
        byteSize: 16,
        align: 3,
        isConst: false,
      });
      expect(s.type).to.equal(StructureType.Struct);
      expect(s.name).to.equal('Hello');
      expect(s.byteSize).to.equal(16);
    })
  })
  describe('attachMember', function() {
    it('should add instance member', function() {
      const env = new Env();
      const s = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        length: 1,
        byteSize: 16,
        align: 3,
        isConst: false,
      });
      env.attachMember(s, {
        type: MemberType.Int,
        name: 'number',
        bitSize: 32,
        byteSize: 4,
        bitOffset: 0,
      }, false);
      expect(s.instance.members[0]).to.eql({
        type: MemberType.Int,
        name: 'number',
        bitSize: 32,
        byteSize: 4,
        bitOffset: 0,
      });
    })
    it('should add static member', function() {
      const env = new Env();
      const s = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        length: 1,
        byteSize: 16,
        align: 3,
        isConst: false,
      });
      env.attachMember(s, {
        type: MemberType.Int,
        name: 'number',
        bitSize: 32,
        byteSize: 4,
        bitOffset: 0,
      }, true);
      expect(s.static.members[0]).to.eql({
        type: MemberType.Int,
        name: 'number',
        bitSize: 32,
        byteSize: 4,
        bitOffset: 0,
      });
    })
  })
  describe('attachTemplate', function() {
    it('should attach instance template', function() {
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(8));
      const templ = env.createTemplate(dv);
      const s = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        length: 1,
        byteSize: 16,
        align: 3,
        isConst: false,
      });
      env.attachTemplate(s, templ, false);
      expect(s.instance.template).to.equal(templ);
    })
    it('should attach instance template', function() {
      const env = new Env();
      const dv = new DataView(new ArrayBuffer(8));
      const templ = env.createTemplate(dv);
      const s = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        length: 1,
        byteSize: 16,
        align: 3,
        isConst: false,
      });
      env.attachTemplate(s, templ, true);
      expect(s.static.template).to.equal(templ);
    })
  })
  describe('endStructure', function() {
    it('should add structure to list', function() {
      const env = new Env();
      const s = {
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
      };
      env.endStructure(s);
      expect(env.structures[0]).to.equal(s);
    })
  })
  describe('captureView', function() {
    it('should allocate new buffer and copy data using copyBytes', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000;
      env.copyBytes = (dv, address, len) => {
        dv.setInt32(0, address, true);
        dv.setInt32(4, len, true);
      };
      const dv = env.captureView(1234, 32, true);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.getInt32(0, true)).to.equal(1234);
      expect(dv.getInt32(4, true)).to.equal(32);
    })
    it('should get view of memory using obtainFixedView', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000;
      env.obtainFixedView = (address, len) => {
        return { address, len };
      };
      const result = env.captureView(1234, 32, false);
      expect(result).to.eql({ address: 1234, len: 32 });
    })
  })
  describe('castView', function() {
    it('should call constructor without the use of the new operator', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000;
      env.copyBytes = (dv, address, len) => {};
      let recv, arg;
      const structure = {
        constructor: function(dv) {
          recv = this;
          arg = dv;
          return {
            // [PROTECTOR]: () => {},
          };
        }
      };
      const object = env.castView(1234, 0, true, structure);
      expect(recv).to.equal(ENVIRONMENT);
    })
    it('should try to create targets of pointers', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000;
      env.copyBytes = (dv, address, len) => {};
      let visitor;
      const structure = {
        constructor: function(dv) {
          return {
            [VISIT]: function(f) { visitor = f },
            // [PROTECTOR]: () => {},
          };
        },
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
      };
      const object = env.castView(1234, 8, true, structure);
    })
  })
  describe('defineFactoryArgStruct', function() {
    it('should return constructor for factory function argument struct', function() {
      const env = new Env();
      const ArgStruct = env.defineFactoryArgStruct();
      const args = new ArgStruct([ { omitFunctions: true } ]);
      expect(args[0]).to.be.an('Options');
      expect(args.retval).to.be.undefined;
      const options = args[0];
      expect(options.omitFunctions).to.be.true;
    })
  })
  describe('acquireStructures', function() {
    it('should invoke the factory thunk', function() {
      const env = new Env();
      env.getFactoryThunk = function() {
        return 0x1234;
      };
      let thunkAddress, options;
      env.invokeThunk = function(...args) {
        thunkAddress = args[0];
        options = args[2][0];
      };
      env.acquireStructures({ omitFunctions: true });
      expect(thunkAddress).to.equal(0x1234);
      expect(options.omitFunctions).to.be.true;
    })
  })
  describe('getRootModule', function() {
    it('should return constructor of the last structure added', function() {
      const env = new Env();
      const s1 = {
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
      };
      env.endStructure(s1);
      const s2 = {
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
      };
      env.endStructure(s2);
      const constructor = env.getRootModule();
      expect(constructor).to.equal(s2.constructor);
    })
  })
  describe('hasMethods', function() {
    it('should return true when some structures have methods', function() {
      const env = new Env();
      const s1 = {
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
      };
      env.endStructure(s1);
      const s2 = {
        instance: { members: [], methods: [] },
        static: { members: [], methods: [
          {
            name: 'hello',
            argStruct: {},
          }
        ] },
        constructor: function() {},
      };
      env.endStructure(s2);
      const presence = env.hasMethods();
      expect(presence).to.be.true;
    })
  })
  describe('exportStructures', function() {
    it('should return list of structures and keys for accessing them', function() {
      const env = new Env();
      const s1 = {
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
      };
      env.endStructure(s1);
      const s2 = {
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
      };
      env.endStructure(s2);
      const { structures, keys } = env.exportStructures();
      expect(structures[0]).to.equal(s1);
      expect(structures[1]).to.equal(s2);
      expect(Object.values(keys)).to.include(MEMORY);
      expect(Object.values(keys)).to.include(SLOTS);
    })
  })
  describe('prepareObjectsForExport', function() {
    it('should combine data views that overlaps the same memory region', function() {
      const env = new Env();
      env.getViewAddress = (dv) => dv[FIXED].address;
      env.getMemoryOffset = (address) => Number(address);
      env.copyBytes = (dv, address, len) => {};
      const fixed = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv[FIXED] = { address, len }
        return dv;
      };
      const templ1 = {
        [MEMORY]: fixed(1002n, 8),
      };
      const object = {
        [MEMORY]: fixed(1016n, 8),
      };
      const templ2 = {
        [MEMORY]: fixed(1000n, 32),
        [SLOTS]: {
          0: object,
        },
      };
      env.structures = [
        {
          instance: { template: templ1 },
          static: {}
        },
        {
          instance: {},
          static: { template: templ2 },
        },
      ];
      env.prepareObjectsForExport();
      expect(templ1[MEMORY].buffer).to.equal(templ2[MEMORY].buffer);
      expect(templ1[MEMORY].byteOffset).to.equal(2);
      expect(object[MEMORY].buffer).to.equal(templ2[MEMORY].buffer);
      expect(object[MEMORY].byteOffset).to.equal(16);
    })
  })
  describe('useStructures', function() {
    it('should remove comptime structures and return constructor of root module', function() {
      const env = new Env();
      const addressMap = new Map();
      env.getViewAddress = (dv) => addressMap.get(dv);
      env.getMemoryOffset = (address) => Number(address);
      env.copyBytes = (dv, address, len) => {};
      const templ1 = {
        [MEMORY]: new DataView(new ArrayBuffer(8))
      };
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(8))
      };
      const templ2 = {
        [MEMORY]: new DataView(new ArrayBuffer(32)),
        [SLOTS]: {
          0: object,
        },
      };
      const constructor = function() {};
      env.structures = [
        {
          instance: { template: templ1 },
          static: {}
        },
        {
          instance: {},
          static: { template: templ2 },
          constructor,
        },
      ];
      addressMap.set(templ1[MEMORY], 1002n);
      addressMap.set(templ2[MEMORY], 1000n);
      addressMap.set(object[MEMORY], 1016n);
      const module = env.useStructures();
      expect(module).to.equal(constructor);
      expect(env.structures).to.eql([]);
      expect(env.slots).to.eql({});
    })
  })
  describe('acquireDefaultPointers', function() {
    it('should acquire targets of pointers in structure template slots', function() {
      const env = new Env();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        flags: StructureFlag.HasValue,
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: intStructure,
      });
      const Int32 = env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | StructureFlag.IsSingle,
        name: '*Int32',
        byteSize: 8,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      const Int32Ptr = env.defineStructure(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Struct,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        name: 'Hello',
        byteSize: 8 * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 64,
        byteSize: 8,
        slot: 1,
        structure: ptrStructure,
      })
      const dv = new DataView(new ArrayBuffer(8 * 2));
      dv.setBigUint64(0, 0x1000n, true);
      dv.setBigUint64(8, 0x2000n, true);
      const template = env.createTemplate(dv);
      env.attachTemplate(structure, template);
      env.defineStructure(structure);
      env.endStructure(structure);
      // function mocks
      const requests = [];
      env.obtainExternView = function(address, len) {
        requests.push({ address, len });
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
        const dv = this.obtainView(buffer, 0, len);
        dv.setUint32(0, Number(address), true);
        return dv;
      };
      env.acquireDefaultPointers(structure);
      expect(requests).to.eql([
        { address: 0x1000n, len: 4 },
        { address: 0x2000n, len: 4 }
      ]);
      expect(template[SLOTS][0]).to.be.instanceOf(Int32Ptr);
      expect(template[SLOTS][0][SLOTS][0]).to.be.instanceOf(Int32);
      expect(template[SLOTS][0]['*']).to.equal(0x1000);
      expect(template[SLOTS][1]).to.be.instanceOf(Int32Ptr);
      expect(template[SLOTS][1][SLOTS][0]).to.be.instanceOf(Int32);
      expect(template[SLOTS][1][SLOTS][0]).to.not.equal(template[SLOTS][0][SLOTS][0]);
      expect(template[SLOTS][1]['*']).to.equal(0x2000);
    })
  })
  if (process.env.TARGET === 'wasm') {
    describe('beginDefinition', function() {
      it('should return an empty object', function() {
        const env = new Env();
        const def1 = env.beginDefinition();
        expect(def1).to.be.an('object');
        const { _beginDefinition } = env.exportFunctions();
        const def2 = env.fromWebAssembly('v', _beginDefinition());
        expect(def2).to.be.an('object');
      })
    })
    describe('insertProperty', function() {
      it('should insert value into object', function() {
        const env = new Env();
        const def1 = env.beginDefinition();
        env.insertProperty(def1, 'hello', 1234);
        expect(def1).to.have.property('hello', 1234);
        const {
          _beginDefinition,
          _insertInteger,
          _insertBoolean,
          _insertString,
          _insertObject,
        } = env.exportFunctions();
        const object = {};
        const defIndex = _beginDefinition();
        _insertInteger(defIndex, env.toWebAssembly('s', 'number'), 4567);
        _insertBoolean(defIndex, env.toWebAssembly('s', 'boolean'), 1);
        _insertString(defIndex, env.toWebAssembly('s', 'string'), env.toWebAssembly('s', 'holy cow'));
        _insertObject(defIndex, env.toWebAssembly('s', 'object'), env.toWebAssembly('v', object));
        const def2 = env.fromWebAssembly('v', defIndex);
        expect(def2).to.have.property('number', 4567);
        expect(def2).to.have.property('boolean', true);
        expect(def2).to.have.property('string', 'holy cow');
        expect(def2).to.have.property('object', object);
      })
    })
    describe('captureString', function() {
      it('should return string located at address', function() {
        const env = new Env();
        const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
        const text = 'Hello';
        const src = new DataView(memory.buffer, 128, 16);
        for (let i = 0; i < text.length; i++) {
          src.setUint8(i, text.charCodeAt(i));
        }
        const string = env.captureString(128, 5);
        expect(string).to.equal('Hello');
      })
    })
    describe('getMemoryOffset', function() {
      it('should return the same address', function() {
        const env = new Env();
        const offset = env.getMemoryOffset(128);
        expect(offset).to.equal(128);
      })
    })
  }
})