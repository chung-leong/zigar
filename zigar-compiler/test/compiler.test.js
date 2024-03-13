import { expect, use } from 'chai';
import { chaiPromised } from 'chai-promised';
import { statSync, utimesSync } from 'fs';
import { stat, utimes } from 'fs/promises';
import os, { tmpdir } from 'os';

use(chaiPromised);

import { fileURLToPath } from 'url';
import {
  compile,
  compileSync,
  createConfig,
  getModuleCachePath,
  runCompiler,
  runCompilerSync
} from '../src/compiler.js';
import {
  delay,
  delaySync,
  findDirectory,
  findDirectorySync,
  findFile,
  findFileSync
} from '../src/utility-functions.js';

describe('Compilation', function() {
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
  describe('getModuleCachePath', function () {
    it('should return cache path for source file', function() {
      const srcPath = '/project/src/hello.zig';
      const options = {
        optimize: 'Debug',
        platform: 'win32',
        arch: 'x64',
        cacheDir: '/project/zigar-cache',
      };
      const modPath = getModuleCachePath(srcPath, options);
      expect(modPath).to.match(/^\/project\/zigar-cache\/src\-\w{8}\/Debug\/hello\.zigar$/);
    })
  })
  describe('createConfig', function() {
    it('should return custom command when provided', async function() {
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', zigCmd: 'zig build -Dsomething=123' };
      const modPath = getModuleCachePath(srcPath, options);
      const config = createConfig(srcPath, modPath, options);
      expect(config.zigCmd).to.equal(options.zigCmd);
    })
    it('should set cpu to native when nativeCpu is true', async function() {
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', nativeCpu: true };
      const modPath = getModuleCachePath(srcPath, options);
      const config = createConfig(srcPath, modPath, options);
      expect(config.zigCmd).to.contain('-Dcpu=native');
    })
    it('should omit cpu despite nativeCpu being true when arch does not match', async function() {
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', arch: 'loong64', nativeCpu: true };
      const modPath = getModuleCachePath(srcPath, options);
      const config = createConfig(srcPath, modPath, options);
      expect(config.zigCmd).to.not.contain('-Dcpu=native');
    })
    it('should omit cpu despite nativeCpu being true when platform does not match', async function() {
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', platform: 'aix', nativeCpu: true };
      const modPath = getModuleCachePath(srcPath, options);
      const config = createConfig(srcPath, modPath, options);
      expect(config.zigCmd).to.not.contain('-Dcpu=native');
    })
    it('should place DLL inside module folder', function() {
      const srcPath = '/project/src/hello.zig';
      const options = {
        platform: 'win32',
        arch: 'x64',
      };
      const modPath = '/lib/hello.zigar';
      const config = createConfig(srcPath, modPath, options);
      expect(config.outputPath).to.equal('/lib/hello.zigar/win32.x64.dll');
    })
    it('should use Unix extension for unrecogized platforms', function() {
      const srcPath = '/project/src/hello.zig';
      const options = {
        platform: 'freebsd',
        arch: 'arm64',
      };
      const modPath = '/lib/hello.zigar';
      const config = createConfig(srcPath, modPath, options);
      expect(config.outputPath).to.equal('/lib/hello.zigar/freebsd.arm64.so');
    })
  })
  describe('compile', function() {
    it('should compile zig source code for C addon', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for WASM32', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'wasm32', platform: 'freestanding' };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for Linux', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'x64', platform: 'linux' };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for Windows', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'x64', platform: 'win32' };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for Windows-ia32', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'ia32', platform: 'win32' };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for MacOS', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'arm64', platform: 'darwin' };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for MacOS-x64', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'x64', platform: 'darwin' };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile optimized code', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options1 = { optimize: 'Debug', arch: 'wasm32', platform: 'freestanding' };
      const options2 = { optimize: 'ReleaseSmall', arch: 'wasm32', platform: 'freestanding' };
      const result1 = await compile(srcPath, null, options1);
      const result2 = await compile(srcPath, null, options2);
      const { size: before } = await stat(result1.outputPath);
      const { size: after } = await stat(result2.outputPath);
      expect(after).to.be.below(before);
    })
    it('should compile code for CPU of current system', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/function-simple.zig');
      const options = { optimize: 'ReleaseSmall', nativeCpu: true };
      const modPath = getModuleCachePath(srcPath, options);
      await forceChange(srcPath, async() => {
        const { outputPath } = await compile(srcPath, modPath, options);
        const { size } = await stat(outputPath);
        expect(size).to.be.at.least(1000); 
      })
    })
    it('should not fail when nativeCpu is set in a cross compilation scenario', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/function-simple.zig');
      const options = { optimize: 'Debug', platform: 'linux', arch: 'ppc64', nativeCpu: true };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile with C library enabled when Zig code imports C code', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/strlen-from-c/strlen.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      await forceChange(srcPath, async () => {     
        const { outputPath } = await compile(srcPath, modPath, options);
        const { size } = await stat(outputPath);
        expect(size).to.be.at.least(1000);
      });
    })
    it('should work correctly when the same file is compiled at the same time', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      await forceChange(srcPath, async () => {
        const promise1 = compile(srcPath, modPath, options);
        const promise2 = compile(srcPath, modPath, options);
        const result2 = await promise2;
        const result1 = await promise1;
        const { size } = await stat(result2.outputPath);
        expect(size).to.be.at.least(1000);
      });
    })
    it('should handle directory reference', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/int-dir');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should throw when source file is missing', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/non-existing.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      await expect(compile(srcPath, modPath, options)).to.eventually.be.rejected;
    })
    it('should return sub-path of module path when source file is omitted', async function() {
      this.timeout(600000);
      const options = { optimize: 'Debug', platform: 'linux', arch: 'arm64' };
      const modPath = '/lib/hello.zigar';
      const { outputPath, changed } = await compile(null, modPath, options);
      expect(outputPath).to.equal('/lib/hello.zigar/linux.arm64.so');
      expect(changed).to.be.false;
    })
    it('should use custom build file', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should recompile when one of the files has a newer modification date', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      await compile(srcPath, modPath, options);
      await delay(1000);
      await forceChange(srcPath, async () => {
        const { changed } = await compile(srcPath, modPath, options);
        expect(changed).to.be.true;
      });
    })
    it('should recompile when code exporter has changed', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      await compile(srcPath, modPath, options);
      const exportPath = absolute('../zig/exporter.zig');
      await delay(1000);
      await forceChange(exportPath, async () => {
        const { changed } = await compile(srcPath, modPath, options);
        expect(changed).to.be.true;
      });
    })
    it('should throw when code cannot be compiled', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/invalid-syntax.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      await expect(compile(srcPath, modPath, options)).to.eventually.be.rejectedWith(Error)
        .with.property('message').that.contains(`expected ';' after declaration`);
    })
    it('should remove build folder when the clean option is given', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/invalid-syntax.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch(), clean: true };
      const modPath = getModuleCachePath(srcPath, options);
      await expect(compile(srcPath, modPath, options)).to.eventually.be.rejectedWith(Error);
      const { moduleBuildDir } = createConfig(srcPath, modPath, options);
      const info = await findDirectory(moduleBuildDir);
      expect(info).to.be.undefined;
    })
  })
  describe('compileSync', function() {
    it('should compile zig source code for C addon', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = compileSync(srcPath, modPath, options);
      const { size } = statSync(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for WASM32', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'wasm32', platform: 'freestanding' };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = compileSync(srcPath, modPath, options);
      const { size } = statSync(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile optimized code', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options1 = { optimize: 'Debug', arch: 'wasm32', platform: 'freestanding' };
      const options2 = { optimize: 'ReleaseSmall', arch: 'wasm32', platform: 'freestanding' };
      const result1 = compileSync(srcPath, null, options1);
      const result2 = compileSync(srcPath, null, options2);
      const { size: before } = statSync(result1.outputPath);
      const { size: after } = statSync(result2.outputPath);
      expect(after).to.be.below(before);
    })
    it('should compile with C library enabled when Zig code imports C code', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/strlen-from-c/strlen.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      forceChangeSync(srcPath, async () => {
        const { outputPath } = compileSync(srcPath, modPath, options);
        const { size } = statSync(outputPath);
        expect(size).to.be.at.least(1000);
      });
    })
    it('should work correctly when the same file is compiled at the same time', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      forceChangeSync(srcPath, async () => {
        const promise = compile(srcPath, modPath, options);
        const { outputPath } = compileSync(srcPath, modPath, options);
        await promise;
        const { size } = statSync(outputPath);
        expect(size).to.be.at.least(1000);
      });
    })
    it('should handle directory reference', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/int-dir');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = compileSync(srcPath, modPath, options);
      const { size } = statSync(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should throw when source file is missing', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/non-existing.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      expect(() => compileSync(srcPath, modPath, options)).to.throw();
    })
    it('should return sub-path of module path when source file is omitted', function() {
      this.timeout(600000);
      const options = { optimize: 'Debug', platform: 'linux', arch: 'arm64' };
      const modPath = '/lib/hello.zigar';
      const { outputPath, changed } = compileSync(null, modPath, options);
      expect(outputPath).to.equal('/lib/hello.zigar/linux.arm64.so');
      expect(changed).to.be.false;
    })
    it('should use custom build file', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = compileSync(srcPath, modPath, options);
      const { size } = statSync(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should recompile when one of the files has a newer modification date', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      compileSync(srcPath, modPath, options);
      delaySync(1000);
      forceChangeSync(srcPath, () => {
        const { changed } = compileSync(srcPath, modPath, options);
        expect(changed).to.be.true;
      });
    })
    it('should recompile when code exporter has changed', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      compileSync(srcPath, modPath, options);
      const exportPath = absolute('../zig/exporter.zig');
      delaySync(1000);
      forceChangeSync(exportPath, async () => {
        const compiled = compileSync(srcPath, modPath, options);
        expect(compiled).to.be.true;
      });
    })
    it('should throw when code cannot be compiled', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/invalid-syntax.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      expect(() => compileSync(srcPath, modPath, options)).to.throw(Error)
        .with.property('message').that.contains(`expected ';' after declaration`);
    })
    it('should remove build folder when the clean option is given', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/invalid-syntax.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch(), clean: true };
      const modPath = getModuleCachePath(srcPath, options);
      expect(() => compileSync(srcPath, modPath, options)).to.throw(Error);
      const config = createConfig(srcPath, modPath, options);
      const info = findDirectorySync(config.outputPath);
      expect(info).to.be.undefined;
    })
  })
})

async function forceChange(path, cb) {
  const info = await findFile(path);
  const now = new Date();
  await utimes(path, now, now);
  try {
    await cb();
  } finally {
    await utimes(path, info.atime, info.mtime);
  }
}

function forceChangeSync(path, cb) {
  const info = findFileSync(path);
  const now = new Date();
  utimesSync(path, now, now); 
  try {
    cb();
  } finally {
    utimesSync(path, info.atime, info.mtime);
  }
}

function absolute(relpath) {
  return fileURLToPath(new URL(relpath, import.meta.url));
}
