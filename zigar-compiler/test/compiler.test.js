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
  createConfig,
  getBuildCommand,
  getBuildFolder,
  runCompiler,
  runCompilerSync,
} from '../src/compiler.js';
import { getCachePath } from '../src/configuration.js';
import {
  delay,
  delaySync,
  findDirectory,
  findDirectorySync,
  findFile,
  findFileSync
} from '../src/utility-functions.js';

describe('Compilation', function() {
  describe('getBuildCommand', function() {
    it('should return custom command when provided', async function() {
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', zigCmd: 'zig build -Dsomething=123' };
      const soPath = getCachePath(srcPath, options);
      const srcInfo = await stat(srcPath);
      const config = createConfig(srcPath, srcInfo, soPath, null, options);
      const soBuildCmd = getBuildCommand(config);
      expect(soBuildCmd).to.equal(options.zigCmd);
    })
    it('should use specific target when nativeCpu is false', async function() {
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', arch: 'arm64', platform: 'linux', nativeCpu: false };
      const soPath = getCachePath(srcPath, options);
      const srcInfo = await stat(srcPath);
      const config = createConfig(srcPath, srcInfo, soPath, null, options);
      const soBuildCmd = getBuildCommand(config);
      expect(soBuildCmd).to.contain('-Dtarget=aarch64-linux');
    })
    it('should omit cpu arch when nativeCpu is true', async function() {
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', arch: 'arm64', platform: 'linux', nativeCpu: true };
      const soPath = getCachePath(srcPath, options);
      const srcInfo = await stat(srcPath);
      const config = createConfig(srcPath, srcInfo, soPath, null, options);
      const soBuildCmd = getBuildCommand(config);
      expect(soBuildCmd).to.contain('-Dtarget=native-linux');
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
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      await compile(srcPath, soPath, options);
      const { size } = await stat(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for WASM32', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'wasm32', platform: 'freestanding' };
      const soPath = getCachePath(srcPath, options);
      await compile(srcPath, soPath, options);
      const { size } = await stat(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for 64-bit Linux', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'x64', platform: 'linux' };
      const soPath = getCachePath(srcPath, options);
      await compile(srcPath, soPath, options);
      const { size } = await stat(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for 32-bit Windows', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'ia32', platform: 'win32' };
      const soPath = getCachePath(srcPath, options);
      await compile(srcPath, soPath, options);
      const { size } = await stat(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for 64-bit Windows', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'x64', platform: 'win32' };
      const soPath = getCachePath(srcPath, options);
      await compile(srcPath, soPath, options);
      const { size } = await stat(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for x64 OSX', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'x64', platform: 'darwin' };
      const soPath = getCachePath(srcPath, options);
      await compile(srcPath, soPath, options);
      const { size } = await stat(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for Arm64 OSX', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'arm64', platform: 'darwin' };
      const soPath = getCachePath(srcPath, options);
      await compile(srcPath, soPath, options);
      const { size } = await stat(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile optimized code', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options1 = { optimize: 'Debug', arch: 'wasm32', platform: 'freestanding' };
      const options2 = { optimize: 'ReleaseSmall', arch: 'wasm32', platform: 'freestanding' };
      const soPath1 = getCachePath(srcPath, options1);
      const soPath2 = getCachePath(srcPath, options2);
      await compile(srcPath, soPath1, options1);
      await compile(srcPath, soPath2, options2);
      const { size: before } = await stat(soPath1);
      const { size: after } = await stat(soPath2);
      expect(after).to.be.below(before);
    })
    it('should compile with C library enabled when Zig code imports C code', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/strlen-from-c/strlen.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      await forceChange(srcPath, async () => {     
        await compile(srcPath, soPath, options);
        const { size } = await stat(soPath);
        expect(size).to.be.at.least(1000);
      });
    })
    it('should work correctly when the same file is compiled at the same time', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      await forceChange(srcPath, async () => {
        const promise1 = compile(srcPath, soPath, options);
        const promise2 = compile(srcPath, soPath, options);
        await promise2;
        await promise1;
        const { size } = await stat(soPath);
        expect(size).to.be.at.least(1000);
      });
    })
    it('should handle directory reference', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/int-dir');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      await compile(srcPath, soPath, options);
      const { size } = await stat(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should throw when source file is missing', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/non-existing.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      await expect(compile(srcPath, soPath, options)).to.eventually.be.rejected;
    })
    it('should use custom build file', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      await compile(srcPath, soPath, options);
      const { size } = await stat(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should recompile when one of the files has a newer modification date', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      await compile(srcPath, soPath, options);
      await delay(1000);
      await forceChange(srcPath, async () => {
        const compiled = await compile(srcPath, soPath, options);
        expect(compiled).to.be.true;
      });
    })
    it('should recompile when code exporter has changed', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      await compile(srcPath, soPath, options);
      const exportPath = absolute('../zig/exporter.zig');
      await delay(1000);
      await forceChange(exportPath, async () => {
        const compiled = await compile(srcPath, soPath, options);
        expect(compiled).to.be.true;
      });
    })
    it('should throw when code cannot be compiled', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/invalid-syntax.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      await expect(compile(srcPath, soPath, options)).to.eventually.be.rejectedWith(Error)
        .with.property('message').that.contains(`expected ';' after declaration`);
    })
    it('should remove build folder when the clean option is given', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/invalid-syntax.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch(), clean: true };
      const soPath = getCachePath(srcPath, options);
      await expect(compile(srcPath, soPath, options)).to.eventually.be.rejectedWith(Error);
      const srcInfo = await stat(srcPath);
      const config = createConfig(srcPath, srcInfo, soPath, null, options);
      const buildFolder = getBuildFolder(config);
      const info = await findDirectory(buildFolder);
      expect(info).to.be.undefined;
    })
  })
  describe('compileSync', function() {
    it('should compile zig source code for C addon', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      compileSync(srcPath, soPath, options);
      const { size } = statSync(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for WASM32', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'wasm32', platform: 'freestanding' };
      const soPath = getCachePath(srcPath, options);
      compileSync(srcPath, soPath, options);
      const { size } = statSync(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile optimized code', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options1 = { optimize: 'Debug', arch: 'wasm32', platform: 'freestanding' };
      const options2 = { optimize: 'ReleaseSmall', arch: 'wasm32', platform: 'freestanding' };
      const soPath1 = getCachePath(srcPath, options1);
      const soPath2 = getCachePath(srcPath, options2);
      compileSync(srcPath, soPath1, options1);
      compileSync(srcPath, soPath2, options2);
      const { size: before } = statSync(soPath1);
      const { size: after } = statSync(soPath2);
      expect(after).to.be.below(before);
    })
    it('should compile with C library enabled when Zig code imports C code', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/strlen-from-c/strlen.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      forceChangeSync(srcPath, async () => {
        compileSync(srcPath, soPath, options);
        const { size } = statSync(soPath);
        expect(size).to.be.at.least(1000);
      });
    })
    it('should work correctly when the same file is compiled at the same time', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      forceChangeSync(srcPath, async () => {
        const promise = compile(srcPath, soPath, options);
        compileSync(srcPath, soPath, options);
        await promise;
        const { size } = statSync(soPath);
        expect(size).to.be.at.least(1000);
      });
    })
    it('should handle directory reference', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/int-dir');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      compileSync(srcPath, soPath, options);
      const { size } = statSync(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should throw when source file is missing', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/non-existing.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      expect(() => compileSync(srcPath, soPath, options)).to.throw();
    })
    it('should use custom build file', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      compileSync(srcPath, soPath, options);
      const { size } = statSync(soPath);
      expect(size).to.be.at.least(1000);
    })
    it('should recompile when one of the files has a newer modification date', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      compileSync(srcPath, soPath, options);
      delaySync(1000);
      forceChangeSync(srcPath, () => {
        const compiled = compileSync(srcPath, soPath, options);
        expect(compiled).to.be.true;
      });
    })
    it('should recompile when code exporter has changed', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      compileSync(srcPath, soPath, options);
      const exportPath = absolute('../zig/exporter.zig');
      delaySync(1000);
      forceChangeSync(exportPath, async () => {
        const compiled = compileSync(srcPath, soPath, options);
        expect(compiled).to.be.true;
      });
    })
    it('should throw when code cannot be compiled', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/invalid-syntax.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const soPath = getCachePath(srcPath, options);
      expect(() => compileSync(srcPath, soPath, options)).to.throw(Error)
        .with.property('message').that.contains(`expected ';' after declaration`);
    })
    it('should remove build folder when the clean option is given', function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/invalid-syntax.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch(), clean: true };
      const soPath = getCachePath(srcPath, options);
      expect(() => compileSync(srcPath, soPath, options)).to.throw(Error);
      const srcInfo = statSync(srcPath);
      const config = createConfig(srcPath, srcInfo, soPath, null, options);
      const buildFolder = getBuildFolder(config);
      const info = findDirectorySync(buildFolder);
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
