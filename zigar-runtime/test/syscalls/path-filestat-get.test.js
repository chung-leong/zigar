import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError, RootDescriptor } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: path-filestat-get', function() {
  it('should call listener', async function() {
    const env = new Env();
    let event;
    env.memory = new WebAssembly.Memory({ initial: 1 });
    env.addListener('stat', (evt) => {
      event = evt;
      return { size: 123n };
    });
    const encoder = new TextEncoder();
    const src = encoder.encode('/hello.txt');
    const pathAddress = 0x1000;
    const pathLen = src.length;
    const bufAddress = 0x2000;
    const pathArray = env.obtainZigArray(pathAddress, pathLen);
    for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
    const flags = 1;
    const result = env.pathFilestatGet(RootDescriptor, flags, pathAddress, pathLen, bufAddress);
    expect(result).to.equal(0);
    expect(event).to.eql({ 
      parent: null,
      path: 'hello.txt', 
      flags: { symlinkFollow: true } 
    });
  })
  it('should return ENOENT when listener returns false', async function() {
    const env = new Env();
    env.memory = new WebAssembly.Memory({ initial: 1 });
    env.addListener('stat', (evt) => false);
    const encoder = new TextEncoder();
    const src = encoder.encode('/hello.txt');
    const pathAddress = 0x1000;
    const pathLen = src.length;
    const bufAddress = 0x2000;
    const pathArray = env.obtainZigArray(pathAddress, pathLen);
    for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
    const flags = 1;
    const result = env.pathFilestatGet(RootDescriptor, flags, pathAddress, pathLen, bufAddress);
    expect(result).to.equal(PosixError.ENOENT);
  })
  it('should display error when listener returns unexpected type', async function() {
    const env = new Env();
    env.memory = new WebAssembly.Memory({ initial: 1 });
    env.addListener('stat', (evt) => undefined);
    const encoder = new TextEncoder();
    const src = encoder.encode('/hello.txt');
    const pathAddress = 0x1000;
    const pathLen = src.length;
    const bufAddress = 0x2000;
    const pathArray = env.obtainZigArray(pathAddress, pathLen);
    for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
    const flags = 1;
    let result;
    const [ error ] = await captureError(() => {
      result = env.pathFilestatGet(RootDescriptor, flags, pathAddress, pathLen, bufAddress);
    });
    expect(result).to.equal(PosixError.ENOENT);
    expect(error).to.contain('object');
  })
  if (process.env.TARGET === 'wasm') {
    it('should call listener', async function() {
      const env = new Env();
      let event;
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('stat', (evt) => {
        event = evt;
        return { size: 123n };
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const bufAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const f = env.getWASIHandler('path_filestat_get');
      const flags = 1;
      const result = f(RootDescriptor, flags, pathAddress, pathLen, bufAddress);
      expect(result).to.equal(0);
      expect(event).to.eql({ 
        parent: null,
        path: 'hello.txt', 
        flags: { symlinkFollow: true } 
      });
    })
  }
})