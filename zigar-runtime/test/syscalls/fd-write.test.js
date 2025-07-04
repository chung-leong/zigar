import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { capture, captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: fd-write', function() {
  it('should write to console', async function() {
    const env = new Env();
    const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
    const bufferAddress = 16;
    const stringAddress = 64;
    const writtenAddress = 128;
    const dv = new DataView(memory.buffer);
    const text = 'ABC\n';
    for (let i = 0; i < text.length; i++) {
      dv.setUint8(stringAddress + i, text.charCodeAt(i));
    }
    dv.setUint32(bufferAddress, stringAddress, true);
    dv.setUint32(bufferAddress + 4, text.length, true);
    dv.setUint32(bufferAddress + 8, stringAddress, true);
    dv.setUint32(bufferAddress + 12, text.length, true);
    let result;
    const [ line1, line2 ] = await capture(() => {
      result = env.fdWrite(1, bufferAddress, 2, writtenAddress);
    });
    expect(result).to.equal(PosixError.NONE);
    expect(line1).to.equal(text.trim());
    expect(line2).to.equal(text.trim());
    const written = dv.getUint32(writtenAddress, true);
    expect(written).to.equal(8);
  })
  it('should write to console when call to fd_write is directed at stderr', async function() {
    const env = new Env();
    const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
    const bufferAddress = 16;
    const stringAddress = 64;
    const writtenAddress = 128;
    const dv = new DataView(memory.buffer);
    const text = 'ABC\n';
    for (let i = 0; i < text.length; i++) {
      dv.setUint8(stringAddress + i, text.charCodeAt(i));
    }
    dv.setUint32(bufferAddress, stringAddress, true);
    dv.setUint32(bufferAddress + 4, text.length, true);
    let result;
    const [ line ] = await capture(() => {
      result = env.fdWrite(2, bufferAddress, 1, writtenAddress);
    });
    expect(result).to.equal(PosixError.NONE);
    expect(line).to.equal(text.trim());
    const written = dv.getUint32(writtenAddress, true);
    expect(written).to.equal(4);
  })
  it('should return error code when file descriptor is not stdout or stderr', async function() {
    const env = new Env();
    const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
    const f = env.getWASIHandler('fd_write');
    const bufferAddress = 16;
    const stringAddress = 64;
    const writtenAddress = 128;
    const dv = new DataView(memory.buffer);
    const text = 'ABC\n';
    for (let i = 0; i < text.length; i++) {
      dv.setUint8(stringAddress + i, text.charCodeAt(i));
    }
    dv.setUint32(bufferAddress, stringAddress, true);
    dv.setUint32(bufferAddress + 4, text.length, true);
    let result;
    const [ line ] = await capture(async () => {
      const [ error ] = await captureError(async () => {
        result = f(5, bufferAddress, 1, writtenAddress);
      })
    });
    expect(result).to.equal(PosixError.EBADF);
    expect(line).to.be.undefined;
  })
  if (process.env.TARGET === 'wasm') {
    it('should be callable through WASI', async function() {
      const env = new Env();
      const memory = env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_write');
      const bufferAddress = 16;
      const stringAddress = 64;
      const writtenAddress = 128;
      const dv = new DataView(memory.buffer);
      const text = 'ABC\n';
      for (let i = 0; i < text.length; i++) {
        dv.setUint8(stringAddress + i, text.charCodeAt(i));
      }
      dv.setUint32(bufferAddress, stringAddress, true);
      dv.setUint32(bufferAddress + 4, text.length, true);
      dv.setUint32(bufferAddress + 8, stringAddress, true);
      dv.setUint32(bufferAddress + 12, text.length, true);
      let result;
      const [ line1, line2 ] = await capture(() => {
        result = f(1, bufferAddress, 2, writtenAddress);
      });
      expect(result).to.equal(PosixError.NONE);
      expect(line1).to.equal(text.trim());
      expect(line2).to.equal(text.trim());
      const written = dv.getUint32(writtenAddress, true);
      expect(written).to.equal(8);
    })
  }
  if (process.env.TARGET === 'node') {
    describe('writeBytes', function() {
      const encoder = new TextEncoder();
      it('should output text to console', async function() {
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
        const address = usize(0x1000);
        const array = encoder.encode('Hello world\n');
        const dv = env.obtainZigView(address, array.length, false);
        for (let i = 0; i < array.length; i++) dv.setUint8(i, array[i]);
        const lines = await capture(() => env.writeBytes(1, address, dv.byteLength));
        expect(lines).to.eql([ 'Hello world' ]);
      })
      it('should allow addition text to be append to current line', async function() {
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
        const address1 = usize(0x1000);
        const array1 = encoder.encode('Hello world!');
        const dv1 = env.obtainZigView(address1, array1.length, false);
        for (let i = 0; i < array1.length; i++) dv1.setUint8(i, array1[i]);
        const address2 = usize(0x2000);
        const array2 = encoder.encode('\n');
        const dv2 = env.obtainZigView(address2, array2.length, false);
        for (let i = 0; i < array2.length; i++) dv2.setUint8(i, array2[i]);
        const lines = await capture(async () => {
          env.writeBytes(2, address1, dv1.byteLength);
          await delay(10);
          env.writeBytes(2, address2, dv2.byteLength);
        });
        expect(lines).to.eql([ 'Hello world!' ]);
        env.flushStreams();
      })
      it('should eventually output text not ending with newline', async function() {
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
        const address1 = usize(0x1000);
        const array1 = encoder.encode('Hi!\nHello world');
        const dv1 = env.obtainZigView(address1, array1.length, false);
        for (let i = 0; i < array1.length; i++) dv1.setUint8(i, array1[i]);
        const address2 = usize(0x2000);
        const array2 = encoder.encode('!');
        const dv2 = env.obtainZigView(address2, array2.length, false);
        for (let i = 0; i < array2.length; i++) dv2.setUint8(i, array2[i]);
        const lines = await capture(async () => {
          env.writeBytes(1, address1, dv1.byteLength);
          await delay(10);
          env.writeBytes(1, address2, dv2.byteLength);
          await delay(300);
        });
        expect(lines).to.eql([ 'Hi!', 'Hello world!' ]);
      })
    })
  }
})
