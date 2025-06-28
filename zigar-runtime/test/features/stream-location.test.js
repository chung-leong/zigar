import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins-wasi.js';
import { usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: stream-location', function() {
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
      const path = 'hello/world.txt';
      const pathAddress = usize(0x1000);
      const encoder = new TextEncoder();
      const pathSrc = encoder.encode(path);
      const pathLen = pathSrc.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
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
      }
      const dirMap = new Map();
      env.streamMap.set(4, env.convertDirectory(dirMap));
      const path = './world.txt';
      const pathAddress = usize(0x1000);
      const encoder = new TextEncoder();
      const pathSrc = encoder.encode(path);
      const pathLen = pathSrc.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = pathSrc[i];
      const result = env.obtainStreamLocation(4, pathAddress, pathLen);
      expect(result).to.eql({
        parent: dirMap, 
        path: 'world.txt', 
      });
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
      const dirMap = new Map();
      env.streamMap.set(4, env.convertDirectory(dirMap));
      const path = 'world/';
      const pathAddress = usize(0x1000);
      const encoder = new TextEncoder();
      const pathSrc = encoder.encode(path);
      const pathLen = pathSrc.length;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
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
