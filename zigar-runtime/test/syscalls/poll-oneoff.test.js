import { expect } from 'chai';
import { PosixError, PosixPollEventType } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { createView, usize } from '../../src/utils.js';
import { captureError } from '../test-utils.js';

const Env = defineEnvironment();

describe('Syscall: poll-oneoff', function() {
  it('should return 0 when selected streams have data available', function() {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }
    const le = env.littleEndian;
    const subscriptionSize = 48;
    const eventSize = 32;
    const subscriptionAddress = usize(0x1000);
    const eventAddress = usize(0x2000);
    const eventCountAddress = usize(0x3000);
    const array = new Uint8Array(32);
    const streams = [ env.convertReader(array), env.convertReader(array) ];
    const fds = streams.map(stream => env.createStreamHandle(stream, env.getDefaultRights('file'), 0));
    const subs = createView(subscriptionSize * fds.length);
    for (let i = 0; i < fds.length; i++) {
      const offset = i * subscriptionSize;
      const fd = fds[i];
      subs.setUint8(offset + 8, PosixPollEventType.FD_READ);
      subs.setInt32(offset + 16, fd, le);
    }
    env.moveExternBytes(subs, subscriptionAddress, true);
    const result = env.pollOneoff(subscriptionAddress, eventAddress, 2, eventCountAddress, true);
    expect(result).to.equal(PosixError.NONE);
    const eventCountDV = env.obtainZigView(eventCountAddress, 4);
    const eventCount = eventCountDV.getUint32(0, le);
    expect(eventCount).to.equal(2);    
  })
  it('should return 0 when selected streams can be written to', function() {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }
    const le = env.littleEndian;
    const subscriptionSize = 48;
    const eventSize = 32;
    const subscriptionAddress = usize(0x1000);
    const eventAddress = usize(0x2000);
    const eventCountAddress = usize(0x3000);
    const array = new Uint8Array(32);
    const streams = [ env.convertReader(array), env.convertReader(array) ];
    const fds = streams.map(stream => env.createStreamHandle(stream, env.getDefaultRights('file'), 0));
    const subs = createView(subscriptionSize * fds.length);
    for (let i = 0; i < fds.length; i++) {
      const offset = i * subscriptionSize;
      const fd = fds[i];
      subs.setUint8(offset + 8, PosixPollEventType.FD_WRITE);
      subs.setInt32(offset + 16, fd, le);
    }
    env.moveExternBytes(subs, subscriptionAddress, true);
    const result = env.pollOneoff(subscriptionAddress, eventAddress, 2, eventCountAddress, true);
    expect(result).to.equal(PosixError.NONE);
    const eventCountDV = env.obtainZigView(eventCountAddress, 4);
    const eventCount = eventCountDV.getUint32(0, le);
    expect(eventCount).to.equal(2);    
  })
  it('should return a promise when no stream is ready to be read', async function() {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }
    const le = env.littleEndian;
    const subscriptionSize = 48;
    const eventSize = 32;
    const subscriptionAddress = usize(0x1000);
    const eventAddress = usize(0x2000);
    const eventCountAddress = usize(0x3000);
    const blob = new Blob([ new Uint8Array(32) ]);
    const streams = [ env.convertReader(blob), env.convertReader(blob) ];
    const fds = streams.map(stream => env.createStreamHandle(stream, env.getDefaultRights('file'), 0));
    const subs = createView(subscriptionSize * (fds.length + 1));
    for (let i = 0; i < fds.length + 1; i++) {
      const offset = i * subscriptionSize;
      if (i < fds.length) {
        const fd = fds[i];
        subs.setUint8(offset + 8, PosixPollEventType.FD_READ);
        subs.setInt32(offset + 16, fd, le);
      } else {
        subs.setUint8(offset + 8, PosixPollEventType.CLOCK);
        subs.setBigUint64(offset + 24, 100n, le);
      }
    }
    env.moveExternBytes(subs, subscriptionAddress, true);
    const result = env.pollOneoff(subscriptionAddress, eventAddress, 3, eventCountAddress, true);
    expect(result).to.be.a('promise');
    const eventualResult = await result;
    expect(eventualResult).to.equal(PosixError.NONE);
    const eventCountDV = env.obtainZigView(eventCountAddress, 4);
    const eventCount = eventCountDV.getUint32(0, le);
    expect(eventCount).to.equal(2);    
  })
  it('should timeout immediately when duration is 0', async function() {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }
    const le = env.littleEndian;
    const subscriptionSize = 48;
    const eventSize = 32;
    const subscriptionAddress = usize(0x1000);
    const eventAddress = usize(0x2000);
    const eventCountAddress = usize(0x3000);
    const blob = new Blob([ new Uint8Array(32) ]);
    const streams = [ env.convertReader(blob), env.convertReader(blob) ];
    const fds = streams.map(stream => env.createStreamHandle(stream, env.getDefaultRights('file'), 0));
    const subs = createView(subscriptionSize * (fds.length + 1));
    for (let i = 0; i < fds.length + 1; i++) {
      const offset = i * subscriptionSize;
      if (i < fds.length) {
        const fd = fds[i];
        subs.setUint8(offset + 8, PosixPollEventType.FD_READ);
        subs.setInt32(offset + 16, fd, le);
      } else {
        subs.setUint8(offset + 8, PosixPollEventType.CLOCK);
        subs.setBigUint64(offset + 24, 0n, le);
      }
    }
    env.moveExternBytes(subs, subscriptionAddress, true);
    const result = env.pollOneoff(subscriptionAddress, eventAddress, 3, eventCountAddress, true);    
    expect(result).to.equal(PosixError.NONE);
    const eventCountDV = env.obtainZigView(eventCountAddress, 4);
    const eventCount = eventCountDV.getUint32(0, le);
    expect(eventCount).to.equal(1);
  })
  it('should set error when a stream does not support polling', async function() {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }
    const le = env.littleEndian;
    const subscriptionSize = 48;
    const eventSize = 32;
    const subscriptionAddress = usize(0x1000);
    const eventAddress = usize(0x2000);
    const eventCountAddress = usize(0x3000);
    const streams = [ { read() {} }, { read() {} } ];
    const fds = streams.map(stream => env.createStreamHandle(stream, env.getDefaultRights('file'), 0));
    const subs = createView(subscriptionSize * fds.length);
    for (let i = 0; i < fds.length; i++) {
      const offset = i * subscriptionSize;
      const fd = fds[i];
      subs.setUint8(offset + 8, PosixPollEventType.FD_READ);
      subs.setInt32(offset + 16, fd, le);
    }
    env.moveExternBytes(subs, subscriptionAddress, true);
    let result;
    const [ error ] = await captureError(() => {
      result = env.pollOneoff(subscriptionAddress, eventAddress, 2, eventCountAddress, true);
    });
    expect(result).to.equal(PosixError.NONE);
    expect(error).to.contain('Missing stream method');
    const eventCountDV = env.obtainZigView(eventCountAddress, 4);
    const eventCount = eventCountDV.getUint32(0, le);
    expect(eventCount).to.equal(2);
    const eventDV = env.obtainZigView(eventAddress, eventSize * 2);
    const errno = eventDV.getUint16(8, le);
    expect(errno).to.equal(PosixError.EBADF);
  })
  it('should return ENOTSUP when a system file descriptor is encountered', async function() {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }
    const le = env.littleEndian;
    const subscriptionSize = 48;
    const eventSize = 32;
    const subscriptionAddress = usize(0x1000);
    const eventAddress = usize(0x2000);
    const eventCountAddress = usize(0x3000);
    const fds = [ 100, 101 ];
    const subs = createView(subscriptionSize * (fds.length + 1));
    for (let i = 0; i < fds.length + 1; i++) {
      const offset = i * subscriptionSize;
      if (i < fds.length) {
        const fd = fds[i];
        subs.setUint8(offset + 8, PosixPollEventType.FD_READ);
        subs.setInt32(offset + 16, fd, le);
      } else {
        subs.setUint8(offset + 8, PosixPollEventType.CLOCK);
        subs.setBigUint64(offset + 24, 0n, le);
      }
    }
    env.moveExternBytes(subs, subscriptionAddress, true);
    const result = env.pollOneoff(subscriptionAddress, eventAddress, 3, eventCountAddress, true);
    expect(result).to.equal(PosixError.ENOTSUP);
  })
  it('should display error when subscription type is invalid', async function() {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }
    const le = env.littleEndian;
    const subscriptionSize = 48;
    const eventSize = 32;
    const subscriptionAddress = usize(0x1000);
    const eventAddress = usize(0x2000);
    const eventCountAddress = usize(0x3000);
    const array = new Uint8Array(32);
    const streams = [ env.convertReader(array), env.convertReader(array) ];
    const fds = streams.map(stream => env.createStreamHandle(stream, env.getDefaultRights('file'), 0));
    const subs = createView(subscriptionSize * (fds.length + 1));
    for (let i = 0; i < fds.length + 1; i++) {
      const offset = i * subscriptionSize;
      if (i < fds.length) {
        const fd = fds[i];
        subs.setUint8(offset + 8, PosixPollEventType.FD_READ);
        subs.setInt32(offset + 16, fd, le);
      } else {
        subs.setUint8(offset + 8, 18);
        subs.setBigUint64(offset + 24, 0n, le);
      }
    }
    env.moveExternBytes(subs, subscriptionAddress, true);
    let result;
    const [ error ] = await captureError(() => {
      result = env.pollOneoff(subscriptionAddress, eventAddress, 3, eventCountAddress, true);
    })
    expect(result).to.equal(PosixError.EINVAL);
    expect(error).to.contain('Invalid argument');
  })
  it('should set hangup flag when no more data is available', function() {
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
        const copy = this.getCopyFunction(len);
        copy(to ? zigDV : jsDV, to ? jsDV : zigDV);
      };
      env.setSyscallTrap = () => {};
      env.setRedirectionMask = () => {};
    }
    const le = env.littleEndian;
    const subscriptionSize = 48;
    const eventSize = 32;
    const subscriptionAddress = usize(0x1000);
    const eventAddress = usize(0x2000);
    const eventCountAddress = usize(0x3000);
    const array = new Uint8Array(0);
    const streams = [ env.convertReader(array), env.convertReader(array) ];
    const fds = streams.map(stream => env.createStreamHandle(stream, env.getDefaultRights('file'), 0));
    const subs = createView(subscriptionSize * fds.length);
    for (let i = 0; i < fds.length; i++) {
      const offset = i * subscriptionSize;
      const fd = fds[i];
      subs.setUint8(offset + 8, PosixPollEventType.FD_READ);
      subs.setInt32(offset + 16, fd, le);
    }
    env.moveExternBytes(subs, subscriptionAddress, true);
    const result = env.pollOneoff(subscriptionAddress, eventAddress, 2, eventCountAddress, true);
    expect(result).to.equal(PosixError.NONE);
    const eventCountDV = env.obtainZigView(eventCountAddress, 4);
    const eventCount = eventCountDV.getUint32(0, le);
    expect(eventCount).to.equal(2);    
    const eventDV = env.obtainZigView(eventAddress, eventSize * 2);
    const flags = eventDV.getUint16(24, le);
    expect(flags).to.equal(1);
  })
})