import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { statSync, utimesSync } from 'fs';
import { stat, utimes } from 'fs/promises';
import os, { tmpdir } from 'os';

use(ChaiAsPromised);

import { fileURLToPath } from 'url';
import {
  compile,
  compileSync,
  getBuildFolder,
  runCompiler,
  runCompilerSync,
} from '../src/compiler.js';
import {
  delay,
  delaySync,
  findDirectory,
  findDirectorySync,
  findFile,
  findFileSync,
  touchFile,
  touchFileSync,
} from '../src/utility-functions.js';

describe('Compilation', function() {
  // describe('getLibraryName', function() {
  //   it('should return the correct name for Linux', function() {
  //     const name = getLibraryName('hello', 'linux', 'ia32');
  //     expect(name).to.equal('libhello.so');
  //   })
  //   it('should return the correct name for Darwin', function() {
  //     const name = getLibraryName('hello', 'darwin', 'x64');
  //     expect(name).to.equal('libhello.dylib');
  //   })
  //   it('should return the correct name for Windows', function() {
  //     const name = getLibraryName('hello', 'win32', 'x64');
  //     expect(name).to.equal('hello.dll');
  //   })
  //   it('should return the correct name for WASM', function() {
  //     const name = getLibraryName('hello', 'freestanding', 'wasm32');
  //     expect(name).to.equal('hello.wasm');
  //   })
  // })
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
  describe('runCompilerSync', function() {
    it('should run the Zig compiler', function() {
      const zigCmd = `zig help`;
      runCompilerSync(zigCmd, tmpdir());
      expect(() => runCompilerSync(zigCmd, tmpdir())).to.not.throw();
    })
    it('should throw when the Zig compiler returns an error', function() {
      const zigCmd = `zig`;
      expect(() => runCompilerSync(zigCmd, tmpdir())).to.throw();
    })
  })
  describe('compile', function() {
    it('should compile zig source code for C addon', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      const libpath = await compile(path);
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('libintegers');
    })
    it('should compile code for WASM32', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      await forceChange(path, async () => {
        const libpath = await compile(path, { arch: 'wasm32', platform: 'freestanding' });
        expect(libpath).to.be.a('string');
        expect(libpath).to.contain('integers.wasm');
      });
    })
    it('should compile optimized code', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      const libpath1 = await compile(path, { arch: 'wasm32', platform: 'freestanding' });
      const { size: before } = await stat(libpath1);
      const libpath2 = await compile(path, { arch: 'wasm32', platform: 'freestanding', optimize: 'ReleaseSmall' });
      const { size: after } = await stat(libpath2);
      expect(after).to.be.below(before);
    })
    it('should compile with C library enabled when Zig code imports C code', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/strlen-from-c/strlen.zig');
      await forceChange(path, async () => {
        const libpath = await compile(path);
        expect(libpath).to.be.a('string');
        expect(libpath).to.contain('libstrlen');
      });
    })
    it('should work correctly when the same file is compiled at the same time', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      await forceChange(path, async () => {
        const promise1 = compile(path);
        const promise2 = compile(path);
        const libpath2 = await promise2;
        const libpath1 = await promise1;
        expect(libpath2).to.equal(libpath1);
      });
    })
    it('should throw when source file is missing', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/non-existing.zig');
      await expect(compile(path)).to.eventually.be.rejected;
    })
    it('should throw when certain options are set to empty and library does not exist', async function() {
      const path = absolute('./zig-samples/non-existing.zig');
      await expect(compile(path, { buildDir: '' })).to.eventually.be.rejected;
      await expect(compile(path, { cacheDir: '' })).to.eventually.be.rejected;
      await expect(compile(path, { zigCmd: '' })).to.eventually.be.rejected;
    })
    it('should return library path when the file exists and buildDir is empty', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      const libpath = await compile(path);
      const libpath2 = await compile(path, { buildDir: '' });
      expect(libpath2).to.equal(libpath);
    })
    it('should use custom build file', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/custom/custom.zig');
      const libpath = await compile(path);
      expect(libpath).to.contain('libcustom');
    })
    it('should compile code that uses C libraries', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/strlen-from-c/strlen.zig');
      const libpath = await compile(path);
      expect(libpath).to.contain('libstrlen');
    })
    it('should recompile when one of the files has a newer modification date', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/custom/custom.zig');
      const libpath1 = await compile(path);
      const { mtime: before } = await stat(libpath1);
      await delay(1000);
      await forceChange(path, async () => {
        const libpath2 = await compile(path);
        const { mtime: after } = await stat(libpath2);
        expect(after).to.be.above(before);
      });
    })
    it('should recompile when code exporter has changed', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/custom/custom.zig');
      const libpath1 = await compile(path);
      const { mtime: before } = await stat(libpath1);
      const exportPath = absolute('../zig/exporter.zig');
      await delay(1000);
      await forceChange(exportPath, async () => {
        const libpath2 = await compile(path);
        const { mtime: after } = await stat(libpath2);
        expect(after).to.be.above(before);
      });
    })
    it('should throw when code cannot be compiled', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/invalid-syntax.zig');
      await expect(compile(path)).to.eventually.be.rejectedWith(Error)
        .with.property('message').that.contains(`expected ';' after declaration`);
    })
    it('should remove build folder when the clean option is given', async function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/invalid-syntax.zig');
      await expect(compile(path, { clean: true })).to.eventually.be.rejectedWith(Error);
      const buildFolder = getBuildFolder(path, os.platform(), os.arch());
      const info = await findDirectory(buildFolder);
      expect(info).to.be.undefined;
    })
  })
  describe('compileSync', function() {
    it('should compile zig source code for C addon', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      const libpath = compileSync(path);
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('libintegers');
    })
    it('should compile code for WASM32', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      forceChangeSync(path, () => {
        const libpath = compileSync(path, { arch: 'wasm32', platform: 'freestanding' });
        expect(libpath).to.be.a('string');
        expect(libpath).to.contain('integers.wasm');
      });
    })
    it('should compile optimized code', function() {
      this.timeout(60000);
      const path = absolute('./zig-samples/basic/integers.zig');
      const libpath1 = compileSync(path, { arch: 'wasm32', platform: 'freestanding' });
      const { size: before } = statSync(libpath1);
      const libpath2 = compileSync(path, { arch: 'wasm32', platform: 'freestanding', optimize: 'ReleaseSmall' });
      const { size: after } = statSync(libpath2);
      expect(after).to.be.below(before);
    })
    it('should compile with C library enabled when Zig code imports C code', function() {
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
    it('should compile code that uses C libraries', function() {
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

async function forceChange(path, cb) {
  const info = await findFile(path);
  await touchFile(path);
  try {
    await cb();
  } finally {
    await utimes(path, info.atime, info.mtime);
  }
}

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
