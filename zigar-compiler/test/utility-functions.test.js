import { expect, use } from 'chai';
import { chaiPromised } from 'chai-promised';
import { writeFileSync } from 'fs';
import os, { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';

use(chaiPromised);

import {
  acquireLock,
  delay,
  deleteDirectory,
  deleteFile,
  getDirectoryStats,
  loadFile,
  normalizePath,
  releaseLock
} from '../src/utility-functions.js';

describe('Utility functions', function() {
  describe('loadFile', function() {
    it('should load a file', async function() {
      const path = absolute('./zig-samples/basic/console.zig');
      const text = await loadFile(path, '');
      expect(text.length).to.be.above(0);
    })
    it('should default string when file is missing', async function() {
      const path = absolute('./does-not-exists.zig');
      const text = await loadFile(path, 'default');
      expect(text).to.equal('default');
    })
  })
  describe('deleteFile', function() {
    it('should not throw when file is missing', async function() {
      const promise = deleteFile('/dev/non-existing');
      expect(promise).to.eventually.be.fulfilled;
    })
    it('should throw when file cannot be removed', async function() {
      const promise = deleteFile('/dev/null');
      expect(promise).to.eventually.be.rejected;
    })
  })
  describe('deleteDirectory', function() {
    it('should not throw when directory is missing', async function() {
      const promise = deleteDirectory('/dev/non-existing');
      expect(promise).to.eventually.be.fulfilled;
    })
    it('should throw when directory cannot be removed', async function() {
      const promise = deleteDirectory(fileURLToPath(import.meta.url));
      await expect(promise).to.eventually.be.rejected;
    })
  })
  describe('getDirectoryStats', function() {
    it('should get size and mtime of directory', async function() {
      const path = absolute('./zig-samples');
      const info = await getDirectoryStats(path);
      expect(info.size).to.be.above(4000);
      expect(info.mtimeMs).to.be.above(1700000000000);
    })
  })
  describe('delay', function() {
    it('should pause execution for the specified amount of time', async function() {
      const start = new Date;
      await delay(220);
      const end = new Date;
      expect(end - start).to.be.at.least(200);
    })
  })
  describe('acquireLock', function() {
    it('should create a directory and place a lock on it', async function() {
      const path = join(tmpdir(), (Math.random() * 0x7FFFFFF).toString(16));
      let lock1 = false, lock2 = false;
      const promise1 = acquireLock(path, 60 * 1000);
      promise1.then(() => lock1 = true);
      await delay(100);
      expect(lock1).to.be.true;
      const promise2 = acquireLock(path, 60 * 1000);
      promise2.then(() => lock2 = true);
      await delay(100);
      expect(lock2).to.be.false;
      await releaseLock(path);
      await delay(500);
      expect(lock2).to.be.true;
      await releaseLock(path);
      let info;
      try {
        info = await stat(path);
      } catch (err) {
      }
      expect(info).to.be.undefined;
    })
    it('should detect that existing pid file is stale', async function() {
      const path = join(tmpdir(), (Math.random() * 0x7FFFFFF).toString(16));
      writeFileSync(path, '1234');
      const promise = acquireLock(path, 60 * 1000);
      let lock = false;
      promise.then(() => lock = true);
      await delay(250);
      expect(lock).to.be.true;
    })
    it('should fail when directory is illegal', async function() {
      const promise = acquireLock(`///`, 60 * 1000);
      await expect(promise).to.eventually.be.rejected;
    })
    it('should overwrite a lock after a while', async function() {
      const path = join(tmpdir(), (Math.random() * 0x7FFFFFF).toString(16));
      await acquireLock(path, true, 60 * 1000);
      let lock2 = false;
      const promise2 = acquireLock(path, true, 200);
      promise2.then(() => lock2 = true);
      await delay(100);
      expect(lock2).to.be.false;
      await delay(500);
      expect(lock2).to.be.true;
      await releaseLock(path);
    })
    it('should fail immediately on lock contention when wait is false', async function() {
      const path = join(tmpdir(), (Math.random() * 0x7FFFFFF).toString(16));
      await acquireLock(path, true, 60 * 1000);
      const promise2 = acquireLock(path, false, 200);
      await expect(promise2).to.eventually.be.rejected;
      await releaseLock(path);
    })
  })
  describe('normalizePath', function() {
    it('should report ASAR archive path', function() {
      const url = new URL('./app.asar/hello.zigar', import.meta.url);
      const unpacked = fileURLToPath(new URL('./app.asar.unpacked/hello.zigar', import.meta.url));
      const { path, archive } = normalizePath(url.href);
      expect(archive).to.equal('asar');
      expect(path).to.equal(unpacked);
    })
  })
})

function absolute(relpath) {
  return fileURLToPath(new URL(relpath, import.meta.url));
}
