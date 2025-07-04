import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-read', function() {
  it('should read from a Uint8Array', async function() {
    const env = new Env();
    const encoder = new TextEncoder();
    const array = encoder.encode('Hello world');
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
    const bufferAddress = 16;
    const stringAddress = 64;
    const readAddress = 128;
    const dv = new DataView(memory.buffer);
    dv.setUint32(bufferAddress, stringAddress, true);
    dv.setUint32(bufferAddress + 4, 4, true);
    dv.setUint32(bufferAddress + 8, stringAddress + 4, true);
    dv.setUint32(bufferAddress + 12, array.length - 4, true);
    env.redirectStream(0, array);
    const result = env.fdRead(0, bufferAddress, 2, readAddress)
    expect(result).to.equal(PosixError.NONE);
    const string = new Uint8Array(memory.buffer, stringAddress, array.length);
    expect(string).to.eql(array);
  })
  it('should fail when reading from an async source from the main thread', async function() {
    const env = new Env();
    const stream = new ReadableStream({
      async pull(controller) {
        controller.close();
      }
    });
    const reader = stream.getReader();
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
    const bufferAddress = 16;
    const stringAddress = 64;
    const readAddress = 128;
    const dv = new DataView(memory.buffer);
    dv.setUint32(bufferAddress, stringAddress, true);
    dv.setUint32(bufferAddress + 4, 16, true);
    env.redirectStream(0, reader);
    let result;
    const [ error ] = await captureError(() => {
      result = env.fdRead(0, bufferAddress, 1, readAddress);
    });
    const code = (process.env.TARGET === 'wasm') ? PosixError.ENOTSUP : PosixError.EDEADLK;
    expect(result).to.equal(code);
    expect(error).to.contains('promise');
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      const encoder = new TextEncoder();
      const array = encoder.encode('Hello world');
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_read');
      const bufferAddress = 16;
      const stringAddress = 64;
      const readAddress = 128;
      const dv = new DataView(memory.buffer);
      dv.setUint32(bufferAddress, stringAddress, true);
      dv.setUint32(bufferAddress + 4, 4, true);
      dv.setUint32(bufferAddress + 8, stringAddress + 4, true);
      dv.setUint32(bufferAddress + 12, array.length - 4, true);
      env.redirectStream(0, array);
      const result = f(0, bufferAddress, 2, readAddress)
      expect(result).to.equal(PosixError.NONE);
      const string = new Uint8Array(memory.buffer, stringAddress, array.length);
      expect(string).to.eql(array);
    })
  }
  if (process.env.TARGET === 'node') {
    describe('readBytes', function() {
      it('should read data from Uint8Array', async function() {
        const env = new Env();
        if (process.env.TARGET === 'wasm') {
          env.memory = new WebAssembly.Memory({ initial: 1 });
        } else {
          const map = new Map();
          env.obtainExternBuffer = (address, len) => {
            let buffer = map.get(address);
            if (!buffer) {
              buffer = new ArrayBuffer(len);
              map.set(address, buffer);
            }
            return buffer;
          };
        }
        const array = new Uint8Array([ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
        env.redirectStream(0, array);
        const address = usize(0x1000);
        const dv = env.obtainZigView(address, 4, false);
        const count1 = env.readBytes(0, address, dv.byteLength);
        expect(count1).to.equal(4);
        expect(dv.getUint8(0)).to.equal(0);
        expect(dv.getUint8(3)).to.equal(3);
        const count2 = env.readBytes(0, address, dv.byteLength);
        expect(count2).to.equal(4);
        expect(dv.getUint8(0)).to.equal(4);
        expect(dv.getUint8(3)).to.equal(7);
        const count3 = env.readBytes(0, address, dv.byteLength);
        expect(count3).to.equal(2);
        expect(dv.getUint8(0)).to.equal(8);
      })
    })
  }
})
