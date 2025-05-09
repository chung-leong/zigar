import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { readdir, stat } from 'fs/promises';
import os, { tmpdir } from 'os';
import { join, sep } from 'path';
import { fileURLToPath } from 'url';

use(chaiAsPromised);

import {
  compile,
  createConfig,
  getModuleCachePath,
  runCompiler
} from '../src/compilation.js';
import { delay } from '../src/utility-functions.js';

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
      const parts = modPath.split(sep);
      expect(parts[1]).to.equal('project');
      expect(parts[2]).to.equal('zigar-cache');
      expect(parts[3]).to.match(/^src\-\w{8}$/);
      expect(parts[4]).to.equal('Debug');
      expect(parts[5]).to.equal('hello.zigar');
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
      const modPath = join('lib', 'hello.zigar');
      const config = createConfig(srcPath, modPath, options);
      expect(config.outputPath).to.equal(join(modPath, 'win32.x64.dll'));
    })
    it('should use Unix extension for unrecogized platforms', function() {
      const srcPath = '/project/src/hello.zig';
      const options = {
        platform: 'freebsd',
        arch: 'arm64',
      };
      const modPath = join('lib', 'hello.zigar');
      const config = createConfig(srcPath, modPath, options);
      expect(config.outputPath).to.equal(join(modPath, 'freebsd.arm64.so'));
    })
  })
  describe('compile', function() {
    it('should compile zig source code for C addon', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for WASM32', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'wasm32', platform: 'wasi', isWASM: true };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for Linux', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'x64', platform: 'linux' };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for Windows', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'x64', platform: 'win32' };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for Windows-ia32', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'ia32', platform: 'win32' };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for MacOS', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'arm64', platform: 'darwin' };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile code for MacOS-x64', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'ReleaseSmall', arch: 'x64', platform: 'darwin' };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile optimized code', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options1 = { optimize: 'Debug', arch: 'wasm32', platform: 'wasi', isWASM: true };
      const options2 = { optimize: 'ReleaseSmall', arch: 'wasm32', platform: 'wasi', isWASM: true };
      const modPath1 = getModuleCachePath(srcPath, options1);
      const modPath2 = getModuleCachePath(srcPath, options2);
      const result1 = await compile(srcPath, modPath1, options1);
      const result2 = await compile(srcPath, modPath2, options2);
      const { size: before } = await stat(result1.outputPath);
      const { size: after } = await stat(result2.outputPath);
      expect(after).to.be.below(before);
    })
    it('should compile with C library enabled when Zig code imports C code', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/strlen-from-c/strlen.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should compile with C library enabled when C allocator is used', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/c-allocator/dupe.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should work correctly when the same file is compiled at the same time', async function() {
      this.timeout(0);
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
    it('should ignore missing compiler when library file exists', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      await compile(srcPath, modPath, options);
      const { changed } = await compile(srcPath, modPath, { ...options, zigPath: 'zigo' });
      expect(changed).to.be.false;
    })
    it('should throw when both compiler when library file are missing', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/basic/empty.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const promise = compile(srcPath, modPath, { ...options, zigPath: 'zigo' });
      await expect(promise).to.eventually.be.rejectedWith(Error)
        .with.property('message').that.contains('not found');
    })
    it('should handle directory reference', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/int-dir');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should throw when source file is missing', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/non-existing.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      await expect(compile(srcPath, modPath, options)).to.eventually.be.rejected;
    })
    it('should return sub-path of module path when source file is omitted', async function() {
      this.timeout(0);
      const options = { optimize: 'Debug', platform: 'linux', arch: 'arm64' };
      const modPath = join('lib', 'hello.zigar');
      const { outputPath, changed } = await compile(null, modPath, options);
      expect(outputPath).to.equal(join(modPath, 'linux.arm64.so'));
      expect(changed).to.be.false;
    })
    it('should use custom build file', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { outputPath } = await compile(srcPath, modPath, options);
      const { size } = await stat(outputPath);
      expect(size).to.be.at.least(1000);
    })
    it('should throw when code cannot be compiled', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/basic/invalid-syntax.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      await expect(compile(srcPath, modPath, options)).to.eventually.be.rejectedWith(Error)
        .with.property('message').that.contains(`expected ';' after declaration`);
    })
    it('should remove build folder when the clean option is given', async function() {
      this.timeout(0);
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
      this.timeout(0);
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
      this.timeout(0);
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
      this.timeout(0);
      const srcPath = absolute('./zig-samples/custom/custom.zig');
      const options = { optimize: 'Debug', platform: os.platform(), arch: os.arch() };
      const modPath = getModuleCachePath(srcPath, options);
      const { sourcePaths } = await compile(srcPath, modPath, options);
      const hasBuildFile = !!sourcePaths.find(p => p.includes('build.zig'));
      const hasPackageCfgFile = !!sourcePaths.find(p => p.includes('build.zig.zon'));
      expect(hasBuildFile).to.be.true;
      expect(hasPackageCfgFile).to.be.true;
    })
    it('should begin deleting files from build directory when it becomes too large', async function() {
      this.timeout(0);
      const srcPath = absolute('./zig-samples/basic/integers.zig');
      const buildDir = join(tmpdir(), 'zigar-build-test-removal');
      const options = { 
        optimize: 'Debug', 
        platform: os.platform(), 
        arch: os.arch(),
        buildDir,
      };
      const modPath = getModuleCachePath(srcPath, options);
      await compile(srcPath, modPath, options);
      await compile(srcPath, modPath, { ...options, buildDirSize: 0 });
      // wait for removal of directories
      await delay(500);
      const names = await readdir(buildDir);
      expect(names).to.have.lengthOf(0);
    })
  })
})

function absolute(relpath) {
  return fileURLToPath(new URL(relpath, import.meta.url));
}
