import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: stream-location', function() {
  describe('resolvePath', function() {
    it('should resolve a path relative to root', async function() {
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
      const path = 'hello/world.txt';
      const pathAddress = usize(0x1000);
      const encoder = new TextEncoder();
      const pathSrc = encoder.encode(path);
      const pathLen = pathSrc.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = pathSrc[i];
      const result = env.resolvePath(3, pathAddress, pathLen);
      expect(result).to.equal('/hello/world.txt'); 
    })
    it('should resolve an absolute path', async function() {
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
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = pathSrc[i];
      const result = env.resolvePath(3, pathAddress, pathLen);
      expect(result).to.equal('/hello/world.txt'); 
    })
    it('should resolve a path relative to another directory', async function() {
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
      env.setStreamPath(4, '/cat/dog/monkey')
      const path = '../hello/./world.txt';
      const pathAddress = usize(0x1000);
      const encoder = new TextEncoder();
      const pathSrc = encoder.encode(path);
      const pathLen = pathSrc.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = pathSrc[i];
      const result = env.resolvePath(4, pathAddress, pathLen);
      expect(result).to.equal('/cat/dog/hello/world.txt'); 
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
      }
      env.setStreamPath(4, '/cat/dog/monkey')
      const path = '../hello/./world/';
      const pathAddress = usize(0x1000);
      const encoder = new TextEncoder();
      const pathSrc = encoder.encode(path);
      const pathLen = pathSrc.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = pathSrc[i];
      const result = env.resolvePath(4, pathAddress, pathLen);
      expect(result).to.equal('/cat/dog/hello/world'); 
    })
  })
  describe('getStreamPath', function() {
    it('should get the path of a stream', async function() {
      const env = new Env();
      env.setStreamPath(4, '/hello/world');
      const path = env.getStreamPath(4);
      expect(path).to.equal('/hello/world');
    })
    it('should return undefined when a path has not been set', async function() {
      const env = new Env();
      const path = env.getStreamPath(4);
      expect(path).to.be.undefined;
    })
  })
  describe('setStreamPath', function() {
    it('should set the path of a stream', async function() {
      const env = new Env();
      env.setStreamPath(4, '/hello/world');
      const path = env.getStreamPath(4);
      expect(path).to.equal('/hello/world');
    })
    it('should remove the path of a stream', async function() {
      const env = new Env();
      env.setStreamPath(4, '/hello/world');
      const before = env.getStreamPath(4);
      expect(before).to.equal('/hello/world');
      env.setStreamPath(4);
      const after = env.getStreamPath(4);
      expect(after).to.be.undefined;
    })
  })
})
