import { expect } from 'chai';
import { execSync } from 'child_process';
import os from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createConfig } from '../../zigar-compiler/src/compilation.js';

import {
  buildAddon,
  getGCStatistics,
  getLibraryPath,
  importModule,
} from '../dist/index.cjs';

describe('Addon functionalities', function() {
  this.timeout(0);
  describe('Addon compilation', function() {
    const addonDir = fileURLToPath(new URL('./addon-results', import.meta.url));
    it('should build addon for Windows', async function() {
      await buildAddon(addonDir, { platform: 'win32', arch: 'x64' });
    })
    it('should build addon for MacOS', async function() {
      await buildAddon(addonDir, { platform: 'darwin', arch: 'arm64' });
    })
    it('should build addon for MacOS-x64', async function() {
      await buildAddon(addonDir, { platform: 'darwin', arch: 'x64' });
    })
    it('should build addon for Linux', async function() {
      let onStartCalled = false, onEndCalled = false;
      const onStart = () => onStartCalled = true;
      const onEnd = () => onEndCalled = true;
      await buildAddon(addonDir, { platform: 'linux', arch: 'x64', onStart, onEnd });
      expect(onStartCalled).to.equal(true);
      expect(onEndCalled).to.equal(true);
    })
    it('should build addon for Linux-musl', async function() {
      await buildAddon(addonDir, { platform: 'linux-musl', arch: 'x64' });
    })
    it('should try to compile for unknown architecture', async function() {
      try {
        const result = await buildAddon(addonDir, { platform: 'xxx', arch: 'xxx' });
        expect.fail('Error expected');
      } catch (err) {
      }
    })
    it('should ignore missing compiler when library file is present', async function() {
      await buildAddon(addonDir, { platform: 'linux', arch: 'x64' });
      const { changed } = await buildAddon(addonDir, { platform: 'linux', arch: 'x64', zigPath: 'zigo' });
      expect(changed).to.be.false;
    })
    it('should throw when both compiler and library file are missing', async function() {
      let failed = false;
      try {
        await buildAddon(addonDir, { platform: 'linux', arch: 'riscv64', zigPath: 'zigo' });
      } catch (err) {
        failed = true;
      }
      expect(failed).to.be.true;
    })
  })
  describe('Module loading', function() {
    const sampleDir = fileURLToPath(new URL('./sample-modules', import.meta.url));
    const addonDir = join(sampleDir, 'node-zigar-addon');
    before(async () => {
      const { outputPath } = await buildAddon(addonDir, {});
      process.env.ADDON_PATH = outputPath;
    })
    after(() => execSync(`rm -rf '${addonDir}'`))
    const options = {
      arch: os.arch(),
      platform: os.platform(),
    };
    const getModulePath = async (name) => {
      const modPath = join(sampleDir, `${name}.zigar`);
      const { outputPath } = await createConfig(null, modPath, options);
      return outputPath;
    };
    describe('importModule', function() {
      it('should load module', async function() {
        const path = await getModulePath('integers');
        const module = importModule(path, { recompile: true });
        expect(module.int32).to.equal(1234);
      })
      it('should throw when module is missing', async function() {
        const path = await getModulePath('missing');
        let error;
        try {
          importModule(path, { addonDir });
        } catch (err) {
          error = err;
        }
        expect(error).to.be.an('error');
      })
    })
    describe('getGCStatistics', function() {
      it('should get gc statistics', function() {
        const stats = getGCStatistics({ recompile: true });
        expect(stats).to.be.an('object');
      })
    })
    describe('getLibraryPath', function() {
      it('should return path to library', function() {
        const path = getLibraryPath();
        expect(path).to.be.a('string');
      })
    })
  })
})
