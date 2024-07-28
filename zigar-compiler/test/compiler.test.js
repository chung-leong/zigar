import { expect, use } from 'chai';
import { chaiPromised } from 'chai-promised';
import { stat } from 'fs/promises';
import os, { tmpdir } from 'os';

use(chaiPromised);

import { fileURLToPath } from 'url';
import {
  compile,
  createConfig,
  getModuleCachePath,
  runCompiler
} from '../src/compiler.js';

describe('Compilation', function() {
  describe('runCompiler', function() {
    it('should run the Zig compiler', async function() {
      const promise = runCompiler('zig', [ 'help' ], { cwd: tmpdir() });
      await expect(promise).to.eventually.be.fulfilled;
    })
    it('should throw when the Zig compiler returns an error', async function() {
      const promise = runCompiler('zig', [], { cwd: tmpdir() });
      await expect(promise).to.eventually.be.rejected;
    })
    it('should call onStart and onEnd', async function() {
      let startCount = 0, endCount = 0;
      const onStart = () => startCount++;
      const onEnd = () => endCount++;
      await runCompiler('zig', [ 'help' ], { cwd: tmpdir(), onStart, onEnd });
      expect(startCount).to.equal(1);
      expect(endCount).to.equal(1);
      try {
        await runCompiler('zig', [], { cwd: tmpdir(), onStart, onEnd });
      } catch (err) {
      }
      expect(startCount).to.equal(2);
      expect(endCount).to.equal(2);
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
      const options = { optimize: 'Debug', zigPath: 'donut', zigArgs: '-Dsomething=123' };
      const modPath = getModuleCachePath(srcPath, options);
      const config = createConfig(srcPath, modPath, options);
      expect(config.zigPath).to.equal('donut');
      expect(config.zigArgs).to.contain('build');
      expect(config.zigArgs).to.contain('-Dsomething=123');
    })
    it('should return override default args', async function() {
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', zigArgs: 'donut -Dtarget=hello -Doptimize=hello' };
      const modPath = getModuleCachePath(srcPath, options);
      const config = createConfig(srcPath, modPath, options);
      expect(config.zigPath).to.equal('zig');
      expect(config.zigArgs).to.not.contain('build');
      expect(config.zigArgs).to.contain('donut');
      expect(config.zigArgs).to.contain('-Dtarget=hello');
      expect(config.zigArgs).to.contain('-Doptimize=hello');
      expect(config.zigArgs).to.have.lengthOf(3);
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
      const options = { optimize: 'ReleaseSmall', arch: 'wasm32', platform: 'wasi' };
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
      const options1 = { optimize: 'Debug', arch: 'wasm32', platform: 'wasi' };
      const options2 = { optimize: 'ReleaseSmall', arch: 'wasm32', platform: 'wasi' };
      const modPath1 = getModuleCachePath(srcPath, options1);
      const modPath2 = getModuleCachePath(srcPath, options2);
      const result1 = await compile(srcPath, modPath1, options1);
      const result2 = await compile(srcPath, modPath2, options2);
      const { size: before } = await stat(result1.outputPath);
      const { size: after } = await stat(result2.outputPath);
      expect(after).to.be.below(before);
    })
    it('should compile with C library enabled when Zig code imports C code', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/strlen-from-c/strlen.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile with C library enabled when C allocator is used', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/c-allocator/dupe.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })

    it('should work correctly when the same file is compiled at the same time', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const promise1 = compile(srcPath, modPath, options);
      const promise2 = compile(srcPath, modPath, options);
      const result2 = await promise2;
      const result1 = await promise1;
      const { size } = await stat(result2.outputPath);
      expect(size).to.be.at.least(1000);
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
      let info;
      try {
        info = await stat(moduleBuildDir);
      } catch (err) {
      }
      expect(info).to.be.undefined;
    })
    it('should call onStart and onEnd', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      let onStartCalled = false, onEndCalled = false;
      const onStart = () => onStartCalled = true;
      const onEnd = () => onEndCalled = true;
      const options = {
        optimize: 'Debug',
        platform: os.platform(),
        arch: os.arch(),
        onStart,
        onEnd,
      };
      const modPath = getModuleCachePath(srcPath, options);
      await compile(srcPath, modPath, options);
      expect(onStartCalled).to.be.true;
      expect(onEndCalled).to.be.true;
    })
    it('should return list of files involved in build', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/c-import/print.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { sourcePaths } = await compile(srcPath, modPath, options);
      const hasMainFile = !!sourcePaths.find(p => p.includes('print.zig'));
      const hasCFile = !!sourcePaths.find(p => p.includes('hello.c'));
      const hasZigFile = !!sourcePaths.find(p => p.includes('hello.zig'));
      const hasExporter = !!sourcePaths.find(p => p.includes('exporter.zig'));
      expect(hasMainFile).to.be.true;
      expect(hasCFile).to.be.true;
      expect(hasZigFile).to.be.true;
      expect(hasExporter).to.be.true;
    })
    it('should include build and package manager config file in list of files involved in build', async function() {
      this.timeout(600000);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { sourcePaths } = await compile(srcPath, modPath, options);
      const hasBuildFile = !!sourcePaths.find(p => p.includes('build.zig'));
      const hasPackageCfgFile = !!sourcePaths.find(p => p.includes('build.zig.zon'));
      expect(hasBuildFile).to.be.true;
      expect(hasPackageCfgFile).to.be.true;
    })
  })
})

function absolute(relpath) {
  return fileURLToPath(new URL(relpath, import.meta.url));
}
