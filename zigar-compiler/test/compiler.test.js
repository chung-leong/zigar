import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { stat, utimes } from 'fs/promises';
import { join } from 'path';
import os, { tmpdir } from 'os';

use(ChaiAsPromised);

import {
  compile,
  getBuildFolder,
  getLibraryName,
  scanDirectory,
  acquireLock,
  releaseLock,
  deleteDirectory,
  findDirectory,
  findFile,
  loadFile,
  deleteFile,
  runCompiler,
  touchFile,
} from '../src/compiler.js';

describe('Compilation', function() {
  describe('getLibraryName', function() {
    it('should return the correct name for Linux', function() {
      const name = getLibraryName('hello', 'linux', 'ia32');
      expect(name).to.equal('libhello.so');
    })
    it('should return the correct name for Darwin', function() {
      const name = getLibraryName('hello', 'darwin', 'x64');
      expect(name).to.equal('libhello.dylib');
    })
    it('should return the correct name for Windows', function() {
      const name = getLibraryName('hello', 'windows', 'x64');
      expect(name).to.equal('libhello.dll');
    })
    it('should return the correct name for WASM', function() {
      const name = getLibraryName('hello', 'freestanding', 'wasm32');
      expect(name).to.equal('hello.wasm');
    })
  })
  describe('scanDirectory', function() {
    it('should not throw when directory is missing', async function() {
      const { pathname } = new URL('./non-existing', import.meta.url);
      await expect(scanDirectory(pathname, /.*/, () => {})).to.eventually.be.fulfilled;
    })
    it('should find matching files', async function() {
      const { pathname } = new URL('./', import.meta.url);
      const list = [];
      await scanDirectory(pathname, /\.zig$/, async (dir, name, info) => {
        list.push(name);
      });
      expect(list.length).to.be.above(0);
      for (const name of list) {
        expect(name).to.match(/\.zig$/);
      }
    })
    it('should ignore node_modules', async function() {
      const { pathname } = new URL('../', import.meta.url);
      const list = [];
      await scanDirectory(pathname, /\.js$/, async (dir, name, info) => {
        list.push(dir);
      });
      expect(list.length).to.be.above(0);
      for (const dir of list) {
        expect(dir).to.not.contain('node_modules');
      }
    })
  })
  describe('loadFile', function() {
    it('should load a file', async function() {
      const { pathname } = new URL('./zig-samples/basic/console.zig', import.meta.url);
      const text = await loadFile(pathname, '');
      expect(text.length).to.be.above(0);
    })
    it('should default string when file is missing', async function() {
      const { pathname } = new URL('./does-not-exists.zig', import.meta.url);
      const text = await loadFile(pathname, 'default');
      expect(text).to.equal('default');
    })
  })
  describe('deleteFile', function() {
    it('should not throw when file is missing', async function() {
      const promise = deleteFile('/dev/null/non-existing');
      expect(promise).to.eventually.be.fulfilled;
    })
    it('should throw when file cannot be removed', async function() {
      const promise = deleteFile('/dev/null');
      expect(promise).to.eventually.be.rejected;
    })
  })
  describe('deleteDirectory', function() {
    it('should not throw when directory is missing', async function() {
      const promise = deleteDirectory('/dev/null/non-existing');
      expect(promise).to.eventually.be.fulfilled;
    })
    it('should throw when directory cannot be removed', async function() {
      const promise = deleteDirectory('/dev/null');
      expect(promise).to.eventually.be.rejected;
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
      await delay(100);
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
  describe('runCompiler', function() {
    it('should run the Zig compiler', async function() {
      const zigCmd = `zig help`;
      const promise = runCompiler(zigCmd, tmpdir());
      await expect(promise).to.eventually.be.fulfilled;
    })
    it('should throw when the Zig compiler returns an error', async function() {
      const zigCmd = `zig`;
      const promise = runCompiler(zigCmd, tmpdir());
      await expect(promise).to.eventually.be.rejected;
    })
  })
  describe('compile', function() {
    it('should compile zig source code for C++ extension', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/basic/integers.zig', import.meta.url);
      const libpath = await compile(pathname);
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('libintegers');
    })
    it('should compile code for WASM32', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/basic/integers.zig', import.meta.url);
      await forceChange(pathname, async () => {
        const libpath = await compile(pathname, { arch: 'wasm32', platform: 'freestanding' });
        expect(libpath).to.be.a('string');
        expect(libpath).to.contain('integers.wasm');
      });
    })
    it('should compile optimized code', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/basic/integers.zig', import.meta.url);
      const libpath1 = await compile(pathname, { arch: 'wasm32', platform: 'freestanding' });
      const { size: before } = await stat(libpath1);
      const libpath2 = await compile(pathname, { arch: 'wasm32', platform: 'freestanding', optimize: 'ReleaseSmall' });
      const { size: after } = await stat(libpath2);
      expect(after).to.be.below(before);
    })
    it('should compile with C library enabled when Zig code imports C code', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/strlen-from-c/strlen.zig', import.meta.url);
      await forceChange(pathname, async () => {
        const libpath = await compile(pathname);
        expect(libpath).to.be.a('string');
        expect(libpath).to.contain('libstrlen');
      });
    })
    it('should work correctly when the same file is compiled at the same time', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/basic/integers.zig', import.meta.url);
      await forceChange(pathname, async () => {
        const promise1 = compile(pathname);
        const promise2 = compile(pathname);
        const libpath2 = await promise2;
        const libpath1 = await promise1;
        expect(libpath2).to.equal(libpath1);
      });
    })
    it('should throw when source file is missing', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/basic/non-existing.zig', import.meta.url);
      await expect(compile(pathname)).to.eventually.be.rejected;
    })
    it('should throw when certain options are set to empty and library does not exist', async function() {
      const { pathname } = new URL('./zig-samples/basic/non-existing.zig', import.meta.url);
      await expect(compile(pathname, { buildDir: '' })).to.eventually.be.rejected;
      await expect(compile(pathname, { cacheDir: '' })).to.eventually.be.rejected;
      await expect(compile(pathname, { zigCmd: '' })).to.eventually.be.rejected;
    })
    it('should return library path when the file exists and buildDir is empty', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/basic/integers.zig', import.meta.url);
      const libpath = await compile(pathname);
      const libpath2 = await compile(pathname, { buildDir: '' });
      expect(libpath2).to.equal(libpath);
    })
    it('should use custom build file', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/custom/custom.zig', import.meta.url);
      const libpath = await compile(pathname);
      expect(libpath).to.contain('libcustom');
    })
    it('should compile code that uses C libraries', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/strlen-from-c/strlen.zig', import.meta.url);
      const libpath = await compile(pathname);
      expect(libpath).to.contain('libstrlen');
    })
    it('should recompile when one of the files has a newer modification date', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/custom/custom.zig', import.meta.url);
      const libpath1 = await compile(pathname);
      const { mtime: before } = await stat(libpath1);
      await delay(1000);
      await forceChange(pathname, async () => {
        const libpath2 = await compile(pathname);
        const { mtime: after } = await stat(libpath2);
        expect(after).to.be.above(before);
      });
    })
    it('should recompile when code exporter has changed', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/custom/custom.zig', import.meta.url);
      const libpath1 = await compile(pathname);
      const { mtime: before } = await stat(libpath1);
      const { pathname: exportPath } = new URL('../zig/exporter.zig', import.meta.url);
      await delay(1000);
      await forceChange(exportPath, async () => {
        const libpath2 = await compile(pathname);
        const { mtime: after } = await stat(libpath2);
        expect(after).to.be.above(before);
      });
    })
    it('should throw when code cannot be compiled', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/basic/invalid-syntax.zig', import.meta.url);
      await expect(compile(pathname)).to.eventually.be.rejectedWith(Error)
        .with.property('message').that.contains(`expected ';' after declaration`);
    })
    it('should remove build folder when the clean option is given', async function() {
      this.timeout(60000);
      const { pathname } = new URL('./zig-samples/basic/invalid-syntax.zig', import.meta.url);
      await expect(compile(pathname, { clean: true })).to.eventually.be.rejectedWith(Error);
      const buildFolder = await getBuildFolder(pathname, os.platform(), os.arch());
      const info = await findDirectory(buildFolder);
      expect(info).to.be.undefined;
    })
  })
})

async function forceChange(path, cb) {
  const info = await findFile(path);
  await touchFile(path);
  try {
    await cb();
  } finally {
    await utimes(path, info.atime, info.mtime);
  }
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
