import { expect } from 'chai';

import {
  MemberType,
  useIntEx,
} from '../src/member.js';
import {
  StructureType,
  useStruct,
} from '../src/structure.js';
import { Environment } from '../src/environment.js'

describe('Environment', function() {
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
      expect(recv).to.equal(env);
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

})