import { expect } from 'chai';
import { statSync, utimesSync } from 'fs';
import os, { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import {
  acquireLockSync,
  compileSync,
  delaySync,
  deleteDirectorySync,
  deleteFileSync,
  findDirectorySync,
  findFileSync,
  loadFileSync,
  releaseLockSync,
  runCompilerSync,
  scanDirectorySync,
  touchFileSync,
} from '../src/compiler-sync.js';
import {
  acquireLock,
  compile,
  delay,
  getBuildFolder
} from '../src/compiler.js';

describe('Compilation (synchronous)', function() {
  describe('scanDirectorySync', function() {
    it('should not throw when directory is missing', function() {
      const path = absolute('./non-existing');
      expect(() => scanDirectorySync(path, /.*/, () => {})).to.not.throw();
    })
    it('should find matching files', function() {      
      const path = absolute('./');
      const list = [];
      scanDirectorySync(path, /\.zig$/, (dir, name, info) => {
        list.push(name);
      });
      expect(list.length).to.be.above(0);
      for (const name of list) {
        expect(name).to.match(/\.zig$/);
      }
    })
    it('should ignore node_modules', function() {
      const path = absolute('../');
      const list = [];
      scanDirectorySync(path, /\.js$/, (dir, name, info) => {
        list.push(dir);
      });
      expect(list.length).to.be.above(0);
      for (const dir of list) {
        expect(dir).to.not.contain('node_modules');
      }
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
  describe('deleteFileSync', function() {
    it('should not throw when file is missing', function() {
      expect(() => deleteFileSync('/dev/non-existing')).to.not.throw();
    })
    it('shoul throw when file cannot be removed', function() {
      expect(() => deleteFileSync('/dev/null')).to.throw();
    })
  })
  describe('deleteDirectorySync', function() {
    it('should not throw when directory is missing', function() {
      expect(() => deleteDirectorySync('/dev/null/non-existing')).to.not.throw();
    })
    it('should throw when directory cannot be removed', function() {
      expect(() => deleteDirectory('/dev/null')).to.throw();
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
  describe('runCompilerSync', function() {
    it('should run the Zig compiler', function() {
      const zigCmd = `zig help`;
      expect(() => runCompilerSync(zigCmd, tmpdir())).to.not.throw();
    })
    it('should throw when the Zig compiler returns an error', function() {
      const zigCmd = `zig`;
      expect(() => runCompilerSync(zigCmd, tmpdir())).to.throw();
    })
  })
  describe('compileSync', function() {
    it('should compileSync zig source code for C addon', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      const libpath = compileSync(path);
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('libintegers');
    })
    it('should compileSync code for WASM32', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      forceChangeSync(path, () => {
        const libpath = compileSync(path, { arch: 'wasm32', platform: 'freestanding' });
        expect(libpath).to.be.a('string');
        expect(libpath).to.contain('integers.wasm');
      });
    })
    it('should compileSync optimized code', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      const libpath1 = compileSync(path, { arch: 'wasm32', platform: 'freestanding' });
      const { size: before } = statSync(libpath1);
      const libpath2 = compileSync(path, { arch: 'wasm32', platform: 'freestanding', optimize: 'ReleaseSmall' });
      const { size: after } = statSync(libpath2);
      expect(after).to.be.below(before);
    })
    it('should compileSync with C library enabled when Zig code imports C code', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/strlen-from-c/strlen.zig');
      forceChangeSync(path, () => {
        const libpath = compileSync(path);
        expect(libpath).to.be.a('string');
        expect(libpath).to.contain('libstrlen');
      });
    })
    it('should work correctly when the same file is compiled at the same time', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      forceChangeSync(path, async () => {
        const promise1 = compile(path);
        const libpath2 = compileSync(path);
        const libpath1 = await promise1;
        expect(libpath2).to.equal(libpath1);
      });
    })
    it('should throw when source file is missing', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/non-existing.zig');
      expect(() => compileSync(path)).to.throw();
    })
    it('should throw when certain options are set to empty and library does not exist', function() {
      const path = absolute('./zig-samples/non-existing.zig');
      expect(() => compileSync(path, { buildDir: '' })).to.throw();
      expect(() => compileSync(path, { cacheDir: '' })).to.throw();
      expect(() => compileSync(path, { zigCmd: '' })).to.throw();
    })
    it('should return library path when the file exists and buildDir is empty', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      const libpath = compileSync(path);
      const libpath2 = compileSync(path, { buildDir: '' });
      expect(libpath2).to.equal(libpath);
    })
    it('should use custom build file', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/custom/custom.zig');
      const libpath = compileSync(path);
      expect(libpath).to.contain('libcustom');
    })
    it('should compileSync code that uses C libraries', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/strlen-from-c/strlen.zig');
      const libpath = compileSync(path);
      expect(libpath).to.contain('libstrlen');
    })
    it('should recompile when one of the files has a newer modification date', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/custom/custom.zig');
      const libpath1 = compileSync(path);
      const { mtime: before } = statSync(libpath1);
      delaySync(1000);
      forceChangeSync(path, () => {
        const libpath2 = compileSync(path);
        const { mtime: after } = statSync(libpath2);
        expect(after).to.be.above(before);
      });
    })
    it('should recompile when code exporter has changed', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/custom/custom.zig');
      const libpath1 = compileSync(path);
      const { mtime: before } = statSync(libpath1);
      const exportPath = absolute('../zig/exporter.zig');
      delaySync(1000);
      forceChangeSync(exportPath, () => {
        const libpath2 = compileSync(path);
        const { mtime: after } = statSync(libpath2);
        expect(after).to.be.above(before);
      });
    })
    it('should throw when code cannot be compiled', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/invalid-syntax.zig');
      expect(() => compileSync(path)).to.throw(Error)
        .with.property('message').that.contains(`expected ';' after declaration`);
    })
    it('should remove build folder when the clean option is given', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/invalid-syntax.zig');
      expect(() => compileSync(path, { clean: true })).to.throw(Error);
      const buildFolder = getBuildFolder(path, os.platform(), os.arch());
      const info = findDirectorySync(buildFolder);
      expect(info).to.be.undefined;
    })
  })
})

function forceChangeSync(path, cb) {
  const info = findFileSync(path);
  touchFileSync(path);
  try {
    cb();
  } finally {
    utimesSync(path, info.atime, info.mtime);
  }
}

function absolute(relpath) {
  return fileURLToPath(new URL(relpath, import.meta.url));
}
