import { expect } from 'chai';
import { PosixError } from '../../src/constants.js';
import { defineEnvironment } from '../../src/environment.js';
import '../../src/mixins.js';
import { captureError, RootDescriptor } from '../test-utils.js';

const Env = defineEnvironment();

const Right = {
    fd_datasync: 1 << 0,
    fd_read: 1 << 1,
    fd_seek: 1 << 2,
    fd_fdstat_set_flags: 1 << 3,
    fd_sync: 1 << 4,
    fd_tell: 1 << 5,
    fd_write: 1 << 6,
    fd_advise: 1 << 7,
    fd_allocate: 1 << 8,
    path_create_directory: 1 << 9,
    path_create_file: 1 << 10,
    path_link_source: 1 << 11,
    path_link_target: 1 << 12,
    path_open: 1 << 13,
    fd_readdir: 1 << 14,
    path_readlink: 1 << 15,
    path_rename_source: 1 << 16,
    path_rename_target: 1 << 17,
    path_filestat_get: 1 << 18,
    path_filestat_set_size: 1 << 19,
    path_filestat_set_times: 1 << 20,
    fd_filestat_get: 1 << 21,
    fd_filestat_set_size: 1 << 22,
    fd_filestat_set_times: 1 << 23,
    path_symlink: 1 << 24,
    path_remove_directory: 1 << 25,
    path_unlink_file: 1 << 26,
    poll_fd_readwrite: 1 << 27,
    sock_shutdown: 1 << 28,
    sock_accept: 1 << 29,
};

if (process.env.TARGET === 'wasm') {
  describe('Wasi: fdstat', function() {
    it('should provide information about stdout', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      const f = env.getWASIHandler('fd_fdstat_get');
      const bufAddress = 0x1000;
      const result = f(1, bufAddress);
      expect(result).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const rights = dv.getBigUint64(bufAddress + 8, true);
      expect(rights & BigInt(Right.fd_write)).to.not.equal(0n);
    })
    it('should obtain information from a file descriptor', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('open', () => {
        return new Uint8Array(32);
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const fdAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const open = env.getWASIHandler('path_open');
      const result1 = open(RootDescriptor, 0, pathAddress, pathLen, 0, BigInt(Right.fd_read), 0n, 0, fdAddress);
      expect(result1).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      const bufAddress = 0x3000;
      const f = env.getWASIHandler('fd_fdstat_get');
      const result2 = f(fd, bufAddress);
      expect(result2).to.equal(0);
      const rights = dv.getBigUint64(bufAddress + 8, true);
      expect(rights & BigInt(Right.fd_read)).to.not.equal(0n);
    })
    it('should obtain information from a directory descriptor', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('open', () => {
        return new Map();
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const fdAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const open = env.getWASIHandler('path_open');
      const result1 = open(RootDescriptor, 0, pathAddress, pathLen, 0, BigInt(Right.fd_readdir), 0n, 0, fdAddress);
      expect(result1).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      const bufAddress = 0x3000;
      const f = env.getWASIHandler('fd_fdstat_get');
      const result2 = f(fd, bufAddress);
      expect(result2).to.equal(0);
      const rights = dv.getBigUint64(bufAddress + 8, true);
      expect(rights & BigInt(Right.fd_readdir)).to.not.equal(0n);
    })
    it('should use stream type', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('open', () => {
        return {
          type: 'directory',
          readdir() {}
        };
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const fdAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const open = env.getWASIHandler('path_open');
      const result1 = open(RootDescriptor, 0, pathAddress, pathLen, 0, BigInt(Right.fd_readdir), 0n, 0, fdAddress);
      expect(result1).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      const bufAddress = 0x3000;
      const f = env.getWASIHandler('fd_fdstat_get');
      const result2 = f(fd, bufAddress);
      expect(result2).to.equal(0);
      const rights = dv.getBigUint64(bufAddress + 8, true);
      expect(rights & BigInt(Right.fd_readdir)).to.not.equal(0n);
    })
    it('should return EINVAL if stream type is incorrect', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('open', () => {
        return {
          type: 'dir',
          readdir() {}
        };
      });
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const fdAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const open = env.getWASIHandler('path_open');
      const result1 = open(RootDescriptor, 0, pathAddress, pathLen, 0, BigInt(Right.fd_readdir), 0n, 0, fdAddress);
      expect(result1).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      const bufAddress = 0x3000;
      const f = env.getWASIHandler('fd_fdstat_get');
      let result2;
      const [ error ] = await captureError(() => {
        result2 = f(fd, bufAddress);
      })
      expect(result2).to.equal(PosixError.EINVAL);
      expect(error).to.contain('dir');
    })
    it('should include right to set times when there is a handler for the operation', async function() {
      const env = new Env();
      env.memory = new WebAssembly.Memory({ initial: 1 });
      env.addListener('open', () => {
        return new Uint8Array(32);
      });
      env.addListener('set_times', () => {});
      const encoder = new TextEncoder();
      const src = encoder.encode('/hello.txt');
      const pathAddress = 0x1000;
      const pathLen = src.length;
      const fdAddress = 0x2000;
      const pathArray = env.obtainZigArray(pathAddress, pathLen);
      for (let i = 0; i < pathLen; i++) pathArray[i] = src[i];
      const open = env.getWASIHandler('path_open');
      const result1 = open(RootDescriptor, 0, pathAddress, pathLen, 0, BigInt(Right.fd_read), 0n, 0, fdAddress);
      expect(result1).to.equal(0);
      const dv = new DataView(env.memory.buffer);
      const fd = dv.getUint32(fdAddress, true);
      const bufAddress = 0x3000;
      const f = env.getWASIHandler('fd_fdstat_get');
      const result2 = f(fd, bufAddress);
      expect(result2).to.equal(0);
      const rights = dv.getBigUint64(bufAddress + 8, true);
      expect(rights & BigInt(Right.fd_filestat_set_times)).to.not.equal(0n);
    })
  })
}