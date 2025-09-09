import { expect } from 'chai';
import 'mocha-skip-if';
import {
  ErrorSetFlag, MemberType, ModuleAttribute, PointerFlag, PrimitiveFlag, StructureFlag,
  StructureType,
} from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { MEMORY, SENTINEL, SLOTS, ZIG } from '../../src/symbols.js';
import { usize } from '../../src/utils.js';
import { addressByteSize, addressSize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: structure-acquisition', function() {
  describe('getSlotValue', function() {
    it('should read from global slots where target is null', function() {
      const env = new Env();
      const object = {}
      env.slots[1] = object;
      const result1 = env.getSlotValue(null, 1);
      const result2 = env.getSlotValue(null, 2);
      expect(result1).to.equal(object);
      expect(result2).to.be.undefined;
    })
    it('should read from target object', function() {
      const env = new Env();
      const object = {}
      const target = {
        1: object,
      };
      const result1 = env.getSlotValue(target, 1);
      const result2 = env.getSlotValue(target, 2);
      expect(result1).to.equal(object);
      expect(result2).to.be.undefined;
    })
    it('should not throw where object does not have slots', function() {
      const env = new Env();
      const target = {};
      expect(() => env.getSlotValue(target, 1)).to.not.throw();
    })
  });
  describe('setSlotValue', function() {
    it('should write into global slots where target is null', function() {
      const env = new Env();
      const object = {}
      env.setSlotValue(null, 1, object);
      expect(env.slots[1]).to.equal(object);
    })
    it('should write to slot of target object', function() {
      const env = new Env();
      const object = {}
      const target = {};
      env.setSlotValue(target, 1, object);
      expect(target[1]).to.equal(object);
    })
    it('should not throw where object does not have slots', function() {
      const env = new Env();
      const object = {}
      const target = {};
      expect(() => env.setSlotValue(target, 1, object)).to.not.throw();
    })
  })
  describe('beginStructure', function() {
    it('should define the shape of a structure', function() {
      const env = new Env();
      const s = {
        type: StructureType.Struct,
        name: 'Hello',
        length: 1,
        byteSize: 16,
        align: 3,
        signature: 0n,
        instance: {
          members: [],
        },
        static: {},
      };
      env.beginStructure(s);
      const Struct = s.constructor;
      expect(Struct).to.be.a('function');
    })
  })
  describe('finishStructure', function() {
    it('should add structure to list', function() {
      const env = new Env();
      const s = {
        type: StructureType.Struct,
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
      };
      env.finishStructure(s);
      expect(env.structures[0]).to.equal(s);
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
      env.acquireStructures();
      expect(thunkAddress).to.equal(usize(0x1234));
    })
    it('should acquire default pointers', function() {
      const env = new Env();
      env.getFactoryThunk = function() {
        return usize(0x1234);
      };
      env.getModuleAttributes = function() {
        return ModuleAttribute.LittleEndian;
      };
      env.invokeThunk = function(...args) {};
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
      const ptrStructure = {
        type: StructureType.Pointer,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot | PointerFlag.IsSingle,
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
      env.beginStructure(ptrStructure);
      env.finishStructure(ptrStructure);
      const structStructure = {
        type: StructureType.Struct,
        byteSize: addressByteSize,
        flags: StructureFlag.HasPointer | StructureFlag.HasObject | StructureFlag.HasSlot,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'ptr',
              type: MemberType.Object,
              bitSize: addressSize,
              bitOffset: 0,
              byteSize: addressByteSize,
              slot: 0,
              structure: ptrStructure,
            },
          ],
          template: {
            [MEMORY]: (() => {
              const dv = new DataView(new ArrayBuffer(addressByteSize));
              if (addressSize === 32) {
                dv.setUint32(0, 0x1000, true);
              } else {
                dv.setBigUint64(0, 0x1000n, true);
              }
              return dv;
            })(),
            [SLOTS]: {},
          }
        },
        static: {},
      };
      env.beginStructure(structStructure);
      env.finishStructure(structStructure);
      if (process.env.TARGET === 'wasm') {
        env.memory = new WebAssembly.Memory({ initial: 1 });
      } else {
        env.obtainExternBuffer = function(address, len) {
          return new ArrayBuffer(len);
        };
      }
      env.acquireStructures();
      const templ = structStructure.instance.template;
      expect(templ[SLOTS][0]).to.not.be.undefined;
      expect(templ[SLOTS][0]['*']).to.equal(0);
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
      env.finishStructure(s1);
      const s2 = {
        type: StructureType.Struct,
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
      };
      env.finishStructure(s2);
      const constructor = env.getRootModule();
      expect(constructor).to.equal(s2.constructor);
    })
  })
  describe('exportStructures', function() {
    it('should return list of structures', function() {
      const env = new Env();
      env.exportedModules = { env: {}, wasi: {}, wasi_snapshot_preview1: {} };
      const s1 = {
        type: StructureType.Struct,
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
      };
      env.finishStructure(s1);
      const s2 = {
        type: StructureType.Struct,
        instance: { members: [], methods: [] },
        static: { members: [], methods: [] },
        constructor: function() {},
      };
      env.finishStructure(s2);
      const { structures, keys } = env.exportStructures();
      expect(structures[0]).to.equal(s1);
      expect(structures[1]).to.equal(s2);
    })
  })
  describe('prepareObjectsForExport', function() {
    it('should combine data views that overlaps the same memory region', function() {
      const env = new Env();
      env.exportedModules = { env: {}, wasi: {}, wasi_snapshot_preview1: {} };
      env.getViewAddress = (dv) => dv[ZIG].address;
      env.getMemoryOffset = (address) => Number(address);
      env.moveExternBytes = (dv, address, to) => {};
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
    it('should attach export handle to object', function() {
      const env = new Env();
      env.exportedModules = { env: {}, wasi: {}, wasi_snapshot_preview1: {} };
      env.getViewAddress = (dv) => dv[ZIG].address;
      env.getMemoryOffset = (address) => Number(address);
      env.moveExternBytes = (dv, address, to) => {};
      const zig = function(address, len, handle) {
        const dv = new DataView(new ArrayBuffer(len));
        dv[ZIG] = { address, len, handle }
        return dv;
      };
      const object = {
        [MEMORY]: zig(usize(1016), 8, 1016),
      };
      const templ = {
        [MEMORY]: zig(usize(2000), 32),
        [SLOTS]: {
          0: object,
        },
      };
      env.structures = [
        {
          instance: {},
          static: { template: templ },
        },
      ];
      env.prepareObjectsForExport();
      expect(object[MEMORY].handle).to.equal(1016);
    })
  })
  describe('useStructures', function() {
    it('should remove comptime structures and return constructor of root module', function() {
      const env = new Env();
      const addressMap = new Map();
      env.getViewAddress = (dv) => addressMap.get(dv);
      env.getMemoryOffset = (address) => Number(address);
      env.moveExternBytes = (dv, address, to) => {};
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
      env.moveExternBytes = (dv, address, to) => {};
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
      const intStructure = {
        type: StructureType.Primitive,
        name: 'Int32',
        byteSize: 4,
        flags: StructureFlag.HasValue,
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
          ],
        },
        static: {},
      };
      env.beginStructure(intStructure);
      env.finishStructure(intStructure);
      const argStructure = {
        type: StructureType.ArgStruct,
        byteSize: 4 * 3,
        length: 2,
        signature: 0n,
        instance: {
          members: [
            {
              name: 'retval',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 0,
              byteSize: 4,
              structure: intStructure,
            },
            {
              name: '0',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 32,
              byteSize: 4,
              structure: intStructure,
            },
            {
              name: '1',
              type: MemberType.Int,
              bitSize: 32,
              bitOffset: 64,
              byteSize: 4,
              structure: intStructure,
            },
          ],
        },
        static: {},
      };
      env.beginStructure(argStructure);
      env.finishStructure(argStructure);
      const structure = {
        type: StructureType.Function,
        name: 'fn(i32, i32) i32',
        byteSize: 8,
        signature: 0n,
        instance: {
          members: [
            {
              type: MemberType.Object,
              structure: argStructure,
            },
          ],
          template: {
            [MEMORY]: zig(0x1004),
          },
        },
        static: {},
      };
      env.beginStructure(structure);
      env.finishStructure(structure);
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
    it('should not fail when name is missing', function() {
      const env = new Env();
      const name = env.getFunctionName({
        type: StructureType.Function,
        instance: {
          members: [
            {
              type: MemberType.Object,
              structure: {
              },
            },
          ]
        },
      });
      expect(name).to.equal('fn ()');
    })
  })
})

function zig(address, len = 0) {
  const dv = new DataView(new ArrayBuffer(len));
  dv[ZIG] = { address: usize(address), len };
  return dv;
}
