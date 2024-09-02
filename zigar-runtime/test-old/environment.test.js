import { expect } from 'chai';

import {
  Environment
} from '../src/environment.js';
import { useAllMemberTypes } from '../src/member.js';
import { useAllStructureTypes } from '../src/structure.js';
import {
  FIXED,
  MEMORY,
  SLOTS
} from '../src/symbol.js';
import { MemberType, StructureType } from '../src/types.js';

describe('Environment', function() {
  beforeEach(function() {
    useAllMemberTypes();
    useAllStructureTypes();
  })
  describe('allocateFixedMemory', function() {
    it('should try to allocate fixed memory from zig', function() {
      const env = new Environment();
      env.allocateExternMemory = function(type, len, align) {
        return 0x1000n;
      };
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
        return this.obtainView(buffer, 0, len);
      };
      const dv = env.allocateFixedMemory(400, 4);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(400);
      expect(dv[FIXED]).to.be.an('object');
    })
    it('should return empty data view when len is 0', function() {
      const env = new Environment();
      env.allocateExternMemory = function(type, len, align) {
        return 0x1000n;
      };
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
        const dv = this.obtainView(buffer, 0, len);
        return dv;
      };
      const dv1 = env.allocateFixedMemory(0, 4);
      const dv2 = env.allocateFixedMemory(0, 1);
      expect(dv1.byteLength).to.equal(0);
      expect(dv2.byteLength).to.equal(0);
      expect(dv1[FIXED]).to.be.an('object')
    })
  })
  describe('freeFixedMemory', function() {
    it('should try to free fixed memory through Zig', function() {
      const env = new Environment();
      let args;
      env.freeExternMemory = function(type, address, len, align) {
        args = { type, address, len, align };
      };
      const dv = new DataView(new ArrayBuffer(16));
      dv[FIXED] = {
        type: 0,
        address: 0x1000n,
        len: 16,
        align: 4,
      };
      env.freeFixedMemory(dv);
      expect(args).to.eql({ type: 0, address: 0x1000n, len: 16, align: 4 });
    })
    it('should try to free fixed memory with unaligned address through Zig', function() {
      const env = new Environment();
      let args;
      env.freeExternMemory = function(type, address, len, align) {
        args = { type, address, len, align };
      };
      const dv = new DataView(new ArrayBuffer(16));
      dv[FIXED] = {
        type: 0,
        unalignedAddress: 0x1000n,
        address: 0x1004n,
        len: 16,
        align: 4,
      };
      env.freeFixedMemory(dv);
      expect(args).to.eql({ type: 0, address: 0x1000n, len: 16, align: 4 });
    })
    it('should do nothing when len is 0', function() {
      const env = new Environment();
      let called = false;
      env.freeExternMemory = function(address, len, align) {
        called = true;
      };
      const dv = new DataView(new ArrayBuffer(0));
      dv[FIXED] = {
        type: 0,
        address: 0x1000n,
        len: 0,
        align: 0,
      };
      env.freeFixedMemory(dv);
      expect(called).to.equal(false);
    })
  })
  describe('obtainFixedView', function() {
    it('should return a data view covering fixed memory at given address', function() {
      const env = new Environment();
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
        const dv = this.obtainView(buffer, 0, len);
        return dv;
      };
      const dv = env.obtainFixedView(0x1000n, 16);
      expect(dv.byteLength).to.equal(16);
      expect(dv[FIXED]).to.be.an('object')
    })
    it('should return empty data view when len is 0', function() {
      const env = new Environment();
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
        const dv = this.obtainView(buffer, 0, len);
        return dv;
      };
      const dv1 = env.obtainFixedView(0x1000n, 0);
      const dv2 = env.obtainFixedView(0x2000n, 0);
      expect(dv1.byteLength).to.equal(0);
      expect(dv2.byteLength).to.equal(0);
      expect(dv1).to.not.equal(dv2);
      expect(dv1[FIXED]).to.be.an('object')
      expect(dv2[FIXED]).to.be.an('object')
    })
    it('should return a view to the empty buffer when len is zero and address is 0', function() {
      const env = new Environment();
      const dv = env.obtainFixedView(0n, 0);
      expect(dv.buffer).to.equal(env.emptyBuffer);
    })
  })
  describe('releaseFixedView', function() {
    it('should free a data view that was allocated using allocateFixedMemory', function() {
      const env = new Environment();
      env.allocateExternMemory = function(type, len, align) {
        return 0x1000n;
      };
      env.obtainExternView = function(address, len) {
        const buffer = new ArrayBuffer(len);
        buffer[FIXED] = { address, len };
        const dv = this.obtainView(buffer, 0, len);
        return dv;
      };
      let args;
      env.freeExternMemory = function(type, address, len, align) {
        args = { type, address, len, align };
      };
      const dv = env.allocateFixedMemory(400, 4);
      env.releaseFixedView(dv);
      expect(args).to.eql({ type: 0, address: 0x1000n, len: 400, align: 4 });
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
      const dv2 = env.findMemory(address, dv1.byteLength, 1);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.equal(dv1.buffer);
      expect(dv2.byteOffset).to.equal(dv1.byteOffset);
    })
    it('should find previously imported buffer when size is undefined', function() {
      const env = new Environment();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv1 = new DataView(new ArrayBuffer(32));
      env.startContext();
      const address = env.registerMemory(dv1);
      const dv2 = env.findMemory(address, 1, undefined);
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
      const dv2 = env.findMemory(address + 8n, 8, 1);
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
      const dv2 = env.findMemory(0xFF0000n, 8, 1);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.be.instanceOf(SharedArrayBuffer);
    })
    it('should return data view of shared memory if address is not known and size, is undefined', function() {
      const env = new Environment();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv1 = new DataView(new ArrayBuffer(32));
      env.startContext();
      const address = env.registerMemory(dv1);
      const dv2 = env.findMemory(0xFF0000n, 4, undefined);
      expect(dv2).to.be.instanceOf(DataView);
      expect(dv2.buffer).to.be.instanceOf(SharedArrayBuffer);
    })
    it('should return null when address is invalid and count is above 0', function() {
      const env = new Environment();
      const dv = env.findMemory(0xaaaaaaaa, 14, 5);
      expect(dv).to.be.null;
    })
    it('should return null when address is 0 and count is above 0', function() {
      const env = new Environment();
      const dv = env.findMemory(0, 14, 5);
      expect(dv).to.be.null;
    })
    it('should return empty view when address is invalid and count is 0', function() {
      const env = new Environment();
      env.obtainFixedView = (address, len) => new DataView(new SharedArrayBuffer(len));
      env.getBufferAddress = () => 0x1000n;
      const dv = env.findMemory(0xaaaaaaaa, 0, 5);
      expect(dv.byteLength).to.equal(0);
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
        type: StructureType.SinglePointer,
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
                    const: true,
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
  describe('getSpecialExports', function() {
    it('should return object for controlling module', async function() {
      const env = new Environment();
      env.init = async () => {};
      env.imports = {
        runThunk: function() {},
      };
      const object = env.getSpecialExports();
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
      const object = env.getSpecialExports();
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
    it('should provide functions for obtaining type info', async function() {
      const env = new Environment();
      env.imports = {
        runThunk: function() {},
      };
      const { sizeOf, alignOf, typeOf } = env.getSpecialExports();
      expect(sizeOf).to.be.a('function');
      expect(alignOf).to.be.a('function');
      expect(typeOf).to.be.a('function');
      const structure = env.beginStructure({
        type: StructureType.PackedStruct,
        name: 'Packed',
        byteSize: 4,
        align: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        name: 'nice',
        bitSize: 1,
        bitOffset: 0,
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        name: 'rich',
        bitSize: 1,
        bitOffset: 1,
      });
      env.attachMember(structure, {
        type: MemberType.Bool,
        name: 'young',
        bitSize: 1,
        bitOffset: 2,
      });
      env.attachMember(structure, {
        type: MemberType.Uint,
        bitSize: 32,
        bitOffset: 0,
        byteSize: 4,
      });
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Packed } = structure;
      expect(sizeOf(Packed)).to.equal(4);
      expect(alignOf(Packed)).to.equal(2);
      expect(typeOf(Packed)).to.equal('packed struct');
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
        type: StructureType.SinglePointer,
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
        name: 'retval',
        type: MemberType.Void,
        bitOffset: 0,
        bitSize: 0,
        byteSize: 0,
        structure: {},
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
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: ArgStruct } = structure;
      const object1 = new Int32(123);
      const object2 = new Int32(123);
      const args = new ArgStruct([ object1, object2, object1, object1 ]);
      env.getTargetAddress = function(target, cluster) {
        // flag object1 as misaligned
        if (cluster) {
          return;
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
        type: StructureType.SinglePointer,
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
        type: StructureType.SinglePointer,
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
        type: StructureType.SinglePointer,
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
  describe('updatePointerTargets', function() {
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
        type: StructureType.SinglePointer,
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
      const { constructor: Hello } = structure;
      const object = new Hello(new Int32(123));
      expect(object.$['*']).to.equal(123);
      object[MEMORY].setBigUint64(0, 0n);
      env.updatePointerTargets(object);
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
        type: StructureType.SinglePointer,
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
        name: 'retval',
        type: MemberType.Bool,
        bitOffset: 0,
        bitSize: 1,
        byteSize: 8,
        structure: {},
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
      env.finalizeShape(structure);
      env.finalizeStructure(structure);
      const { constructor: Hello } = structure;
      const object = new Hello([ new Int32(123) ]);
      expect(object[0]['*']).to.equal(123);
      env.updatePointerTargets(object);
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
        type: StructureType.SinglePointer,
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
      const ptr = new Int32Ptr(new Int32(123));
      expect(ptr['*']).to.equal(123);
      ptr[MEMORY].setBigUint64(0, 0xaaaaaaaaaaaaaaaan, true);
      env.updatePointerTargets(ptr);
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
        type: StructureType.SinglePointer,
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
      env.updatePointerTargets(object3);
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
        type: StructureType.SinglePointer,
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
      env.updatePointerTargets(object3);
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
        type: StructureType.SinglePointer,
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
      env.updatePointerTargets(pointer);
      expect(pointer.dataView).to.equal(dv);
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

