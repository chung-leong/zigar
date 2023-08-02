import { expect, use } from 'chai';
import ChaiAsPromised from 'chai-as-promised';
import { stat, utimes } from 'fs/promises';

use(ChaiAsPromised);

import {
  compile,
  getBuildFolder,
} from '../src/compiler.js';

describe('Compilation', function() {
  describe('compile', function() {
    it('should compile zig source code for C++ extension', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const libpath = await compile(pathname);
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('libintegers');
    })
    it('should compile code for WASM', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const libpath = await compile(pathname, { target: 'wasm' });
      expect(libpath).to.be.a('string');
      expect(libpath).to.contain('integers.wasm');
    })
    it('should compile optimized code', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const libpath1 = await compile(pathname, { target: 'wasm' });
      const { size: before } = await stat(libpath1);
      const libpath2 = await compile(pathname, { target: 'wasm', optimize: 'ReleaseSmall' });
      const { size: after } = await stat(libpath2);
      expect(after).to.be.below(before);
    })
    it('should throw when source file is missing', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./integration/non-existing.zig', import.meta.url);
      await expect(compile(pathname)).to.eventually.be.rejected;
    })
    it('should throw when certain options are set to empty and library does not exist', async function() {
      const { pathname } = new URL('./integration/non-existing.zig', import.meta.url);
      await expect(compile(pathname, { buildDir: '' })).to.eventually.be.rejected;
      await expect(compile(pathname, { cacheDir: '' })).to.eventually.be.rejected;
      await expect(compile(pathname, { zigCmd: '' })).to.eventually.be.rejected;
    })
    it('should return library path when the file exists and buildDir is empty', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./integration/integers.zig', import.meta.url);
      const libpath = await compile(pathname);
      const libpath2 = await compile(pathname, { buildDir: '' });
      expect(libpath2).to.equal(libpath);
    })
    it('should use custom build file', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./samples/custom/custom.zig', import.meta.url);
      const libpath = await compile(pathname);
      expect(libpath).to.contain('libcustom');
    })
    it('should compile code that uses C libraries', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./samples/strlen-from-c/strlen.zig', import.meta.url);
      const libpath = await compile(pathname);
      expect(libpath).to.contain('libstrlen');
    })
    it('should recompile when one of the files has a newer modification date', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./samples/custom/custom.zig', import.meta.url);
      const libpath1 = await compile(pathname);
      const { mtime: before } = await stat(libpath1);
      await delay(1000);
      touch(pathname);
      const libpath2 = await compile(pathname);
      const { mtime: after } = await stat(libpath2);
      expect(after).to.be.above(before);
    })
    it('should recompile when code exporter has changed', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./samples/custom/custom.zig', import.meta.url);
      const libpath1 = await compile(pathname);
      const { mtime: before } = await stat(libpath1);
      const { pathname: exportPath } = new URL('../zig/exporter.zig', import.meta.url);
      await delay(1000);
      touch(exportPath);
      const libpath2 = await compile(pathname);
      const { mtime: after } = await stat(libpath2);
      expect(after).to.be.above(before);
    })
    it('should throw when code cannot be compiled', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./integration/invalid-syntax.zig', import.meta.url);
      await expect(compile(pathname)).to.eventually.be.rejectedWith(Error)
        .with.property('message').that.contains(`expected ';' after declaration`);
    })
    it('should build folder when the clean option is given', async function() {
      this.timeout(30000);
      const { pathname } = new URL('./integration/invalid-syntax.zig', import.meta.url);
      await expect(compile(pathname, { clean: true })).to.eventually.be.rejectedWith(Error);
      const buildFolder = await getBuildFolder(pathname);
      await expect(stat(buildFolder)).to.eventually.be.rejected;
    })
  })
})

async function touch(path) {
  try {
    const now = new Date();
    await utimes(path, now, now);
  } catch (err) {
  }
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
