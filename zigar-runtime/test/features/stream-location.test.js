import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { usize } from '../../src/utils.js';

const Env = defineEnvironment();

describe('Syscalls: stream-location', function() {
  describe('obtainStreamLocation', function() {
    it('should resolve relative to root', async function() {
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
      }
      const path = '/hello/world.txt';
      const pathAddress = usize(0x1000);
      const encoder = new TextEncoder();
      const pathSrc = encoder.encode(path);
      const pathLen = pathSrc.length;
      const pathDV = env.obtainZigView(pathAddress, pathLen, false);
      const pathArray = new Uint8Array(pathDV.buffer, pathDV.byteOffset, pathDV.byteLength);
      for (let i = 0; i < pathLen; i++) pathArray[i] = pathSrc[i];
      const result = env.obtainStreamLocation(3, pathAddress, pathLen);
      expect(result).to.eql({
        parent: null,
        path: 'hello/world.txt' 
      }); 
    })
    it('should resolve a path relative to a directory', async function() {
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
        env.setSyscallTrap = () => {};
        env.setRedirectionMask = () => {};
      }
      const dirMap = new Map();
      const dir = env.convertDirectory(dirMap);
      const dirFd = env.createStreamHandle(dir, env.getDefaultRights('dir'));
      const path = './hello/../world.txt';
      const pathAddress = usize(0x1000);
      const encoder = new TextEncoder();
      const pathSrc = encoder.encode(path);
      const pathLen = pathSrc.length;
      const pathDV = env.obtainZigView(pathAddress, pathLen, false);
      const pathArray = new Uint8Array(pathDV.buffer, pathDV.byteOffset, pathDV.byteLength);
      for (let i = 0; i < pathLen; i++) pathArray[i] = pathSrc[i];
      const result = env.obtainStreamLocation(dirFd, pathAddress, pathLen);
      expect(result).to.eql({
        parent: dirMap, 
        path: 'world.txt', 
      });
    })
    it('should resolve . to directory itself', async function() {
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
        env.setSyscallTrap = () => {};
        env.setRedirectionMask = () => {};
      }
      const dirMap = new Map();
      const dir = env.convertDirectory(dirMap);
      const dirFd = env.createStreamHandle(dir, env.getDefaultRights('dir'));
      const path = '.';
      const pathAddress = usize(0x1000);
      const encoder = new TextEncoder();
      const pathSrc = encoder.encode(path);
      const pathLen = pathSrc.length;
      const pathDV = env.obtainZigView(pathAddress, pathLen, false);
      const pathArray = new Uint8Array(pathDV.buffer, pathDV.byteOffset, pathDV.byteLength);
      for (let i = 0; i < pathLen; i++) pathArray[i] = pathSrc[i];
      const result = env.obtainStreamLocation(dirFd, pathAddress, pathLen);
      expect(result).to.eql({
        parent: dirMap, 
        path: '', 
      });
    })
    it('should throw when path is ..', async function() {
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
        env.setSyscallTrap = () => {};
        env.setRedirectionMask = () => {};
      }
      const dirMap = new Map();
      const dir = env.convertDirectory(dirMap);
      const dirFd = env.createStreamHandle(dir, env.getDefaultRights('dir'));
      const path = '..';
      const pathAddress = usize(0x1000);
      const encoder = new TextEncoder();
      const pathSrc = encoder.encode(path);
      const pathLen = pathSrc.length;
      const pathDV = env.obtainZigView(pathAddress, pathLen, false);
      const pathArray = new Uint8Array(pathDV.buffer, pathDV.byteOffset, pathDV.byteLength);
      for (let i = 0; i < pathLen; i++) pathArray[i] = pathSrc[i];
      expect(() => {
        env.obtainStreamLocation(dirFd, pathAddress, pathLen);
      }).to.throw(Error).with.property('code').that.equal(PosixError.ENOENT);
    })
    it('should remove trailing slash', async function() {
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
        env.setSyscallTrap = () => {};
        env.setRedirectionMask = () => {};
      }
      const dirMap = new Map();
      const dir = env.convertDirectory(dirMap);
      env.streamMap.set(4, [ dir, 0, 0 ]);
      const path = 'world/';
      const pathAddress = usize(0x1000);
      const encoder = new TextEncoder();
      const pathSrc = encoder.encode(path);
      const pathLen = pathSrc.length;
      const pathDV = env.obtainZigView(pathAddress, pathLen, false);
      const pathArray = new Uint8Array(pathDV.buffer, pathDV.byteOffset, pathDV.byteLength);
      for (let i = 0; i < pathLen; i++) pathArray[i] = pathSrc[i];
      const result = env.obtainStreamLocation(4, pathAddress, pathLen);
      expect(result).to.eql({
        parent: dirMap, 
        path: 'world', 
      });
    })
  })
  describe('getStreamLocation', function() {
    it('should get the path of a stream', async function() {
      const env = new Env();
      const loc = { parent: null, path: 'hello/world' };
      env.setStreamLocation(4, loc);
      const path = env.getStreamLocation(4);
      expect(path).to.equal(loc);
    })
    it('should return undefined when a path has not been set', async function() {
      const env = new Env();
      const path = env.getStreamLocation(4);
      expect(path).to.be.undefined;
    })
  })
  describe('setStreamLocation', function() {
    it('should set the path of a stream', async function() {
      const env = new Env();
      const loc = { parent: null, path: 'hello/world' };
      env.setStreamLocation(4, loc);
      const path = env.getStreamLocation(4);
      expect(path).to.equal(loc);
    })
    it('should remove the path of a stream', async function() {
      const env = new Env();
      const loc = { parent: null, path: 'hello/world' };
      env.setStreamLocation(4, loc);
      const before = env.getStreamLocation(4);
      expect(before).to.equal(loc);
      env.setStreamLocation(4);
      const after = env.getStreamLocation(4);
      expect(after).to.be.undefined;
    })
  })
})
