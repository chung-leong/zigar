import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
} from '../src/member.js';
import {
  StructureType,
  useStruct,
} from '../src/structure.js';
import { Environment, getGlobalSlots } from '../src/environment.js'
import { MEMORY, SLOTS, ENVIRONMENT } from '../src/symbol.js';

class Environment extends Environment {
}

describe('Environment', function() {
  beforeEach(function() {
    useStruct();
    useIntEx();
  })
  const env = new Environment;
  describe('allocMemory', function() {
    it ('should return a data view of a newly created array buffer', function() {
      Environment.prototype.getAddress = () => 0x10000;
      const dv = env.allocMemory(32, 3);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(32);
      expect(dv.byteOffset).to.equal(0);
    })
    it ('should allocate a larger buffer to prevent misalignment', function() {
      Environment.prototype.getAddress = () => 0x10010;
      const dv = env.allocMemory(8 * 4, 5);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.byteLength).to.equal(32);
      expect(dv.byteOffset).to.equal(16);
      expect(dv.buffer.byteLength).to.equal(64);
    })
  })
  describe('freeMemory', function() {
  })
  describe('createView', function() {
    it('should allocate new buffer and copy data using copyBytes', function() {
      Environment.prototype.getAddress = () => 0x10000;
      Environment.prototype.copyBytes = (dv, address, len) => {
        dv.setInt32(0, address, true);
        dv.setInt32(4, len, true);
      };
      const dv = env.createView(1234, 32, 3, true);
      expect(dv).to.be.instanceOf(DataView);
      expect(dv.getInt32(0, true)).to.equal(1234);
      expect(dv.getInt32(4, true)).to.equal(32);
    })
    it('should get view of memory using obtainView', function() {
      Environment.prototype.getAddress = () => 0x10000;
      Environment.prototype.copyBytes = null;
      Environment.prototype.obtainView = (address, len) => {
        return { address, len };
      };
      const result = env.createView(1234, 32, 3, false);
      expect(result).to.eql({ address: 1234, len: 32 });
    })
  })
  describe('castView', function() {
    it('should call constructor without the use of the new operator', function() {
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
      const slots = getGlobalSlots();
      const object = {}
      slots[1] = object;
      const result1 = env.readSlot(null, 1);
      const result2 = env.readSlot(null, 2);
      expect(result1).to.equal(object);
      expect(result2).to.be.undefined;
    })
    it('should read from slots of target object', function() {
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
      const target = {};
      expect(() => env.readSlot(target, 1)).to.not.throw();
    })
  });
  describe('writeSlot', function() {
    it('should write into global slots where target is null', function() {
      const slots = getGlobalSlots();
      const object = {}
      env.writeSlot(null, 1, object);
      expect(slots[1]).to.equal(object);
    })
    it('should read from slots of target object', function() {
      const object = {}
      const target = {
        [SLOTS]: {}
      };
      env.writeSlot(target, 1, object);
      expect(target[SLOTS][1]).to.equal(object);
    })
    it('should not throw where object does not have slots', function() {
      const object = {}
      const target = {};
      expect(() => env.writeSlot(target, 1, object)).to.not.throw();
    })
  })
  describe('createTemplate', function() {
    it('should return a template object', function() {
      const dv = new DataView(new ArrayBuffer(8));
      const templ = env.createTemplate(dv);
      expect(templ[MEMORY]).to.equal(dv);
      expect(templ[SLOTS]).to.be.an('object');
    })
  })
  describe('beginStructure', function() {
    it('should return a structure object', function() {
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
      const dv = new DataView(new ArrayBuffer(8));
      const templ = env.createTemplate(dv);
      expect(templ[MEMORY]).to.equal(dv);
    })
  })
  describe('attachTemplate', function() {
    it('should attach instance template', function() {
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
      const lines = await capture(() => {
        const array = encoder.encode('Hello world\n');
        env.writeToConsole(array);
      });
      expect(lines).to.eql([ 'Hello world' ]);
    })
    it('should allow addition text to be append to current line', async function() {
      const lines = await capture(async () => {
        const array1 = encoder.encode('Hello world');
        env.writeToConsole(array1);
        await delay(10);
        const array2 = encoder.encode('!\n');
        env.writeToConsole(array2);
      });
      expect(lines).to.eql([ 'Hello world!' ]);
    })
    it('should eventually output text not ending with newline', async function() {
      const lines = await capture(async () => {
        const array1 = encoder.encode('Hello world');
        env.writeToConsole(array1);
        await delay(10);
        const array2 = encoder.encode('!');
        env.writeToConsole(array2);
        await delay(300);
      });
      expect(lines).to.eql([ 'Hello world!' ]);
    })
  })
  describe('flushConsole', function() {
    const encoder = new TextEncoder();
    it('should force pending text to immediately get sent to console', async function() {
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

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function capture(cb) {
  const logFn = console.log;
  const lines = [];
  try {
    console.log =  (text) => {
      for (const line of text.split(/\r?\n/)) {
        lines.push(line)
      }
    };
    await cb();
  } finally {
    console.log = logFn;
  }
  return lines;
}
