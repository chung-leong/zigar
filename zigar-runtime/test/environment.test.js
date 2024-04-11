import { expect } from 'chai';

import {
  CallContext,
  Environment,
  add,
  findSortedIndex,
  getAlignedAddress,
  isInvalidAddress,
  isMisaligned,
  subtract,
} from '../src/environment.js';
import { MemberType, useAllMemberTypes } from '../src/member.js';
import { getMemoryCopier } from '../src/memory.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import {
  ALIGN, ATTRIBUTES, CONST, COPIER, ENVIRONMENT, FIXED_LOCATION, MEMORY, POINTER_VISITOR, SLOTS,
  TARGET_GETTER
} from '../src/symbol.js';

describe('Environment', function() {
  beforeEach(function() {
    useAllMemberTypes();
    useAllStructureTypes();
  })
  describe('startContext', function() {
    it('should start a new context', function() {
      const env = new Environment();
      env.startContext();
      expect(env.context).to.be.an.instanceOf(CallContext);
    })
    it('should push existing context onto stack', function() {
      const env = new Environment();
      env.startContext();
      const ctx1 = env.context;
      env.startContext();
      const ctx2 = env.context;
      expect(ctx2).to.not.equal(ctx1);
      expect(env.contextStack).to.be.an('array').with.lengthOf(1);
      expect(env.contextStack[0]).to.equal(ctx1);
    })
  })
  describe('endContext', function() {
    it('should end current context', function() {
      const env = new Environment();
      env.startContext();
      expect(env.context).to.be.an.instanceOf(CallContext);
      env.endContext();
      expect(env.context).to.be.undefined;
    })
    it('should restore previous context', function() {
      const env = new Environment();
      env.startContext();
      const ctx1 = env.context;
      env.startContext();
      const ctx2 = env.context;
      expect(ctx2).to.not.equal(ctx1);
      env.endContext();
      expect(env.context).to.equal(ctx1);
    })
  })
  describe('allocateMemory', function() {
    it('should return a data view of a newly created array buffer', function() {
      const env = new Environment();
      env.getBufferAddress = () => 0x10000;
      const dv = env.allocateMemory(32, 4);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(32);
      expect(dv.byteOffset).to.equal(0);
    })
    it('should try to create a buffer in fixed memory', function() {
      const env = new Environment();
      env.allocateFixedMemory = (len, align) => {
        const buffer = new ArrayBuffer(len);
        buffer.align = align;
        return new DataView(buffer);
      }
      const dv = env.allocateMemory(32, 4, true);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(32);
      expect(dv.buffer.align).to.equal(4);
    })
  })
  describe('registerMemory', function() {
    it('should return address of data view', function() {
      const env = new Environment();
      env.getBufferAddress = () => 0x1000n;
      const dv = new DataView(new ArrayBuffer(16), 8, 8);
      env.startContext();
      const address = env.registerMemory(dv);
      expect(address).to.equal(0x1000n + 8n);
    })
    it('should return address as number when address is number', function() {
      const env = new Environment();
      env.getBufferAddress = () => 0x1000;
      const dv = new DataView(new ArrayBuffer(16), 8, 8);
      env.startContext();
      const address = env.registerMemory(dv);
      expect(address).to.equal(0x1000 + 8);
    })
  })
  describe('unregisterMemory', function() {

  })
  describe('findMemory', function() {
    it('should find previously imported buffer', function() {
      const env = new Environment();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv1 = new DataView(new ArrayBuffer(32));
      env.startContext();
      const address = env.registerMemory(dv1);
      const dv2 = env.findMemory(address, dv1.byteLength);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteOffset).to.equal(dv1.byteOffset);
    })
    it('should find previously imported buffer when len is undefined', function() {
      const env = new Environment();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv1 = new DataView(new ArrayBuffer(32));
      env.startContext();
      const address = env.registerMemory(dv1);
      const dv2 = env.findMemory(address, undefined);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteOffset).to.equal(dv1.byteOffset);
    })
    it('should find a subslice of previously imported buffer', function() {
      const env = new Environment();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv1 = new DataView(new ArrayBuffer(32));
      env.startContext();
      const address = env.registerMemory(dv1);
      const dv2 = env.findMemory(address + 8n, 8);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteOffset).to.equal(8);
    })
    it('should return data view of shared memory if address is not known', function() {
      const env = new Environment();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv1 = new DataView(new ArrayBuffer(32));
      env.startContext();
      const address = env.registerMemory(dv1);
      const dv2 = env.findMemory(0xFF0000n, 8);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.be.instanceOf(SharedArrayBuffer);
    })
    it('should return data view of shared memory if address is not knownand len is undefined', function() {
      const env = new Environment();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv1 = new DataView(new ArrayBuffer(32));
      env.startContext();
      const address = env.registerMemory(dv1);
      const dv2 = env.findMemory(0xFF0000n, undefined);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.be.instanceOf(SharedArrayBuffer);
    })
  })
  describe('getViewAddress', function() {
    it('should return address of data view', function() {
      const env = new Environment();
      env.getBufferAddress = () => 0x1000n;
      const dv = new DataView(new ArrayBuffer(32), 8, 8);
      const address = env.getViewAddress(dv);
      expect(address).to.equal(0x1008n);
    })
  })
  describe('obtainView', function() {
    it('should obtain the same view object for the same offset and length', function() {
      const env = new Environment();
      const buffer = new ArrayBuffer(48);
      const dv1 = env.obtainView(buffer, 4, 8);
      expect(dv1.byteOffset).to.equal(4);
      expect(dv1.byteLength).to.equal(8);
      const dv2 = env.obtainView(buffer, 4, 8);
      expect(dv2).to.equal(dv1);
    })
    it('should be able to keep track of multiple views', function() {
      const env = new Environment();
      const buffer = new ArrayBuffer(48);
      const dv1 = env.obtainView(buffer, 4, 8);
      expect(dv1.byteOffset).to.equal(4);
      const dv2 = env.obtainView(buffer, 8, 16);
      expect(dv2.byteOffset).to.equal(8);
      const dv3 = env.obtainView(buffer, 8, 16);
      expect(dv3).to.equal(dv2);
      const dv4 = env.obtainView(buffer, 4, 8);
      expect(dv4).to.equal(dv1);      
    })
  })
  describe('captureView', function() {
    it('should allocate new buffer and copy data using copyBytes', function() {
      const env = new Environment();
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
      const env = new Environment();
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
      const env = new Environment();
      let recv, arg;
      const structure = {
        constructor: function(dv) {
          recv = this;
          arg = dv;
          return {};
        }
      };
      const dv = new DataView(new ArrayBuffer(0));
      const object = env.castView(structure, dv);
      expect(recv).to.equal(ENVIRONMENT);
      expect(arg).to.equal(dv);
    })
    it('should try to create targets of pointers', function() {
      const env = new Environment();
      let visitor;
      const structure = {
        constructor: function(dv) {
          return {
            [POINTER_VISITOR]: function(f) { visitor = f },
          };
        },
        hasPointer: true,
      };
      const dv = new DataView(new ArrayBuffer(8));
      const object = env.castView(structure, dv);
    })
  })
  describe('getSlotNumber', function() {
    it('should return the same number when the same key is given', function() {
      const env = new Environment();
      const s1 = env.getSlotNumber(0, 1234);
      const s2 = env.getSlotNumber(0, 1234);
      const s3 = env.getSlotNumber(0, 12345);
      expect(s2).to.equal(s1);
      expect(s3).to.not.equal(s1);
    })
  })
  describe('readSlot', function() {
    it('should read from global slots where target is null', function() {
      const env = new Environment();
      const object = {}
      env.slots[1] = object;
      const result1 = env.readSlot(null, 1);
      const result2 = env.readSlot(null, 2);
      expect(result1).to.equal(object);
      expect(result2).to.be.undefined;
    })
    it('should read from slots of target object', function() {
      const env = new Environment();
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
      const env = new Environment();
      const target = {};
      expect(() => env.readSlot(target, 1)).to.not.throw();
    })
  });
  describe('writeSlot', function() {
    it('should write into global slots where target is null', function() {
      const env = new Environment();
      const object = {}
      env.writeSlot(null, 1, object);
      expect(env.slots[1]).to.equal(object);
    })
    it('should read from slots of target object', function() {
      const env = new Environment();
      const object = {}
      const target = {
        [SLOTS]: {}
      };
      env.writeSlot(target, 1, object);
      expect(target[SLOTS][1]).to.equal(object);
    })
    it('should not throw where object does not have slots', function() {
      const env = new Environment();
      const object = {}
      const target = {};
      expect(() => env.writeSlot(target, 1, object)).to.not.throw();
    })
  })
  describe('createTemplate', function() {
    it('should return a template object', function() {
      const env = new Environment();
      const dv = new DataView(new ArrayBuffer(8));
      const templ = env.createTemplate(dv);
      expect(templ[MEMORY]).to.equal(dv);
      expect(templ[SLOTS]).to.be.an('object');
    })
  })
  describe('beginStructure', function() {
    it('should return a structure object', function() {
      const env = new Environment();
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
      const env = new Environment();
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
      const env = new Environment();
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
  describe('attachMethod', function() {
    it('should attach static method', function() {
      const env = new Environment();
      const method = {
        name: 'say',
      };
      const s = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        length: 1,
        byteSize: 16,
        align: 3,
        isConst: false,
        hasPointer: false,
      });
      env.attachMethod(s, method, true);
      expect(s.static.methods[0]).to.eql(method);
    })
    it('should attach both static and instance method', function() {
      const env = new Environment();
      const method = {
        name: 'say',
      };
      const s = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        length: 1,
        byteSize: 16,
        align: 3,
        isConst: false,
        hasPointer: false,
      });
      env.attachMethod(s, method, false);
      expect(s.static.methods[0]).to.eql(method);
      expect(s.instance.methods[0]).to.eql(method);
    })
  })
  describe('attachTemplate', function() {
    it('should attach instance template', function() {
      const env = new Environment();
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
      const env = new Environment();
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
      const env = new Environment();
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
      const env = new Environment();
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
      const env = new Environment();
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
      const env = new Environment();
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
      const env = new Environment();
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
      const env = new Environment();
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
      expect(Object.values(keys)).to.include(CONST);
    })
  })
  describe('prepareObjectsForExport', function() {
    it('should combine data views that overlaps the same memory region', function() {
      const env = new Environment();
      env.inFixedMemory = (object) => true;
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
      addressMap.set(templ1[MEMORY], 1002n);
      addressMap.set(templ2[MEMORY], 1000n);
      addressMap.set(object[MEMORY], 1016n);
      env.prepareObjectsForExport();      
      expect(templ1[MEMORY].buffer).to.equal(templ2[MEMORY].buffer);
      expect(templ1[MEMORY].byteOffset).to.equal(2);
      expect(object[MEMORY].buffer).to.equal(templ2[MEMORY].buffer);
      expect(object[MEMORY].byteOffset).to.equal(16);
    })
  })
  describe('useStructures', function() {
    it('should remove comptime structures and return constructor of root module', function() {
      const env = new Environment();
      env.inFixedMemory = (object) => true;
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
  describe('finalizeShape', function() {
    it('should generate constructor for a struct', function() {
      const env = new Environment();
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
        required: false,
      }, false);
      env.finalizeShape(s);
      const { constructor } = s;
      const object = new constructor(undefined);
      expect(object).to.have.property('number');
    })
  })
  describe('finalizeStructure', function() {
    
  })
  describe('createCaller', function() {
    it('should create a caller for a zig function', function() {
      const env = new Environment();      
      const method = {
        name: 'hello', 
        argStruct: { 
          constructor: function(args) {
            this[MEMORY] = new DataView(new ArrayBuffer(8));
            this[MEMORY].setUint32(0, args[0], true);
            this[MEMORY].setUint32(4, args[1], true);
          } 
        }, 
        thunkId: 10
      };      
      const f = env.createCaller(method, false);
      expect(f).to.be.a('function');
      expect(f.name).to.equal('hello');
      let thunkId, argStruct;
      env.invokeThunk = function(...args) {
        thunkId = args[0];
        argStruct = args[1];
      };
      f(123, 456);
      expect(thunkId).to.equal(10);
      expect(argStruct[MEMORY].getUint32(0, true)).to.equal(123);
      expect(argStruct[MEMORY].getUint32(4, true)).to.equal(456);
    })
    it('should create a caller for a zig method', function() {
      const env = new Environment();      
      const method = {
        name: 'hello', 
        argStruct: { 
          constructor: function(args) {
            this.self = args[0];
            this[MEMORY] = new DataView(new ArrayBuffer(8));
            this[MEMORY].setUint32(0, args[1], true);
            this[MEMORY].setUint32(4, args[2], true);
          } 
        }, 
        thunkId: 10
      };      
      const f = env.createCaller(method, true);
      let thunkId, argStruct;
      env.invokeThunk = function(...args) {
        thunkId = args[0];
        argStruct = args[1];
      };
      const object = { method: f };
      object.method(123, 456);
      expect(thunkId).to.equal(10);
      expect(argStruct[MEMORY].getUint32(0, true)).to.equal(123);
      expect(argStruct[MEMORY].getUint32(4, true)).to.equal(456);      
      expect(argStruct.self).to.equal(object);
    })
  })
  describe('recreateStructures', function() {
    it('should recreate structures based on input definition', function() {
      const env = new Environment();
      const s1 = {
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
        align: 4,
        hasPointer: false,
        instance: {
          members: [
            {
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
            }
          ],
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
      };
      const s2 = {
        type: StructureType.ArgStruct,
        name: 'hello',
        byteSize: 0,
        align: 0,
        hasPointer: false,
        instance: {
          members: [
            {
              name: 'retval',
              type: MemberType.Void,
              bitOffset: 0,
              bitSize: 0,
              byteSize: 0,
            }
          ],
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
      };
      const s3 = {
        type: StructureType.Pointer,
        name: '*i32',
        byteSize: 8,
        hasPointer: true,
        instance: {
          members: [
            {
              type: MemberType.Object,
              bitOffset: 0,
              bitSize: 64,
              byteSize: 8,
              slot: 0,
              structure: {},
            },
          ],
          methods: [],
          template: null,
        },
        static: {
          members: [],
          methods: [],
          template: null,
        },
      };
      const s4 = {
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 8,
        align: 4,
        hasPointer: false,
        instance: {
          members: [
            {
              name: 'dog',
              type: MemberType.Int,
              bitOffset: 0,
              bitSize: 32,
              byteSize: 4,
              structure: s1,
            },
            {
              name: 'cat',
              type: MemberType.Int,
              bitOffset: 32,
              bitSize: 32,
              byteSize: 4,
              structure: s1,
            },
            {
              name: 'ghost',
              type: MemberType.Comptime,
              slot: 2,
              structure: s1,
            },
            {
              name: 'type',
              type: MemberType.Type,
              slot: 3,
            }
          ],
          methods: [],
          template: {
            memory: (() => {
              const array = new Uint8Array(8);
              const dv = new DataView(array.buffer);
              dv.setInt32(0, 1234, true);
              dv.setInt32(4, 5678, true);
              return { array };
            })(),
            slots: (() => {
              const array = new Uint8Array(4);
              const dv = new DataView(array.buffer);
              dv.setInt32(0, -8888, true);
              return {
                2: {
                  memory: { array },
                  structure: s1,
                  reloc: 0x1000n,
                },
                3: {
                  structure: s1,
                }
              };
            })(),
          },
        },
        static: {
          members: [
            {
              type: MemberType.Static,
              name: 'pointer',
              slot: 0,
              structure: s3,
            },
            {
              type: MemberType.Static,
              name: 'unsupported',
              slot: 1,
              structure: {},
            },
          ],
          methods: [
            {
              name: 'hello',
              thunkId: 34,
              argStruct: s2,
            }
          ],
          template: {
            slots: {
              0: {
                memory: (() => {
                  const array = new Uint8Array(8);
                  return { array };   
                })(),
                slots: {
                  0: {
                    memory: (() => {
                      const array = new Uint8Array(4);
                      const dv = new DataView(array.buffer);
                      dv.setInt32(0, 707, true);
                      return { array };          
                    })(),
                    structure: s1,
                    reloc: 0x2000n,
                  },
                },
                structure: s3,
              }
            }
          },
        },
      };
      env.recreateStructures([ s1, s2, s3, s4 ]);
      const { constructor } = s4;
      expect(constructor).to.be.a('function');
      const object = new constructor({});
      expect(object.dog).to.equal(1234);
      expect(object.cat).to.equal(5678);
      expect(object.ghost).to.equal(-8888);
      let thunkId, argStruct;
      env.invokeThunk = function(...args) {
        thunkId = args[0];
        argStruct = args[1];
      };
      expect(() => constructor.hello()).to.not.throw();
      expect(thunkId).to.equal(34);
      expect(argStruct[MEMORY].byteLength).to.equal(0);
      expect(env.variables).to.have.lengthOf(2);
    })
  })
  describe('linkVariables', function() {    
    it('should link variables', function() {
      const env = new Environment();
      env.inFixedMemory = function() {
        return false;
      };
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
      env.obtainFixedView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv.address = address;
        return dv;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      Test.prototype[COPIER] = getMemoryCopier(4);
      const object = new Test(new DataView(new ArrayBuffer(4)));
      const dv = object[MEMORY];
      dv.setUint32(0, 1234, true);
      env.variables.push({ object, reloc: 128 });
      env.linkVariables(true);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
    });
    it('should add target location to pointer', function() {
      const env = new Environment();
      env.inFixedMemory = function() {
        return false;
      };
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
      env.obtainFixedView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv.address = address;
        return dv;
      };
      env.getBufferAddress = function(buffer) {
        return 0x4000;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
        this[SLOTS] = { 
          0: { 
            [MEMORY]: new DataView(new ArrayBuffer(32)),
          } 
        };
    };
      Test.prototype[COPIER] = getMemoryCopier(4);
      Test.prototype[TARGET_GETTER] = function() { 
        return {
          [MEMORY]: new DataView(new ArrayBuffer(32)),
          length: 4,
        };
      };
      const object = new Test(new DataView(new ArrayBuffer(4)));
      env.variables.push({ object, reloc: 128 });
      env.linkVariables(false);
      expect(object[FIXED_LOCATION]).to.eql({ address: 0x4000, length: 4 });
    });
  })
  describe('linkObject', function() {    
    it('should replace relocatable memory with fixed memory', function() {
      const env = new Environment();
      env.inFixedMemory = function() {
        return false;
      };
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
      env.obtainFixedView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv.address = address;
        return dv;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      Test.prototype[COPIER] = getMemoryCopier(4);
      const object = new Test(new DataView(new ArrayBuffer(4)));
      const dv = object[MEMORY];
      dv.setUint32(0, 1234, true);
      env.linkObject(object, 0x1000, true);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
    })
    it('should omit copying when writeBack is false', function() {
      const env = new Environment();
      env.inFixedMemory = function() {
        return false;
      };
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
      env.obtainFixedView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv.address = address;
        return dv;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      Test.prototype[COPIER] = getMemoryCopier(4);
      const object = new Test(new DataView(new ArrayBuffer(4)));
      const dv = object[MEMORY];
      dv.setUint32(0, 1234, true);
      env.linkObject(object, 0x1000, false);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[MEMORY].getUint32(0, true)).to.not.equal(1234);
    })
    it('should ignore object already with fixed memory', function() {
      const env = new Environment();
      env.inFixedMemory = function() {
        return true;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      Test.prototype[COPIER] = getMemoryCopier(4);
      const object = new Test(new DataView(new ArrayBuffer(4)));
      const dv = object[MEMORY];
      env.linkObject(object, 0x1000, true);
      expect(object[MEMORY]).to.equal(dv);
    })
    it('should link child objects', function() {
      const env = new Environment();
      env.inFixedMemory = function() {
        return false;
      };
      env.recreateAddress = function(address) {
        return address + 0x1000;
      };
      env.obtainFixedView = function(address, len) {
        const dv = new DataView(new ArrayBuffer(len));
        dv.address = address;
        return dv;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
        this[SLOTS] = {
          0: {
            [MEMORY]: new DataView(dv.buffer, 0, 8),
          }
        }
      };
      Test.prototype[COPIER] = getMemoryCopier(4);
      const object = new Test(new DataView(new ArrayBuffer(32)));
      const dv = object[MEMORY];
      env.linkObject(object, 0x1000, true);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(object[SLOTS][0][MEMORY].buffer).to.equal(object[MEMORY].buffer);
    })
  })
  describe('unlinkVariables', function() {    
    it('should pass variables to unlinkObject', function() {
      const env = new Environment();
      env.allocateFixedMemory = (len, align) => {
        const buffer = new ArrayBuffer(len);
        buffer.align = align;
        return new DataView(buffer);
      };
      env.inFixedMemory = (object) => {
        return object[MEMORY].buffer.align !== undefined;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      Test.prototype[COPIER] = getMemoryCopier(16);
      const object1 = new Test(env.allocateMemory(16, 8, true));
      const object2 = new Test(env.allocateMemory(16, 8, true));
      env.variables.push({ name: 'a', object: object1 });
      env.variables.push({ name: 'b', object: object2 });
      env.unlinkVariables();
      expect(object1[MEMORY].buffer.align).to.be.undefined;
      expect(object2[MEMORY].buffer.align).to.be.undefined;
    })
  })
  describe('unlinkObject', function() {    
    it('should replace buffer in fixed memory with ones in relocatable memory', function() {
      const env = new Environment();
      env.allocateFixedMemory = (len, align) => {
        const buffer = new ArrayBuffer(len);
        buffer.align = align;
        return new DataView(buffer);
      };
      env.inFixedMemory = (object) => {
        return object[MEMORY].buffer.align !== undefined;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      Test.prototype[COPIER] = getMemoryCopier(16);
      const object = new Test(env.allocateMemory(16, 8, true));
      const dv = object[MEMORY];
      expect(dv.buffer.align).to.equal(8);
      dv.setUint32(12, 1234, true);
      env.unlinkObject(object);
      expect(object[MEMORY]).to.not.equal(dv);
      expect(dv.getUint32(12, true)).to.equal(1234);
      expect(object[MEMORY].buffer.align).to.be.undefined;
      // should do nothing
      env.unlinkObject(object);
    })
  })
  describe('releaseFunctions', function() {    
    it('should make all imported functions throw', function() {
      const env = new Environment();
      env.imports = {
        runThunk: function() {},
      };
      for (const [ name, f ] of Object.entries(env.imports)) {
        env[name] = f;
      }
      expect(() => env.runThunk()).to.not.throw();
      env.releaseFunctions();
      expect(() => env.runThunk()).to.throw();
    })
  })
  describe('getControlObject', function() {    
    it('should return object for controlling module', async function() {
      const env = new Environment();
      env.imports = {
        runThunk: function() {},
      };
      const object = env.getControlObject();
      expect(object.init).to.be.a('function');
      expect(object.abandon).to.be.a('function');
      expect(object.released).to.be.a('function');
      expect(object.connect).to.be.a('function');
      await object.init();
      expect(env.abandoned).to.be.false;
      object.abandon();
      expect(env.abandoned).to.be.true;
      expect(object.released()).to.be.false;
    })    
    it('should allow redirection of console output', async function() {
      const env = new Environment();
      const dv = new DataView(new ArrayBuffer(2));
      dv.setUint8(0, '?'.charCodeAt(0));
      dv.setUint8(1, '\n'.charCodeAt(0));
      const [ before ] = await capture(() => env.writeToConsole(dv));
      expect(before).to.equal('?');
      const object = env.getControlObject();
      let content;
      object.connect({ 
        log(s) {
          content = s;
        }
      });
      const [ after ] = await capture(() => env.writeToConsole(dv));
      expect(after).to.be.undefined;
      expect(content).to.equal('?');
    })
  })
  describe('abandon', function() {
    it('should release imported functions and variables', function() {
      const env = new Environment();
      env.imports = {
        runThunk: function() {},
      };
      for (const [ name, f ] of Object.entries(env.imports)) {
        env[name] = f;
      }
      expect(() => env.runThunk()).to.not.throw();
      env.abandon();
      expect(() => env.runThunk()).to.throw();
      expect(env.abandoned).to.be.true;
    })
  })
  describe('writeToConsole', function() {
    const encoder = new TextEncoder();
    it('should output text to console', async function() {
      const env = new Environment();
      const lines = await capture(() => {
        const array = encoder.encode('Hello world\n');
        env.writeToConsole(new DataView(array.buffer));
      });
      expect(lines).to.eql([ 'Hello world' ]);
    })
    it('should allow addition text to be append to current line', async function() {
      const env = new Environment();
      const lines = await capture(async () => {
        const array1 = encoder.encode('Hello world');
        env.writeToConsole(new DataView(array1.buffer));
        await delay(10);
        const array2 = encoder.encode('!\n');
        env.writeToConsole(new DataView(array2.buffer));
      });
      expect(lines).to.eql([ 'Hello world!' ]);
    })
    it('should eventually output text not ending with newline', async function() {
      const env = new Environment();
      const lines = await capture(async () => {
        const array1 = encoder.encode('Hi!\nHello world');
        env.writeToConsole(new DataView(array1.buffer));
        await delay(10);
        const array2 = encoder.encode('!');
        env.writeToConsole(new DataView(array2.buffer));
        await delay(300);
      });
      expect(lines).to.eql([ 'Hi!', 'Hello world!' ]);
    })
  })
  describe('flushConsole', function() {
    const encoder = new TextEncoder();
    it('should force pending text to immediately get sent to console', async function() {
      const env = new Environment();
      const lines = await capture(async () => {
        const array1 = encoder.encode('Hello world');
        env.writeToConsole(array1);
        await delay(10);
        const array2 = encoder.encode('!');
        env.writeToConsole(array2);
        env.flushConsole();
      });
      expect(lines).to.eql([ 'Hello world!' ]);
    })
  })
  describe('updatePointerAddresses', function() {    
    it('should update pointer addresses', function() {
      const env = new Environment();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
        align: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*i32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'ArgStruct',
        byteSize: 32,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: '1',
        type: MemberType.Object,
        bitOffset: 64,
        bitSize: 64,
        byteSize: 8,
        slot: 1,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: '2',
        type: MemberType.Object,
        bitOffset: 128,
        bitSize: 64,
        byteSize: 8,
        slot: 2,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: '3',
        type: MemberType.Object,
        bitOffset: 192,
        bitSize: 64,
        byteSize: 8,
        slot: 3,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Void,
        bitOffset: 256,
        bitSize: 0,
        byteSize: 0,
        structure: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      env.inFixedMemory = function() {
        return false;
      };
      const { constructor: ArgStruct } = structure;    
      const object1 = new Int32(123);
      const object2 = new Int32(123);
      const args = new ArgStruct([ object1, object2, object1, object1 ]);
      env.getTargetAddress = function(target, cluster) {
        // flag object1 as misaligned
        if (cluster) {
          return false;
        } else {
          return 0x1000n;
        }
      };
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function(buffer) {
        return 0x2000n;
      };
      env.startContext();
      env.updatePointerAddresses(args);
      expect(args[0][MEMORY].getBigUint64(0, true)).to.equal(0x2004n);
      expect(args[1][MEMORY].getBigUint64(0, true)).to.equal(0x1000n);
      expect(args[2][MEMORY].getBigUint64(0, true)).to.equal(0x2004n);
      expect(args[3][MEMORY].getBigUint64(0, true)).to.equal(0x2004n);
    })
    it('should be able to handle self-referencing structures', function() {
      const env = new Environment();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 12,
        hasPointer: true,
      });
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const optionalStructure = env.beginStructure({
        type: StructureType.Optional,
        name: '?*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(optionalStructure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(optionalStructure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.finalizeShape(optionalStructure);
      env.finalizeStructure(optionalStructure);
      env.attachMember(structure, {
        name: 'sibling',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: optionalStructure,
      });
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      env.inFixedMemory = function() {
        return false;
      };
      const { constructor: Hello } = structure;    
      const object1 = new Hello({ sibling: null });
      const object2 = new Hello({ sibling: object1 });
      const object3 = new Hello({ sibling: object2 });      
      object1.sibling = object3;
      expect(object3.sibling['*']).to.equal(object2);
      expect(object3.sibling['*'].sibling['*']).to.equal(object1);
      expect(object3.sibling['*'].sibling['*'].sibling['*']).to.equal(object3);
      const map = new Map([
        [ object1[MEMORY], 0x1000n ],
        [ object2[MEMORY], 0x2000n ],
        [ object3[MEMORY], 0x3000n ],
      ]);
      env.getTargetAddress = function(target, cluster) {
        return map.get(target[MEMORY]);
      };
      env.startContext();
      env.updatePointerAddresses(object3);
      expect(object1[MEMORY].getBigUint64(0, true)).to.equal(0x3000n);  // obj1 -> obj3
      expect(object2[MEMORY].getBigUint64(0, true)).to.equal(0x1000n);  // obj2 -> obj1
      expect(object3[MEMORY].getBigUint64(0, true)).to.equal(0x2000n);  // obj3 -> obj2
    })
    it('should ignore inactive pointers', function() {
      const env = new Environment();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*i32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      env.inFixedMemory = function() {
        return false;
      };
      env.getTargetAddress = function(target, cluster) {
        return 0x1000n;
      };
      const { constructor: Hello } = structure;
      // start now with an active pointer so it gets vivificated in order to ensure code coverage
      const object = new Hello(new Int32(1234));
      env.updatePointerAddresses(object);
      expect(object[MEMORY].getBigUint64(0, true)).to.equal(0x1000n);
      // now make the pointer inactive
      object.$ = null;
      env.updatePointerAddresses(object);
      expect(object[MEMORY].getBigUint64(0, true)).to.equal(0n);
    })
    it('should ignore pointers in a bare union', function() {
      const env = new Environment();
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
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Int32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const structStructure = env.beginStructure({
        type: StructureType.Struct,
        name: 'SomeStruct',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structStructure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.finalizeShape(structStructure);
      env.finalizeStructure(structStructure);
      const arrayStructure = env.beginStructure({
        type: StructureType.Array,
        name: '[4]*Int32',
        length: 4,
        byteSize: 8 * 4,
        hasPointer: true,
      });
      env.attachMember(arrayStructure, {
        type: MemberType.Object,
        bitSize: 64,
        byteSize: 8,
        structure: ptrStructure,
      });
      env.finalizeShape(arrayStructure);
      env.finalizeStructure(arrayStructure);
      const structure = env.beginStructure({
        type: StructureType.BareUnion,
        name: 'Hello',
        byteSize: 8 * 4,
        hasPointer: false,
      });
      env.attachMember(structure, {
        name: 'pointer',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'struct',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 1,
        structure: structStructure,
      });
      env.attachMember(structure, {
        name: 'array',
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8 * 4,
        slot: 2,
        structure: arrayStructure,
      });
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
        structure: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello(undefined);
      let called = false;
      env.getTargetAddress = function(target, cluster) {
        called = true;
        return 0x1000n;
      };
      env.updatePointerAddresses(object);
      expect(called).to.be.false;
    })
  })
  describe('findTargetClusters', function() {    
    it('should find overlapping objects', function() {
      const env = new Environment();
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      const buffer1 = new ArrayBuffer(16);
      const buffer2 = new ArrayBuffer(16);
      const object1 = new Test(new DataView(buffer1, 0, 8));
      const object2 = new Test(new DataView(buffer1, 4, 8));
      const object3 = new Test(new DataView(buffer2, 0, 8));
      const object4 = new Test(new DataView(buffer2, 8, 8));
      const object5 = new Test(new DataView(buffer1, 0, 12));
      const clusters = env.findTargetClusters([
        [ object1, object2, object5 ],
        [ object3, object4 ],
      ]);
      expect(clusters).to.have.lengthOf(1);
      expect(clusters[0].targets).to.contain(object1).and.contain(object2);
      expect(clusters[0].start).to.equal(0);
      expect(clusters[0].end).to.equal(12);
    })
  })
  describe('getShadowAddress', function() {
    it('should create a shadow of an object and return the its address', function() {
      const env = new Environment();
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      Test.prototype[COPIER] = getMemoryCopier(8);
      const object = new Test(new DataView(new ArrayBuffer(8)));
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      const address = env.getShadowAddress(object);
      expect(address).to.equal(0x1000);
    })
    it('should return shadow addresses of objects in a cluster', function() {
      const env = new Environment();
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      Test.prototype[COPIER] = getMemoryCopier(8);
      Test[ALIGN] = 4;
      const buffer = new ArrayBuffer(16);
      const object1 = new Test(new DataView(buffer, 0, 8));
      const object2 = new Test(new DataView(buffer, 4, 8));
      const cluster = {
        targets: [ object1, object2 ],
        start: 0,
        end: 12,
        address: undefined,        
      };
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      const address1 = env.getShadowAddress(object1, cluster);
      const address2 = env.getShadowAddress(object2, cluster);
      expect(address1).to.equal(0x1000 + 4);
      expect(address2).to.equal(0x1004 + 4);
    })
  })
  describe('createShadow', function() {
    it('should create a shadow of an object', function() {
      const env = new Environment();
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      Test.prototype[COPIER] = getMemoryCopier(8);
      const object = new Test(new DataView(new ArrayBuffer(8)));
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      const shadow = env.createShadow(object);
      expect(shadow).to.be.instanceOf(Test);
      expect(shadow[MEMORY].byteLength).to.equal(8);
    })
  })
  describe('createClusterShadow', function() {
    it('should create a shadow for a cluster of objects', function() {
      const env = new Environment();
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      Test.prototype[COPIER] = getMemoryCopier(8);
      Test[ALIGN] = 4;
      const buffer = new ArrayBuffer(32);
      const object1 = new Test(new DataView(buffer, 3, 8));
      const object2 = new Test(new DataView(buffer, 7, 8));
      const object3 = new Test(new DataView(buffer, 11, 8));
      const cluster = {
        targets: [ object1, object2, object3 ],
        start: 3,
        end: 19,
      };
      object1[MEMORY].setUint32(0, 1234, true);
      env.startContext();
      const shadow = env.createClusterShadow(cluster);
      expect(shadow[MEMORY].byteLength).to.equal(16);
      expect(shadow[MEMORY].buffer.byteLength).to.equal(20);
      env.updateShadows();
      expect(shadow[MEMORY].getUint32(0, true)).to.equal(1234);
    })
    it('should use alignment attached to data views', function() {
      const env = new Environment();
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
        dv[ALIGN] = 4;
      };
      Test.prototype[COPIER] = getMemoryCopier(8);
      Test[ALIGN] = undefined;
      const buffer = new ArrayBuffer(32);
      const object1 = new Test(new DataView(buffer, 3, 8));
      const object2 = new Test(new DataView(buffer, 7, 8));
      const object3 = new Test(new DataView(buffer, 11, 8));
      const cluster = {
        targets: [ object1, object2, object3 ],
        start: 3,
        end: 19,
      };
      object1[MEMORY].setUint32(0, 1234, true);
      env.startContext();
      const shadow = env.createClusterShadow(cluster);
      expect(shadow[MEMORY].byteLength).to.equal(16);
      expect(shadow[MEMORY].buffer.byteLength).to.equal(20);
      env.updateShadows();
      expect(shadow[MEMORY].getUint32(0, true)).to.equal(1234);
    })

    it('should throw when objects have incompatible alignments', function() {
      const env = new Environment();
      env.allocateShadowMemory = function(len, align) {
        return new DataView(new ArrayBuffer(len));
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      const Test = function(dv) {
        this[MEMORY] = dv;
      };
      Test.prototype[COPIER] = getMemoryCopier(8);
      Test[ALIGN] = 4;
      const buffer = new ArrayBuffer(32);
      const object1 = new Test(new DataView(buffer, 4, 8));
      const object2 = new Test(new DataView(buffer, 7, 8));
      const object3 = new Test(new DataView(buffer, 13, 8));
      const cluster = {
        targets: [ object1, object2, object3 ],
        start: 4,
        end: 21,
      };
      env.startContext();
      expect(() => env.createClusterShadow(cluster)).to.throw(TypeError);
    })
  })
  describe('addShadow', function() {    
    it('should add a shadow', function() {
      const env = new Environment();
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(4))
      };
      const shadow = {
        [MEMORY]: new DataView(new ArrayBuffer(4))
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      expect(env.context.shadowMap).to.be.null;
      env.addShadow(shadow, object);
      expect(env.context.shadowMap.size).to.equal(1);
    })
  })
  describe('removeShadow', function() {   
    it('should remove a previously added shadow', function() {
      const env = new Environment();
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(4))
      };
      const shadow = {
        [MEMORY]: new DataView(new ArrayBuffer(4))
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      env.addShadow(shadow, object);
      env.removeShadow(shadow[MEMORY]);
      expect(env.context.shadowMap.size).to.equal(0);
    }) 
  })
  describe('updateShadows', function() {    
    it('should do nothing where there are no shadows', function() {
      const env = new Environment();
      env.startContext();
      env.updateShadows();
    })
    it('should copy data from targets to shadows', function() {
      const env = new Environment();
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(4)),
      };
      const shadow = {
        [MEMORY]: new DataView(new ArrayBuffer(4)),
        [COPIER]: getMemoryCopier(4),
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      env.addShadow(shadow, object);
      object[MEMORY].setUint32(0, 1234, true);
      env.updateShadows();
      expect(shadow[MEMORY].getUint32(0, true)).to.equal(1234);
    })
  })
  describe('updateShadowTargets', function() {
    it('should do nothing where there are no shadows', function() {
      const env = new Environment();
      env.startContext();
      env.updateShadowTargets();
    })
    it('should copy data from targets to shadows', function() {
      const env = new Environment();
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(4)),
        [COPIER]: getMemoryCopier(4),
      };
      const shadow = {
        [MEMORY]: new DataView(new ArrayBuffer(4)),
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      env.startContext();
      env.addShadow(shadow, object);
      shadow[MEMORY].setUint32(0, 1234, true);
      env.updateShadowTargets();
      expect(object[MEMORY].getUint32(0, true)).to.equal(1234);
    })
  })
  describe('releaseShadows', function() {    
    it('should do nothing where there are no shadows', function() {
      const env = new Environment();
      env.startContext();
      env.releaseShadows();
    })
    it('should free the memory of shadows', function() {
      const env = new Environment();
      const object = {
        [MEMORY]: new DataView(new ArrayBuffer(4)),
      };
      const shadow = {
        [MEMORY]: new DataView(new ArrayBuffer(4)),
        [ATTRIBUTES]: {
          address: 0x1000,
          len: 4,
          align: 1,
        },
      };
      env.getBufferAddress = function() {
        return 0x1000;
      };
      let address, len, align;
      env.freeShadowMemory = function(...args) {
        address = args[0];
        len = args[1];
        align = args[2];
      }
      env.startContext();
      env.addShadow(shadow, object);
      env.releaseShadows();
      expect(address).to.equal(0x1000);
      expect(len).to.equal(4);
      expect(align).to.equal(1);
    })
  })
  describe('acquirePointerTargets', function() {
    it('should set pointer slot to undefined when pointer is inactive', function() {
      const env = new Environment();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*i32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.Optional,
        name: 'Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      env.inFixedMemory = function() {
        return false;
      };
      const { constructor: Hello } = structure;    
      const object = new Hello(new Int32(123));
      expect(object.$['*']).to.equal(123);
      object[MEMORY].setBigUint64(0, 0n);
      env.acquirePointerTargets(object);
      expect(object[SLOTS][0][SLOTS][0]).to.be.undefined;
      expect(object.$).to.be.null;
    })    
    it('should ignore const pointers', function() {
      const env = new Environment();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*i32',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const structure = env.beginStructure({
        type: StructureType.ArgStruct,
        name: 'Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(structure, {
        name: '0',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(structure, {
        name: 'retval',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      env.inFixedMemory = function() {
        return false;
      };
      const { constructor: Hello } = structure;    
      const object = new Hello([ new Int32(123) ]);
      expect(object[0]['*']).to.equal(123);
      env.acquirePointerTargets(object);
      expect(object[0]['*']).to.equal(123);
    })    
    it('should clear slot when pointer has invalid address', function() {
      const env = new Environment();
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*i32',
        byteSize: 8,
        hasPointer: true,
        isConst: false,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: intStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const { constructor: Int32Ptr } = ptrStructure;
      env.inFixedMemory = function() {
        return false;
      };
      env.obtainFixedView = function(address, len) {
        if (isInvalidAddress(address)) {
          return null;
        }
        throw new Error('Unexpected input');
      };
      const ptr = new Int32Ptr(new Int32(123));
      expect(ptr['*']).to.equal(123);
      ptr[MEMORY].setBigUint64(0, 0xaaaaaaaaaaaaaaaan, true);
      env.acquirePointerTargets(ptr);
      expect(() => ptr['*']).to.throw(TypeError)
        .with.property('message').that.contains('Null')
    })    
    it('should be able to handle self-referencing structures', function() {
      const env = new Environment();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 12,
        hasPointer: true,
      });
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const optionalStructure = env.beginStructure({
        type: StructureType.Optional,
        name: '?*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(optionalStructure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(optionalStructure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.finalizeShape(optionalStructure);
      env.finalizeStructure(optionalStructure);
      env.attachMember(structure, {
        name: 'sibling',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: optionalStructure,
      });
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      env.inFixedMemory = function() {
        return false;
      };
      const { constructor: Hello } = structure;    
      const object1 = new Hello({ sibling: null });
      const object2 = new Hello({ sibling: object1 });
      const object3 = new Hello({ sibling: object2 });
      const object4 = new Hello({ sibling: null });
      const object5 = new Hello({ sibling: object4 });
      object1.sibling = object3;
      expect(object3.sibling['*']).to.equal(object2);
      expect(object3.sibling['*'].sibling['*']).to.equal(object1);
      expect(object3.sibling['*'].sibling['*'].sibling['*']).to.equal(object3);
      const map = new Map([
        [ 0x1000n, object1[MEMORY] ],
        [ 0x2000n, object2[MEMORY] ],
        [ 0x3000n, object3[MEMORY] ],
        [ 0x4000n, object4[MEMORY] ],
        [ 0x5000n, object5[MEMORY] ],
      ]);      
      env.obtainFixedView = function(address, len) {
        return map.get(address);
      };
      object1[MEMORY].setBigUint64(0, 0x5000n, true); // obj1 -> obj5
      object2[MEMORY].setBigUint64(0, 0x1000n, true); // obj2 -> obj1
      object3[MEMORY].setBigUint64(0, 0x0000n, true); // obj3 -> null
      object5[MEMORY].setBigUint64(0, 0x4000n, true); // obj5 -> obj4
      env.acquirePointerTargets(object3);
      expect(object3.sibling).to.be.null;
      expect(object2.sibling['*']).to.equal(object1);
      expect(object1.sibling['*']).to.equal(object5);
      expect(object5.sibling['*']).to.equal(object4);
    })
    it('should acquire missing objects', function() {
      const env = new Environment();
      const structure = env.beginStructure({
        type: StructureType.Struct,
        name: 'Hello',
        byteSize: 12,
        hasPointer: true,
      });
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const optionalStructure = env.beginStructure({
        type: StructureType.Optional,
        name: '?*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(optionalStructure, {
        name: 'value',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: ptrStructure,
      });
      env.attachMember(optionalStructure, {
        name: 'present',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
      });
      env.finalizeShape(optionalStructure);
      env.finalizeStructure(optionalStructure);
      env.attachMember(structure, {
        name: 'sibling',
        type: MemberType.Object,
        bitOffset: 0,
        bitSize: 64,
        byteSize: 8,
        slot: 0,
        structure: optionalStructure,
      });
      const intStructure = env.beginStructure({
        type: StructureType.Primitive,
        name: 'i32',
        byteSize: 4,
      });
      env.attachMember(intStructure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      env.attachMember(structure, {
        name: 'number',
        type: MemberType.Int,
        bitOffset: 64,
        bitSize: 32,
        byteSize: 4,
        structure: intStructure,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      env.inFixedMemory = function() {
        return false;
      };
      const { constructor: Hello } = structure;    
      const object1 = new Hello({ sibling: null });
      const object2 = new Hello({ sibling: null });
      const object3 = new Hello({ sibling: null });
      const map = new Map([
        [ 0x1000n, object1[MEMORY] ],
        [ 0x2000n, object2[MEMORY] ],
        [ 0x3000n, object3[MEMORY] ],
      ]);      
      env.obtainFixedView = function(address, len) {
        return map.get(address);
      };
      object1[MEMORY].setBigUint64(0, 0x3000n, true); // obj1 -> obj3
      object2[MEMORY].setBigUint64(0, 0x1000n, true); // obj2 -> obj1
      object3[MEMORY].setBigUint64(0, 0x2000n, true); // obj3 -> obj2
      env.acquirePointerTargets(object3);
      expect(object3.sibling['*']).to.equal(object2);
      expect(object2.sibling['*']).to.equal(object1);
      expect(object1.sibling['*']).to.equal(object3);     
    })
    it('should acquire missing opaque structures', function() {
      const env = new Environment();
      const opaqueStructure = env.beginStructure({
        type: StructureType.Opaque,
        name: 'Hello',
        hasPointer: false,
      });
      env.finalizeShape(opaqueStructure);
      env.finalizeStructure(opaqueStructure);
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
        name: '*Hello',
        byteSize: 8,
        hasPointer: true,
      });
      env.attachMember(ptrStructure, {
        type: MemberType.Object,
        bitSize: 64,
        bitOffset: 0,
        byteSize: 8,
        slot: 0,
        structure: opaqueStructure,
      });
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      env.inFixedMemory = function() {
        return false;
      };
      const { constructor: Ptr } = ptrStructure;    
      const pointer = new Ptr(undefined);
      const dv = new DataView(new ArrayBuffer(16))
      const map = new Map([
        [ 0x1000n, dv ],
      ]);      
      env.obtainFixedView = function(address, len) {
        return map.get(address);
      };
      pointer[MEMORY].setBigUint64(0, 0x1000n, true);
      env.acquirePointerTargets(pointer);
      expect(pointer.dataView).to.equal(dv);
    })
  })
  describe('acquireDefaultPointers', function() {
    it('should acquire targets of pointers in structure template slots ', function() {
      const env = new Environment();
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
      env.finalizeShape(intStructure);
      env.finalizeStructure(intStructure);
      const { constructor: Int32 } = intStructure;
      const ptrStructure = env.beginStructure({
        type: StructureType.Pointer,
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
      env.finalizeShape(ptrStructure);
      env.finalizeStructure(ptrStructure);
      const { constructor: Int32Ptr } = ptrStructure;
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
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      // function mocks
      env.inFixedMemory = function() {
        return true;
      };
      const requests = [];
      env.obtainFixedView = function(address, len) {
        requests.push({ address, len });
        const dv = new DataView(new ArrayBuffer(len));
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
  describe('findSortedIndex', function() {
    it('should return correct indices for the addresses given', function() {
      const list = [
        { address: 10 },
        { address: 20 },
        { address: 30 },
      ];
      expect(findSortedIndex(list, 5, m => m.address)).to.equal(0);
      expect(findSortedIndex(list, 15, m => m.address)).to.equal(1);
      expect(findSortedIndex(list, 25, m => m.address)).to.equal(2);
      expect(findSortedIndex(list, 35, m => m.address)).to.equal(3);
      expect(findSortedIndex(list, 30, m => m.address)).to.equal(3);
      expect(findSortedIndex(list, 10, m => m.address)).to.equal(1);
    })
  })
  describe('isMisaligned', function() {
    it(`should determine whether address is misaligned`, function() {
      expect(isMisaligned(0x1000, 2)).to.be.false;
      expect(isMisaligned(0x1001, 2)).to.be.true;
      expect(isMisaligned(0x1002, 2)).to.be.false;
      expect(isMisaligned(0x1002, 4)).to.be.true;
      expect(isMisaligned(0x1004, 4)).to.be.false;
      expect(isMisaligned(0x1004, 8)).to.be.true;
    })
    it(`should handle bigInt addresses`, function() {
      expect(isMisaligned(0xF000000000001000n, 2)).to.be.false;
      expect(isMisaligned(0xF000000000001001n, 2)).to.be.true;
      expect(isMisaligned(0xF000000000001002n, 2)).to.be.false;
      expect(isMisaligned(0xF000000000001002n, 4)).to.be.true;
      expect(isMisaligned(0xF000000000001004n, 4)).to.be.false;
      expect(isMisaligned(0xF000000000001004n, 8)).to.be.true;
    })
    it(`should return false when align is undefined`, function() {
      expect(isMisaligned(0x1000, undefined)).to.be.false;
      expect(isMisaligned(0xF000000000001000n, undefined)).to.be.false;
    })
  })
  describe('getAlignedAddress', function() {
    it('should create an aligned address from one that is not aligned', function() {
      expect(getAlignedAddress(0x0001, 4)).to.equal(0x0004)
    })
  })
  describe('add', function() {
    it(`should add a number to another`, function() {
      expect(add(5, 5)).to.equal(10);
    })
    it(`should add a number to a bigint`, function() {
      expect(add(5n, 5)).to.equal(10n);
    })
    it(`should add a bigint to a bigint`, function() {
      expect(add(5n, 5n)).to.equal(10n);
    })
  })
  describe('subtract', function() {
    it(`should subtract a number from another`, function() {
      expect(subtract(15, 5)).to.equal(10);
    })
    it(`should subtract a number to from bigint`, function() {
      expect(subtract(15n, 5)).to.equal(10n);
    })
    it(`should subtract a bigint to from bigint`, function() {
      expect(subtract(15n, 5n)).to.equal(10n);
    })
  })
  describe('isInvalidAddress', function() {
    it(`should return true when 0xaaaaaaaa is given`, function() {
      expect(isInvalidAddress(0xaaaaaaaa)).to.be.true;
    })
    it(`should return true when 0xaaaaaaaaaaaaaaaan is given`, function() {
      expect(isInvalidAddress(0xaaaaaaaaaaaaaaaan)).to.be.true;
    })
    it(`should return false when address valid`, function() {
      expect(isInvalidAddress(0x1000n)).to.be.false;
    })
  })
})

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function capture(cb) {
  const logFn = console.log;
  const lines = [];
  try {
    console.log = (text) => {
      if (typeof(text) === 'string') {
        for (const line of text.split(/\r?\n/)) {
          lines.push(line)
        }
      } else {
        logFn.call(console, text);
      }
    };
    await cb();
  } finally {
    console.log = logFn;
  }
  return lines;
}

