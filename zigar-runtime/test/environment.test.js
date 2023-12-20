import { expect } from 'chai';

import { MemberType, useAllMemberTypes } from '../src/member.js';
import { StructureType, useAllStructureTypes } from '../src/structure.js';
import {
  Environment,
  CallContext,
  findSortedIndex,
  isMisaligned,
  getAlignedAddress,
  add,
  subtract,
} from '../src/environment.js'
import { MEMORY, SLOTS, ENVIRONMENT, POINTER_VISITOR } from '../src/symbol.js';

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
      const dv = env.captureView(1234, 32, 3, true);
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
      const result = env.captureView(1234, 32, 3, false);
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
  })
  describe('acquireStructures', function() {    
  })
  describe('getRootModule', function() {    
  })
  describe('exportStructures', function() {    
  })
  describe('prepareObjectsForExport', function() {
    it('should combine data views that overlaps the same memory region', function() {
      const env = new Environment();
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
      const structures = env.structures = [
        {
          instance: { template: templ1 },
          static: {}
        },
        {
          instance: { template: templ2 },
          static: {}
        },
      ];
      templ1[MEMORY].address = 1002;
      templ2[MEMORY].address = 1000;
      object[MEMORY].address = 1016;
      env.prepareObjectsForExport();
      expect(templ1[MEMORY].buffer).to.equal(templ2[MEMORY].buffer);
      expect(templ1[MEMORY].byteOffset).to.equal(2);
      expect(object[MEMORY].buffer).to.equal(templ2[MEMORY].buffer);
      expect(object[MEMORY].byteOffset).to.equal(16);
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
    it('should add structure to list', function() {
      const env = new Environment();
      const s = {};
      env.finalizeStructure(s);
      expect(env.structures[0]).to.equal(s);
    })
  })
  describe('createCaller', function() {    
  })
  describe('recreateStructures', function() {    
  })
  describe('linkVariables', function() {    
  })
  describe('linkObject', function() {    
  })
  describe('unlinkVariables', function() {    
  })
  describe('unlinkObject', function() {    
  })
  describe('releaseFunctions', function() {    
  })
  describe('getControlObject', function() {    
  })
  describe('abandon', function() {
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
  describe('updatePointerAddresses', function() {    
  })
  describe('findTargetClusters', function() {    
  })
  describe('getShadowAddress', function() {    
  })
  describe('createShadow', function() {    
  })
  describe('createClusterShadow', function() {    
  })
  describe('addShadow', function() {    
  })
  describe('removeShadow', function() {    
  })
  describe('updateShadow', function() {    
  })
  describe('releaseShadow', function() {    
  })
  describe('acquirePointerTargets', function() {    
  })
  describe('acquireDefaultPointers', function() {    
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

