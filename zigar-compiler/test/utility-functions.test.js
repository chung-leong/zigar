import { expect, use } from 'chai';
import { chaiPromised } from 'chai-promised';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

use(chaiPromised);

import {
  acquireLock,
  acquireLockSync,
  delay,
  delaySync,
  deleteDirectory,
  deleteDirectorySync,
  deleteFile,
  deleteFileSync,
  findDirectory,
  findDirectorySync,
  findMatchingFiles,
  findMatchingFilesSync,
  loadFile,
  loadFileSync,
  normalizePath,
  releaseLock,
  releaseLockSync,
} from '../src/utility-functions.js';

describe('Utility functions', function() {
  describe('findMatchingFiles', function() {
    it('should not throw when directory is missing', async function() {
      const path = absolute('./non-existing');
      await expect(findMatchingFiles(path, /.*/)).to.eventually.be.fulfilled;
    })
    it('should find matching files', async function() {
      const path = absolute('./');
      const map = await findMatchingFiles(path, /\.zig$/);
      expect(map.size).to.be.above(0);
      for (const [ path ] of map) {
        expect(path).to.match(/\.zig$/);
      }
    })
    it('should ignore node_modules', async function() {
      const path = absolute('../');
      const map = await findMatchingFiles(path, /\.js$/);
      expect(map.size).to.be.above(0);
      for (const [ path ] of map) {
        expect(path).to.not.contain('node_modules');
      }
    })
  })
  describe('findMatchingFilesSync', function() {
    it('should not throw when directory is missing', function() {
      const path = absolute('./non-existing');
      expect(() => findMatchingFilesSync(path, /.*/)).to.not.throw()
    })
    it('should find matching files', function() {
      const path = absolute('./');
      const map = findMatchingFilesSync(path, /\.zig$/);
      expect(map.size).to.be.above(0);
      for (const [ path ] of map) {
        expect(path).to.match(/\.zig$/);
      }
    })
    it('should ignore node_modules', function() {
      const path = absolute('../');
      const map = findMatchingFilesSync(path, /\.js$/);
      expect(map.size).to.be.above(0);
      for (const [ path ] of map) {
        expect(path).to.not.contain('node_modules');
      }
    })
  })
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
  describe('loadFileSync', function() {
    it('should load a file', function() {
      const path = absolute('./zig-samples/basic/console.zig');
      const text = loadFileSync(path, '');
      expect(text.length).to.be.above(0);
    })
    it('should default string when file is missing', function() {
      const path = absolute('./does-not-exists.zig');
      const text = loadFileSync(path, 'default');
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
  describe('deleteFileSync', function() {
    it('should not throw when file is missing', function() {
      expect(() => deleteFileSync('/dev/non-existing')).to.not.throw();
    })
    it('shoul throw when file cannot be removed', function() {
      expect(() => deleteFileSync('/dev/null')).to.throw();
    })
  })
  describe('deleteDirectory', function() {
    it('should not throw when directory is missing', async function() {
      const promise = deleteDirectory('/dev/non-existing');
      expect(promise).to.eventually.be.fulfilled;
    })
    it('should throw when directory cannot be removed', async function() {
      const promise = deleteDirectory('/dev/null');
      await expect(promise).to.eventually.be.rejected;
    })
  })
  describe('deleteDirectorySync', function() {
    it('should not throw when directory is missing', function() {
      expect(() => deleteDirectorySync('/dev/non-existing')).to.not.throw();
    })
    it('should throw when directory cannot be removed', function() {
      expect(() => deleteDirectorySync('/dev/null')).to.throw();
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
  describe('delaySync', function() {
    it('should pause execution for the specified amount of time', function() {
      const start = new Date;
      delaySync(200);
      const end = new Date;
      expect(end - start).to.be.at.least(200);
    })
  })
  describe('acquireLock', function() {
    it('should create a directory and place a lock on it', async function() {
      const dir = join(tmpdir(), (Math.random() * 0x7FFFFFF).toString(16));
      let lock1 = false, lock2 = false;
      const promise1 = acquireLock(dir, 60 * 1000);
      promise1.then(() => lock1 = true);
      await delay(100);
      expect(lock1).to.be.true;
      const promise2 = acquireLock(dir, 60 * 1000);
      promise2.then(() => lock2 = true);
      await delay(100);
      expect(lock2).to.be.false;
      await releaseLock(dir);
      await delay(250);
      expect(lock2).to.be.true;
      await releaseLock(dir);
      await deleteDirectory(dir);
      const info = await findDirectory(dir);
      expect(info).to.be.undefined;
    })
    it('should fail when directory is illegal', async function() {
      const promise = acquireLock(`/dir/null`, 60 * 1000);
      await expect(promise).to.eventually.be.rejected;
    })
    it('should overwrite a lock after a while', async function() {
      const dir = join(tmpdir(), (Math.random() * 0x7FFFFFF).toString(16));
      await acquireLock(dir, 60 * 1000);
      let lock2 = false;
      const promise2 = acquireLock(dir, 200);
      promise2.then(() => lock2 = true);
      await delay(100);
      expect(lock2).to.be.false;
      await delay(300);
      expect(lock2).to.be.true;
      await releaseLock(dir);
      await deleteDirectory(dir);
    })
  })
  describe('acquireLockSync', function() {
    it('should create a directory and place a lock on it', async function() {
      const dir = join(tmpdir(), (Math.random() * 0x7FFFFFF).toString(16));
      acquireLockSync(dir, 60 * 1000);
      const promise = acquireLock(dir, 60 * 1000);
      let lock2 = false;
      promise.then(() => lock2 = true);
      await delay(50);
      expect(lock2).to.be.false;      
      releaseLockSync(dir);
      await delay(300);
      expect(lock2).to.be.true;      
      releaseLockSync(dir);
      deleteDirectorySync(dir);
      const info = findDirectorySync(dir);
      expect(info).to.be.undefined;
    })
    it('should fail when directory is illegal', function() {
      expect(() => acquireLockSync(`/dir/null`, 60 * 1000)).to.throw();
    })
    it('should overwrite a lock after a while', function() {
      const dir = join(tmpdir(), (Math.random() * 0x7FFFFFF).toString(16));
      acquireLockSync(dir, 60 * 1000);
      acquireLockSync(dir, 200);
      releaseLockSync(dir);
      deleteDirectorySync(dir);
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
