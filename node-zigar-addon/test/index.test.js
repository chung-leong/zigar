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
  const sampleDir = fileURLToPath(new URL('./sample-modules', import.meta.url));
  after(function() {
    try {
      execSync(`rm -R '${sampleDir}/addon-test'*`);
    } catch (err) {      
    }
  })
  describe('Addon compilation', function() {
    it('should build addon for Windows', function() {
      this.timeout(300000);
      const addonPath = join(sampleDir, 'addon-test1', 'windows.x64.node');
      buildAddOn(addonPath, { platform: 'windows', arch: 'x64' });
    })
    it('should build addon for MacOS', function() {
      this.timeout(300000);
      const addonPath = join(sampleDir, 'addon-test1', 'windows.arm64.node');
      buildAddOn(addonPath, { platform: 'darwin', arch: 'arm64' });
    })
    it('should build addon for Linux', function() {
      this.timeout(300000);
      const addonPath = join(sampleDir, 'addon-test1', 'linux.x64.node');
      buildAddOn(addonPath, { platform: 'linux', arch: 'x64' });
    })
    it('should build addon for Linux-musl', function() {
      this.timeout(300000);
      const addonPath = join(sampleDir, 'addon-test1', 'linux-musl.x64.node');
      buildAddOn(addonPath, { platform: 'linux-musl', arch: 'x64' });
    })
    it('should build addon for Linux using CommonJS function', function() {
      this.timeout(300000);
      const addonPath = join(sampleDir, 'addon-test3', 'linux.x64.node');
      cjs.buildAddOn(addonPath, { platform: 'linux', arch: 'x64' });
    })
    it('should build addon for Linux-musl using CommonJS function', function() {
      this.timeout(300000);
      const addonPath = join(sampleDir, 'addon-test3', 'linux-musl.x64.node');
      cjs.buildAddOn(addonPath, { platform: 'linux-musl', arch: 'x64' });
    }) 
    it('should try to compile for unknown architecture', function() {
      this.timeout(300000);
      const addonPath = join(sampleDir, 'addon-test1', 'windows.xxx.node');
      expect(() => buildAddOn(addonPath, { platform: 'windows', arch: 'xxx' })).to.throw(Error);
    })
    it('should try to compile for unknown architecture using CommonJS function', function() {
      this.timeout(300000);
      const addonPath = join(sampleDir, 'addon-test3', 'windows.xxx.node');
      expect(() => cjs.buildAddOn(addonPath, { platform: 'windows', arch: 'xxx' })).to.throw(Error);
    })
  })
  describe('Module loading', function() {
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
      const addonDir = join(sampleDir, 'addon-test2');
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
      const addonDir = join(sampleDir, 'addon-test2');
      const stats = getGCStatistics(addonDir);
      expect(stats).to.be.an('object');
    })
    it('should load module using CommonJS function', function() {
      this.timeout(300000);
      const path = getModulePath('integers');
      const addonDir = join(sampleDir, 'addon-test4');
      const module = cjs.importModule(path, addonDir);
      expect(module.int32).to.equal(1234);
    })
    it('should get gc statistics using CommonJS function', function() {
      const addonDir = join(sampleDir, 'addon-test4');
      const stats = cjs.getGCStatistics(addonDir);
      expect(stats).to.be.an('object');
    })    
  })
})
