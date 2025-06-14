import { expect } from 'chai';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { capture, delay, usize } from '../test-utils.js';

const Env = defineEnvironment();

describe('Feature: stream-redirection', function() {
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
      env.console.flush();
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
  describe('console', function() {
    describe('flush', function() {
      const encoder = new TextEncoder();
      it('should force pending text to immediately get sent to console', async function() {
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
        const array1 = encoder.encode('Hello world');
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
          env.console.flush();
        });
        expect(lines).to.eql([ 'Hello world!' ]);
      })
    })
  })
})

