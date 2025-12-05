import { expect } from 'chai';
import { PosixDescriptorFlag } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { copyView } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-sendfile', function() {
  if (process.env.TARGET === 'node') {
    it('should transfer data from the file system to a virtual file', async function() {
      const env = new Env();
      const map = new Map();
      env.obtainExternBuffer = function(address, len) {
        let buffer = map.get(address);
        if (!buffer) {
          buffer = new ArrayBuffer(len);
          map.set(address, buffer);
        }
        return buffer;
      };
      env.moveExternBytes = function(jsDV, address, to) {
        const len = jsDV.byteLength;
        const zigDV = this.obtainZigView(address, len);
        if (!(jsDV instanceof DataView)) {
          jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
        }
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
      let readCount = 0;      
      let fdReceived, offsetRecevied;
      env.readFile = (fd, length, offset) => {
        fdReceived = fd;
        offsetRecevied = offset;
        return new Uint8Array(readCount++ === 0 ? length : 0);
      };
      const array = [];
      const { handle } =  env.createFile(array);
      const sentAddress = 0x1000n;
      const result = env.fdSendfile(handle, 36, 0n, 0n, 18, sentAddress);
      expect(result).to.equal(0);
      expect(fdReceived).to.equal(36);
      expect(offsetRecevied).to.be.undefined;
      expect(array).to.have.lengthOf(1);
      expect(array[0]).to.have.lengthOf(18);
    })
    it('should transfer data at particular offset from the file system to a virtual file', async function() {
      const env = new Env();
      const map = new Map();
      env.obtainExternBuffer = function(address, len) {
        let buffer = map.get(address);
        if (!buffer) {
          buffer = new ArrayBuffer(len);
          map.set(address, buffer);
        }
        return buffer;
      };
      env.moveExternBytes = function(jsDV, address, to) {
        const len = jsDV.byteLength;
        const zigDV = this.obtainZigView(address, len);
        if (!(jsDV instanceof DataView)) {
          jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
        }
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
      let readCount = 0;      
      let fdReceived, offsetRecevied;
      env.readFile = (fd, length, offset) => {
        fdReceived = fd;
        offsetRecevied = offset;
        return new Uint8Array(readCount++ === 0 ? length : 0);
      };
      const array = [];
      const { handle } =  env.createFile(array);
      const sentAddress = 0x1000n;
      const offsetAddress = 0x2000n;
      env.fdFdstatSetFlags(handle, PosixDescriptorFlag.nonblock);
      const result = env.fdSendfile(handle, 36, 72n, offsetAddress, 18, sentAddress);
      expect(result).to.equal(0);
      expect(fdReceived).to.equal(36);
      expect(offsetRecevied).to.equal(72n);
      expect(array).to.have.lengthOf(1);
      expect(array[0]).to.have.lengthOf(18);
      const le = env.littleEndian;
      const offsetDV = env.obtainZigView(offsetAddress, 8, false);
      expect(offsetDV.getBigUint64(0, le)).to.equal(90n);
      const sentDV = env.obtainZigView(sentAddress, 4, false);
      expect(sentDV.getUint32(0, le)).to.equal(18);
    })
    it('should transfer data from the file system to an async virtual file', async function() {
      const env = new Env();
      const map = new Map();
      env.obtainExternBuffer = function(address, len) {
        let buffer = map.get(address);
        if (!buffer) {
          buffer = new ArrayBuffer(len);
          map.set(address, buffer);
        }
        return buffer;
      };
      env.moveExternBytes = function(jsDV, address, to) {
        const len = jsDV.byteLength;
        const zigDV = this.obtainZigView(address, len);
        if (!(jsDV instanceof DataView)) {
          jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
        }
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
      let readCount = 0;      
      let fdReceived, offsetRecevied;
      env.readFile = (fd, length, offset) => {
        fdReceived = fd;
        offsetRecevied = offset;
        return new Uint8Array(readCount++ === 0 ? length : 0);
      };
      const array = [];
      const stream = new WritableStream({
        write(chunk, controller) {
          array.push(chunk);
        }
      });
      const { handle } =  env.createFile(stream);
      const sentAddress = 0x1000n;
      const promise = env.fdSendfile(handle, 36, 0n, 0n, 18, sentAddress, true);
      expect(promise).to.be.a('promise');
      const result = await promise;
      expect(result).to.equal(0);
      expect(fdReceived).to.equal(36);
      expect(offsetRecevied).to.be.undefined;
      expect(array).to.have.lengthOf(1);
      expect(array[0]).to.have.lengthOf(18);
    })
    it('should transfer data from a virtual file to the file system', async function() {
      const env = new Env();
      const map = new Map();
      env.obtainExternBuffer = function(address, len) {
        let buffer = map.get(address);
        if (!buffer) {
          buffer = new ArrayBuffer(len);
          map.set(address, buffer);
        }
        return buffer;
      };
      env.moveExternBytes = function(jsDV, address, to) {
        const len = jsDV.byteLength;
        const zigDV = this.obtainZigView(address, len);
        if (!(jsDV instanceof DataView)) {
          jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
        }
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
      let fdReceived, chunkRecevied;
      env.writeFile = (fd, chunk) => {
        fdReceived = fd;
        chunkRecevied = chunk;
      };
      const string = 'This is a test and this is only a test';
      const { handle } =  env.createFile(string);
      const sentAddress = 0x1000n;
      const result = env.fdSendfile(36, handle, 0n, 0n, 18, sentAddress);
      expect(result).to.equal(0);
      expect(fdReceived).to.equal(36);
      expect(chunkRecevied).to.have.lengthOf(18);
    })
    it('should transfer data at particular offset from a virtual file to the file system', async function() {
      const env = new Env();
      const map = new Map();
      env.obtainExternBuffer = function(address, len) {
        let buffer = map.get(address);
        if (!buffer) {
          buffer = new ArrayBuffer(len);
          map.set(address, buffer);
        }
        return buffer;
      };
      env.moveExternBytes = function(jsDV, address, to) {
        const len = jsDV.byteLength;
        const zigDV = this.obtainZigView(address, len);
        if (!(jsDV instanceof DataView)) {
          jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
        }
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
      let fdReceived, chunkRecevied;
      env.writeFile = (fd, chunk) => {
        fdReceived = fd;
        chunkRecevied = chunk;
      };
      const string = 'This is a test and this is only a test';
      const { handle } =  env.createFile(string);
      const sentAddress = 0x1000n;
      const offsetAddress = 0x2000n;
      const result = env.fdSendfile(36, handle, 2n, offsetAddress, 18, sentAddress);
      expect(result).to.equal(0);
      expect(fdReceived).to.equal(36);
      expect(chunkRecevied).to.have.lengthOf(18);
      const decoded = new TextDecoder().decode(new Uint8Array(chunkRecevied.buffer, chunkRecevied.byteOffset, chunkRecevied.byteLength));
      expect(decoded).to.have.lengthOf(18);
      expect(decoded).to.equal('is is a test and t');
      const le = env.littleEndian;
      const offsetDV = env.obtainZigView(offsetAddress, 8, false);
      expect(offsetDV.getBigUint64(0, le)).to.equal(20n);
      const sentDV = env.obtainZigView(sentAddress, 4, false);
      expect(sentDV.getUint32(0, le)).to.equal(18);
    })
    it('should transfer all data from a virtual file to the file system', async function() {
      const env = new Env();
      const map = new Map();
      env.obtainExternBuffer = function(address, len) {
        let buffer = map.get(address);
        if (!buffer) {
          buffer = new ArrayBuffer(len);
          map.set(address, buffer);
        }
        return buffer;
      };
      env.moveExternBytes = function(jsDV, address, to) {
        const len = jsDV.byteLength;
        const zigDV = this.obtainZigView(address, len);
        if (!(jsDV instanceof DataView)) {
          jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
        }
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
      let fdReceived, chunkRecevied;
      env.writeFile = (fd, chunk) => {
        fdReceived = fd;
        chunkRecevied = chunk;
      };
      const string = 'This is a test and this is only a test';
      const { handle } =  env.createFile(string);
      const sentAddress = 0x1000n;
      const result = env.fdSendfile(36, handle, 0n, 0n, 0xffff_ffff, sentAddress);
      expect(result).to.equal(0);
      expect(fdReceived).to.equal(36);
      expect(chunkRecevied).to.have.lengthOf(string.length);
    })
    it('should transfer data from an async virtual file to the file system', async function() {
      const env = new Env();
      const map = new Map();
      env.obtainExternBuffer = function(address, len) {
        let buffer = map.get(address);
        if (!buffer) {
          buffer = new ArrayBuffer(len);
          map.set(address, buffer);
        }
        return buffer;
      };
      env.moveExternBytes = function(jsDV, address, to) {
        const len = jsDV.byteLength;
        const zigDV = this.obtainZigView(address, len);
        if (!(jsDV instanceof DataView)) {
          jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
        }
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
      let fdReceived, chunkRecevied;
      env.writeFile = (fd, chunk) => {
        fdReceived = fd;
        chunkRecevied = chunk;
      };
      const string = 'This is a test and this is only a test';
      const array = new TextEncoder().encode(string);
      const blob = new Blob([ array ]);
      const { handle } =  env.createFile(blob);
      const sentAddress = 0x1000n;
      const promise = env.fdSendfile(36, handle, 0n, 0n, 18, sentAddress, true);
      expect(promise).to.be.a('promise');
      const result = await promise;
      expect(result).to.equal(0);
      expect(fdReceived).to.equal(36);
      expect(chunkRecevied).to.have.lengthOf(18);
    })
    it('should transfer large virtual file to the file system', async function() {
      const env = new Env();
      const map = new Map();
      env.obtainExternBuffer = function(address, len) {
        let buffer = map.get(address);
        if (!buffer) {
          buffer = new ArrayBuffer(len);
          map.set(address, buffer);
        }
        return buffer;
      };
      env.moveExternBytes = function(jsDV, address, to) {
        const len = jsDV.byteLength;
        const zigDV = this.obtainZigView(address, len);
        if (!(jsDV instanceof DataView)) {
          jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
        }
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
      let fdReceived, chunksRecevied = [];
      env.writeFile = (fd, chunk) => {
        fdReceived = fd;
        chunksRecevied.push(chunk);
      };
      const string = 'This is a test and this is only a test';
      const array = new TextEncoder().encode(string);
      const blob = new Blob(Array(100000).fill(array));
      const { handle } =  env.createFile(blob);
      const sentAddress = 0x1000n;
      const promise = env.fdSendfile(36, handle, 0n, 0n, blob.size, sentAddress, true);
      expect(promise).to.be.a('promise');
      const result = await promise;
      expect(result).to.equal(0);
      expect(fdReceived).to.equal(36);
      expect(chunksRecevied.length).to.be.above(1);
      const blobReceived = new Blob(chunksRecevied);
      expect(blobReceived.size).to.equal(blob.size);
    })
  }
})
