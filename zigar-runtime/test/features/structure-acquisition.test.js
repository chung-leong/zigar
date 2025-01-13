import { expect } from 'chai';
import 'mocha-skip-if';
import {
  ErrorSetFlag, ExportFlag, MemberType, ModuleAttribute, PointerFlag, PrimitiveFlag, StructureFlag,
  StructureType,
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { ENVIRONMENT, MEMORY, SENTINEL, SLOTS, VISIT, ZIG } from '../../src/symbols.js';
import { usize } from '../test-utils.js';

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
        type: StructureType.Struct,
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
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
    it('should get view of memory using obtainZigView', function() {
      const env = new Env();
      env.getBufferAddress = () => 0x10000;
      env.obtainZigView = (address, len) => {
        const dv = new DataView(new ArrayBuffer(len));
        dv[ZIG] = { address, len };
        return dv;
      };
      if (process.env.TARGET === 'wasm') {
        const dv = env.captureView(1234, 32, false);
        expect(dv).to.be.instanceOf(DataView);
        expect(dv[ZIG]).to.eql({ address: 1234, len: 32, handle: 1234 });
      } else {
        const dv = env.captureView(1234n, 32, false, 0x8888n);
        expect(dv).to.be.instanceOf(DataView);
        expect(dv[ZIG]).to.eql({ address: 1234n, len: 32, handle: 0x8888n });
      }
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
        return usize(0x1234);
      };
      let thunkAddress, optionsDV;
      env.invokeThunk = function(...args) {
        thunkAddress = this.getViewAddress(args[0][MEMORY]);
        optionsDV = args[2][MEMORY];
      };
      env.getModuleAttributes = function() {
        return ModuleAttribute.LittleEndian;
      };
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      }
      env.acquireStructures({ omitFunctions: true, omitVariables: true });
      expect(thunkAddress).to.equal(usize(0x1234));
      expect(!!(optionsDV.getUint32(0, env.littleEndian) & ExportFlag.OmitMethods)).to.be.true;
      expect(!!(optionsDV.getUint32(0, env.littleEndian) & ExportFlag.OmitVariables)).to.be.true;
    })
  })
  describe('getRootModule', function() {
    it('should return constructor of the last structure added', function() {
      const env = new Env();
      const s1 = {
        type: StructureType.Struct,
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
      };
      env.endStructure(s1);
      const s2 = {
        type: StructureType.Struct,
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
    it('should return list of structures', function() {
      const env = new Env();
      const s1 = {
        type: StructureType.Struct,
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
      };
      env.endStructure(s1);
      const s2 = {
        type: StructureType.Struct,
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
      };
      env.endStructure(s2);
      const { structures, keys } = env.exportStructures();
      expect(structures[0]).to.equal(s1);
      expect(structures[1]).to.equal(s2);
    })
  })
  describe('prepareObjectsForExport', function() {
    it('should combine data views that overlaps the same memory region', function() {
      const env = new Env();
      env.getViewAddress = (dv) => dv[ZIG].address;
      env.getMemoryOffset = (address) => Number(address);
      env.copyExternBytes = (dv, address, len) => {};
      const zig = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv[ZIG] = { address, len }
        return dv;
      };
      const templ1 = {
        [MEMORY]: zig(usize(1002), 8),
      };
      const object = {
        [MEMORY]: zig(usize(1016), 8),
      };
      const templ2 = {
        [MEMORY]: zig(usize(1000), 32),
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
    it('should add objects in Zig memory to variable list', function() {
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
      object[MEMORY][ZIG] = { address: 1016n, len: 8 };
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
      const thunk = { [MEMORY]: zig(0x1004) };
      env.attachTemplate(structure, thunk, false);
      env.defineStructure(structure);
      env.endStructure(structure);
      expect(env.hasMethods()).to.be.true;
    })
  })
  describe('getPrimitiveName', function() {
    it('should return correct name for bool', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Bool,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('bool');
    })
    it('should return correct name for int', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('i32');
    })
    it('should return correct name for uint', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('u32');
    })
    it('should return correct name for isize', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        flags: PrimitiveFlag.IsSize,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitSize: 32,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('isize');
    })
    it('should return correct name for usize', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        flags: PrimitiveFlag.IsSize,
        instance: {
          members: [
            {
              type: MemberType.Uint,
              bitSize: 32,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('usize');
    })
    it('should return correct name for float', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Float,
              bitSize: 64,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('f64');
    })
    it('should return correct name for void', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Void,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('void');
    })
    it('should return correct name for enum literal', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Literal,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('enum_literal');
    })
    it('should return correct name for null', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Null,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('null');
    })
    it('should return correct name for undefined', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Undefined,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('undefined');
    })
    it('should return correct name for type', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Type,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('type');
    })
    it('should return correct name for comptime', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Object,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('comptime');
    })
    it('should return correct name for unsupported', function() {
      const env = new Env();
      const name = env.getPrimitiveName({
        type: StructureType.Primitive,
        instance: {
          members: [
            {
              type: MemberType.Unsupported,
            }
          ],
        },
        static: {},
      });
      expect(name).to.equal('unknown');
    })
  })
  describe('getArrayName', function() {
    it('should return correct name for array', function() {
      const env = new Env();
      const name = env.getArrayName({
        type: StructureType.Array,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: { name: 'i32'}
            }
          ],
        },
        length: 4
      });
      expect(name).to.equal('[4]i32');
    })
  })
  describe('getStructName', function() {
    it('should return correct name for array', function() {
      const env = new Env();
      const name = env.getStructName({
        type: StructureType.Struct,
      });
      expect(name).to.equal('S0');
    })
  })
  describe('getUnionName', function() {
    it('should return correct name for union', function() {
      const env = new Env();
      const name = env.getUnionName({
        type: StructureType.Union,
      });
      expect(name).to.equal('U0');
    })
  })
  describe('getErrorUnionName', function() {
    it('should return correct name for error union', function() {
      const env = new Env();
      const name = env.getErrorUnionName({
        type: StructureType.ErrorUnion,
        instance: {
          members: [
            {
              type: MemberType.Bool,
              structure: { name: 'bool' },
            },
            {
              type: MemberType.Object,
              structure: { name: 'ES0'},
            },
          ]
        }
      });
      expect(name).to.equal('ES0!bool');
    })
  })
  describe('getErrorSetName', function() {
    it('should return correct name for error set', function() {
      const env = new Env();
      const name = env.getErrorSetName({
        type: StructureType.ErrorSet,
        flags: 0,
      });
      expect(name).to.equal('ES0');
    })
    it('should return correct name for anyerror', function() {
      const env = new Env();
      const name = env.getErrorSetName({
        type: StructureType.ErrorSet,
        flags: ErrorSetFlag.IsGlobal,
      });
      expect(name).to.equal('anyerror');
    })
  })
  describe('getEnumName', function() {
    it('should return correct name for enum', function() {
      const env = new Env();
      const name = env.getEnumName({
        type: StructureType.Enum,
        flags: 0,
      });
      expect(name).to.equal('EN0');
    })
  })
  describe('getOptionalName', function() {
    it('should return correct name for optional', function() {
      const env = new Env();
      const name = env.getOptionalName({
        type: StructureType.ErrorUnion,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: { name: 'i32' },
            },
            {
              type: MemberType.Bool,
              structure: { name: 'bool'},
            },
          ]
        }
      });
      expect(name).to.equal('?i32');
    })
  })
  describe('getPointerName', function() {
    it('should return correct name for single pointer', function() {
      const env = new Env();
      const name = env.getPointerName({
        type: StructureType.Pointer,
        flags: PointerFlag.IsSingle,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: { name: 'i32' },
            },
          ],
        }
      });
      expect(name).to.equal('*i32');
    })
    it('should return correct name for const single pointer', function() {
      const env = new Env();
      const name = env.getPointerName({
        type: StructureType.Pointer,
        flags: PointerFlag.IsSingle | PointerFlag.IsConst,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: { name: 'i32' },
            },
          ],
        }
      });
      expect(name).to.equal('*const i32');
    })
    it('should return correct name for slice pointer', function() {
      const env = new Env();
      const name = env.getPointerName({
        type: StructureType.Pointer,
        flags: PointerFlag.IsMultiple | PointerFlag.HasLength,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: { name: 'i32' },
            },
          ],
        }
      });
      expect(name).to.equal('[]i32');
    })
    it('should return correct name for const slice pointer', function() {
      const env = new Env();
      const name = env.getPointerName({
        type: StructureType.Pointer,
        flags: PointerFlag.IsMultiple | PointerFlag.HasLength | PointerFlag.IsConst,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: { name: 'i32' },
            },
          ],
        }
      });
      expect(name).to.equal('[]const i32');
    })
    it('should return correct name for multiple pointer', function() {
      const env = new Env();
      const name = env.getPointerName({
        type: StructureType.Pointer,
        flags: PointerFlag.IsMultiple,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: { name: 'i32' },
            },
          ],
        }
      });
      expect(name).to.equal('[*]i32');
    })
    it('should return correct name for const multiple pointer', function() {
      const env = new Env();
      const name = env.getPointerName({
        type: StructureType.Pointer,
        flags: PointerFlag.IsMultiple | PointerFlag.IsConst,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: { name: 'i32' },
            },
          ],
        }
      });
      expect(name).to.equal('[*]const i32');
    })
    it('should return correct name for C pointer', function() {
      const env = new Env();
      const name = env.getPointerName({
        type: StructureType.Pointer,
        flags: PointerFlag.IsMultiple | PointerFlag.IsSingle,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: { name: 'i32' },
            },
          ],
        }
      });
      expect(name).to.equal('[*c]i32');
    })
    it('should return correct name for const C pointer', function() {
      const env = new Env();
      const name = env.getPointerName({
        type: StructureType.Pointer,
        flags: PointerFlag.IsMultiple | PointerFlag.IsSingle | PointerFlag.IsConst,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: { name: 'i32' },
            },
          ],
        }
      });
      expect(name).to.equal('[*c]const i32');
    })
    it('should return correct name for multiple pointer with sentinel', function() {
      const env = new Env();
      const constructor = function() {};
      constructor[SENTINEL] = { value: 0 };
      const name = env.getPointerName({
        type: StructureType.Pointer,
        flags: PointerFlag.IsMultiple,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: {
                name: 'i32',
                constructor,
              },
            },
          ],
        },
      });
      expect(name).to.equal('[*:0]i32');
    })
  })
  describe('getSliceName', function() {
    it('should return correct name for slice', function() {
      const env = new Env();
      const name = env.getSliceName({
        type: StructureType.Slice,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: {
                name: 'i32',
              },
            },
          ],
        },
      });
      expect(name).to.equal('[_]i32');
    })
  })
  describe('getVectorName', function() {
    it('should return correct name for vector', function() {
      const env = new Env();
      const name = env.getVectorName({
        type: StructureType.Vector,
        length: 3,
        instance: {
          members: [
            {
              type: MemberType.Int,
              structure: {
                name: 'i32',
              },
            },
          ],
        },
      });
      expect(name).to.equal('@Vector(3, i32)');
    })
  })
  describe('getOpaqueName', function() {
    it('should return correct name for opaque', function() {
      const env = new Env();
      const name = env.getOpaqueName({
        type: StructureType.Opaque,
        instance: {},
      });
      expect(name).to.equal('O0');
    })
  })
  describe('getArgStructName', function() {
    it('should return correct name for arg struct', function() {
      const env = new Env();
      const name = env.getArgStructName({
        type: StructureType.Opaque,
        instance: {
          members: [
            {
              type: MemberType.Int,
              name: 'retval',
              structure: {
                name: 'i32',
              },
            },
            {
              type: MemberType.Int,
              name: '0',
              structure: {
                name: 'u32',
              },
            },
            {
              type: MemberType.Int,
              name: '1',
              structure: {
                name: 'u32',
              },
            },
          ]
        },
      });
      expect(name).to.equal('Arg(fn (u32, u32) i32)');
    })
  })
  describe('getVariadicStructName', function() {
    it('should return correct name for variadic struct', function() {
      const env = new Env();
      const name = env.getVariadicStructName({
        type: StructureType.Opaque,
        instance: {
          members: [
            {
              type: MemberType.Int,
              name: 'retval',
              structure: {
                name: 'i32',
              },
            },
            {
              type: MemberType.Int,
              name: '0',
              structure: {
                name: 'u32',
              },
            },
            {
              type: MemberType.Int,
              name: '1',
              structure: {
                name: 'u32',
              },
            },
          ]
        },
      });
      expect(name).to.equal('Arg(fn (u32, u32, ...) i32)');
    })
  })
  describe('getFunctionName', function() {
    it('should return correct name for function', function() {
      const env = new Env();
      const name = env.getFunctionName({
        type: StructureType.Function,
        instance: {
          members: [
            {
              type: MemberType.Object,
              structure: {
                name: 'Arg(fn (u32, u32) i32)',
              },
            },
          ]
        },
      });
      expect(name).to.equal('fn (u32, u32) i32');
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
          _insertBoolean,
          _insertString,
          _insertObject,
        } = env.exportFunctions();
        const object = {};
        const defIndex = _beginDefinition();
        _insertBoolean(defIndex, env.toWebAssembly('s', 'boolean'), 1);
        _insertString(defIndex, env.toWebAssembly('s', 'string'), env.toWebAssembly('s', 'holy cow'));
        _insertObject(defIndex, env.toWebAssembly('s', 'object'), env.toWebAssembly('v', object));
        const def2 = env.fromWebAssembly('v', defIndex);
        expect(def2).to.have.property('boolean', true);
        expect(def2).to.have.property('string', 'holy cow');
        expect(def2).to.have.property('object', object);
      })
    })
    describe('insertInteger', function() {
      it('should convert negative value for unsigned integers', function() {
        const env = new Env();
        const def = env.beginDefinition();
        env.insertInteger(def, 'hello', -2, true);
        expect(def).to.have.property('hello', 0xffff_fffe);
      })
    })
    describe('insertBigInteger', function() {
      it('should convert negative value for unsigned integers', function() {
        const env = new Env();
        const def = env.beginDefinition();
        env.insertBigInteger(def, 'hello', -2n, true);
        expect(def).to.have.property('hello', 0xffff_ffff_ffff_fffen);
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
  }
})

function zig(address, len = 0) {
  const dv = new DataView(new ArrayBuffer(len));
  dv[ZIG] = { address: usize(address), len };
  return dv;
}
