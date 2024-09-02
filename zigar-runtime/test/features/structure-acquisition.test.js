import { expect } from 'chai';
import { defineClass } from '../../src/environment.js';

// import DataCopying from '../../src/features/data-copying.js';
import StructureAcquisition from '../../src/features/structure-acquisition.js';
import { MemberType } from '../../src/members/all.js';
import StructureAll, { StructureType } from '../../src/structures/all.js';
import { FIXED, MEMORY, SLOTS } from '../../src/symbols.js';
// import ViewManagement from '../../src/features/view-management.js';

const Env = defineClass('FeatureTest', [ StructureAcquisition, StructureAll ]);

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
        hasPointer: false,
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
        hasPointer: false,
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
        hasPointer: false,
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
        hasPointer: false,
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
        hasPointer: false,
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
        return 1234;
      };
      let thunkId, options;
      env.invokeThunk = function(...args) {
        thunkId = args[0];
        options = args[1][0];
      };
      env.acquireStructures({ omitFunctions: true });
      expect(thunkId).to.equal(1234);
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
        name: 'Int32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      const Int32 = env.defineStructure(intStructure);
      env.finalizeStructure(intStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.SinglePointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true
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
        name: 'Hello',
        byteSize: 8 * 2,
        hasPointer: true
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
})