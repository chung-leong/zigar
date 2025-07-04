import { expect } from 'chai';
import { Descriptor, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-readdir', function() {
  it('should read directory entries from a Map', async function() {
    const env = new Env();
    if (process.env.TARGET === 'wasm') {
      env.memory = new WebAssembly.Memory({ initial: 1 });
    } else {
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
        if (to) {
          map.set(address, jsDV.buffer);
        } else {
          const len = Number(jsDV.byteLength);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const zigDV = this.obtainZigView(address, len);
          const copy = this.getCopyFunction(len);
          copy(jsDV, zigDV);
        }
      };
    }   
    const map = new Map([
      [ 'hello.txt', {} ],
      [ 'hello-world.txt', {} ],
    ]);
    const dir = env.convertDirectory(map);
    const fd = env.createStreamHandle(dir);
    const bufAddress = usize(0x1000);
    const bufLen = 24 + 1 + 24 + 2 + 10;
    const usedAddress = usize(0x2000);
    const le = env.littleEndian;
    let cookie = 0n;
    for (let i = 0; i < 4; i++) {
      const result = env.fdReaddir(fd, bufAddress, bufLen, cookie, usedAddress);
      expect(result).to.equal(0);
      const usedDV = env.obtainZigView(usedAddress, 4);
      const used = usedDV.getUint32(0, le);
      const direntDV = env.obtainZigView(bufAddress, 24);
      const len = direntDV.getUint32(16, le);
      switch (i) {
        case 0:
          expect(used).to.equal(24 + 1 + 24 + 2);
          expect(len).to.equal(1); // .
          break;
        case 1:
          expect(used).to.equal(24 + 9);
          expect(len).to.equal(9); // hello.txt
          break;
        case 2:
          expect(used).to.equal(24 + 15);
          expect(len).to.equal(15); // hello-world.txt
          break;
        case 3:
          expect(used).to.equal(0);
          break;
      }
      cookie = direntDV.getBigUint64(0, le);
    }
  })
  it('should work with default root directory', async function() {
    const env = new Env();
    if (process.env.TARGET === 'wasm') {
      env.memory = new WebAssembly.Memory({ initial: 1 });
    } else {
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
        if (to) {
          map.set(address, jsDV.buffer);
        } else {
          const len = Number(jsDV.byteLength);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const zigDV = this.obtainZigView(address, len);
          const copy = this.getCopyFunction(len);
          copy(jsDV, zigDV);
        }
      };
    }   
    const fd = Descriptor.root;
    const bufAddress = usize(0x1000);
    const bufLen = 24 + 1 + 24 + 2 + 10;
    const usedAddress = usize(0x2000);
    const le = env.littleEndian;
    let cookie = 0n;
    const result = env.fdReaddir(fd, bufAddress, bufLen, cookie, usedAddress);
    expect(result).to.equal(0);
    const usedDV = env.obtainZigView(usedAddress, 4);
    const used = usedDV.getUint32(0, le);
    const direntDV = env.obtainZigView(bufAddress, 24);
    const len = direntDV.getUint32(16, le);
    expect(used).to.equal(25);
    expect(len).to.equal(1);
    })
  it('should return EINVAL when entry type is incorrect', async function() {
    const env = new Env();
    if (process.env.TARGET === 'wasm') {
      env.memory = new WebAssembly.Memory({ initial: 1 });
    } else {
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
        if (to) {
          map.set(address, jsDV.buffer);
        } else {
          const len = Number(jsDV.byteLength);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          const zigDV = this.obtainZigView(address, len);
          const copy = this.getCopyFunction(len);
          copy(jsDV, zigDV);
        }
      };
    }   
    const map = new Map([
      [ 'hello.txt', { type: 'file', ino: 1n } ],
      [ 'hello-world.txt', { type: 'fil' } ],
    ]);
    const dir = env.convertDirectory(map);
    const fd = env.createStreamHandle(dir);
    const bufAddress = usize(0x1000);
    const bufLen = 24 + 1 + 24 + 2 + 10;
    const usedAddress = usize(0x2000);
    let cookie = 0n;
    for (let i = 0; i < 3; i++) {
      let result;
      const [ error ] = await captureError(() => {
        result = env.fdReaddir(fd, bufAddress, bufLen, cookie, usedAddress);
      });
      const direntDV = env.obtainZigView(bufAddress, 24);
      switch (i) {
        case 0:
        case 1:
          expect(result).to.equal(0);
          break;
        case 2:
          expect(result).to.equal(PosixError.EINVAL);
          expect(error).to.contain('fil');
          break;
      }
      cookie = direntDV.getBigUint64(0, true);
    }
  })
  it('should return error code when buffer is too small', async function() {
    const env = new Env();
    const f = env.getWASIHandler('fd_readdir');
    const result = f(3, 0x1000, 20, 0n, 0x2000);
    expect(result).to.equal(PosixError.EINVAL);
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const map = new Map([
        [ 'hello.txt', {} ],
        [ 'hello-world.txt', {} ],
      ]);
      const dir = env.convertDirectory(map);
      const fd = env.createStreamHandle(dir);
      const bufAddress = 0x1000;
      const bufLen = 24 + 1 + 24 + 2 + 10;
      const usedAddress = 0x2000;
      const le = env.littleEndian;
      const f = env.getWASIHandler('fd_readdir');
      let cookie = 0n;
      for (let i = 0; i < 4; i++) {
        const result = f(fd, bufAddress, bufLen, cookie, usedAddress);
        expect(result).to.equal(0);
        const usedDV = env.obtainZigView(usedAddress, 4);
        const used = usedDV.getUint32(0, le);
        const direntDV = env.obtainZigView(bufAddress, 24);
        const len = direntDV.getUint32(16, le);
        switch (i) {
          case 0:
            expect(used).to.equal(24 + 1 + 24 + 2);
            expect(len).to.equal(1); // .
            break;
          case 1:
            expect(used).to.equal(24 + 9);
            expect(len).to.equal(9); // hello.txt
            break;
          case 2:
            expect(used).to.equal(24 + 15);
            expect(len).to.equal(15); // hello-world.txt
            break;
          case 3:
            expect(used).to.equal(0);
            break;
        }
        cookie = direntDV.getBigUint64(0, true);
      }
    })
  }
})
