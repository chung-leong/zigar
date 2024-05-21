import { expect } from 'chai';
import { execSync } from 'child_process';
import os from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createConfig } from '../../zigar-compiler/src/compiler.js';

import {
  buildAddon,
  getGCStatistics,
  importModule,
} from '../dist/index.js';

describe('Addon functionalities', function() {
  describe('Addon compilation', function() {
    const addonDir = fileURLToPath(new URL('./addon-results', import.meta.url));
    it('should build addon for Windows', async function() {
      this.timeout(300000);
      await buildAddon(addonDir, { platform: 'win32', arch: 'x64' });
    })
    it('should build addon for MacOS', async function() {
      this.timeout(300000);
      await buildAddon(addonDir, { platform: 'darwin', arch: 'arm64' });
    })
    it('should build addon for MacOS-x64', async function() {
      this.timeout(300000);
      await buildAddon(addonDir, { platform: 'darwin', arch: 'x64' });
    })
    it('should build addon for Linux', async function() {
      this.timeout(300000);
      await buildAddon(addonDir, { platform: 'linux', arch: 'x64' });
    })
    it('should build addon for Linux-musl', async function() {
      this.timeout(300000);
      await buildAddon(addonDir, { platform: 'linux-musl', arch: 'x64' });
    })
    it('should try to compile for unknown architecture', async function() {
      this.timeout(300000);
      try {
        const result = await buildAddon(addonDir, { platform: 'win32', arch: 'xxx' });
        expect.fail('Error expected');
      } catch (err) {
      }
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
      const module = importModule(path, { addonDir, recompile: true });
      expect(module.int32).to.equal(1234);
    })
    it('should throw when module is missing', function() {
      this.timeout(300000);
      const path = getModulePath('missing');
      let error;
      try {
        importModule(path, { addonDir });
      } catch (err) {
        error = err;
      }
      expect(error).to.be.an('error');
    })
    it('should get gc statistics', function() {
      const stats = getGCStatistics({ addonDir, recompile: true });
      expect(stats).to.be.an('object');
    })
  })
})
