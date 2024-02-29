import { expect } from 'chai';
import { execSync } from 'child_process';
import os from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createConfig } from '../../zigar-compiler/src/compiler.js';

import cjs from '../dist/index.cjs';

import {
  buildAddOn,
  getGCStatistics,
  importModule,
} from '../dist/index.js';

describe('Addon functionalities', function() {
  describe('Addon compilation', function() {
    const addonDir = fileURLToPath(new URL('./addon-results', import.meta.url));
    it('should build addon for Windows', function() {
      this.timeout(300000);
      const addonPath = join(addonDir, 'win32.x64.node');
      buildAddOn(addonPath, { platform: 'win32', arch: 'x64' });
    })
    it('should build addon for Windows-ia32', function() {
      this.timeout(300000);
      const addonPath = join(addonDir, 'win32.ia32.node');
      buildAddOn(addonPath, { platform: 'win32', arch: 'ia32' });
    })
    it('should build addon for MacOS', function() {
      this.timeout(300000);
      const addonPath = join(addonDir, 'win32.arm64.node');
      buildAddOn(addonPath, { platform: 'darwin', arch: 'arm64' });
    })
    it('should build addon for MacOS-x64', function() {
      this.timeout(300000);
      const addonPath = join(addonDir, 'win32.x64.node');
      buildAddOn(addonPath, { platform: 'darwin', arch: 'x64' });
    })
    it('should build addon for Linux', function() {
      this.timeout(300000);
      const addonPath = join(addonDir, 'linux.x64.node');
      buildAddOn(addonPath, { platform: 'linux', arch: 'x64' });
    })
    it('should build addon for Linux-musl', function() {
      this.timeout(300000);
      const addonPath = join(addonDir, 'linux-musl.x64.node');
      buildAddOn(addonPath, { platform: 'linux-musl', arch: 'x64' });
    })
    it('should try to compile for unknown architecture', function() {
      this.timeout(300000);
      const addonPath = join(addonDir, 'win32.xxx.node');
      expect(() => buildAddOn(addonPath, { platform: 'win32', arch: 'xxx' })).to.throw(Error);
    })
  })
  describe('Addon compilation using CJS function', function() {
    const addonDir = fileURLToPath(new URL('./addon-results', import.meta.url));
    it('should build addon for Linux', function() {
      this.timeout(300000);
      const addonPath = join(addonDir, 'linux.x64.node');
      cjs.buildAddOn(addonPath, { platform: 'linux', arch: 'x64' });
    })
    it('should build addon for Linux-musl', function() {
      this.timeout(300000);
      const addonPath = join(addonDir, 'linux-musl.x64.node');
      cjs.buildAddOn(addonPath, { platform: 'linux-musl', arch: 'x64' });
    }) 
    it('should try to compile for unknown architecture', function() {
      this.timeout(300000);
      const addonPath = join(addonDir, 'win32.xxx.node');
      expect(() => cjs.buildAddOn(addonPath, { platform: 'win32', arch: 'xxx' })).to.throw(Error);
    })
  })
  describe('Module loading', function() {
    const sampleDir = fileURLToPath(new URL('./sample-modules', import.meta.url));
    const addonDir = join(sampleDir, 'node-zigar-addon');
    after(() => execSync(`rm -rf '${addonDir}'`))
    const options = {
      arch: os.arch(),
      platform: os.platform(),
    };
    const getModulePath = (name) => {
      const modPath = join(sampleDir, `${name}.zigar`);
      const { outputPath } = createConfig(null, modPath, options);
      return outputPath;
    };
    it('should load module', function() {
      this.timeout(300000);
      const path = getModulePath('integers');
      const module = importModule(path, addonDir);
      expect(module.int32).to.equal(1234);
    })
    it('should throw when module is missing', function() {
      this.timeout(300000);
      const path = getModulePath('missing');
      let error;
      try {
        importModule(path);
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error');
    })
    it('should get gc statistics', function() {
      const stats = getGCStatistics(addonDir);
      expect(stats).to.be.an('object');
    })
  })
  describe('Module loading using CommonJS function', function() {
    const sampleDir = fileURLToPath(new URL('./sample-modules', import.meta.url));
    const addonDir = join(sampleDir, 'node-zigar-addon');
    after(() => execSync(`rm -rf '${addonDir}'`))
    const options = {
      arch: os.arch(),
      platform: os.platform(),
    };
    const getModulePath = (name) => {
      const modPath = join(sampleDir, `${name}.zigar`);
      const { outputPath } = createConfig(null, modPath, options);
      return outputPath;
    };
    it('should load module', function() {
      this.timeout(300000);
      const path = getModulePath('integers');
      const module = cjs.importModule(path, addonDir);
      expect(module.int32).to.equal(1234);
    })
    it('should get gc statistics', function() {
      const stats = cjs.getGCStatistics(addonDir);
      expect(stats).to.be.an('object');
    })    
  })
})
