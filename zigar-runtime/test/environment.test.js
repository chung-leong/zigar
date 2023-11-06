import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
} from '../src/member.js';
import {
  StructureType,
  useStruct,
} from '../src/structure.js';
import {
  Environment,
  NodeEnvironment,
  WebAssemblyEnvironment,
  getGlobalSlots,
  CallContext
} from '../src/environment.js'
import { MEMORY, SLOTS, ENVIRONMENT } from '../src/symbol.js';

describe('Environment', function() {
  beforeEach(function() {
    useStruct();
    useIntEx();
  })
  describe('Base class', function() {
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
    describe('rememberPointer', function() {
      it('should return whether a pointer was seen before', function() {
        const env = new Environment();
        env.getAddress = () => 0x1000n;
        const pointer = {
          [MEMORY]: new DataView(new ArrayBuffer(8)),
        };
        env.startContext();
        const result1 = env.rememberPointer(pointer);
        expect(result1).to.be.false;
        const result2 = env.rememberPointer(pointer);
        expect(result2).to.be.true;
      })
    })
    describe('importMemory', function() {
      it('should return address of data view', function() {
        const env = new Environment();
        env.getAddress = () => 0x1000n;
        const dv = new DataView(new ArrayBuffer(16), 8, 8);
        env.startContext();
        const address = env.importMemory(dv);
        expect(address).to.equal(0x1000n + 8n);
      })
      it('should return address as number when address is number', function() {
        const env = new Environment();
        env.getAddress = () => 0x1000;
        const dv = new DataView(new ArrayBuffer(16), 8, 8);
        env.startContext();
        const address = env.importMemory(dv);
        expect(address).to.equal(0x1000 + 8);
      })
      it('should not import same buffer twice', function() {
        const env = new Environment();
        env.getAddress = () => 0x1000;
        const dv = new DataView(new ArrayBuffer(16), 8, 8);
        env.startContext();
        env.importMemory(dv);
        env.importMemory(dv);
        env.importMemory(dv);
        expect(env.context.memoryList).to.have.lengthOf(1);
      })
    })
    describe('findMemory', function() {
      it('should find previously imported buffer', function() {
        const env = new Environment();
        env.obtainView = (address, len) => new DataView(new SharedArrayBuffer(len));
        env.getAddress = () => 0x1000n;
        const dv1 = new DataView(new ArrayBuffer(32));
        env.startContext();
        const address = env.importMemory(dv1);
        const dv2 = env.findMemory(address, dv1.byteLength);
        expect(dv2).to.be.instanceOf(DataView);
        expect(dv2.buffer).to.equal(dv1.buffer);
        expect(dv2.byteOffset).to.equal(dv1.byteOffset);
      })
      it('should find a subslice of previously imported buffer', function() {
        const env = new Environment();
        env.obtainView = (address, len) => new DataView(new SharedArrayBuffer(len));
        env.getAddress = () => 0x1000n;
        const dv1 = new DataView(new ArrayBuffer(32));
        env.startContext();
        const address = env.importMemory(dv1);
        const dv2 = env.findMemory(address + 8n, 8);
        expect(dv2).to.be.instanceOf(DataView);
        expect(dv2.buffer).to.equal(dv1.buffer);
        expect(dv2.byteOffset).to.equal(8);
      })
      it('should return data view of shared memory if address is not known', function() {
        const env = new Environment();
        env.obtainView = (address, len) => new DataView(new SharedArrayBuffer(len));
        env.getAddress = () => 0x1000n;
        const dv1 = new DataView(new ArrayBuffer(32));
        env.startContext();
        const address = env.importMemory(dv1);
        const dv2 = env.findMemory(0xFF0000n, 8);
        expect(dv2).to.be.instanceOf(DataView);
        expect(dv2.buffer).to.be.instanceOf(SharedArrayBuffer);
      })
    })
    describe('getViewAddress', function() {
      it('should return address of data view', function() {
        const env = new Environment();
        env.getAddress = () => 0x1000n;
        const dv = new DataView(new ArrayBuffer(32), 8, 8);
        const address = env.getViewAddress(dv);
        expect(address).to.equal(0x1008n);
      })
    })
    describe('createBuffer', function() {
      it('should return a data view of a newly created array buffer', function() {
        const env = new Environment();
        env.getAddress = () => 0x10000;
        const dv = env.createBuffer(32, 3);
        expect(dv).to.be.instanceOf(DataView);
        expect(dv.byteLength).to.equal(32);
        expect(dv.byteOffset).to.equal(0);
      })
      it('should create a larger buffer to prevent misalignment', function() {
        const env = new Environment();
        env.getAddress = () => 0x10010;
        const dv = env.createBuffer(32, 5);
        expect(dv).to.be.instanceOf(DataView);
        expect(dv.byteLength).to.equal(32);
        expect(dv.byteOffset).to.equal(16);
        expect(dv.buffer.byteLength).to.equal(64);
      })
    })
    describe('allocMemory', function() {
      it('should create a buffer that can be discovered later', function() {
        const env = new Environment();
        env.getAddress = () => 0x10000n;
        env.startContext();
        const dv1 = env.allocMemory(32, 3);
        expect(dv1).to.be.instanceOf(DataView);
        expect(dv1.byteLength).to.equal(32);
        const dv2 = env.findMemory(0x10000n, 32);
        expect(dv2.buffer).to.equal(dv1.buffer);
        expect(dv2.byteLength).to.equal(32);
      })
    })
    describe('freeMemory', function() {
      it('should remove buffer at indicated address', function() {
        const env = new Environment();
        env.obtainView = () => null;
        env.getAddress = () => 0x10010;
        env.startContext();
        const dv = env.allocMemory(32, 5);
        expect(dv).to.be.instanceOf(DataView);
        expect(dv.byteLength).to.equal(32);
        expect(dv.byteOffset).to.equal(16);
        const address = env.getViewAddress(dv);
        env.freeMemory(address, 32, 5);
        const bad = env.findMemory(address, 32);
        expect(bad).to.be.null;
      })
    })
    describe('createView', function() {
      it('should allocate new buffer and copy data using copyBytes', function() {
        const env = new Environment();
        env.getAddress = () => 0x10000;
        env.copyBytes = (dv, address, len) => {
          dv.setInt32(0, address, true);
          dv.setInt32(4, len, true);
        };
        const dv = env.createView(1234, 32, 3, true);
        expect(dv).to.be.instanceOf(DataView);
        expect(dv.getInt32(0, true)).to.equal(1234);
        expect(dv.getInt32(4, true)).to.equal(32);
      })
      it('should get view of memory using obtainView', function() {
        const env = new Environment();
        env.getAddress = () => 0x10000;
        env.obtainView = (address, len) => {
          return { address, len };
        };
        const result = env.createView(1234, 32, 3, false);
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
    })
    describe('createObject', function() {
      it('should call constructor using the new operator', function() {
        const env = new Environment();
        let recv, arg;
        const structure = {
          constructor: function(dv) {
            recv = this;
            arg = dv;
          }
        };
        const initializer = {};
        const object = env.createObject(structure, initializer);
        expect(recv).to.be.instanceOf(structure.constructor);
        expect(recv).to.equal(object);
        expect(arg).to.equal(initializer);
      })
    })
    describe('readSlot', function() {
      it('should read from global slots where target is null', function() {
        const env = new Environment();
        const slots = getGlobalSlots();
        const object = {}
        slots[1] = object;
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
        const slots = getGlobalSlots();
        const object = {}
        env.writeSlot(null, 1, object);
        expect(slots[1]).to.equal(object);
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
        const options = {};
        const s = env.beginStructure({
          type: StructureType.Struct,
          name: 'Hello',
          length: 1,
          byteSize: 16,
          align: 3,
          isConst: false,
          hasPointer: false,
        }, options);
        expect(s.type).to.equal(StructureType.Struct);
        expect(s.name).to.equal('Hello');
        expect(s.byteSize).to.equal(16);
      })
    })
    describe('attachMember', function() {
      it('should add instance member', function() {
        const env = new Environment();
        const options = {};
        const s = env.beginStructure({
          type: StructureType.Struct,
          name: 'Hello',
          length: 1,
          byteSize: 16,
          align: 3,
          isConst: false,
          hasPointer: false,
        }, options);
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
        const options = {};
        const s = env.beginStructure({
          type: StructureType.Struct,
          name: 'Hello',
          length: 1,
          byteSize: 16,
          align: 3,
          isConst: false,
          hasPointer: false,
        }, options);
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
        const options = {};
        const s = env.beginStructure({
          type: StructureType.Struct,
          name: 'Hello',
          length: 1,
          byteSize: 16,
          align: 3,
          isConst: false,
          hasPointer: false,
        }, options);
        env.attachMethod(s, method, true);
        expect(s.static.methods[0]).to.eql(method);
      })
      it('should attach both static and instance method', function() {
        const env = new Environment();
        const method = {
          name: 'say',
        };
        const options = {};
        const s = env.beginStructure({
          type: StructureType.Struct,
          name: 'Hello',
          length: 1,
          byteSize: 16,
          align: 3,
          isConst: false,
          hasPointer: false,
        }, options);
        env.attachMethod(s, method, false);
        expect(s.static.methods[0]).to.eql(method);
        expect(s.instance.methods[0]).to.eql(method);
      })
    })
    describe('createTemplate', function() {
      it('should return a template object', function() {
        const env = new Environment();
        const dv = new DataView(new ArrayBuffer(8));
        const templ = env.createTemplate(dv);
        expect(templ[MEMORY]).to.equal(dv);
      })
    })
    describe('attachTemplate', function() {
      it('should attach instance template', function() {
        const env = new Environment();
        const dv = new DataView(new ArrayBuffer(8));
        const templ = env.createTemplate(dv);
        const options = {};
        const s = env.beginStructure({
          type: StructureType.Struct,
          name: 'Hello',
          length: 1,
          byteSize: 16,
          align: 3,
          isConst: false,
          hasPointer: false,
        }, options);
        env.attachTemplate(s, templ, false);
        expect(s.instance.template).to.equal(templ);
      })
      it('should attach instance template', function() {
        const env = new Environment();
        const dv = new DataView(new ArrayBuffer(8));
        const templ = env.createTemplate(dv);
        const options = {};
        const s = env.beginStructure({
          type: StructureType.Struct,
          name: 'Hello',
          length: 1,
          byteSize: 16,
          align: 3,
          isConst: false,
          hasPointer: false,
        }, options);
        env.attachTemplate(s, templ, true);
        expect(s.static.template).to.equal(templ);
      })
    })
    describe('finalizeStructure', function() {
      it('should generate constructor for a struct', function() {
        const env = new Environment();
        const options = {};
        const s = env.beginStructure({
          type: StructureType.Struct,
          name: 'Hello',
          length: 1,
          byteSize: 16,
          align: 3,
          isConst: false,
          hasPointer: false,
        }, options);
        env.attachMember(s, {
          type: MemberType.Int,
          name: 'number',
          bitSize: 32,
          byteSize: 4,
          bitOffset: 0,
          required: false,
        }, false);
        const constructor = env.finalizeStructure(s);
        const object = new constructor(undefined);
        expect(object).to.have.property('number');
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
          const array1 = encoder.encode('Hello world');
          env.writeToConsole(new DataView(array1.buffer));
          await delay(10);
          const array2 = encoder.encode('!');
          env.writeToConsole(new DataView(array2.buffer));
          await delay(300);
        });
        expect(lines).to.eql([ 'Hello world!' ]);
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
  })
  describe('NodeEnvironment', function() {
    describe('isShared', function() {
      it('should return true when view points to a SharedArrayBuffer', function() {
        const env = new NodeEnvironment();
        const dv = new DataView(new SharedArrayBuffer(16));
        const result = env.isShared(dv);
        expect(result).to.be.true;
      })
    })
    describe('invokeFactory', function() {
      it('should run the given thunk function with the expected arguments and return a constructor', function() {
        const env = new NodeEnvironment();
        let recv;
        const constructor = function() {};
        function thunk(...args) {
          recv = this;
          return constructor
        };
        const result = env.invokeFactory(thunk);
        expect(recv).to.be.equal(env);
        expect(result).to.equal(constructor);
        expect(result).to.have.property('__zigar');
      })
      it('should throw if the thunk function returns a string', function() {
        const env = new NodeEnvironment();
        function thunk(...args) {
          return 'TotalBrainFart';
        }
        expect(() => env.invokeFactory(thunk)).to.throw(Error)
          .with.property('message').that.equal('Total brain fart');
      })
    })

  })
  describe('WebAssemblyEnvironment', function() {
    describe('isShared', function() {
      it('should return true when view points to a WebAssembly memory', function() {
        const env = new WebAssemblyEnvironment();
        const memory = env.memory = new WebAssembly.Memory({
          initial: 128,
          maximum: 1024,
        });
        const dv = new DataView(memory.buffer, 0, 8);
        const result = env.isShared(dv);
        expect(result).to.be.true;
      })
    })
    describe('setCallContext', function() {
      it('should save the address of the context object in WebAssembly', function() {
        const env = new WebAssemblyEnvironment();
        env.startContext();
        env.setCallContext(1234);
        expect(env.context.callContext).to.equal(1234);
        const { _setCallContext } = env.exportFunctions();
        _setCallContext(4567);
        expect(env.context.callContext).to.equal(4567);
      })
    })
    describe('releaseObjects', function() {
      it('should release objects stored in value table', function() {
        const env = new WebAssemblyEnvironment();
        const index = env.getObjectIndex({});
        expect(env.valueTable[index]).to.be.an('object');
        env.releaseObjects();
        expect(env.valueTable[index]).to.be.undefined;
      })
    })
    describe('getObjectIndex', function() {
      it('should create index from new object', function() {
        const env = new WebAssemblyEnvironment();
        const object1 = {};
        const object2 = {};
        const index1 = env.getObjectIndex(object1);
        const index2 = env.getObjectIndex(object2);
        expect(index1).to.equal(1);
        expect(index2).to.equal(2);
      })
      it('should return index of object already in table', function() {
        const env = new WebAssemblyEnvironment();
        const object1 = {};
        const object2 = {};
        const index1 = env.getObjectIndex(object1);
        const index2 = env.getObjectIndex(object2);
        const index3 = env.getObjectIndex(object1);
        const index4 = env.getObjectIndex(object2);
        expect(index3).to.equal(index1);
        expect(index4).to.equal(index2);
      })
    })
    describe('fromWebAssembly', function() {
      it('should return object stored in value table', function() {
        const env = new WebAssemblyEnvironment();
        const object = {};
        const index = env.getObjectIndex(object);
        const result = env.fromWebAssembly('v', index);
        expect(result).to.equal(object);
      })
      it('should return string stored in value table', function() {
        const env = new WebAssemblyEnvironment();
        const object = new String('hello world');
        const index = env.getObjectIndex(object);
        const result = env.fromWebAssembly('s', index);
        expect(result).to.equal('hello world');
      })
      it('should return number given', function() {
        const env = new WebAssemblyEnvironment();
        const result = env.fromWebAssembly('i', 72);
        expect(result).to.equal(72);
      })
      it('should return number as boolean', function() {
        const env = new WebAssemblyEnvironment();
        const result1 = env.fromWebAssembly('b', 72);
        const result2 = env.fromWebAssembly('b', 0);
        expect(result1).to.be.true;
        expect(result2).to.be.false;
      })
    })
    describe('toWebAssembly', function() {
      it('should store object in value table', function() {
        const env = new WebAssemblyEnvironment();
        const object = {};
        const index = env.toWebAssembly('v', object);
        const result = env.fromWebAssembly('v', index);
        expect(result).to.equal(object);
      })
      it('should store string in value table', function() {
        const env = new WebAssemblyEnvironment();
        const string = 'hello world';
        const index = env.toWebAssembly('s', string);
        const result = env.fromWebAssembly('s', index);
        expect(result).to.equal(string);
      })
      it('should return number given', function() {
        const env = new WebAssemblyEnvironment();
        const result = env.toWebAssembly('i', 72);
        expect(result).to.equal(72);
      })
      it('should return boolean as number', function() {
        const env = new WebAssemblyEnvironment();
        const result1 = env.toWebAssembly('b', true);
        const result2 = env.toWebAssembly('b', false);
        expect(result1).to.equal(1);
        expect(result2).to.equal(0);
      })
    })
    describe('exportFunction', function() {
      it('should create function that convert indices to correct values', function() {
        const env = new WebAssemblyEnvironment();
        let recv, args;
        const fn = function(...a) {
          recv = this;
          args = a;
          return 'Hello world';
        };
        const fnEX = env.exportFunction(fn, 'vsib', 's');
        const object = {}, string = 'Cow', number = 1234, boolean = true;
        const indices = [ object, string, number, boolean ].map((a, i) => {
          return env.toWebAssembly('vsib'.charAt(i), a);
        });
        const result = fnEX(...indices);
        expect(result).to.be.a('number');
        expect(env.fromWebAssembly('s', result)).to.equal('Hello world');
        expect(recv).to.equal(env);
        expect(args[0]).to.equal(object);
        expect(args[1]).to.equal(string);
        expect(args[2]).to.equal(number);
        expect(args[3]).to.equal(boolean);
      })
      it('should return a empty function when the function given does not exist', function() {
        const env = new WebAssemblyEnvironment();
        const fnEX = env.exportFunction(undefined, 'vsib', 's');
        expect(fnEX).to.be.a('function');
      })
    })
    describe('importFunction', function() {
      it('should create function that convert arguments to indices', function() {
        const env = new WebAssemblyEnvironment();
        let args;
        const fn = function(...a) {
          args = a;
          return env.getObjectIndex(new String('Hello world'));
        };
        const fnIM = env.importFunction(fn, 'vsib', 's');
        const object = {}, string = 'Cow', number = 1234, boolean = true;
        const result = fnIM(object, string, number, boolean);
        expect(result).to.equal('Hello world');
        expect(args[0]).to.be.a('number');
        expect(args[1]).to.be.a('number');
        expect(args[2]).to.be.a('number');
        expect(args[3]).to.be.a('number');
        expect(env.fromWebAssembly('v', args[0])).to.equal(object);
        expect(env.fromWebAssembly('s', args[1])).to.equal(string);
        expect(env.fromWebAssembly('i', args[2])).to.equal(number);
        expect(env.fromWebAssembly('b', args[3])).to.equal(boolean);
      })
    })
    describe('exportFunctions', function() {
      it('should export functions of the class needed by Zig code', function() {
        const env = new WebAssemblyEnvironment();
        const exports = env.exportFunctions();
        expect(exports._setCallContext).to.be.a('function');
        expect(exports._allocMemory).to.be.a('function');
        expect(exports._beginStructure).to.be.a('function');
      })
    })
    describe('importFunctions', function() {
      it('should create methods in the environment object', function() {
        const env = new WebAssemblyEnvironment();
        const exports = {
          define: () => {},
          alloc: () => {},
          free: () => {},
          run: () => {},
          safe: () => {},
          garbage: () => {},
        };
        env.importFunctions(exports);
        expect(env.defineStructures).to.be.a('function');
        expect(env.allocSharedMemory).to.be.a('function');
        expect(env.freeSharedMemory).to.be.a('function');
        expect(env.runThunk).to.be.a('function');
        expect(env.isRuntimeSafetyActive).to.be.a('function');
      })
    })
    describe('releaseFunctions', function() {
      it('should replace imported functions with placeholders that throw', function() {
        const env = new WebAssemblyEnvironment();
        const exports = {
          define: () => {},
          alloc: () => {},
          free: () => {},
          run: () => {},
          safe: () => {},
          garbage: () => {},
        };
        env.importFunctions(exports);
        expect(() => env.runThunk()).to.not.throw();
        env.releaseFunctions();
        expect(() => env.runThunk()).to.throw();
      })
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
