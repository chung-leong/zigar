import { expect } from 'chai';
import 'mocha-skip-if';
import { ExportFlag, MemberType, PointerFlag, StructureFlag, StructureType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ENVIRONMENT, FIXED, MEMORY, SLOTS, VISIT } from '../../src/symbols.js';
import { addressByteSize, addressSize, setUsize, usize } from '../test-utils.js';

const Env = defineEnvironment();

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
    it('should allocate new buffer and copy data using copyExternBytes', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000;
      env.copyExternBytes = (dv, address, len) => {
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
      env.copyExternBytes = (dv, address, len) => {};
      let recv, arg;
      const structure = {
        constructor: function(dv) {
          recv = this;
          arg = dv;
          return {};
        }
      };
      const object = env.castView(1234, 0, true, structure);
      expect(recv).to.equal(ENVIRONMENT);
    })
    it('should try to create targets of pointers', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000;
      env.copyExternBytes = (dv, address, len) => {};
      let visitor;
      const structure = {
        constructor: function(dv) {
          return {
            [VISIT]: function(f) { visitor = f },
          };
        },
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
      };
      const object = env.castView(1234, 8, true, structure);
    })
  })
  describe('acquireStructures', function() {
    it('should invoke the factory thunk', function() {
      const env = new Env();
      env.getFactoryThunk = function() {
        return 0x1234;
      };
      let thunkAddress, optionsDV;
      env.invokeThunk = function(...args) {
        thunkAddress = this.getViewAddress(args[0][MEMORY]);
        optionsDV = args[2][MEMORY];
      };
      env.acquireStructures({ omitFunctions: true, omitVariables: true });
      expect(thunkAddress).to.equal(0x1234);
      expect(!!(optionsDV.getUint32(0, env.littleEndian) & ExportFlag.OmitMethods)).to.be.true;
      expect(!!(optionsDV.getUint32(0, env.littleEndian) & ExportFlag.OmitVariables)).to.be.true;
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
      env.copyExternBytes = (dv, address, len) => {};
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
      env.copyExternBytes = (dv, address, len) => {};
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
    it('should add objects in fixed memory to variable list', function() {
      const env = new Env();
      const addressMap = new Map();
      env.getViewAddress = (dv) => addressMap.get(dv);
      env.getMemoryOffset = (address) => Number(address);
      env.copyExternBytes = (dv, address, len) => {};
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
      object[MEMORY][FIXED] = { address: 1016n, len: 8 };
      const module = env.useStructures();
      expect(env.variables.length).to.equal(1);
    })
  })
  describe('hasMethods', function() {
    it('should return false when there are no exported functions', function() {
      const env = new Env();
      expect(env.hasMethods()).to.be.false;
    })
    it('should return true when there ar exported functions', function() {
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
        length: 2,
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
      const structure = env.beginStructure({
        type: StructureType.Function,
        name: 'fn(i32, i32) i32',
        byteSize: 8,
      });
      env.attachMember(structure, {
        type: MemberType.Object,
        structure: argStructure,
      });
      const thunk = { [MEMORY]: fixed(0x1004) };
      env.attachTemplate(structure, thunk, false);
      env.defineStructure(structure);
      env.endStructure(structure);
      expect(env.hasMethods()).to.be.true;
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
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
        name: '*Int32',
        byteSize: addressByteSize,
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
        byteSize: addressByteSize * 2,
      });
      env.attachMember(structure, {
        name: 'dog',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: 0,
        byteSize: addressByteSize,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'cat',
        type: MemberType.Object,
        bitSize: addressSize,
        bitOffset: addressSize,
        byteSize: addressByteSize,
        slot: 1,
        structure: ptrStructure,
      })
      const dv = new DataView(new ArrayBuffer(8 * 2));
      setUsize.call(dv, 0, usize(0x1000), true);
      setUsize.call(dv, addressByteSize, usize(0x2000), true);
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
        { address: usize(0x1000), len: 4 },
        { address: usize(0x2000), len: 4 }
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

function fixed(address, len = 0) {
  const dv = new DataView(new ArrayBuffer(len));
  dv[FIXED] = { address: usize(address), len };
  return dv;
}
