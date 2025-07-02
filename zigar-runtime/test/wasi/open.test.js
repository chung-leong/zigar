import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { RootDescriptor } from '../test-utils.js';

const Env = defineEnvironment();

const Right = {
  read: 1n << 1n,
  write: 1n << 6n,
};

const OpenFlag = {
  create: 1 << 0,
  directory: 1 << 1,
  exclusive: 1 << 2,
  truncate: 1 << 3,
};

if (process.env.TARGET === 'wasm') {
  describe('Wasi: open', function() {
    it('should call listener', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 128 });
      let event;
      env.addListener('open', (evt) => {
        event = evt;
        return new Uint8Array(32);
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const fdAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_open');
      const result = f(RootDescriptor, 0, pathAddress, pathLen, OpenFlag.exclusive, Right.read, 0n, 0, fdAddress);
      expect(result).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      expect(fd).to.not.equal(0);
      expect(event).to.eql({
        parent: null,
        path: 'hello.txt',
        rights: { read: true },
        flags: { exclusive: true }
      });
    })
    it('should handle writable resource returned by listener', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 128 });
      let event;
      env.addListener('open', (evt) => {
        event = evt;
        return [];
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const fdAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_open');
      const result = f(RootDescriptor, 0, pathAddress, pathLen, OpenFlag.exclusive, Right.write, 0n, 0, fdAddress);
      expect(result).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      expect(fd).to.not.equal(0);
      expect(event).to.eql({
        parent: null,
        path: 'hello.txt',
        rights: { write: true },
        flags: { exclusive: true }
      });
    })
    it('should return ENOENT when listener returns false', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 128 });
      env.addListener('open', (evt) => false);
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const fdAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_open');
      const result = f(RootDescriptor, 0, pathAddress, pathLen, 0, 1n, 0n, 0, fdAddress);
      expect(result).to.equal(PosixError.ENOENT);
    })
  })
}