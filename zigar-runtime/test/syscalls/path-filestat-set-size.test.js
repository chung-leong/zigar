import { expect } from 'chai';
import { PosixDescriptor, PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { copyView, usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: path-filestat-set-size', function() {
  it('should call open file and call truncate handler', async function() {
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
      env.setRedirectionMask = () => {};
    }
    let event, args;
    const stream = {
      write() {},
      truncate(...a) {
        args = a;
      },
    }
    env.addListener('open', (evt) => {
      event = evt;
      return stream;
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathFilestatSetSize(PosixDescriptor.root, pathAddress, pathLen, 123n);
    expect(result).to.equal(0);
    expect(event).to.eql({ 
      parent: null,
      path: 'hello.txt',
      flags: {
          exclusive: true,
          sync: true,
      },
      rights: {
          write: true,
      },
    });
    expect(args).to.eql([ 123 ]);
  })
  it('should return ENOTSUP when open event handler file return undefined', async function() {
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
      env.setRedirectionMask = () => {};
    }
    env.addListener('open', (evt) => {
      return undefined;
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathFilestatSetSize(PosixDescriptor.root, pathAddress, pathLen, 123n);
    expect(result).to.equal(PosixError.ENOTSUP);
  })
  it('should return ENOENT when open event handler file return false', async function() {
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
      env.setRedirectionMask = () => {};
    }
    env.addListener('open', (evt) => {
      return false;
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    const result = env.pathFilestatSetSize(PosixDescriptor.root, pathAddress, pathLen, 123n);
    expect(result).to.equal(PosixError.ENOENT);
  })
  it('should display error when open event handler file return invalid stream', async function() {
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
      env.setRedirectionMask = () => {};
    }
    env.addListener('open', (evt) => {
      return {};
    });
    const path = new TextEncoder().encode('/hello.txt');
    const pathAddress = usize(0x1000);
    const pathLen = path.length;
    env.moveExternBytes(path, pathAddress, true);
    const [ message ] = await captureError(() => {
      const result = env.pathFilestatSetSize(PosixDescriptor.root, pathAddress, pathLen, 123n);
      expect(result).to.equal(PosixError.EPERM);
    });
    expect(message).to.contain('WritableStreamDefaultWriter');
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      let event, args;
      const stream = {
        write() {},
        truncate(...a) {
          args = a;
        },
      }
      env.addListener('open', (evt) => {
        event = evt;
        return stream;
      });
      const path = new TextEncoder().encode('/hello.txt');
      const pathAddress = usize(0x1000);
      const pathLen = path.length;
      env.moveExternBytes(path, pathAddress, true);
      const f = env.getWASIHandler('path_filestat_set_size');
      const result = f(PosixDescriptor.root, pathAddress, pathLen, 123n);
      expect(result).to.equal(0);
      expect(event).to.eql({ 
        parent: null,
        path: 'hello.txt',
        flags: {
            exclusive: true,
            sync: true,
        },
        rights: {
            write: true,
        },
      });
      expect(args).to.eql([ 123 ]);
    })
  }
})
