import { expect } from 'chai';
import { PosixDescriptor, PosixDescriptorRight, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { copyView, usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-readdir', function() {
  it('should read directory entries from a Map', async function() {
    const env = new Env();
    let syscallTrap = false;
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
        const len = jsDV.byteLength;
        const zigDV = this.obtainZigView(address, len);
        if (!(jsDV instanceof DataView)) {
          jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
        }
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = function(set) {
        syscallTrap = set;
      };
    }   
    const map = new Map([
      [ 'hello.txt', {} ],
      [ 'hello-world.txt', {} ],
    ]);
    const dir = env.convertDirectory(map);
    const fd = env.createStreamHandle(dir, [ PosixDescriptorRight.fd_readdir, 0 ]);
    const bufAddress = usize(0x1000);
    const bufLen = 24 + 1 + 24 + 2 + 16;
    const usedAddress = usize(0x2000);
    const le = env.littleEndian;
    let cookie = 0n;
    for (let i = 0; i < 4; i++) {
      const result = env.fdReaddir(fd, bufAddress, bufLen, cookie, usedAddress);
      expect(result).to.equal(0);
      const usedDV = env.obtainZigView(usedAddress, 4, false);
      const used = usedDV.getUint32(0, le);
      const direntDV = env.obtainZigView(bufAddress, 24, false);
      const len = direntDV.getUint32(16, le);
      cookie = direntDV.getBigUint64(0, le);
      switch (i) {
        case 0:
          expect(used).to.equal(24 + 1 + 24 + 2);
          expect(len).to.equal(1); // .
          cookie += 1n;
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
    }
    if (process.env.TARGET === 'node') {
      expect(syscallTrap).to.be.true;
      map.close();
      expect(syscallTrap).to.be.false;
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
        const len = jsDV.byteLength;
        const zigDV = this.obtainZigView(address, len);
        if (!(jsDV instanceof DataView)) {
          jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
        }
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
    }   
    const fd = PosixDescriptor.root;
    const bufAddress = usize(0x1000);
    const bufLen = 24 + 1 + 24 + 2 + 16;
    const usedAddress = usize(0x2000);
    const le = env.littleEndian;
    let cookie = 0n;
    const result = env.fdReaddir(fd, bufAddress, bufLen, cookie, usedAddress);
    expect(result).to.equal(0);
    const usedDV = env.obtainZigView(usedAddress, 4);
    const used = usedDV.getUint32(0, le);
    const direntDV = env.obtainZigView(bufAddress, 24);
    const len = direntDV.getUint32(16, le);
    expect(used).to.equal(50);
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
        const len = jsDV.byteLength;
        const zigDV = this.obtainZigView(address, len);
        if (!(jsDV instanceof DataView)) {
          jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
        }
        copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = function(set) {};
    }   
    const map = new Map([
      [ 'hello.txt', { type: 'file', ino: 1n } ],
      [ 'hello-world.txt', { type: 'fil' } ],
    ]);
    const dir = env.convertDirectory(map);
    const fd = env.createStreamHandle(dir, [ PosixDescriptorRight.fd_readdir, 0 ]);
    const bufAddress = usize(0x1000);
    const bufLen = 24 + 1 + 24 + 2 + 16;
    const usedAddress = usize(0x2000);
    let cookie = 0n;
    for (let i = 0; i < 3; i++) {
      let result;
      const [ error ] = await captureError(() => {
        result = env.fdReaddir(fd, bufAddress, bufLen, cookie, usedAddress);
      });
      const direntDV = env.obtainZigView(bufAddress, 24);
      cookie = direntDV.getBigUint64(0, true);
      switch (i) {
        case 0:
          // . and ..
          expect(result).to.equal(0);
          cookie += 1n;
          break;
        case 1:
          // hello.txt
          expect(result).to.equal(0);
          break;
        case 2:
          expect(result).to.equal(PosixError.EINVAL);
          expect(error).to.contain('fil');
          break;
      }
    }
  })
  it('should return error code when buffer is too small', async function() {
    const env = new Env();
    const result = env.fdReaddir(3, 0x1000, 20, 0n, 0x2000);
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
      const fd = env.createStreamHandle(dir, [ PosixDescriptorRight.fd_readdir, 0 ]);
      const bufAddress = 0x1000;
      const bufLen = 24 + 1 + 24 + 2 + 16;
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
        cookie = direntDV.getBigUint64(0, true);
        switch (i) {
          case 0:
            expect(used).to.equal(24 + 1 + 24 + 2);
            expect(len).to.equal(1); // .
            cookie += 1n;
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
      }
    })
  }
  if (process.env.TARGET === 'node') {
    it('should seek back to previous position when an entry too large to fit buffer', async function() {
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
          const len = jsDV.byteLength;
          const zigDV = this.obtainZigView(address, len);
          if (!(jsDV instanceof DataView)) {
            jsDV = new DataView(jsDV.buffer, jsDV.byteOffset, jsDV.byteLength);
          }
          copyView(to ? zigDV : jsDV, to ? jsDV : zigDV);
        };
        env.setSyscallTrap = function() {};
      }   
      const map = new Map([
        [ 'very very very long file name.txt', {} ],
        [ 'hello-world.txt', {} ],
      ]);
      const dir = env.convertDirectory(map);
      let position;
      dir.seek = function(pos) {
        position = pos;
      };
      const fd = env.createStreamHandle(dir, [ PosixDescriptorRight.fd_readdir, 0 ]);
      const bufAddress = usize(0x1000);
      const bufLen = 24 + 2 + 24 + 2 + 24 + 16;
      const usedAddress = usize(0x2000);
      const le = env.littleEndian;
      let cookie = 0n;
      const result = env.fdReaddir(fd, bufAddress, bufLen, cookie, usedAddress);
      expect(result).to.equal(0);
      expect(position).to.equal(2);
    })
  }
})
